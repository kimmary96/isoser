from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from utils.supabase_admin import get_current_user_from_authorization, request_supabase

router = APIRouter()


class BookmarkItem(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    program_id: str
    created_at: str | None = None
    program: dict[str, Any] | None = None


class BookmarkListResponse(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    items: list[BookmarkItem] = Field(default_factory=list)


async def _fetch_program_map(program_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not program_ids:
        return {}
    encoded_ids = ",".join(program_ids)
    rows = await request_supabase(
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
    current_user = await get_current_user_from_authorization(authorization)
    rows = await request_supabase(
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
    current_user = await get_current_user_from_authorization(authorization)
    existing_rows = await request_supabase(
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
        rows = await request_supabase(
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
    current_user = await get_current_user_from_authorization(authorization)
    await request_supabase(
        method="DELETE",
        path="/rest/v1/program_bookmarks",
        params={
            "user_id": f"eq.{current_user.id}",
            "program_id": f"eq.{program_id}",
        },
    )
    return {"ok": True}
