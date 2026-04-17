from __future__ import annotations

import json
from pathlib import Path

from scripts import summarize_run_ledgers


def _write_rows(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=True) for row in rows) + "\n",
        encoding="utf-8",
    )


def test_summarize_run_ledgers_prints_stage_counts_and_latest_statuses(
    tmp_path: Path, capsys, monkeypatch
) -> None:
    local_rows = [
        {
            "recorded_at": "2026-04-15T21:00:00",
            "task_id": "TASK-A",
            "watcher": "local",
            "stage": "running",
            "status": "started",
        },
        {
            "recorded_at": "2026-04-15T21:01:00",
            "task_id": "TASK-A",
            "watcher": "local",
            "stage": "completed",
            "status": "done",
            "summary": "Task completed successfully.",
        },
        {
            "recorded_at": "2026-04-15T21:02:00",
            "task_id": "TASK-B",
            "watcher": "local",
            "stage": "blocked",
            "status": "action-required",
        },
    ]
    cowork_rows = [
        {
            "recorded_at": "2026-04-15T21:03:00",
            "task_id": "TASK-C",
            "watcher": "cowork",
            "stage": "review-ready",
            "status": "recorded",
        },
        {
            "recorded_at": "2026-04-15T21:04:00",
            "task_id": "TASK-C",
            "watcher": "cowork",
            "stage": "promoted",
            "status": "recorded",
        },
    ]

    _write_rows(tmp_path / "dispatch" / "run-ledger.jsonl", local_rows)
    _write_rows(tmp_path / "cowork" / "dispatch" / "run-ledger.jsonl", cowork_rows)
    (tmp_path / "tasks" / "review-required").mkdir(parents=True)
    (tmp_path / "tasks" / "review-required" / "TASK-REVIEW.md").write_text("queued", encoding="utf-8")

    monkeypatch.setattr(
        "sys.argv",
        [
            "summarize_run_ledgers.py",
            "--project-path",
            str(tmp_path),
            "--limit",
            "2",
        ],
    )

    exit_code = summarize_run_ledgers.main()

    assert exit_code == 0
    output = capsys.readouterr().out
    assert "[local watcher]" in output
    assert "stage_counts: blocked=1, completed=1, running=1" in output
    assert "latest_stage_counts: blocked=1, completed=1" in output
    assert "TASK-A: completed / done" in output
    assert "TASK-B: blocked / action-required" in output
    assert "[local task queues]" in output
    assert "queue_counts: review-required=1" in output
    assert "TASK-REVIEW.md" in output
    assert "[cowork watcher]" in output
    assert "stage_counts: promoted=1, review-ready=1" in output
    assert "TASK-C: promoted / recorded" in output


def test_summarize_run_ledgers_handles_missing_files(tmp_path: Path, capsys, monkeypatch) -> None:
    monkeypatch.setattr(
        "sys.argv",
        [
            "summarize_run_ledgers.py",
            "--project-path",
            str(tmp_path),
        ],
    )

    exit_code = summarize_run_ledgers.main()

    assert exit_code == 0
    output = capsys.readouterr().out
    assert "records: 0" in output
    assert "recent_events: none" in output
