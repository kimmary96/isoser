import sys

sys.dont_write_bytecode = True
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import glob
import json
import os
import re
import subprocess
import time
from datetime import datetime
from shutil import which
from typing import Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

from scripts.watcher_shared import (
    acquire_lock_file,
    current_head as shared_current_head,
    ensure_directories_exist,
    extract_frontmatter,
    move_file_with_retries,
    parse_token_count,
    read_markdown,
    read_task_metadata as shared_read_task_metadata,
    release_lock_file,
    resolve_cli_command,
    sanitize_task_id,
    write_lock_file,
    write_markdown,
)

COWORK_PACKETS_DIR = "./cowork/packets"
COWORK_REVIEWS_DIR = "./cowork/reviews"
COWORK_APPROVALS_DIR = "./cowork/approvals"
COWORK_DISPATCH_DIR = "./cowork/dispatch"
TASKS_INBOX_DIR = "./tasks/inbox"
TASKS_REMOTE_DIR = "./tasks/remote"
COWORK_WATCHER_LOCK_PATH = "./.cowork_watcher.lock"
PROJECT_PATH = r"D:\02_2025_AI_Lab\isoser"
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
POLL_INTERVAL_SECONDS = 10
MOVE_RETRY_ATTEMPTS = 5
MOVE_RETRY_DELAY_SECONDS = 0.5
REQUIRED_FIELDS = (
    "id",
    "status",
    "type",
    "title",
    "planned_at",
    "planned_against_commit",
)
CODEX_CANDIDATES = (
    which("codex"),
    which("codex.cmd"),
    r"C:\Users\User\AppData\Roaming\npm\codex.cmd",
    r"c:\Users\User\.vscode\extensions\openai.chatgpt-26.409.20454\bin\windows-x86_64\codex.exe",
)


def ensure_directories() -> None:
    ensure_directories_exist(
        [
            COWORK_PACKETS_DIR,
            COWORK_REVIEWS_DIR,
            COWORK_APPROVALS_DIR,
            COWORK_DISPATCH_DIR,
            TASKS_INBOX_DIR,
            TASKS_REMOTE_DIR,
        ]
    )


def startup_warning_messages() -> list[str]:
    warnings: list[str] = []
    if not SLACK_WEBHOOK_URL:
        warnings.append(
            "경고: SLACK_WEBHOOK_URL 이 설정되지 않아 cowork dispatch는 Slack 전송 없이 로컬 파일에만 기록됩니다."
        )
    return warnings


def acquire_watcher_lock() -> Optional[int]:
    return acquire_lock_file(COWORK_WATCHER_LOCK_PATH)


def write_watcher_lock(lock_handle: int) -> None:
    write_lock_file(lock_handle)


def release_watcher_lock(lock_handle: Optional[int]) -> None:
    release_lock_file(lock_handle, COWORK_WATCHER_LOCK_PATH)


def resolve_codex_command() -> str:
    return resolve_cli_command(CODEX_CANDIDATES)


def read_task_metadata(task_path: str) -> tuple[dict[str, str], list[str]]:
    return shared_read_task_metadata(task_path, REQUIRED_FIELDS)


def move_file(src: str, dst: str) -> None:
    move_file_with_retries(
        src,
        dst,
        attempts=MOVE_RETRY_ATTEMPTS,
        delay_seconds=MOVE_RETRY_DELAY_SECONDS,
        path_exists=os.path.exists,
        replace_file=os.replace,
        sleep=time.sleep,
    )


def copy_file(src: str, dst: str) -> None:
    if os.path.exists(dst):
        raise FileExistsError(f"Destination already exists: {dst}")
    write_markdown(dst, read_markdown(src))


def append_review_metadata(review_path: str, *, exit_code: int, token_count: Optional[int]) -> None:
    lines = [
        "",
        "## Review Run Metadata",
        "",
        f"- generated_at: `{datetime.now().isoformat(timespec='seconds')}`",
        f"- watcher_exit_code: `{exit_code}`",
    ]
    if token_count is not None:
        lines.append(f"- codex_tokens_used: `{token_count:,}`")

    with open(review_path, "a", encoding="utf-8") as file:
        file.write("\n".join(lines) + "\n")


def current_head() -> str:
    return shared_current_head(PROJECT_PATH)


def build_review_prompt(packet_filename: str, task_id: str) -> str:
    return (
        f"Read AGENTS.md, cowork/FOLDER_INSTRUCTIONS.md, and cowork/packets/{packet_filename}. "
        f"Do not implement code. Do not edit source files. "
        f"Review only the task packet for execution readiness against the current repository. "
        f"Check frontmatter completeness, repository path accuracy, drift risk, ambiguity, acceptance clarity, and missing references. "
        f"If needed, inspect only directly relevant local files. "
        f"Write the review to cowork/reviews/{task_id}-review.md. "
        f"Use short sections: Overall assessment, Findings, Recommendation. "
        f"If the packet is promotable with minor or no changes, say so explicitly. "
        f"If the packet is not ready, say exactly what must change before promotion. "
        f"Do not move files. Do not modify the packet."
    )


def run_codex_review(packet_filename: str, task_id: str) -> tuple[int, Optional[int]]:
    codex_command = resolve_codex_command()
    prompt = build_review_prompt(packet_filename, task_id)
    print(f"Codex review 실행: {packet_filename}")
    process = subprocess.Popen(
        [codex_command, "exec", "--full-auto", prompt],
        cwd=PROJECT_PATH,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    collected_output: list[str] = []

    assert process.stdout is not None
    for line in process.stdout:
        print(line, end="")
        collected_output.append(line)

    exit_code = process.wait()
    token_count = parse_token_count("".join(collected_output))
    return exit_code, token_count


def write_dispatch(task_id: str, stage: str, lines: list[str]) -> str:
    dispatch_path = os.path.join(COWORK_DISPATCH_DIR, f"{task_id}-{stage}.md")
    write_markdown(dispatch_path, "\n".join(lines))
    notify_slack_for_dispatch(task_id=task_id, stage=stage, lines=lines)
    return dispatch_path


def packet_title_for(task_id: str) -> Optional[str]:
    packet_path = os.path.join(COWORK_PACKETS_DIR, f"{task_id}.md")
    if not os.path.exists(packet_path):
        return None
    metadata, _ = read_task_metadata(packet_path)
    title = metadata.get("title", "").strip()
    return title or None


def review_snapshot_for(task_id: str) -> list[str]:
    review_path = review_path_for(task_id)
    if not os.path.exists(review_path):
        return []

    lines = read_markdown(review_path).splitlines()
    snapshot: list[str] = []
    capture_findings = False

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("## "):
            heading = line[3:].strip().lower()
            capture_findings = heading == "findings"
            continue
        if line.startswith("# "):
            continue

        if not snapshot:
            snapshot.append(line)
            continue

        if capture_findings and line.startswith("- "):
            snapshot.append(line)
            if len(snapshot) >= 5:
                break

    return snapshot[:5]


def localize_review_snapshot_line(line: str) -> str:
    translations = {
        "Not ready for promotion yet.": "아직 승격 준비가 되지 않았습니다.",
        "Ready for promotion.": "승격 가능한 상태입니다.",
        "- Frontmatter completeness: OK. Required fields `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit` are all present.": "- 프론트매터 필수 항목이 모두 채워져 있습니다.",
        "- Planned commit / drift: OK at repo level. Current `HEAD` matches the packet exactly.": "- planned commit 기준 드리프트는 없습니다. 현재 HEAD와 packet이 일치합니다.",
        "- Direct reference paths: mostly valid, but the packet mixes route paths and repository paths.": "- 참조 경로는 대부분 유효하지만 route 경로와 저장소 경로 표기가 혼용되어 있습니다.",
        "- `frontend/lib/types/index.ts` exists.": "- `frontend/lib/types/index.ts` 경로가 확인되었습니다.",
        "- `cowork/drafts/isoser-compare-v3.html` exists.": "- `cowork/drafts/isoser-compare-v3.html` 초안 파일이 존재합니다.",
    }
    return translations.get(line, line)


def format_slack_dispatch_message(*, task_id: str, stage: str, lines: list[str]) -> str:
    emoji = {
        "review-ready": "📝",
        "review-failed": "🚨",
        "approval-blocked-stale-review": "⛔",
        "promoted": "✅",
    }.get(stage, "ℹ️")
    stage_labels = {
        "review-ready": "검토 준비",
        "review-failed": "검토 실패",
        "approval-blocked-stale-review": "승격 보류",
        "promoted": "승격 완료",
    }
    status_labels = {
        "pending-approval": "승인 대기",
        "action-required": "조치 필요",
        "stale-review": "리뷰 재생성 필요",
    }
    message_lines = [
        f"{emoji} cowork 검토 알림",
        "",
        f"*작업*: `{task_id}`",
        f"*단계*: {stage_labels.get(stage, stage)}",
    ]
    title = packet_title_for(task_id)
    if title:
        message_lines.append(f"*제목*: {title}")

    interesting_prefixes = (
        "status:",
        "packet:",
        "review:",
        "target:",
        "approved_at:",
        "- freshness:",
        "- note:",
        "- next_step:",
    )
    for line in lines:
        stripped = line.strip()
        if not any(stripped.startswith(prefix) for prefix in interesting_prefixes):
            continue

        if stripped.startswith("status:"):
            status_value = stripped.removeprefix("status:").strip()
            message_lines.append(f"*상태*: {status_labels.get(status_value, status_value)}")
        elif stripped.startswith("packet:"):
            packet_value = stripped.removeprefix("packet:").strip()
            message_lines.extend(["", "*패킷*", packet_value])
        elif stripped.startswith("review:"):
            review_value = stripped.removeprefix("review:").strip()
            message_lines.extend(["", "*리뷰*", review_value])
        elif stripped.startswith("target:"):
            target_value = stripped.removeprefix("target:").strip().strip("`")
            target_label = "원격 큐" if target_value == "remote" else "로컬 inbox"
            message_lines.append(f"*대상 큐*: {target_label}")
        elif stripped.startswith("approved_at:"):
            approved_at = stripped.removeprefix("approved_at:").strip().strip("`")
            message_lines.append(f"*승인 시각*: `{approved_at}`")
        elif stripped.startswith("- freshness:"):
            freshness = stripped.removeprefix("- freshness:").strip()
            if freshness == "review is aligned with the current packet contents":
                freshness = "현재 packet 기준 최신 review 입니다."
            message_lines.extend(["", "*검토 상태*", freshness])
        elif stripped.startswith("- note:"):
            note = stripped.removeprefix("- note:").strip()
            if note == "packet is newer than the current review, so promotion is blocked until review is regenerated":
                note = "packet이 현재 review보다 최신이라서, review를 다시 생성하기 전에는 승격할 수 없습니다."
            elif note == "frontmatter 누락으로 자동 review가 로컬 규칙 점검만 수행함":
                note = "frontmatter 누락으로 자동 review가 로컬 규칙 점검만 수행했습니다."
            elif note == "Codex review did not create the expected review file":
                note = "Codex review가 기대한 review 파일을 만들지 못했습니다."
            elif note == "packet copied from cowork scratch space into an execution queue":
                note = "packet을 cowork scratch 공간에서 실행 큐로 복사했습니다."
            message_lines.extend(["", "*메모*", note])
        elif stripped.startswith("- next_step:"):
            next_step = stripped.removeprefix("- next_step:").strip()
            if next_step == "reviewer reads the review and creates `cowork/approvals/<task-id>.ok` when approved":
                next_step = "review 내용을 확인한 뒤 승인 가능하면 approval marker를 생성합니다."
            message_lines.extend(["", "*다음 조치*", next_step])

    if stage == "review-ready":
        review_snapshot = review_snapshot_for(task_id)
        if review_snapshot:
            message_lines.extend(["", "*리뷰 요약*"])
            for item in review_snapshot:
                message_lines.append(localize_review_snapshot_line(item))
        message_lines.extend(
            [
                "",
                "*승인 방법*",
                f"`승인` 버튼 또는 `/isoser-approve {task_id} inbox`",
                f"`원격` 버튼 또는 `/isoser-approve {task_id} remote`",
            ]
        )

    return "\n".join(message_lines)


def build_slack_dispatch_payload(*, task_id: str, stage: str, lines: list[str]) -> dict[str, object]:
    text = format_slack_dispatch_message(task_id=task_id, stage=stage, lines=lines)
    payload: dict[str, object] = {"text": text}
    stage_labels = {
        "review-ready": "검토 준비",
        "review-failed": "검토 실패",
        "approval-blocked-stale-review": "승격 보류",
        "promoted": "승격 완료",
    }
    header_text = f"{stage_labels.get(stage, stage)} | {task_id}"

    if stage != "review-ready":
        payload["blocks"] = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": header_text},
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": text,
                },
            },
        ]
        return payload

    payload["blocks"] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": header_text},
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": text,
            },
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "승인"},
                    "style": "primary",
                    "action_id": "cowork_approve_inbox",
                    "value": json.dumps({"task_id": task_id, "target": "inbox"}, ensure_ascii=True),
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "원격"},
                    "action_id": "cowork_approve_remote",
                    "value": json.dumps({"task_id": task_id, "target": "remote"}, ensure_ascii=True),
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "거절"},
                    "style": "danger",
                    "action_id": "cowork_reject",
                    "value": json.dumps({"task_id": task_id}, ensure_ascii=True),
                },
            ],
        },
    ]
    return payload


def notify_slack_for_dispatch(*, task_id: str, stage: str, lines: list[str]) -> None:
    if not SLACK_WEBHOOK_URL:
        return

    payload = build_slack_dispatch_payload(task_id=task_id, stage=stage, lines=lines)
    request = urllib_request.Request(
        SLACK_WEBHOOK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            response.read()
    except (urllib_error.URLError, TimeoutError) as error:
        print(f"Slack dispatch 전송 실패: {type(error).__name__}: {error}")


def approval_target_from_file(approval_path: str) -> str:
    try:
        text = read_markdown(approval_path)
    except OSError:
        return "inbox"

    target_match = re.search(r"^\s*target\s*:\s*(inbox|remote)\s*$", text, flags=re.IGNORECASE | re.MULTILINE)
    if not target_match:
        return "inbox"
    return target_match.group(1).lower()


def review_path_for(task_id: str) -> str:
    return os.path.join(COWORK_REVIEWS_DIR, f"{task_id}-review.md")


def approval_path_for(task_id: str) -> str:
    return os.path.join(COWORK_APPROVALS_DIR, f"{task_id}.ok")


def review_dispatch_path_for(task_id: str) -> str:
    return os.path.join(COWORK_DISPATCH_DIR, f"{task_id}-review-ready.md")


def promoted_dispatch_path_for(task_id: str) -> str:
    return os.path.join(COWORK_DISPATCH_DIR, f"{task_id}-promoted.md")


def reset_stale_promotion_state(task_id: str) -> None:
    stale_paths = [
        approval_path_for(task_id),
        promoted_dispatch_path_for(task_id),
    ]
    for stale_path in stale_paths:
        try:
            if os.path.exists(stale_path):
                os.remove(stale_path)
        except OSError:
            continue


def packet_needs_review(packet_path: str, review_path: str) -> bool:
    if not os.path.exists(review_path):
        return True
    return os.path.getmtime(packet_path) > os.path.getmtime(review_path)


def handle_packet_review(packet_path: str) -> None:
    filename = os.path.basename(packet_path)
    metadata, missing_fields = read_task_metadata(packet_path)
    task_id = sanitize_task_id(metadata.get("id", filename.removesuffix(".md")))
    review_path = review_path_for(task_id)

    if not packet_needs_review(packet_path, review_path):
        return

    if missing_fields:
        reset_stale_promotion_state(task_id)
        write_markdown(
            review_path,
            "\n".join(
                [
                    f"# Review: {task_id}",
                    "",
                    "## Overall assessment",
                    "",
                    "승격 불가입니다. 필수 frontmatter가 누락되어 있습니다.",
                    "",
                    "## Findings",
                    "",
                    f"- missing_fields: {', '.join(missing_fields)}",
                    f"- packet: `cowork/packets/{filename}`",
                    "",
                    "## Recommendation",
                    "",
                    "누락 필드를 채운 뒤 다시 review 하세요.",
                ]
            ),
        )
        write_dispatch(
            task_id,
            "review-ready",
            [
                f"# Dispatch: {task_id}",
                "",
                "stage: review-ready",
                "status: action-required",
                f"packet: `cowork/packets/{filename}`",
                f"review: `cowork/reviews/{task_id}-review.md`",
                f"created_at: `{datetime.now().isoformat(timespec='seconds')}`",
                "- freshness: review is aligned with the current packet contents",
                "- note: frontmatter 누락으로 자동 review가 로컬 규칙 점검만 수행함",
            ],
        )
        print(f"review 생성: {filename} (frontmatter 누락)")
        return

    planned_commit = metadata.get("planned_against_commit", "")
    head_commit = current_head()
    if planned_commit != head_commit:
        print(
            "경고: packet review 시 commit drift 감지 "
            f"(planned={planned_commit}, head={head_commit})"
        )

    exit_code, token_count = run_codex_review(filename, task_id)
    if os.path.exists(review_path):
        append_review_metadata(review_path, exit_code=exit_code, token_count=token_count)
        reset_stale_promotion_state(task_id)
        write_dispatch(
            task_id,
            "review-ready",
            [
                f"# Dispatch: {task_id}",
                "",
                "stage: review-ready",
                "status: pending-approval",
                f"packet: `cowork/packets/{filename}`",
                f"review: `cowork/reviews/{task_id}-review.md`",
                f"created_at: `{datetime.now().isoformat(timespec='seconds')}`",
                "- freshness: review is aligned with the current packet contents",
                "- next_step: reviewer reads the review and creates `cowork/approvals/<task-id>.ok` when approved",
            ],
        )
        print(f"review 완료: {filename}")
        return

    write_dispatch(
        task_id,
        "review-failed",
        [
            f"# Dispatch: {task_id}",
            "",
            "stage: review-failed",
            f"packet: `cowork/packets/{filename}`",
            f"created_at: `{datetime.now().isoformat(timespec='seconds')}`",
            f"- exit_code: `{exit_code}`",
            "- note: Codex review did not create the expected review file",
        ],
    )
    print(f"review 실패: {filename} (review 파일 미생성)")


def handle_approval(packet_path: str) -> None:
    filename = os.path.basename(packet_path)
    metadata, _ = read_task_metadata(packet_path)
    task_id = sanitize_task_id(metadata.get("id", filename.removesuffix(".md")))
    approval_path = approval_path_for(task_id)
    review_path = review_path_for(task_id)
    promoted_dispatch_path = promoted_dispatch_path_for(task_id)

    if not os.path.exists(approval_path) or os.path.exists(promoted_dispatch_path):
        return

    if packet_needs_review(packet_path, review_path):
        write_dispatch(
            task_id,
            "approval-blocked-stale-review",
            [
                f"# Dispatch: {task_id}",
                "",
                "stage: approval-blocked",
                "status: stale-review",
                f"packet: `cowork/packets/{filename}`",
                f"review: `cowork/reviews/{task_id}-review.md`",
                f"created_at: `{datetime.now().isoformat(timespec='seconds')}`",
                "- note: packet is newer than the current review, so promotion is blocked until review is regenerated",
            ],
        )
        print(f"승격 보류: {filename} (stale review)")
        return

    target = approval_target_from_file(approval_path)
    destination_dir = TASKS_REMOTE_DIR if target == "remote" else TASKS_INBOX_DIR
    destination_path = os.path.join(destination_dir, filename)

    copy_file(packet_path, destination_path)
    write_dispatch(
        task_id,
        "promoted",
        [
            f"# Dispatch: {task_id}",
            "",
            "stage: promoted",
            f"target: `{target}`",
            f"packet: `tasks/{target}/{filename}`",
            f"approved_at: `{datetime.now().isoformat(timespec='seconds')}`",
            "- note: packet copied from cowork scratch space into an execution queue",
        ],
    )
    print(f"승격 완료: {filename} -> tasks/{target} (copy)")


def main() -> None:
    ensure_directories()
    for warning in startup_warning_messages():
        print(warning)
    lock_handle = acquire_watcher_lock()
    if lock_handle is None:
        print("cowork watcher 중복 실행 감지됨. 기존 cowork watcher를 종료한 뒤 다시 실행하세요.")
        return

    write_watcher_lock(lock_handle)
    print("cowork watcher 시작됨. cowork/packets 감시 중...")
    try:
        while True:
            for packet_path in sorted(glob.glob(f"{COWORK_PACKETS_DIR}/*.md")):
                handle_packet_review(packet_path)

            for packet_path in sorted(glob.glob(f"{COWORK_PACKETS_DIR}/*.md")):
                handle_approval(packet_path)

            time.sleep(POLL_INTERVAL_SECONDS)
    finally:
        release_watcher_lock(lock_handle)


if __name__ == "__main__":
    main()
