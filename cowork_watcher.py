import sys

sys.dont_write_bytecode = True

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


def format_slack_dispatch_message(*, task_id: str, stage: str, lines: list[str]) -> str:
    emoji = {
        "review-ready": "📝",
        "review-failed": "🚨",
        "approval-blocked-stale-review": "⛔",
        "promoted": "✅",
    }.get(stage, "ℹ️")
    message_lines = [f"{emoji} cowork dispatch", f"task: `{task_id}`", f"stage: `{stage}`"]

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
        if any(stripped.startswith(prefix) for prefix in interesting_prefixes):
            message_lines.append(stripped)

    if stage == "review-ready":
        message_lines.append("approval: create `cowork/approvals/<task-id>.ok` after checking the latest review")
        message_lines.append(f"slack approve: `/isoser-approve {task_id} inbox` or `/isoser-approve {task_id} remote`")

    return "\n".join(message_lines)


def notify_slack_for_dispatch(*, task_id: str, stage: str, lines: list[str]) -> None:
    if not SLACK_WEBHOOK_URL:
        return

    payload = {"text": format_slack_dispatch_message(task_id=task_id, stage=stage, lines=lines)}
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
