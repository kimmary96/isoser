from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter()


class CurrentUser(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str
    email: str | None = None


class BookmarkItem(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    program_id: str
    created_at: str | None = None
    program: dict[str, Any] | None = None


class BookmarkListResponse(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    items: list[BookmarkItem] = Field(default_factory=list)


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
    payload: dict[str, Any] | None = None,
    prefer: str | None = None,
) -> Any:
    supabase_url, service_role_key, timeout_seconds = _get_supabase_settings()
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
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
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.get(f"{supabase_url}/auth/v1/user", headers=headers)

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail="Invalid access token")
    if not response.is_success:
        raise HTTPException(status_code=500, detail="Failed to verify user token")

    body = response.json()
    return CurrentUser(id=str(body["id"]), email=body.get("email"))


async def _fetch_program_map(program_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not program_ids:
        return {}
    encoded_ids = ",".join(program_ids)
    rows = await _request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": "*",
            "id": f"in.({encoded_ids})",
        },
    )
    if not isinstance(rows, list):
        return {}
    return {str(row.get("id")): row for row in rows if row.get("id") is not None}


@router.get("", response_model=BookmarkListResponse)
async def get_bookmarks(authorization: str = Header(...)) -> BookmarkListResponse:
    current_user = await _get_current_user(authorization)
    rows = await _request_supabase(
        method="GET",
        path="/rest/v1/program_bookmarks",
        params={
            "select": "program_id,created_at",
            "user_id": f"eq.{current_user.id}",
            "order": "created_at.desc",
        },
    )
    items = rows if isinstance(rows, list) else []
    program_map = await _fetch_program_map(
        [str(row.get("program_id")) for row in items if row.get("program_id") is not None]
    )
    return BookmarkListResponse(
        items=[
            BookmarkItem(
                program_id=str(row["program_id"]),
                created_at=row.get("created_at"),
                program=program_map.get(str(row["program_id"])),
            )
            for row in items
            if row.get("program_id") is not None
        ]
    )


@router.post("/{program_id}", response_model=BookmarkItem)
async def create_bookmark(program_id: str, authorization: str = Header(...)) -> BookmarkItem:
    current_user = await _get_current_user(authorization)
    existing_rows = await _request_supabase(
        method="GET",
        path="/rest/v1/program_bookmarks",
        params={
            "select": "program_id,created_at",
            "user_id": f"eq.{current_user.id}",
            "program_id": f"eq.{program_id}",
            "limit": "1",
        },
    )
    if isinstance(existing_rows, list) and existing_rows:
        row = existing_rows[0]
    else:
        rows = await _request_supabase(
            method="POST",
            path="/rest/v1/program_bookmarks",
            payload={"user_id": current_user.id, "program_id": program_id},
            prefer="return=representation",
        )
        if not isinstance(rows, list) or not rows:
            raise HTTPException(status_code=500, detail="Failed to create bookmark")
        row = rows[0]

    program_map = await _fetch_program_map([program_id])
    return BookmarkItem(
        program_id=str(row["program_id"]),
        created_at=row.get("created_at"),
        program=program_map.get(program_id),
    )


@router.delete("/{program_id}")
async def delete_bookmark(program_id: str, authorization: str = Header(...)) -> dict[str, bool]:
    current_user = await _get_current_user(authorization)
    await _request_supabase(
        method="DELETE",
        path="/rest/v1/program_bookmarks",
        params={
            "user_id": f"eq.{current_user.id}",
            "program_id": f"eq.{program_id}",
        },
    )
    return {"ok": True}
