import sys

sys.dont_write_bytecode = True
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import glob
import json
import os
import subprocess
import time
from shutil import which
from datetime import datetime
from typing import Optional
from pathlib import Path
from urllib import error as urllib_error
from urllib import request as urllib_request

from scripts.watcher_shared import (
    acquire_lock_file,
    current_head as shared_current_head,
    ensure_directories_exist,
    extract_frontmatter,
    move_file_with_retries,
    parse_token_count,
    read_task_metadata as shared_read_task_metadata,
    release_lock_file,
    resolve_cli_command,
    sanitize_task_id,
    write_lock_file,
)

INBOX_DIR = "./tasks/inbox"
REMOTE_DIR = "./tasks/remote"
RUNNING_DIR = "./tasks/running"
DONE_DIR = "./tasks/done"
BLOCKED_DIR = "./tasks/blocked"
DRIFTED_DIR = "./tasks/drifted"
REPORTS_DIR = "./reports"
ALERTS_DIR = "./dispatch/alerts"
WATCHER_LOCK_PATH = "./.watcher.lock"
PROJECT_PATH = r"D:\02_2025_AI_Lab\isoser"
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
STALE_RUNNING_MINUTES = 20
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
DOC_TASK_TYPES = {"docs", "doc", "documentation"}
DOCS_QUICK_RULES = (
    "Use minimal safe edits. "
    "Stay docs-only. "
    "Inspect only files named in the task or obviously required to verify wording. "
    "Stop and write a drift report if the target wording already changed materially."
)
CODE_QUICK_RULES = (
    "Read AGENTS.md first. "
    "Use minimal safe edits. "
    "Inspect the implementation area directly relevant to the task first. "
    "Avoid broad repository searches unless local search fails."
)


def ensure_directories() -> None:
    ensure_directories_exist([INBOX_DIR, REMOTE_DIR, RUNNING_DIR, DONE_DIR, BLOCKED_DIR, DRIFTED_DIR, REPORTS_DIR, ALERTS_DIR])


def startup_warning_messages() -> list[str]:
    warnings: list[str] = []
    if not SLACK_WEBHOOK_URL:
        warnings.append(
            "경고: SLACK_WEBHOOK_URL 이 설정되지 않아 watcher alert는 dispatch/alerts 에만 기록되고 Slack 전송은 생략됩니다."
        )
    return warnings


def acquire_watcher_lock() -> Optional[int]:
    return acquire_lock_file(WATCHER_LOCK_PATH)


def write_watcher_lock(lock_handle: int) -> None:
    write_lock_file(lock_handle)


def release_watcher_lock(lock_handle: Optional[int]) -> None:
    release_lock_file(lock_handle, WATCHER_LOCK_PATH)


def read_task_metadata(task_path: str) -> tuple[dict[str, str], list[str]]:
    return shared_read_task_metadata(task_path, REQUIRED_FIELDS)


def current_head() -> str:
    return shared_current_head(PROJECT_PATH)


def current_branch() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=PROJECT_PATH,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def run_git(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=PROJECT_PATH,
        capture_output=True,
        text=True,
        check=check,
    )


def write_report(task_id: str, suffix: str, body: str) -> str:
    report_path = os.path.join(REPORTS_DIR, f"{task_id}-{suffix}.md")
    with open(report_path, "w", encoding="utf-8") as file:
        file.write(body.rstrip() + "\n")
    return report_path


def write_alert(
    task_id: str,
    stage: str,
    *,
    status: str,
    packet_path: str,
    report_path: Optional[str] = None,
    summary: Optional[str] = None,
    next_action: Optional[str] = None,
) -> str:
    alert_path = os.path.join(ALERTS_DIR, f"{task_id}-{stage}.md")
    severity = {
        "completed": "info",
        "drift": "warning",
        "blocked": "error",
        "push-failed": "error",
    }.get(stage, "info")
    lines = [
        f"# Alert: {task_id}",
        "",
        "type: watcher-alert",
        f"stage: {stage}",
        f"status: {status}",
        f"severity: {severity}",
        f"packet: `{packet_path}`",
        f"created_at: `{datetime.now().isoformat(timespec='seconds')}`",
    ]
    if report_path:
        lines.append(f"report: `{report_path}`")
    if summary:
        lines.append(f"summary: {summary}")
    if next_action:
        lines.append(f"next_action: {next_action}")

    with open(alert_path, "w", encoding="utf-8") as file:
        file.write("\n".join(lines).rstrip() + "\n")

    notify_slack_for_alert(
        task_id=task_id,
        stage=stage,
        status=status,
        packet_path=packet_path,
        report_path=report_path,
        summary=summary,
        next_action=next_action,
    )
    return alert_path


def format_slack_alert_message(
    *,
    task_id: str,
    stage: str,
    status: str,
    packet_path: str,
    report_path: Optional[str] = None,
    summary: Optional[str] = None,
    next_action: Optional[str] = None,
) -> str:
    emoji = {
        "completed": "✅",
        "drift": "⚠️",
        "blocked": "⛔",
        "push-failed": "🚨",
    }.get(stage, "ℹ️")
    stage_labels = {
        "completed": "완료",
        "drift": "드리프트 감지",
        "blocked": "차단",
        "push-failed": "Git 동기화 실패",
    }
    status_labels = {
        "done": "완료",
        "action-required": "조치 필요",
    }
    lines = [
        f"{emoji} 로컬 watcher 알림",
        "",
        f"*작업*: `{task_id}`",
        f"*단계*: {stage_labels.get(stage, stage)}",
        f"*상태*: {status_labels.get(status, status)}",
        "",
        "*패킷*",
        f"`{packet_path}`",
    ]
    if report_path:
        lines.extend(["", "*리포트*", f"`{report_path}`"])
    if summary:
        lines.extend(["", "*요약*", summary])
    if next_action:
        lines.extend(["", "*다음 조치*", next_action])
    return "\n".join(lines)


def build_slack_alert_payload(
    *,
    task_id: str,
    stage: str,
    status: str,
    packet_path: str,
    report_path: Optional[str] = None,
    summary: Optional[str] = None,
    next_action: Optional[str] = None,
) -> dict[str, object]:
    text = format_slack_alert_message(
        task_id=task_id,
        stage=stage,
        status=status,
        packet_path=packet_path,
        report_path=report_path,
        summary=summary,
        next_action=next_action,
    )
    emoji = {
        "completed": "✅",
        "drift": "⚠️",
        "blocked": "⛔",
        "push-failed": "🚨",
    }.get(stage, "ℹ️")
    stage_labels = {
        "completed": "완료",
        "drift": "드리프트 감지",
        "blocked": "차단",
        "push-failed": "Git 동기화 실패",
    }
    status_labels = {
        "done": "완료",
        "action-required": "조치 필요",
    }

    overview = [
        f"*작업*: `{task_id}`",
        f"*단계*: {stage_labels.get(stage, stage)}",
        f"*상태*: {status_labels.get(status, status)}",
        f"*패킷*: `{packet_path}`",
    ]
    if report_path:
        overview.append(f"*리포트*: `{report_path}`")

    blocks: list[dict[str, object]] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"{emoji} 로컬 watcher 알림"},
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(overview)},
        },
    ]
    if summary:
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*요약*\n{summary}"},
            }
        )
    if next_action:
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*다음 조치*\n{next_action}"},
            }
        )
    return {"text": text, "blocks": blocks}


def notify_slack_for_alert(
    *,
    task_id: str,
    stage: str,
    status: str,
    packet_path: str,
    report_path: Optional[str] = None,
    summary: Optional[str] = None,
    next_action: Optional[str] = None,
) -> None:
    if not SLACK_WEBHOOK_URL:
        return

    payload = build_slack_alert_payload(
        task_id=task_id,
        stage=stage,
        status=status,
        packet_path=packet_path,
        report_path=report_path,
        summary=summary,
        next_action=next_action,
    )
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
        print(f"Slack alert 전송 실패: {type(error).__name__}: {error}")


def append_run_metadata(
    report_path: str,
    *,
    exit_code: int,
    token_count: Optional[int],
) -> None:
    if not os.path.exists(report_path):
        return

    lines = [
        "",
        "## Run Metadata",
        "",
        f"- generated_at: `{datetime.now().isoformat(timespec='seconds')}`",
        f"- watcher_exit_code: `{exit_code}`",
    ]
    if token_count is not None:
        lines.append(f"- codex_tokens_used: `{token_count:,}`")

    with open(report_path, "a", encoding="utf-8") as file:
        file.write("\n".join(lines) + "\n")


def append_git_metadata(
    report_path: str,
    *,
    status: str,
    branch: Optional[str] = None,
    commit_sha: Optional[str] = None,
    message: Optional[str] = None,
) -> None:
    if not os.path.exists(report_path):
        return

    lines = [
        "",
        "## Git Automation",
        "",
        f"- status: `{status}`",
    ]
    if branch:
        lines.append(f"- branch: `{branch}`")
    if commit_sha:
        lines.append(f"- commit: `{commit_sha}`")
    if message:
        lines.append(f"- note: {message}")

    with open(report_path, "a", encoding="utf-8") as file:
        file.write("\n".join(lines) + "\n")


def report_relpath(path: str) -> str:
    return os.path.relpath(path, PROJECT_PATH).replace("\\", "/")


def parse_changed_files_from_result_report(report_path: str) -> list[str]:
    if not os.path.exists(report_path):
        return []

    lines = Path(report_path).read_text(encoding="utf-8").splitlines()
    in_changed_files = False
    changed_files: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped == "## Changed files":
            in_changed_files = True
            continue
        if in_changed_files and stripped.startswith("## "):
            break
        if not in_changed_files:
            continue
        if stripped.startswith("- `") and stripped.endswith("`"):
            changed_files.append(stripped[3:-1])

    return changed_files


def sync_completed_task_to_git(
    *,
    task_id: str,
    task_filename: str,
    running_path: str,
    done_path: str,
    result_report: str,
) -> tuple[str, str, Optional[str], Optional[str]]:
    branch = current_branch()
    commit_message = f"[codex] {task_id} 구현 완료."
    changed_files = parse_changed_files_from_result_report(result_report)

    stage_targets = [
        os.path.relpath(running_path, PROJECT_PATH).replace("\\", "/"),
        os.path.relpath(done_path, PROJECT_PATH).replace("\\", "/"),
        os.path.relpath(result_report, PROJECT_PATH).replace("\\", "/"),
        *changed_files,
    ]

    # Stage only task-specific paths so unrelated worktree changes are not swept in.
    unique_targets = list(dict.fromkeys(stage_targets))
    run_git(["add", "-A", "--", *unique_targets])

    staged = run_git(["diff", "--cached", "--name-only"], check=False)
    if not staged.stdout.strip():
        append_git_metadata(
            result_report,
            status="skipped",
            branch=branch,
            message="No staged task-specific changes were detected after watcher finalization.",
        )
        return ("skipped", "No staged task-specific changes were detected after watcher finalization.", branch, None)

    commit_result = run_git(["commit", "-m", commit_message], check=False)
    commit_output = (commit_result.stdout or "") + (commit_result.stderr or "")
    if commit_result.returncode != 0:
        append_git_metadata(
            result_report,
            status="commit-failed",
            branch=branch,
            message=commit_output.strip() or "git commit failed",
        )
        return ("commit-failed", commit_output.strip() or "git commit failed", branch, None)

    commit_sha = current_head()
    push_result = run_git(["push", "origin", branch], check=False)
    push_output = (push_result.stdout or "") + (push_result.stderr or "")
    if push_result.returncode != 0:
        append_git_metadata(
            result_report,
            status="push-failed",
            branch=branch,
            commit_sha=commit_sha,
            message=push_output.strip() or "git push failed",
        )
        return ("push-failed", push_output.strip() or "git push failed", branch, commit_sha)

    append_git_metadata(
        result_report,
        status="pushed",
        branch=branch,
        commit_sha=commit_sha,
        message=commit_message,
    )
    return ("pushed", commit_message, branch, commit_sha)


def move_task_file(src: str, dst: str) -> None:
    move_file_with_retries(
        src,
        dst,
        attempts=MOVE_RETRY_ATTEMPTS,
        delay_seconds=MOVE_RETRY_DELAY_SECONDS,
        path_exists=os.path.exists,
        replace_file=os.replace,
        sleep=time.sleep,
    )


def move_stale_running_tasks() -> None:
    now = time.time()
    stale_seconds = STALE_RUNNING_MINUTES * 60

    for running_path in glob.glob(f"{RUNNING_DIR}/*.md"):
        filename = os.path.basename(running_path)
        if filename == ".gitkeep":
            continue

        modified_at = os.path.getmtime(running_path)
        if now - modified_at < stale_seconds:
            continue

        task_id = sanitize_task_id(filename.removesuffix(".md"))
        write_report(
            task_id,
            "blocked",
            "\n".join(
                [
                    f"# Blocked: {task_id}",
                    "",
                    "Stale task was found in running and moved to blocked automatically.",
                    "",
                    f"- file: `tasks/running/{filename}`",
                    f"- stale_after_minutes: {STALE_RUNNING_MINUTES}",
                    f"- moved_at: `{datetime.now().isoformat(timespec='seconds')}`",
                ]
            ),
        )
        write_alert(
            task_id,
            "blocked",
            status="action-required",
            packet_path=f"tasks/running/{filename}",
            report_path=f"reports/{task_id}-blocked.md",
            summary="Stale running task was auto-blocked by the watcher.",
            next_action="Review the blocked report and requeue the task only after confirming the previous run is no longer active.",
        )
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        try:
            move_task_file(running_path, blocked_path)
            print(f"차단됨: {filename} (stale running task 자동 정리)")
        except PermissionError as error:
            write_report(
                task_id,
                "blocked",
                "\n".join(
                    [
                        f"# Blocked: {task_id}",
                        "",
                        "Stale running task could not be moved because the file is locked.",
                        "",
                        f"- file: `tasks/running/{filename}`",
                        f"- stale_after_minutes: {STALE_RUNNING_MINUTES}",
                        f"- attempted_at: `{datetime.now().isoformat(timespec='seconds')}`",
                        f"- error: `{type(error).__name__}: {error}`",
                        "- action: close any process using the file and retry",
                    ]
                ),
            )
            write_alert(
                task_id,
                "blocked",
                status="action-required",
                packet_path=f"tasks/running/{filename}",
                report_path=f"reports/{task_id}-blocked.md",
                summary="Stale running task could not be moved because the file is locked.",
                next_action="Clear the file lock, inspect the blocked report, and retry the task.",
            )
            print(f"보류: {filename} (파일 잠금으로 stale task 이동 실패)")


def resolve_codex_command() -> str:
    return resolve_cli_command(CODEX_CANDIDATES)


def build_codex_prompt(task_filename: str, task_id: str, task_type: str) -> str:
    if task_type in DOC_TASK_TYPES:
        return (
            f"Read tasks/running/{task_filename}. "
            f"Quick rules: {DOCS_QUICK_RULES} "
            f"Check planned_against_commit against the current docs state. "
            f"If drift is significant, write reports/{task_id}-drift.md and stop. "
            f"If blocked, write reports/{task_id}-blocked.md and stop. "
            f"Otherwise make the smallest docs-only change, run only the lightest relevant checks, "
            f"write reports/{task_id}-result.md, update docs/current-state.md only if workflow structure changed, "
            f"append to docs/refactoring-log.md only if meaningful, "
            f"and commit/push only if the task is actually completed. "
            f"Use commit message: [codex] {task_id} 구현 완료."
        )
    return (
        f"Read AGENTS.md and tasks/running/{task_filename}. "
        f"Quick rules: {CODE_QUICK_RULES} "
        f"Check planned_against_commit against the current codebase. "
        f"If drift is significant, write reports/{task_id}-drift.md and stop. "
        f"If blocked, write reports/{task_id}-blocked.md and stop. "
        f"Otherwise make minimal safe changes and run only relevant checks, "
        f"write reports/{task_id}-result.md, update docs/current-state.md only if structure changed, "
        f"append a short note to docs/refactoring-log.md only if meaningful, "
        f"and commit/push only if the task is actually completed. "
        f"Use commit message: [codex] {task_id} 구현 완료."
    )


def run_codex(task_filename: str, task_id: str, task_type: str) -> tuple[int, Optional[int]]:
    prompt = build_codex_prompt(task_filename, task_id, task_type)
    codex_command = resolve_codex_command()
    print(f"Codex 실행: {task_filename}")
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
    combined_output = "".join(collected_output)
    token_count = parse_token_count(combined_output)
    return exit_code, token_count


def handle_task(task_path: str) -> None:
    filename = os.path.basename(task_path)
    running_path = os.path.join(RUNNING_DIR, filename)

    try:
        move_task_file(task_path, running_path)
    except (PermissionError, FileExistsError) as error:
        task_id = sanitize_task_id(filename.removesuffix(".md"))
        if os.path.exists(task_path):
            try:
                metadata, _ = read_task_metadata(task_path)
                task_id = sanitize_task_id(metadata.get("id", task_id))
            except OSError:
                pass

        write_report(
            task_id,
            "blocked",
            "\n".join(
                [
                    f"# Blocked: {task_id}",
                    "",
                    "Watcher could not move the task packet into running.",
                    "",
                    f"- file: `tasks/inbox/{filename}`",
                    f"- attempted_destination: `tasks/running/{filename}`",
                    f"- error: `{type(error).__name__}: {error}`",
                    "- action: retry after any editor or sync lock is cleared",
                ]
            ),
        )
        write_alert(
            task_id,
            "blocked",
            status="action-required",
            packet_path=f"tasks/inbox/{filename}",
            report_path=f"reports/{task_id}-blocked.md",
            summary="Watcher could not move the task packet into running.",
            next_action="Clear any editor or sync lock on the task file, then requeue it.",
        )
        print(f"차단됨: {filename} (running 이동 실패)")
        return

    print(f"실행 시작: {filename}")

    metadata, missing_fields = read_task_metadata(running_path)
    task_id = sanitize_task_id(metadata.get("id", filename.removesuffix(".md")))
    planned_commit = metadata.get("planned_against_commit", "")
    task_type = metadata.get("type", "").strip().lower()

    if missing_fields:
        write_report(
            task_id,
            "blocked",
            "\n".join(
                [
                    f"# Blocked: {task_id}",
                    "",
                    "Task packet is missing required frontmatter fields.",
                    "",
                    f"- file: `tasks/running/{filename}`",
                    f"- missing_fields: {', '.join(missing_fields)}",
                ]
            ),
        )
        write_alert(
            task_id,
            "blocked",
            status="action-required",
            packet_path=f"tasks/running/{filename}",
            report_path=f"reports/{task_id}-blocked.md",
            summary="Task packet is missing required frontmatter fields.",
            next_action="Fill the missing frontmatter fields and resubmit the task packet.",
        )
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        move_task_file(running_path, blocked_path)
        print(f"차단됨: {filename} (frontmatter 누락)")
        return

    head_commit = current_head()
    if planned_commit != head_commit:
        print(
            "경고: commit drift 감지 "
            f"(planned={planned_commit}, head={head_commit}). "
            "최종 drift 판단은 Codex가 수행합니다."
        )

    try:
        exit_code, token_count = run_codex(filename, task_id, task_type)
    except Exception as error:
        write_report(
            task_id,
            "blocked",
            "\n".join(
                [
                    f"# Blocked: {task_id}",
                    "",
                    "Watcher failed before Codex completed.",
                    "",
                    f"- file: `tasks/running/{filename}`",
                    f"- error: `{type(error).__name__}: {error}`",
                ]
            ),
        )
        write_alert(
            task_id,
            "blocked",
            status="action-required",
            packet_path=f"tasks/running/{filename}",
            report_path=f"reports/{task_id}-blocked.md",
            summary="Watcher failed before Codex completed.",
            next_action="Inspect the blocked report and watcher exception before retrying the task.",
        )
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        move_task_file(running_path, blocked_path)
        print(f"차단됨: {filename} (watcher 예외 발생)")
        return

    result_report = os.path.join(REPORTS_DIR, f"{task_id}-result.md")
    drift_report = os.path.join(REPORTS_DIR, f"{task_id}-drift.md")
    blocked_report = os.path.join(REPORTS_DIR, f"{task_id}-blocked.md")

    if exit_code == 0 and os.path.exists(result_report):
        append_run_metadata(result_report, exit_code=exit_code, token_count=token_count)
        done_path = os.path.join(DONE_DIR, filename)
        move_task_file(running_path, done_path)
        try:
            git_status, git_message, git_branch, git_commit_sha = sync_completed_task_to_git(
                task_id=task_id,
                task_filename=filename,
                running_path=running_path,
                done_path=done_path,
                result_report=result_report,
            )
        except Exception as error:
            append_git_metadata(
                result_report,
                status="watcher-sync-failed",
                message=f"{type(error).__name__}: {error}",
            )
            write_alert(
                task_id,
                "push-failed",
                status="action-required",
                packet_path=f"tasks/done/{filename}",
                report_path=f"reports/{task_id}-result.md",
                    summary=f"Watcher git sync failed: {type(error).__name__}: {error}",
                    next_action="Review the result report Git Automation section and push manually if needed.",
                )
        else:
            if git_status in {"push-failed", "commit-failed", "watcher-sync-failed"}:
                summary = git_message
                if git_branch:
                    summary = f"{summary} (branch={git_branch})"
                if git_commit_sha:
                    summary = f"{summary}, commit={git_commit_sha}"
                write_alert(
                    task_id,
                    "push-failed",
                    status="action-required",
                    packet_path=f"tasks/done/{filename}",
                    report_path=f"reports/{task_id}-result.md",
                    summary=summary,
                    next_action="Review the result report Git Automation section and push manually if needed.",
                )
            else:
                summary = "Task completed successfully."
                if git_status == "pushed" and git_branch and git_commit_sha:
                    summary = f"Task completed and pushed to origin/{git_branch} at {git_commit_sha}."
                elif git_status == "skipped":
                    summary = "Task completed but watcher found no task-scoped staged changes to commit."
                write_alert(
                    task_id,
                    "completed",
                    status="done",
                    packet_path=f"tasks/done/{filename}",
                    report_path=f"reports/{task_id}-result.md",
                    summary=summary,
                    next_action="No action required unless you want to inspect the result report.",
                )
        print(f"완료: {filename}")
        return

    if os.path.exists(drift_report):
        drifted_path = os.path.join(DRIFTED_DIR, filename)
        move_task_file(running_path, drifted_path)
        append_run_metadata(drift_report, exit_code=exit_code, token_count=token_count)
        write_alert(
            task_id,
            "drift",
            status="action-required",
            packet_path=f"tasks/drifted/{filename}",
            report_path=f"reports/{task_id}-drift.md",
            summary="Codex stopped because the task packet no longer matched the current repository state.",
            next_action="Read the drift report, regenerate or revise the task packet against the current HEAD, then requeue it.",
        )
        print(f"드리프트 중단: {filename}")
    elif os.path.exists(blocked_report):
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        move_task_file(running_path, blocked_path)
        append_run_metadata(blocked_report, exit_code=exit_code, token_count=token_count)
        write_alert(
            task_id,
            "blocked",
            status="action-required",
            packet_path=f"tasks/blocked/{filename}",
            report_path=f"reports/{task_id}-blocked.md",
            summary="Codex stopped with a blocked report.",
            next_action="Read the blocked report, fix the issue, and requeue the task when ready.",
        )
        print(f"차단됨: {filename}")
    else:
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        move_task_file(running_path, blocked_path)
        write_alert(
            task_id,
            "blocked",
            status="action-required",
            packet_path=f"tasks/blocked/{filename}",
            summary=f"Task failed without an explicit drift or blocked report (exit_code={exit_code}).",
            next_action="Inspect the watcher output and recreate the task or report before retrying.",
        )
        print(f"실패: {filename} (exit_code={exit_code})")


def main() -> None:
    ensure_directories()
    lock_handle = acquire_watcher_lock()
    if lock_handle is None:
        print("watcher 중복 실행 감지됨. 기존 watcher를 종료한 뒤 다시 실행하세요.")
        return

    write_watcher_lock(lock_handle)
    move_stale_running_tasks()
    for warning in startup_warning_messages():
        print(warning)
    print("watcher 시작됨. tasks/inbox 감시 중...")
    try:
        while True:
            move_stale_running_tasks()
            for task_file in sorted(glob.glob(f"{INBOX_DIR}/*.md")):
                handle_task(task_file)
            time.sleep(10)
    finally:
        release_watcher_lock(lock_handle)


if __name__ == "__main__":
    main()
