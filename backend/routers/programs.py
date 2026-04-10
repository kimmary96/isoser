from __future__ import annotations

from dataclasses import asdict
import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from rag.programs_rag import ProgramsRAG

try:
    from backend.logging_config import get_logger, log_event
except ImportError:
    from logging_config import get_logger, log_event

router = APIRouter()
logger = get_logger(__name__)
programs_rag = ProgramsRAG()

PROGRAM_SELECT_COLUMNS = "*"
PROFILE_SELECT_COLUMNS = (
    "id,name,email,phone,education,career,education_history,awards,certifications,"
    "languages,skills,self_intro,bio,portfolio_url"
)
ACTIVITY_SELECT_COLUMNS = "id,type,title,role,skills,description,is_visible"


class CurrentUser(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str
    email: str | None = None


class ProgramListResponse(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    items: list[dict[str, Any]]
    page: int
    page_size: int
    has_more: bool


class ProgramRecommendationItem(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    program_id: str
    score: float | None = None
    reason: str
    fit_keywords: list[str] = Field(default_factory=list)
    program: dict[str, Any]


class ProgramRecommendResponse(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    items: list[ProgramRecommendationItem]
    synced_count: int


class ProgramRecommendRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    top_k: int = Field(default=5, ge=1, le=10)


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


def _service_headers(service_role_key: str, *, prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


async def _request_supabase(
    *,
    method: str,
    path: str,
    params: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
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


async def _get_current_user(authorization: str = Header(...)) -> CurrentUser:
    token = authorization.removeprefix("Bearer").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authorization bearer token is required")

    supabase_url, service_role_key, timeout_seconds = _get_supabase_settings()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=timeout_seconds, trust_env=False) as client:
        response = await client.get(f"{supabase_url}/auth/v1/user", headers=headers)

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail="Invalid access token")
    if not response.is_success:
        raise HTTPException(status_code=500, detail="Failed to verify user token")

    body = response.json()
    return CurrentUser(id=str(body["id"]), email=body.get("email"))


async def _fetch_profile(user_id: str) -> dict[str, Any]:
    rows = await _request_supabase(
        method="GET",
        path="/rest/v1/profiles",
        params={
            "select": PROFILE_SELECT_COLUMNS,
            "id": f"eq.{user_id}",
            "limit": "1",
        },
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="Profile not found")
    return rows[0]


async def _fetch_visible_activities(user_id: str) -> list[dict[str, Any]]:
    rows = await _request_supabase(
        method="GET",
        path="/rest/v1/activities",
        params={
            "select": ACTIVITY_SELECT_COLUMNS,
            "user_id": f"eq.{user_id}",
            "is_visible": "eq.true",
            "order": "updated_at.desc",
        },
    )
    return rows if isinstance(rows, list) else []


async def _fetch_programs(
    *,
    category: str | None = None,
    location: str | None = None,
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 20,
) -> list[dict[str, Any]]:
    params = {
        "select": PROGRAM_SELECT_COLUMNS,
        "order": "created_at.desc",
        "limit": str(page_size),
        "offset": str((page - 1) * page_size),
    }
    if category:
        params["category"] = f"eq.{category}"
    if location:
        params["location"] = f"ilike.*{location}*"
    if is_active is not None:
        params["is_active"] = f"eq.{str(is_active).lower()}"

    rows = await _request_supabase(method="GET", path="/rest/v1/programs", params=params)
    return rows if isinstance(rows, list) else []


@router.get("", response_model=ProgramListResponse)
async def list_programs(
    category: str | None = Query(default=None),
    location: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ProgramListResponse:
    items = await _fetch_programs(
        category=category,
        location=location,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    return ProgramListResponse(
        items=items,
        page=page,
        page_size=page_size,
        has_more=len(items) == page_size,
    )


@router.get("/{program_id}")
async def get_program(program_id: str) -> dict[str, Any]:
    rows = await _request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": PROGRAM_SELECT_COLUMNS,
            "id": f"eq.{program_id}",
            "limit": "1",
        },
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="Program not found")
    return rows[0]


@router.post("/recommend", response_model=ProgramRecommendResponse)
async def recommend_programs(
    payload: ProgramRecommendRequest,
    authorization: str = Header(...),
) -> ProgramRecommendResponse:
    current_user = await _get_current_user(authorization)
    profile = await _fetch_profile(current_user.id)
    activities = await _fetch_visible_activities(current_user.id)
    programs = await _fetch_programs(is_active=True, page=1, page_size=2000)
    items = await programs_rag.recommend(
        profile=profile,
        activities=activities,
        programs=programs,
        top_k=payload.top_k,
    )

    log_event(
        logger,
        logging.INFO,
        "programs_recommended",
        user_id=current_user.id,
        top_k=payload.top_k,
        recommendation_count=len(items),
    )
    return ProgramRecommendResponse(
        items=[ProgramRecommendationItem.model_validate(asdict(item)) for item in items],
        synced_count=0,
    )
