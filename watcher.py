import sys

sys.dont_write_bytecode = True
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import glob
import hashlib
import json
import os
import re
import subprocess
import threading
import time
import traceback
from shutil import which
from datetime import datetime
from typing import Literal, Optional, TypedDict
from pathlib import Path
from urllib import request as urllib_request

from scripts.watcher_shared import (
    acquire_lock_file,
    append_jsonl_record,
    current_head as shared_current_head,
    ensure_directories_exist,
    extract_frontmatter,
    move_file_with_retries,
    parse_token_count,
    read_task_metadata as shared_read_task_metadata,
    release_lock_file,
    resolve_cli_command,
    sanitize_task_id,
    validate_task_packet_metadata,
    worktree_fingerprint_details,
    write_lock_file,
)

INBOX_DIR = "./tasks/inbox"
REMOTE_DIR = "./tasks/remote"
RUNNING_DIR = "./tasks/running"
DONE_DIR = "./tasks/done"
BLOCKED_DIR = "./tasks/blocked"
DRIFTED_DIR = "./tasks/drifted"
REVIEW_REQUIRED_DIR = "./tasks/review-required"
ARCHIVE_DIR = "./tasks/archive"
REPORTS_DIR = "./reports"
ALERTS_DIR = "./dispatch/alerts"
LEDGER_PATH = "./dispatch/run-ledger.jsonl"
COWORK_PACKETS_DIR = "./cowork/packets"
COWORK_APPROVALS_DIR = "./cowork/approvals"
WATCHER_LOCK_PATH = "./.watcher.lock"
WATCHER_ENV_PATH = "./.watcher.env"
PROJECT_PATH = os.environ.get("ISOSER_PROJECT_PATH", str(Path(__file__).resolve().parent))
STALE_RUNNING_MINUTES = 20
RUNNING_HEARTBEAT_SECONDS = 30
MAX_AUTO_RECOVERY_ATTEMPTS = 2
REPLAN_REQUIRED_ATTEMPTS = 2
AUTO_REMEDIATION_REPEAT_THRESHOLD = 3
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
SUPERVISOR_AGENT_LABELS = {
    "inspector": "Supervisor Inspector",
    "implementer": "Supervisor Implementer",
    "verifier": "Supervisor Verifier",
}


class SupervisorRunResult(TypedDict):
    exit_code: int
    token_count: Optional[int]
    stage: Literal["implemented", "drift", "blocked", "manual-review", "supervisor-blocked", "unknown"]
    supervisor_step: Optional[Literal["inspection", "implementation", "verification"]]


class AlertRunbookResult(TypedDict, total=False):
    handled: bool
    stage: str
    status: str
    packet_path: str
    report_path: Optional[str]
    summary: Optional[str]
    next_action: Optional[str]
    runbook: str
    note: str


def ensure_directories() -> None:
    ensure_directories_exist(
        [
            INBOX_DIR,
            REMOTE_DIR,
            RUNNING_DIR,
            DONE_DIR,
            BLOCKED_DIR,
            DRIFTED_DIR,
            REVIEW_REQUIRED_DIR,
            ARCHIVE_DIR,
            REPORTS_DIR,
            ALERTS_DIR,
        ]
    )


def startup_warning_messages() -> list[str]:
    warnings: list[str] = []
    if not get_slack_webhook_url():
        warnings.append(
            "경고: SLACK_WEBHOOK_URL 이 설정되지 않아 watcher alert는 dispatch/alerts 에만 기록되고 Slack 전송은 생략됩니다."
        )
    return warnings


def get_slack_webhook_url() -> str:
    env_value = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if env_value:
        return env_value

    watcher_env_path = Path(WATCHER_ENV_PATH)
    if not watcher_env_path.exists():
        return ""

    try:
        for line in watcher_env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            name, value = stripped.split("=", 1)
            if name.strip() != "SLACK_WEBHOOK_URL":
                continue
            resolved = value.strip().strip("\"'")
            if resolved:
                return resolved
    except OSError as error:
        print(f"watcher env 파일 읽기 실패: {type(error).__name__}: {error}")

    return ""


def append_run_ledger(
    task_id: str,
    stage: str,
    *,
    status: str,
    packet_path: str,
    report_path: Optional[str] = None,
    details: Optional[dict[str, object]] = None,
) -> None:
    payload: dict[str, object] = {
        "recorded_at": datetime.now().isoformat(timespec="seconds"),
        "task_id": task_id,
        "watcher": "local",
        "stage": stage,
        "status": status,
        "packet_path": packet_path,
    }
    if report_path:
        payload["report_path"] = report_path
    if details:
        payload.update(details)
    append_jsonl_record(LEDGER_PATH, payload)


def read_run_ledger_rows() -> list[dict[str, object]]:
    if not os.path.exists(LEDGER_PATH):
        return []

    rows: list[dict[str, object]] = []
    try:
        for raw_line in Path(LEDGER_PATH).read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                rows.append(parsed)
    except OSError:
        return []
    return rows


def normalize_alert_signature_text(text: Optional[str]) -> str:
    if not text:
        return ""

    normalized = text.strip().lower().replace("\\", "/")
    normalized = re.sub(r"task-\d{4}-\d{2}-\d{2}-\d{4}[a-z0-9._-]*", "<task>", normalized)
    normalized = re.sub(r"[a-f0-9]{40}", "<sha>", normalized)
    normalized = re.sub(r"[a-f0-9]{12,39}", "<hash>", normalized)
    normalized = re.sub(r"\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2})?", "<timestamp>", normalized)
    normalized = re.sub(r"\b\d+\b", "<n>", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def compute_alert_fingerprint(*, stage: str, summary: Optional[str], next_action: Optional[str]) -> str:
    normalized_stage = normalize_alert_signature_text(stage)
    normalized_summary = normalize_alert_signature_text(summary)
    normalized_next_action = normalize_alert_signature_text(next_action)
    payload = f"{normalized_stage}|{normalized_summary}|{normalized_next_action}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def resolve_repo_path(path_value: str) -> str:
    normalized = path_value.strip().strip("`").replace("/", os.sep)
    if os.path.isabs(normalized):
        return os.path.normpath(normalized)
    return os.path.normpath(os.path.join(PROJECT_PATH, normalized.lstrip(".\\/")))


def parse_branch_and_commit_from_summary(summary: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not summary:
        return (None, None)

    branch_match = re.search(r"\(branch=([^),\s]+)\)", summary)
    commit_match = re.search(r"commit=([a-f0-9]{7,40})", summary, flags=re.IGNORECASE)
    branch = branch_match.group(1).strip() if branch_match else None
    commit = commit_match.group(1).strip() if commit_match else None
    return (branch, commit)


def apply_alert_runbook(
    *,
    task_id: str,
    stage: str,
    status: str,
    packet_path: str,
    report_path: Optional[str],
    summary: Optional[str],
    next_action: Optional[str],
) -> Optional[AlertRunbookResult]:
    if stage == "push-failed" and summary and "origin/main is not an ancestor of the task commit" in summary:
        branch, commit = parse_branch_and_commit_from_summary(summary)
        resolved_summary = "Task completed successfully. Automatic main promotion was skipped because origin/main was not a fast-forward target."
        if branch and commit:
            resolved_summary = f"Task completed and pushed to origin/{branch} at {commit}. Automatic main promotion was skipped because origin/main was not a fast-forward target."
        elif branch:
            resolved_summary = f"Task completed and pushed to origin/{branch}. Automatic main promotion was skipped because origin/main was not a fast-forward target."
        return {
            "handled": True,
            "stage": "self-healed",
            "status": "done",
            "packet_path": packet_path,
            "report_path": report_path,
            "summary": resolved_summary,
            "next_action": "No action required unless you want to inspect the result report Git Automation section.",
            "runbook": "downgrade-main-promotion-skip",
            "note": "Known non-blocking Git state was downgraded from push-failed to self-healed.",
        }

    if stage == "push-failed" and summary and "already contains the task commit" in summary:
        return {
            "handled": True,
            "stage": "self-healed",
            "status": "done",
            "packet_path": packet_path,
            "report_path": report_path,
            "summary": "Task completed successfully. The remote branch already contained the task commit, so the earlier push failure was treated as stale.",
            "next_action": "No action required unless you want to inspect the result report Git Automation section.",
            "runbook": "downgrade-stale-branch-push-failure",
            "note": "A stale push-failed state was downgraded because the remote branch already had the task commit.",
        }

    if stage == "runtime-error" and summary and "FileExistsError: Destination already exists:" in summary and "/tasks/done" in summary.replace("\\", "/"):
        source_abs = resolve_repo_path(packet_path)
        if not os.path.exists(source_abs):
            return None

        destination_match = re.search(r"Destination already exists:\s*(.+?)\s*$", summary)
        if not destination_match:
            return None
        destination_abs = resolve_repo_path(destination_match.group(1))
        if not os.path.exists(destination_abs):
            return None

        archived_path = archive_duplicate_task(source_abs, existing_stage="done")
        archived_relpath = report_relpath(archived_path)
        return {
            "handled": True,
            "stage": "self-healed",
            "status": "done",
            "packet_path": archived_relpath,
            "report_path": report_path,
            "summary": "Watcher archived a duplicate task packet because a completed task file already existed.",
            "next_action": "No action required unless you want to inspect the archived duplicate packet.",
            "runbook": "archive-duplicate-done-packet",
            "note": f"Duplicate packet archived to {archived_relpath}.",
        }

    return None


def alert_repeat_count(alert_fingerprint: str) -> int:
    if not alert_fingerprint:
        return 0

    count = 0
    for row in read_run_ledger_rows():
        if str(row.get("alert_fingerprint", "")).strip() == alert_fingerprint:
            count += 1
    return count


def remediation_task_exists(alert_fingerprint: str) -> bool:
    if not alert_fingerprint:
        return False

    fingerprint_prefix = alert_fingerprint[:12]
    queue_roots = [
        INBOX_DIR,
        REMOTE_DIR,
        RUNNING_DIR,
        DONE_DIR,
        BLOCKED_DIR,
        DRIFTED_DIR,
        REVIEW_REQUIRED_DIR,
        ARCHIVE_DIR,
    ]
    for queue_root in queue_roots:
        if not os.path.exists(queue_root):
            continue
        for packet_path in glob.glob(os.path.join(queue_root, "*.md")):
            try:
                body = Path(packet_path).read_text(encoding="utf-8")
            except OSError:
                continue
            if f"auto_remediation_fingerprint: {alert_fingerprint}" in body:
                return True
            if fingerprint_prefix in os.path.basename(packet_path):
                return True
    return False


def active_remediation_task_exists(alert_fingerprint: str) -> bool:
    if not alert_fingerprint:
        return False

    fingerprint_prefix = alert_fingerprint[:12]
    active_queue_roots = [
        INBOX_DIR,
        REMOTE_DIR,
        RUNNING_DIR,
        BLOCKED_DIR,
        DRIFTED_DIR,
        REVIEW_REQUIRED_DIR,
    ]
    for queue_root in active_queue_roots:
        if not os.path.exists(queue_root):
            continue
        for packet_path in glob.glob(os.path.join(queue_root, "*.md")):
            try:
                body = Path(packet_path).read_text(encoding="utf-8")
            except OSError:
                continue
            if f"auto_remediation_fingerprint: {alert_fingerprint}" in body:
                return True
            if fingerprint_prefix in os.path.basename(packet_path):
                return True
    return False


def build_auto_remediation_packet(
    *,
    remediation_task_id: str,
    stage: str,
    alert_fingerprint: str,
    repeat_count: int,
    summary: Optional[str],
    next_action: Optional[str],
    examples: list[dict[str, object]],
) -> str:
    lines = [
        "---",
        f"id: {remediation_task_id}",
        "status: queued",
        "type: ops",
        f"title: Repeated watcher alert auto-remediation ({stage})",
        f"planned_at: {datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"planned_against_commit: {current_head()}",
        "planned_by: watcher-auto-remediation",
        f"auto_remediation_fingerprint: {alert_fingerprint}",
        f"auto_remediation_stage: {stage}",
        f"auto_remediation_repeat_count: {repeat_count}",
        "---",
        "# Goal",
        "",
        "Resolve the root cause behind a repeated watcher alert so the same operational issue stops paging Slack.",
        "",
        "# Repeated Alert Context",
        "",
        f"- stage: `{stage}`",
        f"- fingerprint: `{alert_fingerprint}`",
        f"- repeat_count: `{repeat_count}`",
    ]
    if summary:
        lines.append(f"- latest_summary: {summary}")
    if next_action:
        lines.append(f"- latest_next_action: {next_action}")
    lines.extend(
        [
            "",
            "## Recent Examples",
            "",
        ]
    )
    for example in examples[:5]:
        example_summary = str(example.get("summary", "")).strip()
        summary_suffix = f" | {example_summary}" if example_summary else ""
        lines.append(
            f"- `{example.get('recorded_at', '')}` `{example.get('task_id', '')}` `{example.get('stage', '')}`{summary_suffix}"
        )
    lines.extend(
        [
            "",
            "# Constraints",
            "",
            "- Prefer fixing the root cause in watcher logic or alert classification before adding more retries.",
            "- Preserve existing supervisor / packet flow unless the repeated alert proves the flow is misclassified.",
            "- If the alert is noise rather than a true failure, downgrade or suppress it safely instead of hiding real failures.",
            "",
            "# Acceptance Criteria",
            "",
            "1. The repeated alert pattern is either fixed at the source or intentionally downgraded with justification.",
            "2. The watcher no longer emits the same Slack-noise alert for the same root cause under the covered scenario.",
            "3. Relevant tests cover the repeated-alert handling.",
            "4. `docs/current-state.md` and `docs/refactoring-log.md` are updated if behavior changes.",
            "",
            "# Open Questions",
            "",
            "- None.",
        ]
    )
    return "\n".join(lines) + "\n"


def enqueue_auto_remediation_task(
    *,
    stage: str,
    alert_fingerprint: str,
    repeat_count: int,
    summary: Optional[str],
    next_action: Optional[str],
) -> Optional[str]:
    actionable_stages = {"blocked", "runtime-error", "push-failed"}
    if stage not in actionable_stages:
        return None
    if repeat_count < AUTO_REMEDIATION_REPEAT_THRESHOLD:
        return None
    if remediation_task_exists(alert_fingerprint):
        return None

    examples = [
        row
        for row in read_run_ledger_rows()
        if str(row.get("alert_fingerprint", "")).strip() == alert_fingerprint
    ]
    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    fingerprint_prefix = alert_fingerprint[:12]
    remediation_task_id = f"TASK-{timestamp}-auto-remediate-{stage}-{fingerprint_prefix}"
    packet_path = os.path.join(INBOX_DIR, f"{remediation_task_id}.md")
    packet_body = build_auto_remediation_packet(
        remediation_task_id=remediation_task_id,
        stage=stage,
        alert_fingerprint=alert_fingerprint,
        repeat_count=repeat_count,
        summary=summary,
        next_action=next_action,
        examples=examples,
    )
    Path(packet_path).write_text(packet_body, encoding="utf-8")
    append_run_ledger(
        remediation_task_id,
        "auto-remediation-queued",
        status="queued",
        packet_path=packet_path.replace("\\", "/"),
        details={
            "source_alert_fingerprint": alert_fingerprint,
            "source_stage": stage,
            "source_repeat_count": repeat_count,
        },
    )
    return packet_path.replace("\\", "/")


def write_runtime_error_alert(
    *,
    task_id: str,
    packet_path: str,
    context: str,
    error: Exception,
    traceback_text: str,
) -> None:
    summary = f"{context}: {type(error).__name__}: {error}"
    write_alert(
        task_id,
        "runtime-error",
        status="action-required",
        packet_path=packet_path,
        summary=summary,
        next_action="Inspect watcher console output or traceback for the exception details. The watcher kept running.",
    )
    append_run_ledger(
        task_id,
        "runtime-error",
        status="action-required",
        packet_path=packet_path,
        details={
            "context": context,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback_text,
        },
    )


def safe_run_task_handler(
    handler,
    task_path: str,
    *,
    context: str,
    task_id: Optional[str] = None,
) -> None:
    filename = os.path.basename(task_path)
    derived_task_id = task_id or sanitize_task_id(filename.removesuffix(".md")) or "WATCHER-RUNTIME"
    try:
        handler(task_path)
    except Exception as error:
        traceback_text = traceback.format_exc()
        print(f"watcher 런타임 예외: {context} ({filename})")
        print(traceback_text, end="" if traceback_text.endswith("\n") else "\n")
        write_runtime_error_alert(
            task_id=derived_task_id,
            packet_path=task_path.replace("\\", "/"),
            context=context,
            error=error,
            traceback_text=traceback_text,
        )


def acquire_watcher_lock() -> Optional[int]:
    return acquire_lock_file(WATCHER_LOCK_PATH)


def write_watcher_lock(lock_handle: int) -> None:
    write_lock_file(lock_handle)


def release_watcher_lock(lock_handle: Optional[int]) -> None:
    release_lock_file(lock_handle, WATCHER_LOCK_PATH)


def read_task_metadata(task_path: str) -> tuple[dict[str, str], list[str], list[str]]:
    metadata, _ = shared_read_task_metadata(task_path, REQUIRED_FIELDS)
    missing_fields, validation_errors = validate_task_packet_metadata(metadata, REQUIRED_FIELDS)
    return metadata, missing_fields, validation_errors


def current_head() -> str:
    return shared_current_head(PROJECT_PATH)


TASK_FILENAME_ORDER_RE = re.compile(
    r"^TASK-(\d{4})-(\d{2})-(\d{2})-(\d{4})(?:-.+)?\.md$",
    flags=re.IGNORECASE,
)


def task_queue_sort_key(task_path: str) -> tuple[int, int, int, int, str]:
    filename = os.path.basename(task_path)
    match = TASK_FILENAME_ORDER_RE.match(filename)
    if not match:
        return (9999, 99, 99, 9999, filename.lower())
    year, month, day, slot = match.groups()
    return (int(year), int(month), int(day), int(slot), filename.lower())


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


def is_transient_git_push_error(output: str) -> bool:
    normalized = output.casefold()
    transient_markers = (
        "internal server error",
        "the requested url returned error: 500",
        "the requested url returned error: 502",
        "the requested url returned error: 503",
        "the requested url returned error: 504",
        "http 500",
        "http 502",
        "http 503",
        "http 504",
    )
    return any(marker in normalized for marker in transient_markers)


def remote_branch_contains_commit(branch: str, commit_sha: str) -> bool:
    fetch_result = run_git(["fetch", "origin", branch], check=False)
    if fetch_result.returncode != 0:
        return False

    ancestry_check = run_git(["merge-base", "--is-ancestor", commit_sha, f"origin/{branch}"], check=False)
    return ancestry_check.returncode == 0


def timing_artifact_path(task_id: str) -> str:
    return os.path.join(REPORTS_DIR, f"{task_id}-timing.json")


def record_task_timing_anchor(
    task_id: str,
    *,
    source: str,
    stage: str,
    timestamp: Optional[str] = None,
    details: Optional[dict[str, object]] = None,
) -> str:
    path = timing_artifact_path(task_id)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, object]
    if os.path.exists(path):
        try:
            payload = json.loads(Path(path).read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            payload = {}
    else:
        payload = {}

    payload.setdefault("task_id", task_id)
    payload.setdefault("version", 1)
    anchors = payload.setdefault("anchors", {})
    assert isinstance(anchors, dict)

    anchor_payload: dict[str, object] = {
        "source": source,
        "at": timestamp or datetime.now().isoformat(timespec="seconds"),
    }
    if details:
        anchor_payload["details"] = details
    anchors[stage] = anchor_payload

    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def write_report(task_id: str, suffix: str, body: str) -> str:
    report_path = os.path.join(REPORTS_DIR, f"{task_id}-{suffix}.md")
    with open(report_path, "w", encoding="utf-8") as file:
        file.write(body.rstrip() + "\n")
    return report_path


def supervisor_inspection_report_path(task_id: str) -> str:
    return os.path.join(REPORTS_DIR, f"{task_id}-supervisor-inspection.md")


def supervisor_verification_report_path(task_id: str) -> str:
    return os.path.join(REPORTS_DIR, f"{task_id}-supervisor-verification.md")


def write_docs_fast_path_verification_report(task_id: str) -> str:
    body = "\n".join(
        [
            f"# Supervisor Verification: {task_id}",
            "",
            "## Verification Summary",
            "",
            "- Docs fast-path verification completed inside the watcher.",
            "- The implementer result report exists and no new blocked/drift report was produced after implementation.",
            "",
            "## Checks Reviewed",
            "",
            "- task type is docs/doc/documentation",
            "- result report exists",
            "- lightweight docs-only checks were delegated to the implementer step",
            "",
            "## Result Report Consistency",
            "",
            "- The watcher confirmed the result report artifact exists before completion.",
            "",
            "## Residual Risks",
            "",
            "- This used the lightweight docs fast-path, so final verification relied on the implementer report plus watcher safeguards.",
            "",
            "## Final Verdict",
            "",
            "- verdict: pass",
        ]
    )
    return write_report(task_id, "supervisor-verification", body)


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
    original_stage = stage
    original_status = status
    original_packet_path = packet_path
    original_report_path = report_path
    original_summary = summary
    original_next_action = next_action
    runbook_result = apply_alert_runbook(
        task_id=task_id,
        stage=stage,
        status=status,
        packet_path=packet_path,
        report_path=report_path,
        summary=summary,
        next_action=next_action,
    )
    if runbook_result and runbook_result.get("handled"):
        stage = str(runbook_result.get("stage", stage))
        status = str(runbook_result.get("status", status))
        packet_path = str(runbook_result.get("packet_path", packet_path))
        report_path = runbook_result.get("report_path", report_path)
        summary = runbook_result.get("summary", summary)
        next_action = runbook_result.get("next_action", next_action)

    alert_path = os.path.join(ALERTS_DIR, f"{task_id}-{stage}.md")
    slack_thread_ts = slack_thread_ts_for_task(task_id)
    alert_fingerprint = compute_alert_fingerprint(
        stage=original_stage,
        summary=original_summary,
        next_action=original_next_action,
    )
    repeat_count = alert_repeat_count(alert_fingerprint) + 1
    auto_remediation_packet = None
    slack_notification = "sent"
    duplicate_alert_suppressed = False
    if not runbook_result:
        duplicate_alert_suppressed = active_remediation_task_exists(alert_fingerprint)
        auto_remediation_packet = enqueue_auto_remediation_task(
            stage=original_stage,
            alert_fingerprint=alert_fingerprint,
            repeat_count=repeat_count,
            summary=original_summary,
            next_action=original_next_action,
        )
        if duplicate_alert_suppressed:
            slack_notification = "suppressed-duplicate"
    severity = {
        "completed": "info",
        "self-healed": "info",
        "recovered": "info",
        "needs-review": "warning",
        "replan-required": "warning",
        "drift": "warning",
        "blocked": "error",
        "push-failed": "error",
        "runtime-error": "error",
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
    lines.append(f"alert_fingerprint: `{alert_fingerprint}`")
    lines.append(f"repeat_count: `{repeat_count}`")
    lines.append(f"slack_notification: `{slack_notification}`")
    if runbook_result:
        lines.append(f"self_heal_runbook: `{runbook_result.get('runbook', '')}`")
        note = str(runbook_result.get("note", "")).strip()
        if note:
            lines.append(f"self_heal_note: {note}")
    if stage != original_stage:
        lines.append(f"original_stage: `{original_stage}`")
        lines.append(f"original_status: `{original_status}`")
        lines.append(f"original_packet: `{original_packet_path}`")
        if original_report_path:
            lines.append(f"original_report: `{original_report_path}`")
    if auto_remediation_packet:
        lines.append(f"auto_remediation_packet: `{auto_remediation_packet}`")
    if slack_thread_ts:
        lines.append(f"slack_thread_ts: `{slack_thread_ts}`")

    if stage in {"completed", "push-failed", "self-healed", "blocked", "drift", "needs-review", "recovered", "runtime-error"}:
        timing_details: dict[str, object] = {"status": status}
        if summary:
            timing_details["summary"] = summary
        if original_stage != stage:
            timing_details["original_stage"] = original_stage
        record_task_timing_anchor(task_id, source="local-alert", stage=stage, details=timing_details)

    with open(alert_path, "w", encoding="utf-8") as file:
        file.write("\n".join(lines).rstrip() + "\n")

    append_run_ledger(
        task_id,
        stage,
        status=status,
        packet_path=packet_path,
        report_path=report_path,
        details={
            "summary": summary,
            "alert_fingerprint": alert_fingerprint,
            "alert_repeat_count": repeat_count,
            "auto_remediation_packet": auto_remediation_packet,
            "slack_notification": slack_notification,
            "original_stage": original_stage,
            "original_status": original_status,
            "self_heal_runbook": runbook_result.get("runbook") if runbook_result else None,
        },
    )
    if not duplicate_alert_suppressed:
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


def localize_slack_operator_text(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None

    localized = text
    replacements = [
        ("Codex stopped because of repository drift.", "Codex가 저장소 드리프트 때문에 중단되었습니다."),
        (
            "Codex stopped because the task packet no longer matched the current repository state.",
            "Codex가 task packet과 현재 저장소 상태가 더 이상 맞지 않아 중단되었습니다.",
        ),
        ("Regenerate the packet.", "packet을 다시 생성하세요."),
        ("Regenerate the task packet against current HEAD.", "현재 HEAD 기준으로 task packet을 다시 생성하세요."),
        ("This task has stopped repeatedly and now needs a stronger replan.", "이 task는 반복 중단되어 더 강한 재설계가 필요합니다."),
        ("Replan the packet before requeueing.", "재큐잉 전에 packet을 다시 설계하세요."),
        ("Watcher git sync failed.", "watcher의 Git 동기화에 실패했습니다."),
        ("Task completed successfully.", "작업이 정상 완료되었습니다."),
        ("No action required unless you want to inspect the result report.", "결과 리포트를 추가로 확인할 계획이 아니라면 별도 조치는 필요하지 않습니다."),
        ("No manual action required unless the retried task fails again.", "재시도한 task가 다시 실패하지 않는 한 수동 조치는 필요하지 않습니다."),
        ("Watcher refreshed the drift task packet and requeued it for another implementation run.", "watcher가 drift task packet을 갱신해 다시 구현 큐에 넣었습니다."),
        ("Watcher refreshed the blocked task packet and requeued it for another implementation run.", "watcher가 blocked task packet을 갱신해 다시 구현 큐에 넣었습니다."),
        (
            "Task completed successfully. Automatic main promotion was skipped because origin/main was not a fast-forward target.",
            "작업은 정상 완료되었고 origin/main 자동 반영은 fast-forward 대상이 아니라 건너뛰었습니다.",
        ),
        (
            "Watcher archived a duplicate task packet because a completed task file already existed.",
            "이미 완료된 task 파일이 있어 watcher가 중복 task packet을 자동 보관했습니다.",
        ),
        (
            "No action required unless you want to inspect the archived duplicate packet.",
            "보관된 중복 packet을 확인할 계획이 아니라면 별도 조치는 필요하지 않습니다.",
        ),
        (
            "No action required unless you want to inspect the result report Git Automation section.",
            "결과 리포트의 Git Automation 섹션을 확인할 계획이 아니라면 별도 조치는 필요하지 않습니다.",
        ),
        ("Watcher could not move the task packet into running.", "watcher가 task packet을 running으로 옮기지 못했습니다."),
        ("Clear any editor or sync lock on the task file, then requeue it.", "task 파일의 에디터 또는 동기화 잠금을 해제한 뒤 다시 큐에 넣으세요."),
        ("Task packet is missing required frontmatter fields.", "task packet에 필수 frontmatter 필드가 빠져 있습니다."),
        ("Fill the missing frontmatter fields and resubmit the task packet.", "누락된 frontmatter 필드를 채운 뒤 task packet을 다시 제출하세요."),
        ("Task packet fingerprint no longer matches the current worktree.", "task packet fingerprint가 현재 worktree와 더 이상 일치하지 않습니다."),
        (
            "Refresh planned_files/planned_worktree_fingerprint against the current worktree, then requeue the task.",
            "현재 worktree 기준으로 planned_files/planned_worktree_fingerprint를 갱신한 뒤 task를 다시 큐에 넣으세요.",
        ),
        ("Watcher failed before Codex completed.", "Codex가 끝나기 전에 watcher 단계에서 실패했습니다."),
        ("Inspect the blocked report and watcher exception before retrying the task.", "task를 다시 시도하기 전에 blocked report와 watcher 예외를 확인하세요."),
        ("Review the result report Git Automation section and push manually if needed.", "결과 리포트의 Git Automation 섹션을 확인하고 필요하면 수동으로 push 하세요."),
        ("Codex stopped with a blocked report.", "Codex가 blocked report를 남기고 중단되었습니다."),
        ("Read the blocked report, fix the issue, and requeue the task when ready.", "blocked report를 읽고 문제를 해결한 뒤 준비되면 task를 다시 큐에 넣으세요."),
        ("Inspect the watcher output and recreate the task or report before retrying.", "watcher 출력을 확인하고 task 또는 report를 정비한 뒤 다시 시도하세요."),
        ("Stale running task was auto-blocked by the watcher.", "오래된 running task가 watcher에 의해 자동 차단되었습니다."),
        ("Review the blocked report and requeue the task only after confirming the previous run is no longer active.", "이전 실행이 끝난 것을 확인한 뒤에만 blocked report를 검토하고 task를 다시 큐에 넣으세요."),
        ("Stale running task could not be moved because the file is locked.", "파일 잠금 때문에 오래된 running task를 옮기지 못했습니다."),
        ("Clear the file lock, inspect the blocked report, and retry the task.", "파일 잠금을 해제하고 blocked report를 확인한 뒤 task를 다시 시도하세요."),
        ("Inspect watcher console output or traceback for the exception details. The watcher kept running.", "예외 상세는 watcher 콘솔 출력 또는 traceback을 확인하세요. 워처 자체는 계속 실행 중입니다."),
    ]
    for source, target in replacements:
        localized = localized.replace(source, target)

    localized = re.sub(
        r"Task completed and auto-promoted to origin/main at ([A-Za-z0-9]+)\.",
        r"작업이 완료되었고 \1 커밋으로 origin/main까지 자동 반영되었습니다.",
        localized,
    )
    localized = re.sub(
        r"Task completed and pushed to origin/([^ ]+) at ([A-Za-z0-9]+)\.",
        r"작업이 완료되었고 \2 커밋이 origin/\1 브랜치로 push 되었습니다.",
        localized,
    )
    localized = re.sub(
        r"Task failed without an explicit drift or blocked report \(exit_code=(\d+)\)\.",
        r"명시적인 drift 또는 blocked report 없이 task가 실패했습니다. (exit_code=\1)",
        localized,
    )
    localized = re.sub(
        r"Watcher git sync failed: ([A-Za-z0-9_]+): (.+)",
        r"watcher Git 동기화가 실패했습니다. (\1: \2)",
        localized,
    )
    return localized


def is_smoke_task(task_id: str) -> bool:
    normalized = (task_id or "").strip().upper()
    return normalized.startswith("TASK-TEST-")


def task_title_from_packet_path(packet_path: str) -> Optional[str]:
    packet_abs = resolve_repo_path(packet_path)
    if not os.path.exists(packet_abs):
        return None
    try:
        content = Path(packet_abs).read_text(encoding="utf-8")
    except OSError:
        return None
    metadata = extract_frontmatter(content)
    title = str(metadata.get("title", "")).strip()
    return title or None


def alert_targets_test_path(*, packet_path: str, report_path: Optional[str] = None) -> bool:
    targets = [packet_path]
    if report_path:
        targets.append(report_path)
    for target in targets:
        normalized = (target or "").replace("\\", "/").lower()
        if "/.pytest_tmp/" in normalized or normalized.startswith(".pytest_tmp/"):
            return True
    return False


def slack_alert_preview_text(*, task_id: str, stage: str, packet_path: str) -> str:
    stage_labels = {
        "completed": "개발 완료",
        "self-healed": "자동 자가복구",
        "recovered": "자동 복구",
        "needs-review": "검토 필요",
        "replan-required": "재설계 필요",
        "drift": "드리프트 감지",
        "blocked": "차단",
        "push-failed": "Git 동기화 실패",
    }
    title = task_title_from_packet_path(packet_path)
    if title:
        return f"{stage_labels.get(stage, stage)}: {task_id} | {title}"
    return f"{stage_labels.get(stage, stage)}: {task_id}"


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
    localized_summary = localize_slack_operator_text(summary) or summary
    localized_next_action = localize_slack_operator_text(next_action) or next_action

    if is_smoke_task(task_id):
        lines = [
            "🧪 watcher smoke alert",
            "",
            f"*작업*: `{task_id}`",
            f"*단계*: {stage}",
            f"*상태*: {status}",
        ]
        if localized_summary:
            lines.extend(["", f"*요약*: {localized_summary}"])
        if localized_next_action:
            lines.extend(["", f"*다음*: {localized_next_action}"])
        return "\n".join(lines)

    emoji = {
        "completed": "✅",
        "self-healed": "🛠️",
        "recovered": "🔁",
        "needs-review": "📝",
        "replan-required": "🧭",
        "drift": "⚠️",
        "blocked": "⛔",
        "push-failed": "🚨",
    }.get(stage, "ℹ️")
    stage_labels = {
        "completed": "완료",
        "self-healed": "자동 자가복구",
        "recovered": "자동 복구",
        "needs-review": "검토 필요",
        "replan-required": "재설계 필요",
        "drift": "드리프트 감지",
        "blocked": "차단",
        "push-failed": "Git 동기화 실패",
    }
    status_labels = {
        "done": "완료",
        "action-required": "조치 필요",
    }
    lines = [
        f"*작업*: `{task_id}`",
        f"*상태*: {status_labels.get(status, status)}",
    ]
    title = task_title_from_packet_path(packet_path)
    if title:
        lines.append(f"*제목*: {title}")
    lines.append(f"*단계*: {stage_labels.get(stage, stage)}")
    if stage == "runtime-error" and alert_targets_test_path(packet_path=packet_path, report_path=report_path):
        lines.append("*주의*: 테스트 경로 감지됨")
    if localized_summary:
        summary_heading = "*완료 결과*" if stage == "completed" else "*요약*"
        lines.extend(["", summary_heading, f"- {localized_summary}"])
    if localized_next_action:
        lines.extend(["", "*다음 조치*", f"- {localized_next_action}"])
    lines.extend(["", "*산출물*", f"- 패킷: `{packet_path}`"])
    if report_path:
        lines.append(f"- 리포트: `{report_path}`")
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
    localized_summary = localize_slack_operator_text(summary) or summary
    localized_next_action = localize_slack_operator_text(next_action) or next_action
    slack_thread_ts = slack_thread_ts_for_task(task_id)

    if is_smoke_task(task_id):
        smoke_lines = [
            f"*작업*: `{task_id}`",
            f"*단계*: {stage}",
            f"*상태*: {status}",
        ]
        if localized_summary:
            smoke_lines.append(f"*요약*: {localized_summary}")
        if localized_next_action:
            smoke_lines.append(f"*다음*: {localized_next_action}")
        payload: dict[str, object] = {
            "text": text,
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "\n".join(smoke_lines)},
                }
            ],
        }
        if slack_thread_ts:
            payload["thread_ts"] = slack_thread_ts
            payload["reply_broadcast"] = False
        return payload

    emoji = {
        "completed": "✅",
        "self-healed": "🛠️",
        "recovered": "🔁",
        "needs-review": "📝",
        "replan-required": "🧭",
        "drift": "⚠️",
        "blocked": "⛔",
        "push-failed": "🚨",
    }.get(stage, "ℹ️")
    stage_labels = {
        "completed": "완료",
        "self-healed": "자동 자가복구",
        "recovered": "자동 복구",
        "needs-review": "검토 필요",
        "replan-required": "재설계 필요",
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
        f"*상태*: {status_labels.get(status, status)}",
    ]
    title = task_title_from_packet_path(packet_path)
    if title:
        overview.append(f"*제목*: {title}")
    overview.append(f"*단계*: {stage_labels.get(stage, stage)}")
    if stage == "runtime-error" and alert_targets_test_path(packet_path=packet_path, report_path=report_path):
        overview.append("*주의*: 테스트 경로 감지됨")

    blocks: list[dict[str, object]] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"{stage_labels.get(stage, stage)} | {task_id}"},
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(overview)},
        },
    ]
    if localized_summary:
        blocks.append(
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{'*완료 결과*' if stage == 'completed' else '*요약*'}\n- {localized_summary}",
                },
            }
        )
    if localized_next_action:
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*다음 조치*\n- {localized_next_action}"},
            }
        )
    artifacts = [f"- 패킷: `{packet_path}`"]
    if report_path:
        artifacts.append(f"- 리포트: `{report_path}`")
    blocks.append(
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*산출물*\n" + "\n".join(artifacts)},
        }
    )
    payload = {
        "text": slack_alert_preview_text(task_id=task_id, stage=stage, packet_path=packet_path),
        "blocks": blocks,
    }
    if slack_thread_ts:
        payload["thread_ts"] = slack_thread_ts
        payload["reply_broadcast"] = False
    return payload


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
    webhook_url = get_slack_webhook_url()
    if not webhook_url:
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
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            response.read()
    except Exception as error:
        print(f"Slack alert 전송 실패: {type(error).__name__}: {error}")


def slack_thread_ts_for_task(task_id: str) -> str:
    approval_path = os.path.join(COWORK_APPROVALS_DIR, f"{task_id}.ok")
    if not os.path.exists(approval_path):
        return ""

    try:
        text = Path(approval_path).read_text(encoding="utf-8")
    except OSError:
        return ""

    match = re.search(r"^\s*slack_message_ts\s*:\s*(.+?)\s*$", text, flags=re.IGNORECASE | re.MULTILINE)
    if not match:
        return ""
    return match.group(1).strip().strip("`")


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


def recovery_report_path(task_id: str) -> str:
    return os.path.join(REPORTS_DIR, f"{task_id}-recovery.md")


def packet_needs_recovery(task_path: str, failure_report_path: str, task_recovery_report_path: str) -> bool:
    if not os.path.exists(failure_report_path):
        return False
    if not os.path.exists(task_recovery_report_path):
        return True
    recovery_mtime = os.path.getmtime(task_recovery_report_path)
    return recovery_mtime < max(os.path.getmtime(task_path), os.path.getmtime(failure_report_path))


def auto_recovery_attempts(task_path: str) -> int:
    metadata, _, _ = read_task_metadata(task_path)
    raw_value = metadata.get("auto_recovery_attempts", "").strip()
    if not raw_value:
        return 0
    try:
        return max(0, int(raw_value))
    except ValueError:
        return 0


def cowork_packet_path(task_id: str) -> str:
    return os.path.join(COWORK_PACKETS_DIR, f"{task_id}.md")


def manual_review_dispatch_path(task_id: str, *, stage: str = "needs-review") -> str:
    return os.path.join(ALERTS_DIR, f"{task_id}-{stage}.md")


def build_manual_review_packet(
    task_path: str,
    *,
    failure_stage: str,
    task_id: str,
    reviewer_action: str = "update the packet or provide approval/feedback before requeueing",
    replan_required: bool = False,
) -> str:
    task_body = Path(task_path).read_text(encoding="utf-8").rstrip()
    report_lines = [
        "",
        "## Auto Recovery Context",
        "",
        f"- source_task: `tasks/{'drifted' if failure_stage == 'drift' else 'blocked'}/{os.path.basename(task_path)}`",
        f"- failure_stage: `{failure_stage}`",
        f"- failure_report: `reports/{task_id}-{failure_stage}.md`",
        f"- recovery_report: `reports/{task_id}-recovery.md`",
        f"- reviewer_action: {reviewer_action}",
    ]
    if replan_required:
        report_lines.extend(
            [
                "",
                "## Replan Checklist",
                "",
                "- clarify external/runtime prerequisites before requeueing",
                "- narrow scope to repository-executable work only",
                "- refresh acceptance criteria so they match the current code paths",
                "- split follow-up work if one packet still mixes infrastructure, runtime ops, and product changes",
            ]
        )
    return task_body + "\n" + "\n".join(report_lines) + "\n"


def escalate_task_for_manual_review(
    task_path: str,
    *,
    failure_stage: str,
    reason: str,
    stage: str = "needs-review",
    reviewer_action: str = "update the packet or provide approval/feedback before requeueing",
    report_path_override: Optional[str] = None,
    source_stage_override: Optional[str] = None,
) -> None:
    filename = os.path.basename(task_path)
    task_id = sanitize_task_id(filename.removesuffix(".md"))
    cowork_packet = cowork_packet_path(task_id)
    dispatch_path = manual_review_dispatch_path(task_id, stage=stage)
    review_report_path = report_path_override or recovery_report_path(task_id)
    source_stage = source_stage_override or ("drifted" if failure_stage == "drift" else "blocked")
    desired_packet_body = build_manual_review_packet(
        task_path,
        failure_stage=failure_stage,
        task_id=task_id,
        reviewer_action=reviewer_action,
        replan_required=stage == "replan-required",
    )

    existing_body = None
    if os.path.exists(cowork_packet):
        existing_body = Path(cowork_packet).read_text(encoding="utf-8")
    if existing_body != desired_packet_body:
        write_report_path = cowork_packet
        Path(os.path.dirname(write_report_path)).mkdir(parents=True, exist_ok=True)
        Path(write_report_path).write_text(desired_packet_body, encoding="utf-8")

    should_write_alert = True
    if os.path.exists(dispatch_path):
        alert_mtime = os.path.getmtime(dispatch_path)
        refresh_sources = [os.path.getmtime(task_path)]
        if os.path.exists(review_report_path):
            refresh_sources.append(os.path.getmtime(review_report_path))
        if os.path.exists(cowork_packet):
            refresh_sources.append(os.path.getmtime(cowork_packet))
        should_write_alert = alert_mtime < max(refresh_sources)

    if not should_write_alert:
        return

    write_alert(
        task_id,
        stage,
        status="action-required",
        packet_path=f"tasks/{source_stage}/{filename}",
        report_path=review_report_path.replace("\\", "/"),
        summary=reason,
        next_action=(
            f"Review `cowork/packets/{task_id}.md`, wait for the cowork review-ready alert, then approve or reject it in Slack "
            f"or with `/isoser-approve {task_id} inbox`."
        ),
    )


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


def parse_supervisor_verdict(report_path: str) -> Optional[str]:
    if not os.path.exists(report_path):
        return None

    text = Path(report_path).read_text(encoding="utf-8")
    match = re.search(r"^\s*-\s*verdict:\s*(pass|review-required)\s*$", text, flags=re.IGNORECASE | re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip().lower()


def path_is_stageable(path_rel: str) -> bool:
    path_abs = os.path.join(PROJECT_PATH, path_rel.replace("/", os.sep))
    if os.path.exists(path_abs):
        return True
    tracked = run_git(["ls-files", "--error-unmatch", "--", path_rel], check=False)
    return tracked.returncode == 0


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
    inspection_report = supervisor_inspection_report_path(task_id)
    verification_report = supervisor_verification_report_path(task_id)
    if os.path.exists(inspection_report):
        stage_targets.append(os.path.relpath(inspection_report, PROJECT_PATH).replace("\\", "/"))
    if os.path.exists(verification_report):
        stage_targets.append(os.path.relpath(verification_report, PROJECT_PATH).replace("\\", "/"))

    # Stage only task-specific paths so unrelated worktree changes are not swept in.
    unique_targets = [target for target in dict.fromkeys(stage_targets) if path_is_stageable(target)]
    if not unique_targets:
        append_git_metadata(
            result_report,
            status="skipped",
            branch=branch,
            message="No stageable task-specific paths were detected after watcher finalization.",
        )
        return ("skipped", "No stageable task-specific paths were detected after watcher finalization.", branch, None)
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
    branch_push_note: Optional[str] = None
    push_result = run_git(["push", "origin", branch], check=False)
    push_output = (push_result.stdout or "") + (push_result.stderr or "")

    if push_result.returncode != 0 and is_transient_git_push_error(push_output):
        retry_result = run_git(["push", "origin", branch], check=False)
        retry_output = (retry_result.stdout or "") + (retry_result.stderr or "")
        if retry_result.returncode == 0:
            push_result = retry_result
            push_output = retry_output
        else:
            push_output = "\n".join(part for part in [push_output.strip(), retry_output.strip()] if part).strip()
            push_result = retry_result

    if push_result.returncode != 0:
        if remote_branch_contains_commit(branch, commit_sha):
            branch_push_note = (
                f"{commit_message} origin/{branch} already contains the task commit even though the watcher push returned an error."
            )
        else:
            append_git_metadata(
                result_report,
                status="push-failed",
                branch=branch,
                commit_sha=commit_sha,
                message=push_output.strip() or "git push failed",
            )
            return ("push-failed", push_output.strip() or "git push failed", branch, commit_sha)

    promotion_note: Optional[str] = None
    if branch != "main":
        fetch_main_result = run_git(["fetch", "origin", "main"], check=False)
        fetch_main_output = (fetch_main_result.stdout or "") + (fetch_main_result.stderr or "")
        if fetch_main_result.returncode != 0:
            promotion_note = (
                f"{branch_push_note or commit_message} "
                "Automatic main promotion skipped because git fetch origin main failed: "
                f"{fetch_main_output.strip() or 'git fetch origin main failed'}"
            )
        else:
            ancestry_check = run_git(["merge-base", "--is-ancestor", "origin/main", commit_sha], check=False)
            if ancestry_check.returncode != 0:
                promotion_note = (
                    f"{branch_push_note or commit_message} "
                    "Automatic main promotion skipped because origin/main is not an ancestor of the task commit."
                )
            else:
                main_push_result = run_git(["push", "origin", f"{commit_sha}:refs/heads/main"], check=False)
                main_push_output = (main_push_result.stdout or "") + (main_push_result.stderr or "")
                if main_push_result.returncode == 0:
                    append_git_metadata(
                        result_report,
                        status="merged-main",
                        branch=branch,
                        commit_sha=commit_sha,
                        message=f"{commit_message} Auto-promoted to origin/main.",
                    )
                    return ("merged-main", f"{commit_message} Auto-promoted to origin/main.", branch, commit_sha)

                promotion_note = (
                    f"{branch_push_note or commit_message} "
                    "Automatic main promotion failed but branch push succeeded: "
                    f"{main_push_output.strip() or 'git push to origin/main failed'}"
                )

    append_git_metadata(
        result_report,
        status="pushed",
        branch=branch,
        commit_sha=commit_sha,
        message=promotion_note or branch_push_note or commit_message,
    )
    return ("pushed", promotion_note or branch_push_note or commit_message, branch, commit_sha)


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

        duplicate_destinations = [
            ("blocked", os.path.join(BLOCKED_DIR, filename)),
            ("drifted", os.path.join(DRIFTED_DIR, filename)),
            ("done", os.path.join(DONE_DIR, filename)),
        ]
        duplicate_stage = next(
            (stage for stage, destination in duplicate_destinations if os.path.exists(destination)),
            None,
        )
        if duplicate_stage is not None:
            try:
                os.remove(running_path)
                print(f"running 정리됨: {filename} (현재 상태: {duplicate_stage})")
            except OSError as error:
                print(f"running 정리 실패: {filename} ({type(error).__name__}: {error})")
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


def touch_running_task(path: str) -> None:
    try:
        Path(path).touch()
    except OSError:
        # A stale-cleanup or manual move can race with the heartbeat; best effort is enough.
        pass


def start_running_heartbeat(running_path: str) -> tuple[threading.Event, threading.Thread]:
    stop_event = threading.Event()

    def heartbeat_loop() -> None:
        while not stop_event.wait(RUNNING_HEARTBEAT_SECONDS):
            touch_running_task(running_path)

    heartbeat_thread = threading.Thread(
        target=heartbeat_loop,
        name=f"watcher-heartbeat:{os.path.basename(running_path)}",
        daemon=True,
    )
    heartbeat_thread.start()
    return stop_event, heartbeat_thread


def archive_duplicate_task(task_path: str, *, existing_stage: str) -> str:
    filename = os.path.basename(task_path)
    stem, ext = os.path.splitext(filename)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    archive_name = f"{stem}-duplicate-from-{existing_stage}-{timestamp}{ext or '.md'}"
    archive_path = os.path.join(ARCHIVE_DIR, archive_name)
    move_task_file(task_path, archive_path)
    return archive_path


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
        f"If the packet contains optional planned_files or planned_worktree_fingerprint metadata, verify that those fields still match the current worktree. "
        f"If drift is significant, write reports/{task_id}-drift.md and stop. "
        f"If blocked, write reports/{task_id}-blocked.md and stop. "
        f"Otherwise make minimal safe changes and run only relevant checks, "
        f"write reports/{task_id}-result.md, update docs/current-state.md only if structure changed, "
        f"append a short note to docs/refactoring-log.md only if meaningful, "
        f"and commit/push only if the task is actually completed. "
        f"Use commit message: [codex] {task_id} 구현 완료."
    )


def build_supervisor_inspector_prompt(task_filename: str, task_id: str, task_type: str) -> str:
    inspection_report = f"reports/{task_id}-supervisor-inspection.md"
    if task_type in DOC_TASK_TYPES:
        return (
            f"Read tasks/running/{task_filename}. "
            "You are the Supervisor Inspector agent. "
            "Your job is to inspect the task packet and current docs state before any implementation work starts. "
            f"Follow these quick rules: {DOCS_QUICK_RULES} "
            f"If drift is significant, write reports/{task_id}-drift.md and stop without creating {inspection_report}. "
            f"If blocked, write reports/{task_id}-blocked.md and stop without creating {inspection_report}. "
            f"Otherwise write {inspection_report} with these sections: "
            f"`# Supervisor Inspection: {task_id}`, `## Task Summary`, `## Touched files`, `## Implementation outline`, "
            "`## Verification plan`, `## Preserved behaviors`, `## Risks`. "
            "Do not edit source files in this step. Do not write the final result report in this step."
        )
    return (
        f"Read AGENTS.md and tasks/running/{task_filename}. "
        "You are the Supervisor Inspector agent. "
        "Inspect the current repository state for this packet before any implementation starts. "
        f"Follow these quick rules: {CODE_QUICK_RULES} "
        "Compare planned_against_commit with the current HEAD and inspect the directly relevant implementation area. "
        "If optional planned_files or planned_worktree_fingerprint metadata exist, verify them against the current worktree. "
        f"If drift is significant, write reports/{task_id}-drift.md and stop without creating {inspection_report}. "
        f"If blocked, write reports/{task_id}-blocked.md and stop without creating {inspection_report}. "
        f"Otherwise write {inspection_report} with these sections: "
        f"`# Supervisor Inspection: {task_id}`, `## Task Summary`, `## Touched files`, `## Implementation outline`, "
        "`## Verification plan`, `## Preserved behaviors`, `## Risks`. "
        "Do not edit source files in this step. Do not write the final result report in this step."
    )


def build_supervisor_implementer_prompt(task_filename: str, task_id: str, task_type: str) -> str:
    inspection_report = f"reports/{task_id}-supervisor-inspection.md"
    if task_type in DOC_TASK_TYPES:
        return (
            f"Read tasks/running/{task_filename} and {inspection_report}. "
            "You are the Supervisor Implementer agent working under the watcher supervisor. "
            "Treat the inspection report as the approved handoff from the inspector agent. "
            f"Follow these quick rules: {DOCS_QUICK_RULES} "
            f"If new drift is discovered while implementing, write reports/{task_id}-drift.md and stop. "
            f"If blocked, write reports/{task_id}-blocked.md and stop. "
            "Otherwise make the smallest docs-only change, "
            f"write reports/{task_id}-result.md, update docs/current-state.md only if workflow structure changed, "
            "append to docs/refactoring-log.md only if meaningful, "
            "and include a `Changed files` section in the result report. "
            "You are responsible for implementation and result report drafting only in this step. "
            "Do not treat this step as the final verification gate."
        )
    return (
        f"Read AGENTS.md, tasks/running/{task_filename}, and {inspection_report}. "
        "You are the Supervisor Implementer agent working under the watcher supervisor. "
        "Treat the inspection report as the approved handoff from the inspector agent. "
        f"Follow these quick rules: {CODE_QUICK_RULES} "
        f"If new drift is discovered while implementing, write reports/{task_id}-drift.md and stop. "
        f"If blocked, write reports/{task_id}-blocked.md and stop. "
        "Otherwise make minimal safe changes, "
        f"write reports/{task_id}-result.md, update docs/current-state.md only if structure changed, "
        "append a short note to docs/refactoring-log.md only if meaningful, "
        "and include a `Changed files` section in the result report. "
        "You are responsible for implementation and result report drafting only in this step. "
        "Do not treat this step as the final verification gate."
    )


def build_supervisor_verifier_prompt(task_filename: str, task_id: str, task_type: str) -> str:
    inspection_report = f"reports/{task_id}-supervisor-inspection.md"
    result_report = f"reports/{task_id}-result.md"
    verification_report = f"reports/{task_id}-supervisor-verification.md"
    if task_type in DOC_TASK_TYPES:
        return (
            f"Read tasks/running/{task_filename}, {inspection_report}, and {result_report}. "
            "You are the Supervisor Verifier agent working under the watcher supervisor. "
            "This is the final verification gate. "
            f"Follow these quick rules: {DOCS_QUICK_RULES} "
            "Stay read-only except for verification artifacts. "
            f"If drift is discovered, write reports/{task_id}-drift.md and stop without creating {verification_report}. "
            f"If blocked, write reports/{task_id}-blocked.md and stop without creating {verification_report}. "
            f"Otherwise verify that the result report matches the actual docs changes and that the lightest relevant checks were run. "
            f"Then write {verification_report} with these sections: "
            f"`# Supervisor Verification: {task_id}`, `## Verification Summary`, `## Checks Reviewed`, "
            "`## Result Report Consistency`, `## Residual Risks`, `## Final Verdict`. "
            "Under `## Final Verdict` include exactly one bullet in the form `- verdict: pass` or `- verdict: review-required`. "
            "Do not edit source files in this step."
        )
    return (
        f"Read AGENTS.md, tasks/running/{task_filename}, {inspection_report}, and {result_report}. "
        "You are the Supervisor Verifier agent working under the watcher supervisor. "
        "This is the final verification gate. "
        f"Follow these quick rules: {CODE_QUICK_RULES} "
        "Stay read-only except for verification artifacts. "
        f"If drift is discovered, write reports/{task_id}-drift.md and stop without creating {verification_report}. "
        f"If blocked, write reports/{task_id}-blocked.md and stop without creating {verification_report}. "
        "Verify that the implementation matches the inspection handoff, that the result report matches the actual file changes, "
        "and that the checks recorded are sufficient for the touched area. "
        f"Then write {verification_report} with these sections: "
        f"`# Supervisor Verification: {task_id}`, `## Verification Summary`, `## Checks Reviewed`, "
        "`## Result Report Consistency`, `## Residual Risks`, `## Final Verdict`. "
        "Under `## Final Verdict` include exactly one bullet in the form `- verdict: pass` or `- verdict: review-required`. "
        "Do not edit source files in this step."
    )


def run_codex_prompt(
    prompt: str,
    *,
    label: str,
    running_path: Optional[str] = None,
) -> tuple[int, Optional[int]]:
    codex_command = resolve_codex_command()
    print(f"{label} 실행")
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
    heartbeat_stop: Optional[threading.Event] = None
    heartbeat_thread: Optional[threading.Thread] = None
    if running_path:
        heartbeat_stop, heartbeat_thread = start_running_heartbeat(running_path)

    try:
        assert process.stdout is not None
        for line in process.stdout:
            print(line, end="")
            collected_output.append(line)
    finally:
        if heartbeat_stop is not None and heartbeat_thread is not None:
            heartbeat_stop.set()
            heartbeat_thread.join(timeout=1)

    exit_code = process.wait()
    combined_output = "".join(collected_output)
    token_count = parse_token_count(combined_output)
    return exit_code, token_count


def run_codex(
    task_filename: str,
    task_id: str,
    task_type: str,
    *,
    running_path: str,
) -> tuple[int, Optional[int]]:
    prompt = build_codex_prompt(task_filename, task_id, task_type)
    return run_codex_prompt(
        prompt,
        label=f"Codex",
        running_path=running_path,
    )


def run_supervisor_workflow(
    task_filename: str,
    task_id: str,
    task_type: str,
    *,
    running_path: str,
) -> SupervisorRunResult:
    inspection_report = supervisor_inspection_report_path(task_id)
    verification_report = supervisor_verification_report_path(task_id)
    result_report = os.path.join(REPORTS_DIR, f"{task_id}-result.md")
    drift_report = os.path.join(REPORTS_DIR, f"{task_id}-drift.md")
    blocked_report = os.path.join(REPORTS_DIR, f"{task_id}-blocked.md")

    for stale_report in (inspection_report, verification_report, result_report, drift_report, blocked_report):
        if os.path.exists(stale_report):
            os.remove(stale_report)

    append_run_ledger(
        task_id,
        "supervisor-inspection",
        status="started",
        packet_path=f"tasks/running/{task_filename}",
        report_path=f"reports/{task_id}-supervisor-inspection.md",
    )
    record_task_timing_anchor(task_id, source="local-watcher", stage="supervisor-inspection-started")
    inspector_exit_code, inspector_token_count = run_codex_prompt(
        build_supervisor_inspector_prompt(task_filename, task_id, task_type),
        label=SUPERVISOR_AGENT_LABELS["inspector"],
        running_path=running_path,
    )
    total_tokens = inspector_token_count

    if os.path.exists(drift_report):
        return {"exit_code": inspector_exit_code, "token_count": total_tokens, "stage": "drift", "supervisor_step": "inspection"}
    if os.path.exists(blocked_report):
        return {"exit_code": inspector_exit_code, "token_count": total_tokens, "stage": "blocked", "supervisor_step": "inspection"}
    if inspector_exit_code != 0 or not os.path.exists(inspection_report):
        return {
            "exit_code": inspector_exit_code,
            "token_count": total_tokens,
            "stage": "supervisor-blocked",
            "supervisor_step": "inspection",
        }

    append_run_ledger(
        task_id,
        "supervisor-implementer",
        status="started",
        packet_path=f"tasks/running/{task_filename}",
        report_path=f"reports/{task_id}-result.md",
    )
    record_task_timing_anchor(task_id, source="local-watcher", stage="supervisor-implementer-started")
    implementer_exit_code, implementer_token_count = run_codex_prompt(
        build_supervisor_implementer_prompt(task_filename, task_id, task_type),
        label=SUPERVISOR_AGENT_LABELS["implementer"],
        running_path=running_path,
    )
    if total_tokens is None:
        total_tokens = implementer_token_count
    elif implementer_token_count is not None:
        total_tokens += implementer_token_count

    if os.path.exists(drift_report):
        return {
            "exit_code": implementer_exit_code,
            "token_count": total_tokens,
            "stage": "drift",
            "supervisor_step": "implementation",
        }
    if os.path.exists(blocked_report):
        return {
            "exit_code": implementer_exit_code,
            "token_count": total_tokens,
            "stage": "blocked",
            "supervisor_step": "implementation",
        }
    if implementer_exit_code != 0 or not os.path.exists(result_report):
        return {
            "exit_code": implementer_exit_code,
            "token_count": total_tokens,
            "stage": "supervisor-blocked",
            "supervisor_step": "implementation",
        }

    if task_type in DOC_TASK_TYPES:
        append_run_ledger(
            task_id,
            "supervisor-verification",
            status="started",
            packet_path=f"tasks/running/{task_filename}",
            report_path=f"reports/{task_id}-supervisor-verification.md",
            details={"mode": "docs-fast-path"},
        )
        record_task_timing_anchor(
            task_id,
            source="local-watcher",
            stage="supervisor-verification-started",
            details={"mode": "docs-fast-path"},
        )
        write_docs_fast_path_verification_report(task_id)
        return {
            "exit_code": implementer_exit_code,
            "token_count": total_tokens,
            "stage": "implemented",
            "supervisor_step": "verification",
        }

    append_run_ledger(
        task_id,
        "supervisor-verification",
        status="started",
        packet_path=f"tasks/running/{task_filename}",
        report_path=f"reports/{task_id}-supervisor-verification.md",
    )
    record_task_timing_anchor(task_id, source="local-watcher", stage="supervisor-verification-started")
    verifier_exit_code, verifier_token_count = run_codex_prompt(
        build_supervisor_verifier_prompt(task_filename, task_id, task_type),
        label=SUPERVISOR_AGENT_LABELS["verifier"],
        running_path=running_path,
    )
    if total_tokens is None:
        total_tokens = verifier_token_count
    elif verifier_token_count is not None:
        total_tokens += verifier_token_count

    if os.path.exists(drift_report):
        return {
            "exit_code": verifier_exit_code,
            "token_count": total_tokens,
            "stage": "drift",
            "supervisor_step": "verification",
        }
    if os.path.exists(blocked_report):
        return {
            "exit_code": verifier_exit_code,
            "token_count": total_tokens,
            "stage": "blocked",
            "supervisor_step": "verification",
        }
    verdict = parse_supervisor_verdict(verification_report)
    if (
        verifier_exit_code == 0
        and os.path.exists(result_report)
        and os.path.exists(verification_report)
        and verdict == "pass"
    ):
        return {
            "exit_code": verifier_exit_code,
            "token_count": total_tokens,
            "stage": "implemented",
            "supervisor_step": "verification",
        }
    if (
        verifier_exit_code == 0
        and os.path.exists(result_report)
        and os.path.exists(verification_report)
        and verdict == "review-required"
    ):
        return {
            "exit_code": verifier_exit_code,
            "token_count": total_tokens,
            "stage": "manual-review",
            "supervisor_step": "verification",
        }

    return {
        "exit_code": verifier_exit_code,
        "token_count": total_tokens,
        "stage": "supervisor-blocked",
        "supervisor_step": "verification",
    }


def build_recovery_prompt(
    task_filename: str,
    task_id: str,
    *,
    failure_stage: str,
    retry_count: int,
) -> str:
    failure_report = f"reports/{task_id}-{failure_stage}.md"
    task_path = f"tasks/{'drifted' if failure_stage == 'drift' else 'blocked'}/{task_filename}"
    next_attempt = retry_count + 1
    return (
        f"Read AGENTS.md, {task_path}, and {failure_report}. "
        "Do not touch unrelated source files. "
        "Inspect only the files directly needed to understand the failure reason and refresh the packet safely. "
        f"If the task can be retried safely without new human input, update {task_path} in place so it is ready for another watcher run: "
        "keep the original intent, narrow stale assumptions, preserve required frontmatter, set status to queued, "
        "set planned_against_commit to the current HEAD, add or update auto_recovery_attempts, "
        "If the packet already uses optional `planned_files` / `planned_worktree_fingerprint` fields, refresh them so they match the current worktree snapshot you validated. "
        f"and set auto_recovery_attempts to {next_attempt}. "
        f"Then write reports/{task_id}-recovery.md summarizing what changed in the packet and why retry is now safe. "
        "If the failure depends on missing credentials, missing approvals, ambiguous product decisions, or any other external prerequisite, "
        f"do not modify {task_path}; instead write reports/{task_id}-recovery.md explaining why automatic recovery was not safe."
    )


def run_codex_recovery(
    task_filename: str,
    task_id: str,
    *,
    failure_stage: str,
    retry_count: int,
) -> tuple[int, Optional[int]]:
    prompt = build_recovery_prompt(
        task_filename,
        task_id,
        failure_stage=failure_stage,
        retry_count=retry_count,
    )
    codex_command = resolve_codex_command()
    print(f"Codex 복구 실행: {task_filename} ({failure_stage})")
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


def handle_recovery(task_path: str, *, failure_stage: str) -> None:
    filename = os.path.basename(task_path)
    task_id = sanitize_task_id(filename.removesuffix(".md"))
    failure_report_path = os.path.join(REPORTS_DIR, f"{task_id}-{failure_stage}.md")
    task_recovery_report_path = recovery_report_path(task_id)

    if not packet_needs_recovery(task_path, failure_report_path, task_recovery_report_path):
        return

    retry_count = auto_recovery_attempts(task_path)
    if retry_count >= REPLAN_REQUIRED_ATTEMPTS:
        if os.path.exists(task_recovery_report_path):
            escalate_task_for_manual_review(
                task_path,
                failure_stage=failure_stage,
                stage="replan-required",
                reason=(
                    "This task has stopped repeatedly in drift/blocked recovery and now requires a stronger replan pass "
                    "before it can be retried safely."
                ),
                reviewer_action="replan the packet, tighten scope/acceptance, and only then approve requeueing",
            )
        print(f"재설계 필요: {filename} (auto_recovery_attempts={retry_count})")
        return

    if retry_count >= MAX_AUTO_RECOVERY_ATTEMPTS:
        if os.path.exists(task_recovery_report_path):
            escalate_task_for_manual_review(
                task_path,
                failure_stage=failure_stage,
                reason="Automatic recovery reached the retry limit and now needs human approval or packet feedback.",
            )
        print(f"복구 중단: {filename} (auto_recovery_attempts={retry_count})")
        return

    exit_code, token_count = run_codex_recovery(
        filename,
        task_id,
        failure_stage=failure_stage,
        retry_count=retry_count,
    )
    if os.path.exists(task_recovery_report_path):
        append_run_metadata(task_recovery_report_path, exit_code=exit_code, token_count=token_count)

    if exit_code != 0 or not os.path.exists(task_recovery_report_path):
        print(f"복구 실패: {filename} (exit_code={exit_code})")
        return

    metadata, missing_fields, validation_errors = read_task_metadata(task_path)
    planned_commit = metadata.get("planned_against_commit", "")
    status = metadata.get("status", "").strip().lower()
    updated_retry_count = auto_recovery_attempts(task_path)
    head_commit = current_head()

    if (
        missing_fields
        or validation_errors
        or planned_commit != head_commit
        or status != "queued"
        or updated_retry_count <= retry_count
    ):
        escalate_task_for_manual_review(
            task_path,
            failure_stage=failure_stage,
            reason="Automatic recovery determined that this task still needs human approval or feedback before it can be retried.",
        )
        print(f"복구 보류: {filename} (packet not ready for retry)")
        return

    fingerprint_details = worktree_fingerprint_details(PROJECT_PATH, metadata)
    if fingerprint_details and not bool(fingerprint_details["matches"]):
        escalate_task_for_manual_review(
            task_path,
            failure_stage=failure_stage,
            reason="Automatic recovery refreshed the packet, but its optional planned worktree fingerprint still does not match the current files.",
        )
        print(f"복구 보류: {filename} (worktree fingerprint mismatch)")
        return

    destination_path = os.path.join(INBOX_DIR, filename)
    move_task_file(task_path, destination_path)
    write_alert(
        task_id,
        "recovered",
        status="done",
        packet_path=f"tasks/inbox/{filename}",
        report_path=f"reports/{task_id}-recovery.md",
        summary=f"Watcher refreshed the {failure_stage} task packet and requeued it for another implementation run.",
        next_action="No manual action required unless the retried task fails again.",
    )
    print(f"복구 완료: {filename} -> tasks/inbox")


def handle_task(task_path: str) -> None:
    filename = os.path.basename(task_path)
    running_path = os.path.join(RUNNING_DIR, filename)
    task_id = sanitize_task_id(filename.removesuffix(".md"))

    duplicate_destinations = [
        ("running", running_path),
        ("blocked", os.path.join(BLOCKED_DIR, filename)),
        ("drifted", os.path.join(DRIFTED_DIR, filename)),
        ("review-required", os.path.join(REVIEW_REQUIRED_DIR, filename)),
        ("done", os.path.join(DONE_DIR, filename)),
    ]
    duplicate_stage = next(
        (stage for stage, destination in duplicate_destinations if os.path.exists(destination)),
        None,
    )
    if duplicate_stage is not None:
        if os.path.exists(task_path):
            try:
                metadata, _, _ = read_task_metadata(task_path)
                task_id = sanitize_task_id(metadata.get("id", task_id))
            except OSError:
                pass
        archived_path = archive_duplicate_task(task_path, existing_stage=duplicate_stage)
        append_run_ledger(
            task_id,
            "duplicate-skipped",
            status="skipped",
            packet_path=task_path.replace("\\", "/"),
            details={
                "existing_stage": duplicate_stage,
                "archived_path": archived_path.replace("\\", "/"),
            },
        )
        print(f"중복 inbox packet 보관됨: {filename} (현재 상태: {duplicate_stage})")
        return

    try:
        move_task_file(task_path, running_path)
    except (PermissionError, FileExistsError) as error:
        if os.path.exists(task_path):
            try:
                metadata, _, _ = read_task_metadata(task_path)
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

    metadata, missing_fields, validation_errors = read_task_metadata(running_path)
    task_id = sanitize_task_id(metadata.get("id", filename.removesuffix(".md")))
    append_run_ledger(
        task_id,
        "running",
        status="started",
        packet_path=f"tasks/running/{filename}",
    )
    record_task_timing_anchor(task_id, source="local-watcher", stage="running-started")
    planned_commit = metadata.get("planned_against_commit", "")
    task_type = metadata.get("type", "").strip().lower()

    if missing_fields or validation_errors:
        issue_lines = [f"- missing_fields: {', '.join(missing_fields)}"] if missing_fields else []
        issue_lines.extend(f"- validation_error: {error}" for error in validation_errors)
        write_report(
            task_id,
            "blocked",
            "\n".join(
                [
                    f"# Blocked: {task_id}",
                    "",
                    "Task packet failed watcher validation before execution.",
                    "",
                    f"- file: `tasks/running/{filename}`",
                    *issue_lines,
                ]
            ),
        )
        write_alert(
            task_id,
            "blocked",
            status="action-required",
            packet_path=f"tasks/running/{filename}",
            report_path=f"reports/{task_id}-blocked.md",
            summary="Task packet failed watcher validation before execution.",
            next_action="Fix the packet validation issues, regenerate approval if needed, and resubmit the task packet.",
        )
        blocked_path = os.path.join(BLOCKED_DIR, filename)
        move_task_file(running_path, blocked_path)
        print(f"차단됨: {filename} (packet validation 실패)")
        return

    head_commit = current_head()
    if planned_commit != head_commit:
        print(
            "경고: commit drift 감지 "
            f"(planned={planned_commit}, head={head_commit}). "
            "최종 drift 판단은 Codex가 수행합니다."
        )

    fingerprint_details = worktree_fingerprint_details(PROJECT_PATH, metadata)
    if fingerprint_details and not bool(fingerprint_details["matches"]):
        write_report(
            task_id,
            "drift",
            "\n".join(
                [
                    f"# Drift: {task_id}",
                    "",
                    "Task packet fingerprint does not match the current worktree for its planned files.",
                    "",
                    f"- file: `tasks/running/{filename}`",
                    f"- planned_files: {', '.join(f'`{path}`' for path in fingerprint_details['planned_files'])}",
                    f"- planned_worktree_fingerprint: `{fingerprint_details['planned_fingerprint']}`",
                    f"- actual_worktree_fingerprint: `{fingerprint_details['actual_fingerprint']}`",
                    "- action: refresh the packet against the current worktree or remove the stale fingerprint metadata before retrying",
                ]
            ),
        )
        drifted_path = os.path.join(DRIFTED_DIR, filename)
        move_task_file(running_path, drifted_path)
        write_alert(
            task_id,
            "drift",
            status="action-required",
            packet_path=f"tasks/drifted/{filename}",
            report_path=f"reports/{task_id}-drift.md",
            summary="Task packet fingerprint no longer matches the current worktree.",
            next_action="Refresh planned_files/planned_worktree_fingerprint against the current worktree, then requeue the task.",
        )
        print(f"드리프트 중단: {filename} (worktree fingerprint mismatch)")
        return

    try:
        supervisor_result = run_supervisor_workflow(
            filename,
            task_id,
            task_type,
            running_path=running_path,
        )
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

    exit_code = supervisor_result["exit_code"]
    token_count = supervisor_result["token_count"]
    if supervisor_result["stage"] == "supervisor-blocked":
        supervisor_step = supervisor_result.get("supervisor_step")
        if supervisor_step == "inspection":
            blocked_summary = "Supervisor inspector did not produce a reusable implementation handoff."
            expected_report = f"reports/{task_id}-supervisor-inspection.md"
        elif supervisor_step == "implementation":
            blocked_summary = "Supervisor implementer did not produce a reusable result report."
            expected_report = f"reports/{task_id}-result.md"
        else:
            blocked_summary = "Supervisor verifier did not produce a reusable verification decision."
            expected_report = f"reports/{task_id}-supervisor-verification.md"
        write_report(
            task_id,
            "blocked",
            "\n".join(
                [
                    f"# Blocked: {task_id}",
                    "",
                    blocked_summary,
                    "",
                    f"- file: `tasks/running/{filename}`",
                    f"- supervisor_step: `{supervisor_step}`",
                    f"- expected_report: `{expected_report}`",
                    f"- step_exit_code: `{exit_code}`",
                    "- action: inspect the watcher output and the failed supervisor step before retrying",
                ]
            ),
        )

    result_report = os.path.join(REPORTS_DIR, f"{task_id}-result.md")
    drift_report = os.path.join(REPORTS_DIR, f"{task_id}-drift.md")
    blocked_report = os.path.join(REPORTS_DIR, f"{task_id}-blocked.md")
    verification_report = supervisor_verification_report_path(task_id)

    if exit_code == 0 and os.path.exists(result_report):
        if supervisor_result["stage"] == "manual-review":
            if os.path.exists(verification_report):
                append_run_metadata(verification_report, exit_code=exit_code, token_count=token_count)
            review_required_path = os.path.join(REVIEW_REQUIRED_DIR, filename)
            move_task_file(running_path, review_required_path)
            escalate_task_for_manual_review(
                review_required_path,
                failure_stage="blocked",
                stage="needs-review",
                reason="Supervisor verifier requested manual review before this task can be accepted.",
                reviewer_action="review the verification findings, tighten the packet if needed, and only then approve requeueing",
                report_path_override=f"reports/{task_id}-supervisor-verification.md",
                source_stage_override="review-required",
            )
            print(f"검토 필요: {filename} (verifier requested manual review)")
            return
        append_run_metadata(result_report, exit_code=exit_code, token_count=token_count)
        done_path = os.path.join(DONE_DIR, filename)
        try:
            move_task_file(running_path, done_path)
        except FileExistsError:
            archived_path = archive_duplicate_task(running_path, existing_stage="done")
            append_run_ledger(
                task_id,
                "duplicate-completion",
                status="skipped",
                packet_path=f"tasks/running/{filename}",
                report_path=f"reports/{task_id}-result.md",
                details={"archived_path": archived_path.replace("\\", "/")},
            )
            print(f"중복 완료 packet 보관됨: {filename} (done already exists)")
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
            if git_status in {
                "push-failed",
                "commit-failed",
                "watcher-sync-failed",
                "main-fetch-failed",
                "main-push-failed",
            }:
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
                if git_status == "merged-main" and git_commit_sha:
                    summary = f"Task completed and auto-promoted to origin/main at {git_commit_sha}."
                elif git_status == "pushed" and git_branch and git_commit_sha:
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
            safe_run_task_handler(
                lambda _path: move_stale_running_tasks(),
                "__watcher_loop__",
                context="move stale running tasks",
                task_id="WATCHER-RUNTIME",
            )
            for task_file in sorted(glob.glob(f"{DRIFTED_DIR}/*.md"), key=task_queue_sort_key):
                safe_run_task_handler(
                    lambda path, stage="drift": handle_recovery(path, failure_stage=stage),
                    task_file,
                    context="handle drift recovery",
                )
            for task_file in sorted(glob.glob(f"{BLOCKED_DIR}/*.md"), key=task_queue_sort_key):
                safe_run_task_handler(
                    lambda path, stage="blocked": handle_recovery(path, failure_stage=stage),
                    task_file,
                    context="handle blocked recovery",
                )
            for task_file in sorted(glob.glob(f"{INBOX_DIR}/*.md"), key=task_queue_sort_key):
                safe_run_task_handler(
                    handle_task,
                    task_file,
                    context="handle inbox task",
                )
            time.sleep(10)
    finally:
        release_watcher_lock(lock_handle)


if __name__ == "__main__":
    main()
