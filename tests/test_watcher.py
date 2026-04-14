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
    inbox_dir.mkdir(parents=True)
    running_dir.mkdir(parents=True)
    reports_dir.mkdir(parents=True)

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

    def fail_move(src: str, dst: str) -> None:
        raise PermissionError("locked")

    monkeypatch.setattr(watcher, "move_task_file", fail_move)

    watcher.handle_task(str(task_path))

    report_path = reports_dir / "TASK-TEST-WATCHER-MOVE-blocked.md"
    assert task_path.exists()
    assert report_path.exists()
    assert "Watcher could not move the task packet into running." in report_path.read_text(encoding="utf-8")

