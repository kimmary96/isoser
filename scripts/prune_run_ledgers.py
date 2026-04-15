from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

try:
    from scripts.summarize_run_ledgers import read_jsonl, resolve_path
except ImportError:
    from summarize_run_ledgers import read_jsonl, resolve_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Archive old watcher ledger rows and keep only recent entries in the active ledgers."
    )
    parser.add_argument("--project-path", default=".")
    parser.add_argument("--days", type=int, default=14, help="Keep this many recent days in active ledgers.")
    parser.add_argument("--local-ledger", default="dispatch/run-ledger.jsonl")
    parser.add_argument("--cowork-ledger", default="cowork/dispatch/run-ledger.jsonl")
    return parser


def parse_recorded_at(row: dict[str, Any]) -> datetime | None:
    raw_value = str(row.get("recorded_at", "")).strip()
    if not raw_value:
        return None
    try:
        return datetime.fromisoformat(raw_value)
    except ValueError:
        return None


def append_archive_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    existing_lines = set(path.read_text(encoding="utf-8").splitlines()) if path.exists() else set()
    new_lines: list[str] = []
    for row in rows:
        line = json.dumps(row, ensure_ascii=True, sort_keys=True)
        if line not in existing_lines:
            new_lines.append(line)
            existing_lines.add(line)
    if not new_lines:
        return
    with open(path, "a", encoding="utf-8") as file:
        for line in new_lines:
            file.write(line + "\n")


def prune_one_ledger(path: Path, *, keep_days: int) -> tuple[int, int]:
    rows = read_jsonl(path)
    if not rows:
        return (0, 0)

    cutoff = datetime.now() - timedelta(days=keep_days)
    kept_rows: list[dict[str, Any]] = []
    archived_by_month: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        recorded_at = parse_recorded_at(row)
        if recorded_at is None or recorded_at >= cutoff:
            kept_rows.append(row)
            continue
        archive_key = recorded_at.strftime("%Y-%m")
        archived_by_month[archive_key].append(row)

    archive_root = path.parent / "archive"
    for archive_key, archive_rows in archived_by_month.items():
        append_archive_rows(archive_root / f"{path.stem}-{archive_key}.jsonl", archive_rows)

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as file:
        for row in kept_rows:
            file.write(json.dumps(row, ensure_ascii=True, sort_keys=True) + "\n")

    archived_count = sum(len(items) for items in archived_by_month.values())
    return (len(kept_rows), archived_count)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    local_path = resolve_path(args.project_path, args.local_ledger)
    cowork_path = resolve_path(args.project_path, args.cowork_ledger)

    local_kept, local_archived = prune_one_ledger(local_path, keep_days=args.days)
    cowork_kept, cowork_archived = prune_one_ledger(cowork_path, keep_days=args.days)

    print(f"local_kept={local_kept} local_archived={local_archived}")
    print(f"cowork_kept={cowork_kept} cowork_archived={cowork_archived}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
