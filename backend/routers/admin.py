from __future__ import annotations

import logging
import os
from datetime import date
from time import perf_counter
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, Query

from rag.programs_rag import ProgramsRAG
from rag.source_adapters.work24_training import Work24TrainingAdapter

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


def _get_supabase_settings() -> tuple[str, str, float]:
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    timeout_raw = os.getenv("SUPABASE_TIMEOUT_SECONDS")
    if not supabase_url or not service_role_key:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        timeout_seconds = float(timeout_raw) if timeout_raw else 10.0
    except ValueError:
        timeout_seconds = 10.0
    return supabase_url.rstrip("/"), service_role_key, timeout_seconds


def _build_prefer_header(*values: str) -> str:
    return ",".join(value for value in values if value)


def _service_headers(service_role_key: str, *, prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


async def _request_supabase(
    *,
    method: str,
    path: str,
    params: dict[str, str] | None = None,
    payload: dict[str, Any] | list[dict[str, Any]] | None = None,
    prefer: str | None = None,
) -> Any:
    supabase_url, service_role_key, timeout_seconds = _get_supabase_settings()
    async with httpx.AsyncClient(timeout=timeout_seconds, trust_env=False) as client:
        response = await client.request(
            method,
            f"{supabase_url}{path}",
            params=params,
            json=payload,
            headers=_service_headers(service_role_key, prefer=prefer),
        )

    if response.is_success:
        if not response.content:
            return None
        return response.json()

    detail = response.text
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        detail = str(body.get("message") or body.get("hint") or body.get("details") or detail)
    raise HTTPException(status_code=500, detail=f"Supabase request failed: {detail}")


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

    return {
        "hrd_id": hrd_id,
        "title": str(row.get("title") or "").strip() or hrd_id,
        "category": str(row.get("category") or "").strip() or None,
        "location": str(row.get("location") or "").strip() or None,
        "provider": str(row.get("provider") or "").strip() or None,
        "start_date": str(row.get("start_date") or "").strip() or None,
        "end_date": str(row.get("end_date") or "").strip() or None,
        "cost": row.get("cost"),
        "subsidy_amount": row.get("subsidy_amount"),
        "target": str(row.get("target") or "").strip() or None,
        "source_url": str(row.get("source_url") or "").strip() or None,
        "source": str(row.get("source") or "").strip() or "work24_training",
        "is_active": True,
    }


@router.post("/sync/programs")
async def sync_programs(
    authorization: str | None = Header(default=None),
    start_dt: str | None = Query(default=None),
    end_dt: str | None = Query(default=None),
    area_code: str | None = Query(default=None),
    ncs_code: str | None = Query(default=None),
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
            duration_seconds=fetch_duration,
            fetched_count=len(fetched_rows or []),
        )
        if fetched_rows is None:
            raise HTTPException(status_code=503, detail="Failed to fetch Work24 training programs")

        payload = [normalized for row in fetched_rows if (normalized := _normalize_program_row(row))]
        if not payload:
            duration_seconds = round(perf_counter() - started_at, 3)
            log_event(
                logger,
                logging.INFO,
                "admin_programs_sync_completed",
                synced_count=0,
                chroma_synced=0,
                duration_seconds=duration_seconds,
            )
            return {"synced": 0, "chroma_synced": 0, "duration_seconds": duration_seconds}

        upsert_started_at = perf_counter()
        rows = await _request_supabase(
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
            synced_count=len(synced_rows),
        )

        chroma_started_at = perf_counter()
        chroma_synced = programs_rag.sync(synced_rows)
        chroma_duration = round(perf_counter() - chroma_started_at, 3)
        log_event(
            logger,
            logging.INFO,
            "admin_programs_chroma_sync_completed",
            duration_seconds=chroma_duration,
            chroma_synced=chroma_synced,
        )

        duration_seconds = round(perf_counter() - started_at, 3)
        log_event(
            logger,
            logging.INFO,
            "admin_programs_sync_completed",
            fetched_count=len(fetched_rows),
            synced_count=len(synced_rows),
            chroma_synced=chroma_synced,
            start_dt=resolved_start_dt,
            end_dt=resolved_end_dt,
            area_code=area_code,
            ncs_code=ncs_code,
            duration_seconds=duration_seconds,
        )
        return {
            "synced": len(synced_rows),
            "chroma_synced": chroma_synced,
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
