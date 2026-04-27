from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
for path in (ROOT, BACKEND):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from scripts import backfill_program_source_records, refresh_program_list_index


DEFAULT_VALIDATION_SAMPLE_OPTIONS: dict[str, int] = {
    "pool_limit": 50,
    "delta_batch_limit": 50,
    "sample_max_rows": 50,
    "sample_keep_latest_snapshot_count": 1,
    "source_record_batch_limit": 50,
    "source_record_max_rows": 50,
    "source_record_fallback_min_batch_limit": 10,
}

VALIDATION_SAMPLE_PRESETS: dict[str, dict[str, int]] = {
    "free-plan-50": dict(DEFAULT_VALIDATION_SAMPLE_OPTIONS),
}


def _extract_error(report: dict[str, Any]) -> str | None:
    if report.get("error"):
        return str(report["error"])
    if report.get("delta_refresh_error"):
        return str(report["delta_refresh_error"])
    if report.get("full_refresh_error"):
        return str(report["full_refresh_error"])
    if report.get("fallback_error"):
        return str(report["fallback_error"])
    return None


def _resolve_validation_sample_options(args: argparse.Namespace) -> dict[str, int]:
    options = dict(DEFAULT_VALIDATION_SAMPLE_OPTIONS)
    preset_name = getattr(args, "preset", None)
    if preset_name:
        options.update(VALIDATION_SAMPLE_PRESETS[preset_name])

    for key, default_value in DEFAULT_VALIDATION_SAMPLE_OPTIONS.items():
        value = getattr(args, key)
        if value != default_value or not preset_name:
            options[key] = value

    return options


def _resolve_output_path(raw_path: str | None) -> Path | None:
    if not raw_path:
        return None
    output_path = Path(raw_path)
    if not output_path.is_absolute():
        output_path = ROOT / output_path
    return output_path


def _write_report(path: Path, report: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


async def run_validation_sample(
    *,
    pool_limit: int,
    delta_batch_limit: int,
    sample_max_rows: int,
    sample_keep_latest_snapshot_count: int,
    source_record_batch_limit: int,
    source_record_max_rows: int,
    source_record_fallback_min_batch_limit: int,
) -> dict[str, object]:
    read_model_report = await refresh_program_list_index.refresh(
        pool_limit,
        delta_batch_limit=delta_batch_limit,
        sample_refresh=True,
        sample_max_rows=sample_max_rows,
        sample_keep_latest_snapshot_count=sample_keep_latest_snapshot_count,
    )
    if read_model_report.get("status") == "failed":
        return {
            "status": "failed",
            "failed_stage": "program_list_index_sample_refresh",
            "error": _extract_error(read_model_report),
            "read_model": read_model_report,
        }

    source_record_report = await backfill_program_source_records.backfill_sample(
        batch_limit=source_record_batch_limit,
        max_rows=source_record_max_rows,
        min_batch_limit=source_record_fallback_min_batch_limit,
    )
    if source_record_report.get("status") == "failed":
        return {
            "status": "failed",
            "failed_stage": "program_source_records_sample_backfill",
            "error": _extract_error(source_record_report),
            "read_model": read_model_report,
            "source_records": source_record_report,
        }

    return {
        "status": "validation_sample_refresh",
        "read_model": read_model_report,
        "source_records": source_record_report,
    }


def main() -> int:
    refresh_program_list_index.load_backend_env()
    backfill_program_source_records.load_backend_env()
    parser = argparse.ArgumentParser(
        description="Run the free-plan-safe program validation sample flow: read-model sample refresh, then source-record sample backfill."
    )
    parser.add_argument(
        "--preset",
        choices=sorted(VALIDATION_SAMPLE_PRESETS.keys()),
        help="Apply a named validation preset first, then let explicit CLI flags override it.",
    )
    parser.add_argument(
        "--output",
        help="Write the final JSON report to this path as well as printing it to stdout.",
    )
    parser.add_argument(
        "--pool-limit",
        type=int,
        default=DEFAULT_VALIDATION_SAMPLE_OPTIONS["pool_limit"],
        help="Browse pool size for the read-model sample refresh.",
    )
    parser.add_argument(
        "--delta-batch-limit",
        type=int,
        default=DEFAULT_VALIDATION_SAMPLE_OPTIONS["delta_batch_limit"],
        help="Delta batch size for the read-model sample refresh.",
    )
    parser.add_argument(
        "--sample-max-rows",
        type=int,
        default=DEFAULT_VALIDATION_SAMPLE_OPTIONS["sample_max_rows"],
        help="Maximum program_list_index rows to keep after sample refresh trimming.",
    )
    parser.add_argument(
        "--sample-keep-latest-snapshot-count",
        type=int,
        default=DEFAULT_VALIDATION_SAMPLE_OPTIONS["sample_keep_latest_snapshot_count"],
        help="How many latest browse facet snapshots to keep during read-model sample refresh.",
    )
    parser.add_argument(
        "--source-record-batch-limit",
        type=int,
        default=DEFAULT_VALIDATION_SAMPLE_OPTIONS["source_record_batch_limit"],
        help="Maximum programs rows to sample for the source-record sample backfill.",
    )
    parser.add_argument(
        "--source-record-max-rows",
        type=int,
        default=DEFAULT_VALIDATION_SAMPLE_OPTIONS["source_record_max_rows"],
        help="Maximum program_source_records rows to keep after sample backfill trimming.",
    )
    parser.add_argument(
        "--source-record-fallback-min-batch-limit",
        type=int,
        default=DEFAULT_VALIDATION_SAMPLE_OPTIONS["source_record_fallback_min_batch_limit"],
        help="Smallest batch/max row fallback the bundled provenance step may use on retryable timeout or lock errors.",
    )
    args = parser.parse_args()
    options = _resolve_validation_sample_options(args)

    report = asyncio.run(
        run_validation_sample(
            pool_limit=options["pool_limit"],
            delta_batch_limit=options["delta_batch_limit"],
            sample_max_rows=options["sample_max_rows"],
            sample_keep_latest_snapshot_count=options["sample_keep_latest_snapshot_count"],
            source_record_batch_limit=options["source_record_batch_limit"],
            source_record_max_rows=options["source_record_max_rows"],
            source_record_fallback_min_batch_limit=options["source_record_fallback_min_batch_limit"],
        )
    )
    output_report: dict[str, object] = {
        **report,
        "requested_options": options,
    }
    if args.preset:
        output_report["preset"] = args.preset

    output_path = _resolve_output_path(args.output)
    if output_path is not None:
        output_report["output_path"] = str(output_path)
        _write_report(output_path, output_report)

    print(json.dumps(output_report, ensure_ascii=False, indent=2))
    return 1 if report.get("status") == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
