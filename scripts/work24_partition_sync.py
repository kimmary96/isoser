from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from time import perf_counter
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for path in (REPO_ROOT, BACKEND_ROOT):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from backend.rag.runtime_config import load_backend_dotenv, resolve_chroma_mode  # noqa: E402
from backend.rag.source_adapters.work24_supplementary import Work24SupplementaryAdapter  # noqa: E402
from backend.rag.source_adapters.work24_training import (  # noqa: E402
    DEFAULT_PAGE_SIZE,
    Work24TrainingAdapter,
    _extract_records,
    _extract_total_count,
    default_training_date_range,
)
from backend.routers.admin import (  # noqa: E402
    _deduplicate_program_rows,
    _normalize_program_row,
    _sync_program_batches,
    _upsert_program_payload,
)
from backend.utils.supabase_admin import request_supabase  # noqa: E402


@dataclass(frozen=True)
class RegionPartition:
    code: str
    name: str


@dataclass
class PartitionSyncOutcome:
    report: dict[str, Any]
    upserted_rows: list[dict[str, Any]]


REGION_PARTITIONS: tuple[RegionPartition, ...] = (
    RegionPartition("11", "서울"),
    RegionPartition("41", "경기"),
    RegionPartition("28", "인천"),
    RegionPartition("51", "강원"),
    RegionPartition("43", "충북"),
    RegionPartition("44", "충남"),
    RegionPartition("36", "세종"),
    RegionPartition("30", "대전"),
    RegionPartition("45", "전북"),
    RegionPartition("47", "경북"),
    RegionPartition("27", "대구"),
    RegionPartition("48", "경남"),
    RegionPartition("31", "울산"),
    RegionPartition("26", "부산"),
    RegionPartition("46", "전남"),
    RegionPartition("29", "광주"),
    RegionPartition("50", "제주"),
)

REGION_PARTITION_BY_CODE = {partition.code: partition for partition in REGION_PARTITIONS}
REGION_PARTITION_BY_NAME = {partition.name: partition for partition in REGION_PARTITIONS}
CHROMA_SYNC_FIELDS = (
    "id",
    "title",
    "summary",
    "description",
    "category",
    "location",
    "provider",
    "is_active",
    "end_date",
    "tags",
    "skills",
)
CHROMA_DB_SELECT = ",".join(("source_unique_key", *CHROMA_SYNC_FIELDS))
CHROMA_DB_FETCH_BATCH_SIZE = 100


def configure_stdout() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        return
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Work24 training programs partition sync by srchTraArea1.",
    )
    parser.add_argument("--start-dt", dest="start_dt", default=None)
    parser.add_argument("--end-dt", dest="end_dt", default=None)
    parser.add_argument("--start-from", dest="start_from", default=None, help="Region code or Korean name.")
    parser.add_argument("--stop-after", dest="stop_after", default=None, help="Region code or Korean name.")
    parser.add_argument("--include-seoul", action="store_true", help="Include Seoul partition in the run order.")
    parser.add_argument("--apply", action="store_true", help="Actually upsert fetched rows into Supabase.")
    parser.add_argument("--page-size", dest="page_size", type=int, default=DEFAULT_PAGE_SIZE)
    parser.add_argument("--max-pages", dest="max_pages", type=int, default=None)
    parser.add_argument("--sleep-seconds", dest="sleep_seconds", type=float, default=0.5)
    parser.add_argument("--region-pause-seconds", dest="region_pause_seconds", type=float, default=1.0)
    parser.add_argument("--upsert-retries", dest="upsert_retries", type=int, default=3)
    parser.add_argument(
        "--sync-chroma-at-end",
        action="store_true",
        help="After apply, sync upserted programs to persistent Chroma. Skips when CHROMA_MODE is not persistent.",
    )
    parser.add_argument("--report-path", dest="report_path", default=None, help="Optional JSON report output path.")
    return parser.parse_args()


def resolve_start_date_range(start_dt: str | None, end_dt: str | None) -> tuple[str, str]:
    default_start_dt, default_end_dt = default_training_date_range()
    return (start_dt or "").strip() or default_start_dt, (end_dt or "").strip() or default_end_dt


def resolve_start_partition(selector: str | None) -> RegionPartition | None:
    text = (selector or "").strip()
    if not text:
        return None
    return REGION_PARTITION_BY_CODE.get(text) or REGION_PARTITION_BY_NAME.get(text)


def ordered_region_partitions(
    *,
    include_seoul: bool,
    start_from: str | None = None,
    stop_after: str | None = None,
) -> list[RegionPartition]:
    partitions = list(REGION_PARTITIONS if include_seoul else REGION_PARTITIONS[1:])
    start_partition = resolve_start_partition(start_from)
    if start_partition:
        for index, partition in enumerate(partitions):
            if partition.code == start_partition.code:
                partitions = partitions[index:]
                break

    stop_partition = resolve_start_partition(stop_after)
    if stop_partition:
        for index, partition in enumerate(partitions):
            if partition.code == stop_partition.code:
                return partitions[: index + 1]
    return partitions


def build_adapter(*, region_code_map: dict[str, dict[str, str]], page_size: int, sleep_seconds: float) -> Work24TrainingAdapter:
    return Work24TrainingAdapter(
        region_code_map=region_code_map,
        page_size=page_size,
        sleep_seconds=sleep_seconds,
    )


def write_json_report(path: str | None, payload: dict[str, Any]) -> None:
    if not path:
        return
    report_path = Path(path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def preview_partition(
    adapter: Work24TrainingAdapter,
    *,
    partition: RegionPartition,
    start_dt: str,
    end_dt: str,
) -> dict[str, Any]:
    payload = adapter._request_payload(  # pyright: ignore[reportPrivateUsage]
        page_num=1,
        page_size=adapter.page_size,
        start_dt=start_dt,
        end_dt=end_dt,
        area_code=partition.code,
        area2_code=None,
        ncs_code=None,
        ncs1_code=None,
        ncs2_code=None,
        ncs3_code=None,
        ncs4_code=None,
        weekend_code=None,
        course_type=None,
        training_category=None,
        training_type=None,
        process_name=None,
        organization_name=None,
        sort="ASC",
        sort_col="2",
    )
    total_count = _extract_total_count(payload)
    page_rows = len(_extract_records(payload)) if payload is not None else 0
    estimated_pages = math.ceil(total_count / adapter.page_size) if total_count else 0
    return {
        "code": partition.code,
        "name": partition.name,
        "total_count": total_count,
        "page_rows": page_rows,
        "page_size": adapter.page_size,
        "estimated_pages": estimated_pages,
        "within_api_page_limit": estimated_pages <= 1000,
    }


async def sync_partition(
    adapter: Work24TrainingAdapter,
    *,
    partition: RegionPartition,
    start_dt: str,
    end_dt: str,
    max_pages: int | None,
    upsert_retries: int,
    collect_chroma_rows: bool = False,
) -> PartitionSyncOutcome:
    started_at = perf_counter()
    fetched_rows = adapter.fetch_all(
        start_dt=start_dt,
        end_dt=end_dt,
        area_code=partition.code,
        sort="ASC",
        sort_col="2",
        max_pages=max_pages,
    )
    normalized_payload = [
        normalized
        for row in (fetched_rows or [])
        if (normalized := _normalize_program_row(row))
    ]
    payload = _deduplicate_program_rows(normalized_payload)
    deadline_from_start_count = sum(
        1
        for row in payload
        if row.get("deadline") == row.get("start_date")
        and isinstance(row.get("compare_meta"), dict)
        and row["compare_meta"].get("deadline_source") == "traStartDate"
    )
    last_error: str | None = None
    rows: list[dict[str, Any]] | None = None
    for attempt in range(1, max(upsert_retries, 1) + 1):
        try:
            rows = await _upsert_program_payload(payload)
            last_error = None
            break
        except Exception as exc:
            last_error = str(exc)
            if attempt < max(upsert_retries, 1):
                await asyncio.sleep(min(2 * attempt, 10))
    duration_seconds = round(perf_counter() - started_at, 3)
    result: dict[str, Any] = {
        "code": partition.code,
        "name": partition.name,
        "fetched_rows": len(fetched_rows or []),
        "payload_rows": len(payload),
        "deadline_from_traStartDate_rows": deadline_from_start_count,
        "upserted_rows": len(rows or []),
        "duration_seconds": duration_seconds,
    }
    if last_error:
        result["error"] = last_error
    chroma_rows = rows or []
    if collect_chroma_rows and not last_error:
        chroma_rows = await fetch_chroma_db_rows_for_payload(payload)
        result["chroma_candidate_rows"] = len(chroma_rows)
    return PartitionSyncOutcome(report=result, upserted_rows=chroma_rows)


def quote_postgrest_in_values(values: list[str]) -> str:
    return ",".join(f'"{value.replace(chr(34), chr(92) + chr(34))}"' for value in values if value)


async def fetch_chroma_db_rows_for_payload(payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
    keys: list[str] = []
    seen_keys: set[str] = set()
    for row in payload:
        key = str(row.get("source_unique_key") or "").strip()
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        keys.append(key)

    rows: list[dict[str, Any]] = []
    for index in range(0, len(keys), CHROMA_DB_FETCH_BATCH_SIZE):
        chunk = keys[index : index + CHROMA_DB_FETCH_BATCH_SIZE]
        fetched = await request_supabase(
            method="GET",
            path="/rest/v1/programs",
            params={
                "select": CHROMA_DB_SELECT,
                "source_unique_key": f"in.({quote_postgrest_in_values(chunk)})",
            },
        )
        if isinstance(fetched, list):
            rows.extend(row for row in fetched if isinstance(row, dict))
    return rows


def build_chroma_sync_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chroma_rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for row in rows:
        program_id = str(row.get("id") or "").strip()
        if not program_id or program_id in seen_ids:
            continue
        seen_ids.add(program_id)
        chroma_rows.append({field: row.get(field) for field in CHROMA_SYNC_FIELDS if field in row})
    return chroma_rows


async def sync_chroma_rows_at_end(
    rows: list[dict[str, Any]],
    *,
    apply_mode: bool,
    sync_requested: bool,
) -> dict[str, Any] | None:
    if not sync_requested:
        return None

    chroma_mode = resolve_chroma_mode()
    candidate_rows = build_chroma_sync_rows(rows)
    result: dict[str, Any] = {
        "requested": True,
        "chroma_mode": chroma_mode,
        "candidate_count": len(candidate_rows),
    }
    if not apply_mode:
        result.update({"status": "skipped", "reason": "requires_apply"})
        return result
    if chroma_mode != "persistent":
        result.update({"status": "skipped", "reason": "non_persistent_chroma_mode"})
        return result
    if not candidate_rows:
        result.update({"status": "skipped", "reason": "no_upserted_rows"})
        return result

    started_at = perf_counter()
    synced_count, skipped_count = await _sync_program_batches(candidate_rows)
    result.update(
        {
            "status": "completed",
            "synced_count": synced_count,
            "skipped_count": skipped_count,
            "duration_seconds": round(perf_counter() - started_at, 3),
        }
    )
    return result


async def main() -> None:
    configure_stdout()
    load_backend_dotenv()
    args = parse_args()
    start_dt, end_dt = resolve_start_date_range(args.start_dt, args.end_dt)
    partitions = ordered_region_partitions(
        include_seoul=args.include_seoul,
        start_from=args.start_from,
        stop_after=args.stop_after,
    )
    region_code_map: dict[str, dict[str, str]] = {}
    try:
        region_code_map = Work24SupplementaryAdapter().fetch_region_code_map()
    except Exception as exc:
        print(json.dumps({"event": "region_code_map_failed", "error": str(exc)}, ensure_ascii=False))

    adapter = build_adapter(
        region_code_map=region_code_map,
        page_size=args.page_size,
        sleep_seconds=args.sleep_seconds,
    )

    preview = [
        preview_partition(
            adapter,
            partition=partition,
            start_dt=start_dt,
            end_dt=end_dt,
        )
        for partition in partitions
    ]

    result: dict[str, Any] = {
        "mode": "apply" if args.apply else "preview",
        "start_dt": start_dt,
        "end_dt": end_dt,
        "include_seoul": args.include_seoul,
        "start_from": args.start_from,
        "stop_after": args.stop_after,
        "partition_order": [asdict(partition) for partition in partitions],
        "preview": preview,
        "sync_results": [],
    }

    chroma_source_rows: list[dict[str, Any]] = []
    if args.apply:
        for index, partition in enumerate(partitions):
            sync_outcome = await sync_partition(
                adapter,
                partition=partition,
                start_dt=start_dt,
                end_dt=end_dt,
                max_pages=args.max_pages,
                upsert_retries=args.upsert_retries,
                collect_chroma_rows=args.sync_chroma_at_end,
            )
            result["sync_results"].append(sync_outcome.report)
            if args.sync_chroma_at_end:
                chroma_source_rows.extend(sync_outcome.upserted_rows)
            print(json.dumps({"event": "partition_synced", **sync_outcome.report}, ensure_ascii=False))
            write_json_report(args.report_path, result)
            if index + 1 < len(partitions) and args.region_pause_seconds > 0:
                await asyncio.sleep(args.region_pause_seconds)

    if args.sync_chroma_at_end:
        chroma_sync_result = await sync_chroma_rows_at_end(
            chroma_source_rows,
            apply_mode=args.apply,
            sync_requested=args.sync_chroma_at_end,
        )
        if chroma_sync_result is not None:
            result["chroma_sync"] = chroma_sync_result
            print(json.dumps({"event": "chroma_sync", **chroma_sync_result}, ensure_ascii=False))

    write_json_report(args.report_path, result)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
