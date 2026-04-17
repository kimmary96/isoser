from __future__ import annotations

import argparse

try:
    from scripts.summarize_run_ledgers import (
        LOCAL_QUEUE_PATHS,
        filter_rows_by_stages,
        queue_snapshot,
        read_jsonl,
        resolve_path,
        summarize_queue_snapshot,
        summarize_rows,
    )
except ImportError:
    from summarize_run_ledgers import (
        LOCAL_QUEUE_PATHS,
        filter_rows_by_stages,
        queue_snapshot,
        read_jsonl,
        resolve_path,
        summarize_queue_snapshot,
        summarize_rows,
    )


DEFAULT_ACTIONABLE_STAGES = {
    "blocked",
    "drift",
    "needs-review",
    "replan-required",
    "approval-blocked-stale-review",
    "review-failed",
    "push-failed",
    "main-push-failed",
    "runtime-error",
}
ACTIONABLE_QUEUE_PATHS = {
    "blocked": LOCAL_QUEUE_PATHS["blocked"],
    "drifted": LOCAL_QUEUE_PATHS["drifted"],
    "review-required": LOCAL_QUEUE_PATHS["review-required"],
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Show only actionable watcher/cowork watcher states from JSONL ledgers."
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
        help="Maximum number of recent actionable events to print per watcher. Defaults to 10.",
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
    parser.add_argument(
        "--stages",
        default=",".join(sorted(DEFAULT_ACTIONABLE_STAGES)),
        help="Comma-separated actionable stages override.",
    )
    return parser


def parse_stage_filter(raw_value: str) -> set[str]:
    return {item.strip() for item in raw_value.split(",") if item.strip()}


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    stages = parse_stage_filter(args.stages)

    local_rows = filter_rows_by_stages(
        read_jsonl(resolve_path(args.project_path, args.local_ledger)),
        stages,
    )
    cowork_rows = filter_rows_by_stages(
        read_jsonl(resolve_path(args.project_path, args.cowork_ledger)),
        stages,
    )

    sections = [
        *summarize_rows("local actionable", local_rows, args.limit),
        "",
        *summarize_queue_snapshot(
            "local actionable queues",
            queue_snapshot(args.project_path, ACTIONABLE_QUEUE_PATHS),
            args.limit,
        ),
        "",
        *summarize_rows("cowork actionable", cowork_rows, args.limit),
    ]
    print("\n".join(sections).rstrip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
