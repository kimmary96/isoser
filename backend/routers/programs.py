import os
from typing import Any

import requests
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

try:
    from rag.collector.scheduler import run_all_collectors
except ImportError:
    from backend.rag.collector.scheduler import run_all_collectors

programs_router = APIRouter(prefix="/programs", tags=["programs"])


def _get_supabase_settings() -> tuple[str, str, float]:
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_KEY", "").strip()
    timeout_seconds = 10.0
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="SUPABASE_URL or SUPABASE_KEY is not configured.")
    return supabase_url.rstrip("/"), supabase_key, timeout_seconds


async def _request_supabase(
    *,
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
) -> Any:
    supabase_url, supabase_key, timeout_seconds = _get_supabase_settings()
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    response = requests.request(
        method,
        f"{supabase_url}{path}",
        headers=headers,
        params=params,
        timeout=timeout_seconds,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@programs_router.get("/")
async def list_programs(
    category: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    limit: int = Query(default=20, ge=1),
    offset: int = Query(default=0, ge=0),
) -> Any:
    params: dict[str, Any] = {
        "select": "*",
        "limit": limit,
        "offset": offset,
        "order": "deadline.asc.nullslast",
    }
    if category:
        params["category"] = f"eq.{category}"
    if scope:
        params["scope"] = f"eq.{scope}"
    if region_detail:
        params["region_detail"] = f"eq.{region_detail}"

    return await _request_supabase(method="GET", path="/rest/v1/programs", params=params)


@programs_router.get("/popular")
async def list_popular_programs() -> Any:
    params = {
        "select": "*",
        "is_ad": "eq.false",
        "order": "deadline.asc.nullslast",
        "limit": 10,
    }
    return await _request_supabase(method="GET", path="/rest/v1/programs", params=params)


@programs_router.get("/{program_id}")
async def get_program(program_id: str) -> Any:
    params = {
        "select": "*",
        "id": f"eq.{program_id}",
        "limit": 1,
    }
    rows = await _request_supabase(method="GET", path="/rest/v1/programs", params=params)
    if not rows:
        raise HTTPException(status_code=404, detail="Program not found")
    return rows[0]


@programs_router.post("/sync")
async def sync_programs(background_tasks: BackgroundTasks) -> dict[str, str]:
    background_tasks.add_task(run_all_collectors)
    return {"message": "동기화 시작됨", "status": "running"}


# main.py에 추가: app.include_router(programs_router)
