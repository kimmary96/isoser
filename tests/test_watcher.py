from __future__ import annotations

from pathlib import Path

import watcher


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
    assert "- status: `pushed`" in updated_report


def test_write_alert_creates_dispatch_file(tmp_path, monkeypatch) -> None:
    alerts_dir = tmp_path / "dispatch" / "alerts"
    alerts_dir.mkdir(parents=True)

    monkeypatch.setattr(watcher, "ALERTS_DIR", str(alerts_dir))

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

    assert "task: `TASK-TEST`" in message
    assert "stage: `drift`" in message
    assert "packet: `tasks/drifted/TASK-TEST.md`" in message
    assert "report: `reports/TASK-TEST-drift.md`" in message
    assert "summary: Codex stopped because of repository drift." in message
