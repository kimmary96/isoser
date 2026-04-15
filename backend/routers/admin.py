from __future__ import annotations

import asyncio
import logging
import os
from datetime import date
from time import perf_counter
from typing import Any
from fastapi import APIRouter, Header, HTTPException, Query

from rag.programs_rag import ProgramsRAG
from rag.source_adapters.work24_training import Work24TrainingAdapter
from utils.supabase_admin import request_supabase
from rag.collector.normalizer import _classify_category

try:
    from backend.logging_config import get_logger, log_event
except ImportError:
    from logging_config import get_logger, log_event

router = APIRouter()
logger = get_logger(__name__)
programs_rag = ProgramsRAG()

if not os.getenv("ADMIN_SECRET_KEY", "").strip():
    log_event(
        logger,
        logging.WARNING,
        "admin_secret_missing",
        env_name="ADMIN_SECRET_KEY",
    )


def _build_prefer_header(*values: str) -> str:
    return ",".join(value for value in values if value)


def _require_admin_secret(authorization: str | None) -> None:
    expected_secret = os.getenv("ADMIN_SECRET_KEY", "").strip()
    if not expected_secret:
        raise HTTPException(status_code=503, detail="ADMIN_SECRET_KEY is not configured")

    provided_secret = (authorization or "").strip()
    if provided_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Forbidden")


def _add_months(base: date, months: int) -> date:
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    month_lengths = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(base.day, month_lengths[month - 1])
    return date(year, month, day)


def _default_start_dt() -> str:
    return date.today().strftime("%Y%m%d")


def _default_end_dt() -> str:
    return _add_months(date.today(), 6).strftime("%Y%m%d")


def _normalize_program_row(row: dict[str, Any]) -> dict[str, Any]:
    hrd_id = str(row.get("hrd_id") or "").strip()
    if not hrd_id:
        return {}

    title = str(row.get("title") or "").strip() or hrd_id
    provider_name = str(row.get("provider_name") or "").strip()
    provider = provider_name or str(row.get("provider") or "").strip() or None
    end_date = str(row.get("end_date") or "").strip() or None
    start_date = str(row.get("start_date") or "").strip() or None
    target_text = str(row.get("target") or "").strip()
    target = [target_text] if target_text else []
    category = str(row.get("category_label") or "").strip() or str(row.get("category") or "").strip()
    description = str(row.get("summary") or "").strip() or None

    return {
        "hrd_id": hrd_id,
        "title": title,
        "category": category or _classify_category(title),
        "location": str(row.get("location") or "").strip() or None,
        "provider": provider,
        "description": description,
        "start_date": start_date,
        "end_date": end_date,
        "deadline": end_date,
        "cost": row.get("cost"),
        "subsidy_amount": row.get("subsidy_amount"),
        "target": target or None,
        "source_url": str(row.get("source_url") or "").strip() or None,
        "source": str(row.get("source") or "").strip() or "work24_training",
        "is_active": True,
    }


def _deduplicate_program_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped_by_hrd_id: dict[str, dict[str, Any]] = {}
    for row in rows:
        hrd_id = str(row.get("hrd_id") or "").strip()
        if not hrd_id:
            continue
        deduped_by_hrd_id[hrd_id] = row
    return list(deduped_by_hrd_id.values())


async def _fetch_chroma_sync_candidates() -> list[dict[str, Any]]:
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": "id,title,description,category,location,provider,is_active,end_date",
            "end_date": "not.is.null",
            "order": "end_date.asc",
            "limit": "200",
        },
    )
    return rows if isinstance(rows, list) else []


async def _sync_program_batches(program_rows: list[dict[str, Any]]) -> tuple[int, int]:
    if not program_rows:
        return 0, 0

    if not programs_rag._manager.ensure_initialized(seed_data=False):
        log_event(logger, logging.ERROR, "admin_programs_chroma_init_failed")
        return 0, len(program_rows)

    chroma_synced = 0
    chroma_skipped = 0

    for batch_index in range(0, len(program_rows), 20):
        batch = program_rows[batch_index : batch_index + 20]
        batch_started_at = perf_counter()
        try:
            synced_count = programs_rag.sync(batch)
            chroma_synced += synced_count
            if synced_count < len(batch):
                chroma_skipped += len(batch) - synced_count
                log_event(
                    logger,
                    logging.WARNING,
                    "admin_programs_chroma_batch_partial",
                    batch_start=batch_index,
                    batch_size=len(batch),
                    synced_count=synced_count,
                    skipped_count=len(batch) - synced_count,
                    duration_seconds=round(perf_counter() - batch_started_at, 3),
                )
            else:
                log_event(
                    logger,
                    logging.INFO,
                    "admin_programs_chroma_batch_completed",
                    batch_start=batch_index,
                    batch_size=len(batch),
                    synced_count=synced_count,
                    duration_seconds=round(perf_counter() - batch_started_at, 3),
                )
        except Exception as exc:
            chroma_skipped += len(batch)
            log_event(
                logger,
                logging.WARNING,
                "admin_programs_chroma_batch_skipped",
                batch_start=batch_index,
                batch_size=len(batch),
                error=str(exc),
                rate_limited="429" in str(exc) or "Too Many Requests" in str(exc),
                duration_seconds=round(perf_counter() - batch_started_at, 3),
            )

        if batch_index + 20 < len(program_rows):
            await asyncio.sleep(2)

    return chroma_synced, chroma_skipped


@router.post("/sync/programs")
async def sync_programs(
    authorization: str | None = Header(default=None),
    start_dt: str | None = Query(default=None),
    end_dt: str | None = Query(default=None),
    area_code: str | None = Query(default=None),
    ncs_code: str | None = Query(default=None),
    max_pages: int | None = Query(default=None, ge=1),
) -> dict[str, Any]:
    started_at = perf_counter()
    resolved_start_dt = (start_dt or "").strip() or _default_start_dt()
    resolved_end_dt = (end_dt or "").strip() or _default_end_dt()

    try:
        _require_admin_secret(authorization)

        fetch_started_at = perf_counter()
        adapter = Work24TrainingAdapter()
        fetched_rows = adapter.fetch_all(
            start_dt=resolved_start_dt,
            end_dt=resolved_end_dt,
            area_code=area_code,
            ncs_code=ncs_code,
            max_pages=max_pages,
        )
        fetch_duration = round(perf_counter() - fetch_started_at, 3)
        log_event(
            logger,
            logging.INFO,
            "admin_programs_fetch_completed",
            start_dt=resolved_start_dt,
            end_dt=resolved_end_dt,
            area_code=area_code,
            ncs_code=ncs_code,
            max_pages=max_pages,
            duration_seconds=fetch_duration,
            fetched_count=len(fetched_rows or []),
        )
        if fetched_rows is None:
            raise HTTPException(status_code=503, detail="Failed to fetch Work24 training programs")

        payload = [normalized for row in fetched_rows if (normalized := _normalize_program_row(row))]
        payload = _deduplicate_program_rows(payload)
        if not payload:
            duration_seconds = round(perf_counter() - started_at, 3)
            log_event(
                logger,
                logging.INFO,
                "admin_programs_sync_completed",
                synced_count=0,
                chroma_synced=0,
                chroma_skipped=0,
                duration_seconds=duration_seconds,
            )
            return {
                "synced": 0,
                "chroma_synced": 0,
                "chroma_skipped": 0,
                "duration_seconds": duration_seconds,
            }

        upsert_started_at = perf_counter()
        rows = await request_supabase(
            method="POST",
            path="/rest/v1/programs",
            params={"on_conflict": "hrd_id"},
            payload=payload,
            prefer=_build_prefer_header("resolution=merge-duplicates", "return=representation"),
        )
        upsert_duration = round(perf_counter() - upsert_started_at, 3)
        synced_rows = rows if isinstance(rows, list) else []
        log_event(
            logger,
            logging.INFO,
            "admin_programs_upsert_completed",
            duration_seconds=upsert_duration,
            payload_count=len(payload),
            synced_count=len(synced_rows),
        )

        chroma_started_at = perf_counter()
        chroma_synced = 0
        chroma_skipped = 0
        try:
            chroma_candidates_started_at = perf_counter()
            chroma_candidates = await _fetch_chroma_sync_candidates()
            log_event(
                logger,
                logging.INFO,
                "admin_programs_chroma_candidates_fetched",
                duration_seconds=round(perf_counter() - chroma_candidates_started_at, 3),
                candidate_count=len(chroma_candidates),
            )
            chroma_synced, chroma_skipped = await _sync_program_batches(chroma_candidates)
        except Exception as exc:
            log_event(
                logger,
                logging.WARNING,
                "admin_programs_chroma_sync_failed",
                error=str(exc),
            )

        chroma_duration = round(perf_counter() - chroma_started_at, 3)
        log_event(
            logger,
            logging.INFO,
            "admin_programs_chroma_sync_completed",
            duration_seconds=chroma_duration,
            chroma_synced=chroma_synced,
            chroma_skipped=chroma_skipped,
        )

        duration_seconds = round(perf_counter() - started_at, 3)
        log_event(
            logger,
            logging.INFO,
            "admin_programs_sync_completed",
            fetched_count=len(fetched_rows),
            synced_count=len(synced_rows),
            chroma_synced=chroma_synced,
            chroma_skipped=chroma_skipped,
            start_dt=resolved_start_dt,
            end_dt=resolved_end_dt,
            area_code=area_code,
            ncs_code=ncs_code,
            max_pages=max_pages,
            duration_seconds=duration_seconds,
        )
        return {
            "synced": len(synced_rows),
            "chroma_synced": chroma_synced,
            "chroma_skipped": chroma_skipped,
            "duration_seconds": duration_seconds,
        }
    except HTTPException:
        raise
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "admin_programs_sync_failed",
            start_dt=resolved_start_dt,
            end_dt=resolved_end_dt,
            area_code=area_code,
            ncs_code=ncs_code,
            error=str(exc),
            duration_seconds=round(perf_counter() - started_at, 3),
        )
        raise HTTPException(status_code=500, detail=f"Program sync failed: {exc}") from exc
