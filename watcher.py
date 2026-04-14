import glob
import os
import re
import shutil
import subprocess
import time
from shutil import which
from datetime import datetime
from typing import Optional

INBOX_DIR = "./tasks/inbox"
REMOTE_DIR = "./tasks/remote"
RUNNING_DIR = "./tasks/running"
DONE_DIR = "./tasks/done"
BLOCKED_DIR = "./tasks/blocked"
REPORTS_DIR = "./reports"
PROJECT_PATH = r"D:\02_2025_AI_Lab\isoser"
STALE_RUNNING_MINUTES = 20
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
    for directory in [INBOX_DIR, REMOTE_DIR, RUNNING_DIR, DONE_DIR, BLOCKED_DIR, REPORTS_DIR]:
        os.makedirs(directory, exist_ok=True)


def extract_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}

    end_index = text.find("\n---\n", 4)
    if end_index == -1:
        return {}

    metadata: dict[str, str] = {}
    frontmatter = text[4:end_index]
    for raw_line in frontmatter.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip()
    return metadata


def read_task_metadata(task_path: str) -> tuple[dict[str, str], list[str]]:
    with open(task_path, "r", encoding="utf-8") as file:
        content = file.read()

    metadata = extract_frontmatter(content)
    missing_fields = [field for field in REQUIRED_FIELDS if not metadata.get(field)]
    return metadata, missing_fields


def sanitize_task_id(raw_value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", raw_value).strip("-")
    return cleaned or "unknown-task"


def current_head() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=PROJECT_PATH,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def write_report(task_id: str, suffix: str, body: str) -> str:
    report_path = os.path.join(REPORTS_DIR, f"{task_id}-{suffix}.md")
    with open(report_path, "w", encoding="utf-8") as file:
        file.write(body.rstrip() + "\n")
    return report_path


def parse_token_count(output: str) -> Optional[int]:
    match = re.search(r"tokens used\s+([\d,]+)", output, flags=re.IGNORECASE | re.MULTILINE)
    if not match:
        return None
    return int(match.group(1).replace(",", ""))


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
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        try:
            shutil.move(running_path, blocked_path)
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
            print(f"보류: {filename} (파일 잠금으로 stale task 이동 실패)")


def resolve_codex_command() -> str:
    for candidate in CODEX_CANDIDATES:
        if candidate and os.path.exists(candidate):
            return candidate
    raise FileNotFoundError("Unable to resolve Codex CLI executable.")


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
    result = subprocess.run(
        [codex_command, "exec", "--full-auto", prompt],
        cwd=PROJECT_PATH,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
    if result.stderr:
        print(result.stderr, end="" if result.stderr.endswith("\n") else "\n")
    token_count = parse_token_count(f"{result.stdout}\n{result.stderr}")
    return result.returncode, token_count


def handle_task(task_path: str) -> None:
    filename = os.path.basename(task_path)
    running_path = os.path.join(RUNNING_DIR, filename)

    shutil.move(task_path, running_path)
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
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        shutil.move(running_path, blocked_path)
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
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        shutil.move(running_path, blocked_path)
        print(f"차단됨: {filename} (watcher 예외 발생)")
        return

    result_report = os.path.join(REPORTS_DIR, f"{task_id}-result.md")
    drift_report = os.path.join(REPORTS_DIR, f"{task_id}-drift.md")
    blocked_report = os.path.join(REPORTS_DIR, f"{task_id}-blocked.md")

    if exit_code == 0 and os.path.exists(result_report):
        append_run_metadata(result_report, exit_code=exit_code, token_count=token_count)
        done_path = os.path.join(DONE_DIR, filename)
        shutil.move(running_path, done_path)
        print(f"완료: {filename}")
        return

    blocked_path = os.path.join(BLOCKED_DIR, filename)
    shutil.move(running_path, blocked_path)
    if os.path.exists(drift_report):
        append_run_metadata(drift_report, exit_code=exit_code, token_count=token_count)
        print(f"드리프트 중단: {filename}")
    elif os.path.exists(blocked_report):
        append_run_metadata(blocked_report, exit_code=exit_code, token_count=token_count)
        print(f"차단됨: {filename}")
    else:
        print(f"실패: {filename} (exit_code={exit_code})")


def main() -> None:
    ensure_directories()
    move_stale_running_tasks()
    print("watcher 시작됨. tasks/inbox 감시 중...")

    while True:
        move_stale_running_tasks()
        for task_file in sorted(glob.glob(f"{INBOX_DIR}/*.md")):
            handle_task(task_file)
        time.sleep(10)


if __name__ == "__main__":
    main()
