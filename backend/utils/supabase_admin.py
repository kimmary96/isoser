from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Any

import httpx
from fastapi import Header, HTTPException
from pydantic import BaseModel, ConfigDict


@dataclass(frozen=True, slots=True)
class SupabaseAdminSettings:
    url: str
    service_role_key: str
    timeout_seconds: float


class CurrentUser(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str
    email: str | None = None


def _read_local_env_value(name: str) -> str:
    candidates = (
        Path(__file__).resolve().parents[1] / ".env",
        Path(__file__).resolve().parents[2] / "frontend" / ".env.local",
    )

    for path in candidates:
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() != name:
                continue
            return value.strip().strip("'\"")

    return ""


def get_supabase_admin_settings() -> SupabaseAdminSettings:
    supabase_url = (
        os.getenv("SUPABASE_URL")
        or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        or _read_local_env_value("SUPABASE_URL")
        or _read_local_env_value("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    ).strip()
    service_role_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or _read_local_env_value("SUPABASE_SERVICE_ROLE_KEY")
        or ""
    ).strip()
    timeout_raw = (
        os.getenv("SUPABASE_TIMEOUT_SECONDS")
        or _read_local_env_value("SUPABASE_TIMEOUT_SECONDS")
        or None
    )

    if not supabase_url or not service_role_key:
        raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        timeout_seconds = float(timeout_raw) if timeout_raw else 10.0
    except ValueError:
        timeout_seconds = 10.0

    return SupabaseAdminSettings(
        url=supabase_url.rstrip("/"),
        service_role_key=service_role_key,
        timeout_seconds=timeout_seconds,
    )


def build_service_headers(service_role_key: str, *, prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


async def request_supabase(
    *,
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    payload: dict[str, Any] | list[dict[str, Any]] | None = None,
    prefer: str | None = None,
) -> Any:
    settings = get_supabase_admin_settings()
    async with httpx.AsyncClient(timeout=settings.timeout_seconds, trust_env=False) as client:
        response = await client.request(
            method,
            f"{settings.url}{path}",
            params=params,
            json=payload,
            headers=build_service_headers(settings.service_role_key, prefer=prefer),
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


async def get_current_user_from_authorization(
    authorization: str = Header(...),
) -> CurrentUser:
    token = authorization.removeprefix("Bearer").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authorization bearer token is required")

    settings = get_supabase_admin_settings()
    headers = {
        "apikey": settings.service_role_key,
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=settings.timeout_seconds, trust_env=False) as client:
        response = await client.get(f"{settings.url}/auth/v1/user", headers=headers)

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail="Invalid access token")
    if not response.is_success:
        raise HTTPException(status_code=500, detail="Failed to verify user token")

    body = response.json()
    return CurrentUser(id=str(body["id"]), email=body.get("email"))
