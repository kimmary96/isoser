from __future__ import annotations

import json
import subprocess
from pathlib import Path

from scripts import watcher_shared


def test_acquire_lock_file_reclaims_stale_lock(tmp_path: Path, monkeypatch) -> None:
    lock_path = tmp_path / ".watcher.lock"
    lock_path.write_text("pid=999999\nstarted_at=2026-04-15T10:00:00\n", encoding="utf-8")

    monkeypatch.setattr(watcher_shared, "_is_pid_running", lambda pid: False)

    lock_handle = watcher_shared.acquire_lock_file(str(lock_path))

    try:
        assert lock_handle is not None
        watcher_shared.write_lock_file(lock_handle)
        body = lock_path.read_text(encoding="utf-8")
        assert "pid=" in body
    finally:
        watcher_shared.release_lock_file(lock_handle, str(lock_path))


def test_acquire_lock_file_keeps_live_lock(tmp_path: Path, monkeypatch) -> None:
    lock_path = tmp_path / ".watcher.lock"
    lock_path.write_text("pid=1234\nstarted_at=2026-04-15T10:00:00\n", encoding="utf-8")

    monkeypatch.setattr(watcher_shared, "_is_pid_running", lambda pid: True)

    assert watcher_shared.acquire_lock_file(str(lock_path)) is None


def test_is_pid_running_returns_false_on_system_error(monkeypatch) -> None:
    def fake_kill(_pid: int, _signal: int) -> None:
        raise SystemError("windows pid probe failed")

    monkeypatch.setattr(watcher_shared.os, "kill", fake_kill)
    monkeypatch.setattr(watcher_shared.os, "name", "posix")

    assert watcher_shared._is_pid_running(12345) is False


def test_is_pid_running_uses_tasklist_on_windows(monkeypatch) -> None:
    class DummyCompletedProcess:
        def __init__(self, stdout: str, returncode: int = 0) -> None:
            self.stdout = stdout
            self.returncode = returncode

    captured: dict[str, object] = {}

    def fake_run(command, **kwargs):
        captured["command"] = command
        captured["kwargs"] = kwargs
        return DummyCompletedProcess('"python.exe","12345","Console","1","12,000 K"\n')

    monkeypatch.setattr(watcher_shared.os, "name", "nt")
    monkeypatch.setattr(watcher_shared.subprocess, "run", fake_run)

    assert watcher_shared._is_pid_running(12345) is True
    assert captured["command"] == ["tasklist", "/FI", "PID eq 12345", "/FO", "CSV", "/NH"]


def test_is_pid_running_returns_false_when_tasklist_has_no_match(monkeypatch) -> None:
    def fake_run(*_args, **_kwargs):
        return subprocess.CompletedProcess(
            args=["tasklist"],
            returncode=0,
            stdout="INFO: No tasks are running which match the specified criteria.\n",
        )

    monkeypatch.setattr(watcher_shared.os, "name", "nt")
    monkeypatch.setattr(watcher_shared.subprocess, "run", fake_run)

    assert watcher_shared._is_pid_running(999999) is False


def test_compute_worktree_fingerprint_changes_when_file_changes(tmp_path: Path) -> None:
    tracked = tmp_path / "backend" / "routers" / "programs.py"
    tracked.parent.mkdir(parents=True, exist_ok=True)
    tracked.write_text("print('v1')\n", encoding="utf-8")

    first = watcher_shared.compute_worktree_fingerprint(str(tmp_path), ["backend/routers/programs.py"])
    tracked.write_text("print('v2')\n", encoding="utf-8")
    second = watcher_shared.compute_worktree_fingerprint(str(tmp_path), ["backend/routers/programs.py"])

    assert first != second


def test_worktree_fingerprint_details_returns_match_status(tmp_path: Path) -> None:
    tracked = tmp_path / "backend" / "routers" / "programs.py"
    tracked.parent.mkdir(parents=True, exist_ok=True)
    tracked.write_text("print('ok')\n", encoding="utf-8")
    fingerprint = watcher_shared.compute_worktree_fingerprint(str(tmp_path), ["backend/routers/programs.py"])

    details = watcher_shared.worktree_fingerprint_details(
        str(tmp_path),
        {
            "planned_files": "backend/routers/programs.py",
            "planned_worktree_fingerprint": fingerprint,
        },
    )

    assert details is not None
    assert details["matches"] is True


def test_validate_task_packet_metadata_checks_supervisor_spec_constraints() -> None:
    missing_fields, validation_errors = watcher_shared.validate_task_packet_metadata(
        {
            "id": "TASK-TEST",
            "status": "queued",
            "type": "ops",
            "title": "Supervisor spec validation",
            "planned_at": "2026-04-20T21:00:00+09:00",
            "planned_against_commit": "abc123",
            "spec_version": "2.0",
            "request_id": "REQ-1",
            "created_by": "claude",
            "goal": "Validate packet",
            "background": "test",
            "scope_in": "watcher",
            "scope_out": "product",
            "constraints": "minimal-safe-change-only",
            "non_goals": "none",
            "acceptance_criteria": "see-body",
            "risk_level": "severe",
            "execution_path": "remote",
            "allowed_paths": "watcher.py, docs/current-state.md",
            "blocked_paths": "docs/current-state.md",
            "prechecks": "read-current-state",
            "implementation_steps": "inspect, implement, verify",
            "tests": "targeted-tests",
            "artifacts": "reports/TASK-TEST-result.md",
            "fallback_plan": "stop-and-report",
            "rollback_plan": "revert-last-task-scope",
            "dedupe_key": "TASK-TEST",
            "report_format": "planner-supervisor-implementer-qa",
        },
        ("id", "status", "type", "title", "planned_at", "planned_against_commit"),
    )

    assert missing_fields == []
    assert "execution_path must be one of: local, github, manual-blocked" in validation_errors
    assert "risk_level must be one of: low, medium, high, critical" in validation_errors
    assert "allowed_paths and blocked_paths overlap: docs/current-state.md" in validation_errors


def test_append_jsonl_record_writes_one_json_object_per_line(tmp_path: Path) -> None:
    ledger_path = tmp_path / "dispatch" / "run-ledger.jsonl"

    watcher_shared.append_jsonl_record(str(ledger_path), {"task_id": "TASK-1", "stage": "running"})

    rows = [json.loads(line) for line in ledger_path.read_text(encoding="utf-8").splitlines()]
    assert rows == [{"stage": "running", "task_id": "TASK-1"}]
