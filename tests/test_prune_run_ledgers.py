from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

from scripts import prune_run_ledgers


def _write_rows(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(json.dumps(row, ensure_ascii=True) for row in rows) + "\n",
        encoding="utf-8",
    )


def test_prune_run_ledgers_archives_old_rows_and_keeps_recent(tmp_path: Path, capsys, monkeypatch) -> None:
    old_time = (datetime.now() - timedelta(days=30)).replace(microsecond=0).isoformat()
    new_time = (datetime.now() - timedelta(days=1)).replace(microsecond=0).isoformat()
    _write_rows(
        tmp_path / "dispatch" / "run-ledger.jsonl",
        [
            {"recorded_at": old_time, "task_id": "TASK-OLD", "stage": "blocked", "status": "action-required"},
            {"recorded_at": new_time, "task_id": "TASK-NEW", "stage": "completed", "status": "done"},
        ],
    )

    monkeypatch.setattr(
        "sys.argv",
        ["prune_run_ledgers.py", "--project-path", str(tmp_path), "--days", "14"],
    )

    exit_code = prune_run_ledgers.main()

    assert exit_code == 0
    output = capsys.readouterr().out
    assert "local_kept=1 local_archived=1" in output
    active = (tmp_path / "dispatch" / "run-ledger.jsonl").read_text(encoding="utf-8")
    assert "TASK-NEW" in active
    assert "TASK-OLD" not in active
    archive_files = list((tmp_path / "dispatch" / "archive").glob("run-ledger-*.jsonl"))
    assert archive_files
    archive_text = archive_files[0].read_text(encoding="utf-8")
    assert "TASK-OLD" in archive_text
