from __future__ import annotations

import os
import time
from pathlib import Path

import watcher
from scripts import watcher_shared


def test_move_task_file_retries_then_succeeds(tmp_path, monkeypatch) -> None:
    src = tmp_path / "source.md"
    dst = tmp_path / "dest.md"
    src.write_text("task", encoding="utf-8")

    attempts = {"count": 0}
    real_replace = watcher.os.replace

    def flaky_replace(source: str, target: str) -> None:
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise PermissionError("temporary lock")
        real_replace(source, target)

    monkeypatch.setattr(watcher, "MOVE_RETRY_ATTEMPTS", 3)
    monkeypatch.setattr(watcher.time, "sleep", lambda _: None)
    monkeypatch.setattr(watcher.os, "replace", flaky_replace)

    watcher.move_task_file(str(src), str(dst))

    assert attempts["count"] == 3
    assert not src.exists()
    assert dst.read_text(encoding="utf-8") == "task"


def test_start_running_heartbeat_touches_running_file(tmp_path, monkeypatch) -> None:
    running_path = tmp_path / "tasks" / "running" / "TASK-TEST.md"
    running_path.parent.mkdir(parents=True)
    running_path.write_text("running", encoding="utf-8")
    before = running_path.stat().st_mtime_ns

    monkeypatch.setattr(watcher, "RUNNING_HEARTBEAT_SECONDS", 0.01)

    stop_event, thread = watcher.start_running_heartbeat(str(running_path))
    try:
        time.sleep(0.03)
    finally:
        stop_event.set()
        thread.join(timeout=1)

    after = running_path.stat().st_mtime_ns
    assert after > before


def test_handle_task_writes_blocked_report_when_move_to_running_fails(tmp_path, monkeypatch) -> None:
    inbox_dir = tmp_path / "tasks" / "inbox"
    running_dir = tmp_path / "tasks" / "running"
    reports_dir = tmp_path / "reports"
    alerts_dir = tmp_path / "dispatch" / "alerts"
    inbox_dir.mkdir(parents=True)
    running_dir.mkdir(parents=True)
    reports_dir.mkdir(parents=True)
    alerts_dir.mkdir(parents=True)

    task_path = inbox_dir / "TASK-TEST-WATCHER-MOVE.md"
    task_path.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-WATCHER-MOVE",
                "status: queued",
                "type: docs",
                "title: Watcher move failure test",
                "planned_at: 2026-04-14T23:30:00+09:00",
                "planned_against_commit: deadbeef",
                "---",
                "# Goal",
                "",
                "Test watcher blocked reporting.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(watcher, "RUNNING_DIR", str(running_dir))
    monkeypatch.setattr(watcher, "REPORTS_DIR", str(reports_dir))
    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))
    monkeypatch.setattr(watcher, "PROJECT_PATH", str(tmp_path))

    def fail_move(src: str, dst: str) -> None:
        raise PermissionError("locked")

    monkeypatch.setattr(watcher, "move_task_file", fail_move)

    watcher.handle_task(str(task_path))

    report_path = reports_dir / "TASK-TEST-WATCHER-MOVE-blocked.md"
    alert_path = alerts_dir / "TASK-TEST-WATCHER-MOVE-blocked.md"
    assert task_path.exists()
    assert report_path.exists()
    assert alert_path.exists()
    assert "Watcher could not move the task packet into running." in report_path.read_text(encoding="utf-8")
    assert "stage: blocked" in alert_path.read_text(encoding="utf-8")
    assert "type: watcher-alert" in alert_path.read_text(encoding="utf-8")


def test_run_codex_starts_and_stops_running_heartbeat(monkeypatch) -> None:
    class FakeThread:
        def __init__(self) -> None:
            self.join_calls = 0

        def join(self, timeout: float | None = None) -> None:
            self.join_calls += 1

    class FakeEvent:
        def __init__(self) -> None:
            self.set_calls = 0

        def set(self) -> None:
            self.set_calls += 1

    fake_thread = FakeThread()
    fake_event = FakeEvent()
    heartbeat_calls: list[str] = []

    def fake_start_running_heartbeat(running_path: str):
        heartbeat_calls.append(running_path)
        return fake_event, fake_thread

    class FakeProcess:
        def __init__(self) -> None:
            self.stdout = iter(["line 1\n", "line 2\n"])

        def wait(self) -> int:
            return 0

    monkeypatch.setattr(watcher, "build_codex_prompt", lambda *_args, **_kwargs: "prompt")
    monkeypatch.setattr(watcher, "resolve_codex_command", lambda: "codex")
    monkeypatch.setattr(watcher, "start_running_heartbeat", fake_start_running_heartbeat)
    monkeypatch.setattr(watcher.subprocess, "Popen", lambda *args, **kwargs: FakeProcess())
    monkeypatch.setattr(watcher, "parse_token_count", lambda output: 123)

    exit_code, token_count = watcher.run_codex(
        "TASK-TEST.md",
        "TASK-TEST",
        "feature",
        running_path="tasks/running/TASK-TEST.md",
    )

    assert exit_code == 0
    assert token_count == 123
    assert heartbeat_calls == ["tasks/running/TASK-TEST.md"]
    assert fake_event.set_calls == 1
    assert fake_thread.join_calls == 1


def test_parse_changed_files_from_result_report_reads_bullets(tmp_path) -> None:
    report_path = tmp_path / "TASK-TEST-result.md"
    report_path.write_text(
        "\n".join(
            [
                "# Result: TASK-TEST",
                "",
                "## Changed files",
                "",
                "- `frontend/app/example/page.tsx`",
                "- `docs/current-state.md`",
                "",
                "## Why changes were made",
                "",
                "- test",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    assert watcher.parse_changed_files_from_result_report(str(report_path)) == [
        "frontend/app/example/page.tsx",
        "docs/current-state.md",
    ]


def test_task_queue_sort_key_orders_by_task_number_slot() -> None:
    paths = [
        r"D:\repo\tasks\inbox\TASK-2026-04-15-1710-recommend-api-enhance.md",
        r"D:\repo\tasks\inbox\TASK-2026-04-15-1500-tier2-seoul-crawl.md",
        r"D:\repo\tasks\inbox\TASK-2026-04-15-1700-recommend-data-pipeline.md",
    ]

    ordered = sorted(paths, key=watcher.task_queue_sort_key)

    assert ordered == [
        r"D:\repo\tasks\inbox\TASK-2026-04-15-1500-tier2-seoul-crawl.md",
        r"D:\repo\tasks\inbox\TASK-2026-04-15-1700-recommend-data-pipeline.md",
        r"D:\repo\tasks\inbox\TASK-2026-04-15-1710-recommend-api-enhance.md",
    ]


def test_sync_completed_task_to_git_stages_task_paths_and_appends_git_metadata(tmp_path, monkeypatch) -> None:
    project_path = tmp_path
    running_path = project_path / "tasks" / "running" / "TASK-TEST.md"
    done_path = project_path / "tasks" / "done" / "TASK-TEST.md"
    result_report = project_path / "reports" / "TASK-TEST-result.md"
    changed_file = project_path / "frontend" / "app" / "example" / "page.tsx"

    running_path.parent.mkdir(parents=True)
    done_path.parent.mkdir(parents=True)
    result_report.parent.mkdir(parents=True)
    changed_file.parent.mkdir(parents=True)

    running_path.write_text("running", encoding="utf-8")
    done_path.write_text("done", encoding="utf-8")
    changed_file.write_text("export default function Example() {}", encoding="utf-8")
    result_report.write_text(
        "\n".join(
            [
                "# Result: TASK-TEST",
                "",
                "## Changed files",
                "",
                "- `frontend/app/example/page.tsx`",
                "",
                "## Why changes were made",
                "",
                "- test",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(watcher, "PROJECT_PATH", str(project_path))
    monkeypatch.setattr(watcher, "current_branch", lambda: "develop")
    monkeypatch.setattr(watcher, "current_head", lambda: "abc123")

    calls: list[list[str]] = []

    class FakeResult:
        def __init__(self, stdout: str = "", stderr: str = "", returncode: int = 0) -> None:
            self.stdout = stdout
            self.stderr = stderr
            self.returncode = returncode

    def fake_run_git(args: list[str], *, check: bool = True) -> FakeResult:
        calls.append(args)
        if args[:3] == ["diff", "--cached", "--name-only"]:
            return FakeResult(stdout="tasks/done/TASK-TEST.md\n")
        if args[:2] == ["commit", "-m"]:
            return FakeResult(stdout="[develop abc123] [codex] TASK-TEST 구현 완료.\n")
        if args[:3] == ["push", "origin", "develop"]:
            return FakeResult(stdout="pushed\n")
        if args[:3] == ["fetch", "origin", "main"]:
            return FakeResult(stdout="fetched\n")
        if args[:3] == ["merge-base", "--is-ancestor", "origin/main"]:
            return FakeResult(returncode=0)
        if args[:3] == ["push", "origin", "abc123:refs/heads/main"]:
            return FakeResult(stdout="main pushed\n")
        return FakeResult()

    monkeypatch.setattr(watcher, "run_git", fake_run_git)

    watcher.sync_completed_task_to_git(
        task_id="TASK-TEST",
        task_filename="TASK-TEST.md",
        running_path=str(running_path),
        done_path=str(done_path),
        result_report=str(result_report),
    )

    assert calls[0][:3] == ["add", "-A", "--"]
    assert "tasks/running/TASK-TEST.md" in calls[0]
    assert "tasks/done/TASK-TEST.md" in calls[0]
    assert "reports/TASK-TEST-result.md" in calls[0]
    assert "frontend/app/example/page.tsx" in calls[0]
    updated_report = result_report.read_text(encoding="utf-8")
    assert "## Git Automation" in updated_report
    assert "- status: `merged-main`" in updated_report
    assert "Auto-promoted to origin/main." in updated_report


def test_sync_completed_task_to_git_skips_missing_untracked_running_path(tmp_path, monkeypatch) -> None:
    project_path = tmp_path
    done_path = project_path / "tasks" / "done" / "TASK-TEST.md"
    result_report = project_path / "reports" / "TASK-TEST-result.md"

    done_path.parent.mkdir(parents=True)
    result_report.parent.mkdir(parents=True)
    done_path.write_text("done", encoding="utf-8")
    result_report.write_text(
        "\n".join(
            [
                "# Result: TASK-TEST",
                "",
                "## Changed files",
                "",
                "- `backend/routers/programs.py`",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(watcher, "PROJECT_PATH", str(project_path))
    monkeypatch.setattr(watcher, "current_branch", lambda: "develop")
    monkeypatch.setattr(watcher, "current_head", lambda: "abc123")

    calls: list[list[str]] = []

    class FakeResult:
        def __init__(self, stdout: str = "", stderr: str = "", returncode: int = 0) -> None:
            self.stdout = stdout
            self.stderr = stderr
            self.returncode = returncode

    def fake_run_git(args: list[str], *, check: bool = True) -> FakeResult:
        calls.append(args)
        if args[:2] == ["ls-files", "--error-unmatch"]:
            return FakeResult(returncode=1)
        if args[:3] == ["diff", "--cached", "--name-only"]:
            return FakeResult(stdout="tasks/done/TASK-TEST.md\n")
        if args[:2] == ["commit", "-m"]:
            return FakeResult(stdout="[develop abc123] [codex] TASK-TEST 구현 완료.\n")
        if args[:3] == ["push", "origin", "develop"]:
            return FakeResult(stdout="pushed\n")
        if args[:3] == ["fetch", "origin", "main"]:
            return FakeResult(stdout="fetched\n")
        if args[:3] == ["merge-base", "--is-ancestor", "origin/main"]:
            return FakeResult(returncode=0)
        if args[:3] == ["push", "origin", "abc123:refs/heads/main"]:
            return FakeResult(stdout="main pushed\n")
        return FakeResult()

    monkeypatch.setattr(watcher, "run_git", fake_run_git)

    watcher.sync_completed_task_to_git(
        task_id="TASK-TEST",
        task_filename="TASK-TEST.md",
        running_path=str(project_path / "tasks" / "running" / "TASK-TEST.md"),
        done_path=str(done_path),
        result_report=str(result_report),
    )

    add_call = calls[2]
    assert add_call[:3] == ["add", "-A", "--"]
    assert "tasks/running/TASK-TEST.md" not in add_call
    assert "tasks/done/TASK-TEST.md" in add_call
    assert "reports/TASK-TEST-result.md" in add_call


def test_write_alert_creates_dispatch_file(tmp_path, monkeypatch) -> None:
    alerts_dir = tmp_path / "dispatch" / "alerts"
    alerts_dir.mkdir(parents=True)
    ledger_path = tmp_path / "dispatch" / "run-ledger.jsonl"

    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))
    monkeypatch.setattr(watcher, "LEDGER_PATH", str(ledger_path))

    alert_path = watcher.write_alert(
        "TASK-TEST-DRIFT",
        "drift",
        status="action-required",
        packet_path="tasks/drifted/TASK-TEST-DRIFT.md",
        report_path="reports/TASK-TEST-DRIFT-drift.md",
        summary="Codex stopped because of repository drift.",
        next_action="Regenerate the task packet against current HEAD.",
    )

    body = Path(alert_path).read_text(encoding="utf-8")
    assert "type: watcher-alert" in body
    assert "stage: drift" in body
    assert "status: action-required" in body
    assert "severity: warning" in body
    assert "tasks/drifted/TASK-TEST-DRIFT.md" in body
    assert "reports/TASK-TEST-DRIFT-drift.md" in body
    assert "summary: Codex stopped because of repository drift." in body
    assert "next_action: Regenerate the task packet against current HEAD." in body
    ledger_body = ledger_path.read_text(encoding="utf-8")
    assert '"task_id": "TASK-TEST-DRIFT"' in ledger_body
    assert '"stage": "drift"' in ledger_body


def test_handle_task_stops_early_when_optional_worktree_fingerprint_mismatches(tmp_path, monkeypatch) -> None:
    inbox_dir = tmp_path / "tasks" / "inbox"
    running_dir = tmp_path / "tasks" / "running"
    drifted_dir = tmp_path / "tasks" / "drifted"
    reports_dir = tmp_path / "reports"
    alerts_dir = tmp_path / "dispatch" / "alerts"
    inbox_dir.mkdir(parents=True)
    running_dir.mkdir(parents=True)
    drifted_dir.mkdir(parents=True)
    reports_dir.mkdir(parents=True)
    alerts_dir.mkdir(parents=True)

    tracked = tmp_path / "backend" / "routers" / "programs.py"
    tracked.parent.mkdir(parents=True, exist_ok=True)
    tracked.write_text("print('v1')\n", encoding="utf-8")
    fingerprint = watcher_shared.compute_worktree_fingerprint(str(tmp_path), ["backend/routers/programs.py"])
    tracked.write_text("print('v2')\n", encoding="utf-8")

    task_path = inbox_dir / "TASK-TEST-FP.md"
    task_path.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-FP",
                "status: queued",
                "type: feature",
                "title: Fingerprint drift test",
                "planned_at: 2026-04-15T23:00:00+09:00",
                "planned_against_commit: abc123",
                "planned_files: backend/routers/programs.py",
                f"planned_worktree_fingerprint: {fingerprint}",
                "---",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(watcher, "PROJECT_PATH", str(tmp_path))
    monkeypatch.setattr(watcher, "RUNNING_DIR", str(running_dir))
    monkeypatch.setattr(watcher, "DRIFTED_DIR", str(drifted_dir))
    monkeypatch.setattr(watcher, "REPORTS_DIR", str(reports_dir))
    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))
    monkeypatch.setattr(watcher, "current_head", lambda: "abc123")
    monkeypatch.setattr(watcher, "run_codex", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("run_codex should not run")))

    watcher.handle_task(str(task_path))

    assert not task_path.exists()
    assert (drifted_dir / "TASK-TEST-FP.md").exists()
    drift_report = (reports_dir / "TASK-TEST-FP-drift.md").read_text(encoding="utf-8")
    assert "planned_worktree_fingerprint" in drift_report
    assert "actual_worktree_fingerprint" in drift_report


def test_handle_recovery_requeues_task_when_packet_is_refreshed(tmp_path, monkeypatch) -> None:
    inbox_dir = tmp_path / "tasks" / "inbox"
    drifted_dir = tmp_path / "tasks" / "drifted"
    reports_dir = tmp_path / "reports"
    alerts_dir = tmp_path / "dispatch" / "alerts"
    inbox_dir.mkdir(parents=True)
    drifted_dir.mkdir(parents=True)
    reports_dir.mkdir(parents=True)
    alerts_dir.mkdir(parents=True)

    task_path = drifted_dir / "TASK-TEST-RECOVERY.md"
    task_path.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-RECOVERY",
                "status: drift",
                "type: feature",
                "title: Recovery test",
                "planned_at: 2026-04-15T10:00:00+09:00",
                "planned_against_commit: old-head",
                "---",
                "",
                "# Goal",
                "",
                "Refresh this task packet.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (reports_dir / "TASK-TEST-RECOVERY-drift.md").write_text("# Drift\n", encoding="utf-8")

    monkeypatch.setattr(watcher, "INBOX_DIR", str(inbox_dir))
    monkeypatch.setattr(watcher, "REPORTS_DIR", str(reports_dir))
    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))
    monkeypatch.setattr(watcher, "current_head", lambda: "new-head")

    def fake_run_codex_recovery(
        task_filename: str,
        task_id: str,
        *,
        failure_stage: str,
        retry_count: int,
    ) -> tuple[int, int]:
        task_path.write_text(
            "\n".join(
                [
                    "---",
                    "id: TASK-TEST-RECOVERY",
                    "status: queued",
                    "type: feature",
                    "title: Recovery test",
                    "planned_at: 2026-04-15T10:00:00+09:00",
                    "planned_against_commit: new-head",
                    "auto_recovery_attempts: 1",
                    "---",
                    "",
                    "# Goal",
                    "",
                    "Refresh this task packet.",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        (reports_dir / "TASK-TEST-RECOVERY-recovery.md").write_text(
            "# Recovery\n\nPacket refreshed.\n",
            encoding="utf-8",
        )
        return (0, 123)

    monkeypatch.setattr(watcher, "run_codex_recovery", fake_run_codex_recovery)

    watcher.handle_recovery(str(task_path), failure_stage="drift")

    assert not task_path.exists()
    assert (inbox_dir / "TASK-TEST-RECOVERY.md").exists()
    alert_body = (alerts_dir / "TASK-TEST-RECOVERY-recovered.md").read_text(encoding="utf-8")
    assert "stage: recovered" in alert_body
    assert "tasks/inbox/TASK-TEST-RECOVERY.md" in alert_body


def test_handle_recovery_leaves_task_when_packet_is_not_retry_safe(tmp_path, monkeypatch) -> None:
    blocked_dir = tmp_path / "tasks" / "blocked"
    reports_dir = tmp_path / "reports"
    alerts_dir = tmp_path / "dispatch" / "alerts"
    cowork_packets_dir = tmp_path / "cowork" / "packets"
    blocked_dir.mkdir(parents=True)
    reports_dir.mkdir(parents=True)
    alerts_dir.mkdir(parents=True)
    cowork_packets_dir.mkdir(parents=True)

    task_path = blocked_dir / "TASK-TEST-BLOCKED.md"
    task_path.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-BLOCKED",
                "status: blocked",
                "type: feature",
                "title: Blocked recovery test",
                "planned_at: 2026-04-15T10:00:00+09:00",
                "planned_against_commit: same-head",
                "---",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (reports_dir / "TASK-TEST-BLOCKED-blocked.md").write_text("# Blocked\n", encoding="utf-8")

    monkeypatch.setattr(watcher, "REPORTS_DIR", str(reports_dir))
    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))
    monkeypatch.setattr(watcher, "COWORK_PACKETS_DIR", str(cowork_packets_dir))
    monkeypatch.setattr(watcher, "current_head", lambda: "same-head")

    def fake_run_codex_recovery(
        task_filename: str,
        task_id: str,
        *,
        failure_stage: str,
        retry_count: int,
    ) -> tuple[int, int]:
        (reports_dir / "TASK-TEST-BLOCKED-recovery.md").write_text(
            "# Recovery\n\nExternal credentials still missing.\n",
            encoding="utf-8",
        )
        return (0, 123)

    monkeypatch.setattr(watcher, "run_codex_recovery", fake_run_codex_recovery)

    watcher.handle_recovery(str(task_path), failure_stage="blocked")

    assert task_path.exists()
    assert not (tmp_path / "tasks" / "inbox" / "TASK-TEST-BLOCKED.md").exists()
    cowork_packet = cowork_packets_dir / "TASK-TEST-BLOCKED.md"
    assert cowork_packet.exists()
    assert "## Auto Recovery Context" in cowork_packet.read_text(encoding="utf-8")
    alert_body = (alerts_dir / "TASK-TEST-BLOCKED-needs-review.md").read_text(encoding="utf-8")
    assert "stage: needs-review" in alert_body
    assert "/isoser-approve TASK-TEST-BLOCKED inbox" in alert_body


def test_handle_recovery_escalates_to_replan_required_after_repeat_failures(tmp_path, monkeypatch) -> None:
    drifted_dir = tmp_path / "tasks" / "drifted"
    reports_dir = tmp_path / "reports"
    alerts_dir = tmp_path / "dispatch" / "alerts"
    cowork_packets_dir = tmp_path / "cowork" / "packets"
    drifted_dir.mkdir(parents=True)
    reports_dir.mkdir(parents=True)
    alerts_dir.mkdir(parents=True)
    cowork_packets_dir.mkdir(parents=True)

    task_path = drifted_dir / "TASK-TEST-REPLAN.md"
    task_path.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-TEST-REPLAN",
                "status: queued",
                "type: feature",
                "title: Replan recovery test",
                "planned_at: 2026-04-15T10:00:00+09:00",
                "planned_against_commit: same-head",
                "auto_recovery_attempts: 2",
                "---",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (reports_dir / "TASK-TEST-REPLAN-drift.md").write_text("# Drift\n", encoding="utf-8")
    recovery_report = reports_dir / "TASK-TEST-REPLAN-recovery.md"
    recovery_report.write_text("# Recovery\n\nretry failed again.\n", encoding="utf-8")
    stale_timestamp = time.time() - 10
    os.utime(recovery_report, (stale_timestamp, stale_timestamp))

    monkeypatch.setattr(watcher, "REPORTS_DIR", str(reports_dir))
    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))
    monkeypatch.setattr(watcher, "COWORK_PACKETS_DIR", str(cowork_packets_dir))

    watcher.handle_recovery(str(task_path), failure_stage="drift")

    alert_body = (alerts_dir / "TASK-TEST-REPLAN-replan-required.md").read_text(encoding="utf-8")
    assert "stage: replan-required" in alert_body
    assert "stronger replan pass" in alert_body
    packet_body = (cowork_packets_dir / "TASK-TEST-REPLAN.md").read_text(encoding="utf-8")
    assert "## Replan Checklist" in packet_body
    assert "tighten scope/acceptance" in packet_body


def test_format_slack_alert_message_contains_core_fields() -> None:
    message = watcher.format_slack_alert_message(
        task_id="TASK-TEST",
        stage="drift",
        status="action-required",
        packet_path="tasks/drifted/TASK-TEST.md",
        report_path="reports/TASK-TEST-drift.md",
        summary="Codex stopped because of repository drift.",
        next_action="Regenerate the packet.",
    )

    assert "로컬 watcher 알림" in message
    assert "*작업*: `TASK-TEST`" in message
    assert "*단계*: 드리프트 감지" in message
    assert "`tasks/drifted/TASK-TEST.md`" in message
    assert "`reports/TASK-TEST-drift.md`" in message
    assert "*요약*" in message
    assert "Codex가 저장소 드리프트 때문에 중단되었습니다." in message


def test_format_slack_alert_message_uses_compact_smoke_format() -> None:
    message = watcher.format_slack_alert_message(
        task_id="TASK-TEST-SMOKE",
        stage="blocked",
        status="action-required",
        packet_path="tasks/blocked/TASK-TEST-SMOKE.md",
        report_path="reports/TASK-TEST-SMOKE-blocked.md",
        summary="Task packet is missing required frontmatter fields.",
        next_action="Fill the missing frontmatter fields and resubmit the task packet.",
    )

    assert "🧪 watcher smoke alert" in message
    assert "*작업*: `TASK-TEST-SMOKE`" in message
    assert "*단계*: blocked" in message
    assert "*상태*: action-required" in message
    assert "tasks/blocked/TASK-TEST-SMOKE.md" not in message
    assert "reports/TASK-TEST-SMOKE-blocked.md" not in message


def test_format_slack_alert_message_surfaces_main_promotion_summary() -> None:
    message = watcher.format_slack_alert_message(
        task_id="TASK-TEST",
        stage="completed",
        status="done",
        packet_path="tasks/done/TASK-TEST.md",
        report_path="reports/TASK-TEST-result.md",
        summary="Task completed and auto-promoted to origin/main at abc123.",
        next_action=None,
    )

    assert "*단계*: 완료" in message
    assert "*상태*: 완료" in message
    assert "origin/main" in message
    assert "abc123" in message
    assert "자동 반영" in message


def test_format_slack_alert_message_for_replan_required() -> None:
    message = watcher.format_slack_alert_message(
        task_id="TASK-TEST",
        stage="replan-required",
        status="action-required",
        packet_path="tasks/drifted/TASK-TEST.md",
        report_path="reports/TASK-TEST-recovery.md",
        summary="This task has stopped repeatedly and now needs a stronger replan.",
        next_action="Replan the packet before requeueing.",
    )

    assert "*단계*: 재설계 필요" in message
    assert "더 강한 재설계가 필요합니다." in message


def test_build_slack_alert_payload_adds_structured_blocks() -> None:
    payload = watcher.build_slack_alert_payload(
        task_id="TASK-LIVE",
        stage="push-failed",
        status="action-required",
        packet_path="tasks/done/TASK-LIVE.md",
        report_path="reports/TASK-LIVE-result.md",
        summary="Watcher git sync failed.",
        next_action="Git Automation 섹션을 확인한 뒤 수동으로 push 하세요.",
    )

    assert "text" in payload
    assert "blocks" in payload
    blocks = payload["blocks"]
    assert isinstance(blocks, list)
    assert len(blocks) >= 3
    summary_block = blocks[2]["text"]["text"]
    assert "watcher의 Git 동기화에 실패했습니다." in summary_block


def test_build_slack_alert_payload_reuses_known_task_thread(monkeypatch) -> None:
    monkeypatch.setattr(watcher, "slack_thread_ts_for_task", lambda task_id: "1776325765.533439")

    payload = watcher.build_slack_alert_payload(
        task_id="TASK-LIVE",
        stage="push-failed",
        status="action-required",
        packet_path="tasks/done/TASK-LIVE.md",
        report_path="reports/TASK-LIVE-result.md",
        summary="Watcher git sync failed.",
        next_action="Git Automation 섹션을 확인한 뒤 수동으로 push 하세요.",
    )

    assert payload["thread_ts"] == "1776325765.533439"
    assert payload["reply_broadcast"] is False


def test_build_slack_alert_payload_uses_compact_blocks_for_smoke_task() -> None:
    payload = watcher.build_slack_alert_payload(
        task_id="TASK-TEST-SMOKE",
        stage="blocked",
        status="action-required",
        packet_path="tasks/blocked/TASK-TEST-SMOKE.md",
        report_path="reports/TASK-TEST-SMOKE-blocked.md",
        summary="Task packet is missing required frontmatter fields.",
        next_action="Fill the missing frontmatter fields and resubmit the task packet.",
    )

    blocks = payload["blocks"]
    assert isinstance(blocks, list)
    assert len(blocks) == 1
    block_text = blocks[0]["text"]["text"]
    assert "*작업*: `TASK-TEST-SMOKE`" in block_text
    assert "*단계*: blocked" in block_text
    assert "*상태*: action-required" in block_text
    assert "reports/TASK-TEST-SMOKE-blocked.md" not in block_text


def test_startup_warning_messages_warns_when_slack_webhook_missing(monkeypatch) -> None:
    monkeypatch.setattr(watcher, "get_slack_webhook_url", lambda: "")

    warnings = watcher.startup_warning_messages()

    assert len(warnings) == 1
    assert "SLACK_WEBHOOK_URL" in warnings[0]


def test_get_slack_webhook_url_reads_process_env(monkeypatch) -> None:
    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/test/process")
    monkeypatch.setattr(watcher, "WATCHER_ENV_PATH", "./missing.env")

    assert watcher.get_slack_webhook_url() == "https://hooks.slack.com/services/test/process"


def test_get_slack_webhook_url_falls_back_to_watcher_env(tmp_path, monkeypatch) -> None:
    watcher_env_path = tmp_path / ".watcher.env"
    watcher_env_path.write_text(
        "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/test/file\n",
        encoding="utf-8",
    )

    monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)
    monkeypatch.setattr(watcher, "WATCHER_ENV_PATH", str(watcher_env_path))

    assert watcher.get_slack_webhook_url() == "https://hooks.slack.com/services/test/file"


def test_slack_thread_ts_for_task_reads_cowork_approval_marker(tmp_path, monkeypatch) -> None:
    approvals_dir = tmp_path / "cowork" / "approvals"
    approvals_dir.mkdir(parents=True)
    approval_path = approvals_dir / "TASK-THREAD.ok"
    approval_path.write_text(
        "\n".join(
            [
                "approved_by: slack:U123",
                "slack_message_ts: 1776325765.533439",
                "slack_channel_id: C123",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(watcher, "COWORK_APPROVALS_DIR", str(approvals_dir))

    assert watcher.slack_thread_ts_for_task("TASK-THREAD") == "1776325765.533439"


def test_move_stale_running_tasks_removes_duplicate_running_marker(tmp_path, monkeypatch) -> None:
    running_dir = tmp_path / "tasks" / "running"
    blocked_dir = tmp_path / "tasks" / "blocked"
    drifted_dir = tmp_path / "tasks" / "drifted"
    done_dir = tmp_path / "tasks" / "done"
    for directory in [running_dir, blocked_dir, drifted_dir, done_dir]:
        directory.mkdir(parents=True)

    running_task = running_dir / "TASK-DUPLICATE.md"
    blocked_task = blocked_dir / "TASK-DUPLICATE.md"
    running_task.write_text("running", encoding="utf-8")
    blocked_task.write_text("blocked", encoding="utf-8")

    monkeypatch.setattr(watcher, "RUNNING_DIR", str(running_dir))
    monkeypatch.setattr(watcher, "BLOCKED_DIR", str(blocked_dir))
    monkeypatch.setattr(watcher, "DRIFTED_DIR", str(drifted_dir))
    monkeypatch.setattr(watcher, "DONE_DIR", str(done_dir))

    watcher.move_stale_running_tasks()

    assert not running_task.exists()
    assert blocked_task.exists()


def test_handle_task_archives_duplicate_inbox_packet_when_done_exists(tmp_path, monkeypatch) -> None:
    inbox_dir = tmp_path / "tasks" / "inbox"
    running_dir = tmp_path / "tasks" / "running"
    blocked_dir = tmp_path / "tasks" / "blocked"
    drifted_dir = tmp_path / "tasks" / "drifted"
    done_dir = tmp_path / "tasks" / "done"
    archive_dir = tmp_path / "tasks" / "archive"
    reports_dir = tmp_path / "reports"
    alerts_dir = tmp_path / "dispatch" / "alerts"
    for directory in [inbox_dir, running_dir, blocked_dir, drifted_dir, done_dir, archive_dir, reports_dir, alerts_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    task_path = inbox_dir / "TASK-DUPLICATE.md"
    task_path.write_text(
        "\n".join(
            [
                "---",
                "id: TASK-DUPLICATE",
                "status: queued",
                "type: bug",
                "title: Duplicate task",
                "planned_at: 2026-04-16T18:00:00+09:00",
                "planned_against_commit: abc123",
                "---",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (done_dir / "TASK-DUPLICATE.md").write_text("done\n", encoding="utf-8")
    ledger_path = tmp_path / "dispatch" / "run-ledger.jsonl"

    monkeypatch.setattr(watcher, "RUNNING_DIR", str(running_dir))
    monkeypatch.setattr(watcher, "BLOCKED_DIR", str(blocked_dir))
    monkeypatch.setattr(watcher, "DRIFTED_DIR", str(drifted_dir))
    monkeypatch.setattr(watcher, "DONE_DIR", str(done_dir))
    monkeypatch.setattr(watcher, "ARCHIVE_DIR", str(archive_dir))
    monkeypatch.setattr(watcher, "REPORTS_DIR", str(reports_dir))
    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))
    monkeypatch.setattr(watcher, "LEDGER_PATH", str(ledger_path))
    monkeypatch.setattr(
        watcher,
        "run_codex",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("run_codex should not run")),
    )

    watcher.handle_task(str(task_path))

    assert not task_path.exists()
    archived = list(archive_dir.glob("TASK-DUPLICATE-duplicate-from-done-*.md"))
    assert len(archived) == 1
    assert (done_dir / "TASK-DUPLICATE.md").exists()
    ledger_body = ledger_path.read_text(encoding="utf-8")
    assert '"stage": "duplicate-skipped"' in ledger_body


def test_safe_run_task_handler_keeps_watcher_alive_after_runtime_exception(tmp_path, monkeypatch) -> None:
    alerts_dir = tmp_path / "dispatch" / "alerts"
    alerts_dir.mkdir(parents=True)
    ledger_path = tmp_path / "dispatch" / "run-ledger.jsonl"
    task_path = tmp_path / "tasks" / "inbox" / "TASK-RUNTIME.md"
    task_path.parent.mkdir(parents=True)
    task_path.write_text("test\n", encoding="utf-8")

    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))
    monkeypatch.setattr(watcher, "LEDGER_PATH", str(ledger_path))

    def boom(_path: str) -> None:
        raise RuntimeError("loop crash")

    watcher.safe_run_task_handler(boom, str(task_path), context="handle inbox task")

    alert_body = (alerts_dir / "TASK-RUNTIME-runtime-error.md").read_text(encoding="utf-8")
    assert "stage: runtime-error" in alert_body
    assert "loop crash" in alert_body
    ledger_body = ledger_path.read_text(encoding="utf-8")
    assert '"stage": "runtime-error"' in ledger_body
