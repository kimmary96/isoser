from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, Optional

LOCAL_QUEUE_PATHS = {
    "inbox": "tasks/inbox",
    "running": "tasks/running",
    "done": "tasks/done",
    "blocked": "tasks/blocked",
    "drifted": "tasks/drifted",
    "review-required": "tasks/review-required",
    "remote": "tasks/remote",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Summarize local watcher and cowork watcher JSONL run ledgers."
    )
    parser.add_argument(
        "--project-path",
        default=".",
        help="Project root to resolve default ledger paths from. Defaults to current directory.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum number of recent events to print per watcher. Defaults to 10.",
    )
    parser.add_argument(
        "--local-ledger",
        default="dispatch/run-ledger.jsonl",
        help="Path to the local watcher ledger, relative to --project-path unless absolute.",
    )
    parser.add_argument(
        "--cowork-ledger",
        default="cowork/dispatch/run-ledger.jsonl",
        help="Path to the cowork watcher ledger, relative to --project-path unless absolute.",
    )
    return parser


def resolve_path(project_path: str, raw_path: str) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate
    return Path(project_path).resolve() / candidate


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            rows.append(parsed)
    return rows


def format_counter(counter: Counter[str]) -> str:
    if not counter:
        return "none"
    return ", ".join(f"{key}={counter[key]}" for key in sorted(counter))


def latest_by_task(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for row in sorted(rows, key=lambda item: str(item.get("recorded_at", ""))):
        task_id = str(row.get("task_id", "")).strip()
        if not task_id:
            continue
        latest[task_id] = row
    return latest


def filter_rows_by_stages(rows: list[dict[str, Any]], stages: Optional[set[str]]) -> list[dict[str, Any]]:
    if not stages:
        return rows
    return [row for row in rows if str(row.get("stage", "")).strip() in stages]


def summarize_rows(name: str, rows: list[dict[str, Any]], limit: int) -> list[str]:
    lines = [f"[{name}]"]
    lines.append(f"records: {len(rows)}")
    if not rows:
        lines.append("stage_counts: none")
        lines.append("latest_tasks: none")
        lines.append("recent_events: none")
        return lines

    stage_counter = Counter(str(row.get("stage", "unknown")) for row in rows)
    latest_tasks = latest_by_task(rows)
    latest_stage_counter = Counter(str(row.get("stage", "unknown")) for row in latest_tasks.values())

    lines.append(f"stage_counts: {format_counter(stage_counter)}")
    lines.append(f"latest_tasks: {len(latest_tasks)}")
    lines.append(f"latest_stage_counts: {format_counter(latest_stage_counter)}")
    lines.append("recent_events:")
    for row in sorted(rows, key=lambda item: str(item.get("recorded_at", "")), reverse=True)[:limit]:
        task_id = str(row.get("task_id", "unknown"))
        stage = str(row.get("stage", "unknown"))
        status = str(row.get("status", "unknown"))
        recorded_at = str(row.get("recorded_at", ""))
        summary = str(row.get("summary", "")).strip()
        suffix = f" | {summary}" if summary else ""
        lines.append(f"- {recorded_at} | {task_id} | {stage} | {status}{suffix}")

    lines.append("latest_task_statuses:")
    for task_id in sorted(latest_tasks):
        row = latest_tasks[task_id]
        lines.append(
            f"- {task_id}: {row.get('stage', 'unknown')} / {row.get('status', 'unknown')} @ {row.get('recorded_at', '')}"
        )
    return lines


def queue_snapshot(project_path: str, queue_paths: dict[str, str]) -> dict[str, list[str]]:
    snapshot: dict[str, list[str]] = {}
    project_root = Path(project_path).resolve()
    for label, raw_path in queue_paths.items():
        queue_dir = project_root / raw_path
        if not queue_dir.exists():
            snapshot[label] = []
            continue
        snapshot[label] = sorted(path.name for path in queue_dir.glob("*.md"))
    return snapshot


def summarize_queue_snapshot(name: str, snapshot: dict[str, list[str]], limit: int) -> list[str]:
    lines = [f"[{name}]"]
    total = sum(len(items) for items in snapshot.values())
    lines.append(f"queue_records: {total}")
    if total == 0:
        lines.append("queue_counts: none")
        lines.append("queue_samples: none")
        return lines

    queue_counter = Counter({label: len(items) for label, items in snapshot.items() if items})
    lines.append(f"queue_counts: {format_counter(queue_counter)}")
    lines.append("queue_samples:")
    for label in sorted(snapshot):
        items = snapshot[label]
        if not items:
            continue
        sample = ", ".join(f"`{item}`" for item in items[:limit])
        suffix = ""
        if len(items) > limit:
            suffix = f" ... (+{len(items) - limit})"
        lines.append(f"- {label}: {sample}{suffix}")
    return lines


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    local_path = resolve_path(args.project_path, args.local_ledger)
    cowork_path = resolve_path(args.project_path, args.cowork_ledger)

    local_rows = read_jsonl(local_path)
    cowork_rows = read_jsonl(cowork_path)

    sections = [
        *summarize_rows("local watcher", local_rows, args.limit),
        "",
        *summarize_queue_snapshot(
            "local task queues",
            queue_snapshot(args.project_path, LOCAL_QUEUE_PATHS),
            args.limit,
        ),
        "",
        *summarize_rows("cowork watcher", cowork_rows, args.limit),
    ]
    print("\n".join(sections).rstrip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
