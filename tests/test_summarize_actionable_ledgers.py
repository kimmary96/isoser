from __future__ import annotations

import json
from pathlib import Path

from scripts import summarize_actionable_ledgers


def _write_rows(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=True) for row in rows) + "\n",
        encoding="utf-8",
    )


def test_summarize_actionable_ledgers_filters_non_actionable_rows(
    tmp_path: Path, capsys, monkeypatch
) -> None:
    _write_rows(
        tmp_path / "dispatch" / "run-ledger.jsonl",
        [
            {
                "recorded_at": "2026-04-15T21:00:00",
                "task_id": "TASK-A",
                "watcher": "local",
                "stage": "running",
                "status": "started",
            },
            {
                "recorded_at": "2026-04-15T21:01:00",
                "task_id": "TASK-B",
                "watcher": "local",
                "stage": "blocked",
                "status": "action-required",
                "summary": "move failed",
            },
        ],
    )
    _write_rows(
        tmp_path / "cowork" / "dispatch" / "run-ledger.jsonl",
        [
            {
                "recorded_at": "2026-04-15T21:02:00",
                "task_id": "TASK-C",
                "watcher": "cowork",
                "stage": "review-ready",
                "status": "recorded",
            },
            {
                "recorded_at": "2026-04-15T21:03:00",
                "task_id": "TASK-D",
                "watcher": "cowork",
                "stage": "approval-blocked-stale-review",
                "status": "recorded",
            },
        ],
    )

    monkeypatch.setattr(
        "sys.argv",
        [
            "summarize_actionable_ledgers.py",
            "--project-path",
            str(tmp_path),
            "--limit",
            "5",
        ],
    )

    exit_code = summarize_actionable_ledgers.main()

    assert exit_code == 0
    output = capsys.readouterr().out
    assert "[local actionable]" in output
    assert "stage_counts: blocked=1" in output
    assert "TASK-B: blocked / action-required" in output
    assert "TASK-A" not in output
    assert "[cowork actionable]" in output
    assert "stage_counts: approval-blocked-stale-review=1" in output
    assert "TASK-D: approval-blocked-stale-review / recorded" in output
    assert "TASK-C" not in output


def test_summarize_actionable_ledgers_supports_custom_stage_override(
    tmp_path: Path, capsys, monkeypatch
) -> None:
    _write_rows(
        tmp_path / "dispatch" / "run-ledger.jsonl",
        [
            {
                "recorded_at": "2026-04-15T21:00:00",
                "task_id": "TASK-Z",
                "watcher": "local",
                "stage": "drift",
                "status": "action-required",
            },
        ],
    )

    monkeypatch.setattr(
        "sys.argv",
        [
            "summarize_actionable_ledgers.py",
            "--project-path",
            str(tmp_path),
            "--stages",
            "drift",
        ],
    )

    exit_code = summarize_actionable_ledgers.main()

    assert exit_code == 0
    output = capsys.readouterr().out
    assert "stage_counts: drift=1" in output
    assert "TASK-Z: drift / action-required" in output
