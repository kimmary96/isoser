from __future__ import annotations

import pytest
from fastapi import HTTPException

from routers import admin


def test_missing_program_column_name_parses_postgrest_schema_error() -> None:
    exc = HTTPException(
        status_code=500,
        detail="Supabase request failed: Could not find the 'is_certified' column of 'programs' in the schema cache",
    )

    assert admin._missing_program_column_name(exc) == "is_certified"


@pytest.mark.asyncio
async def test_upsert_program_payload_retries_without_missing_columns(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[list[str]] = []

    async def fake_request_supabase(*, method, path, params=None, payload=None, prefer=None):
        assert method == "POST"
        assert path == "/rest/v1/programs"
        assert isinstance(payload, list)
        calls.append(sorted(payload[0].keys()))

        if "is_certified" in payload[0]:
            raise HTTPException(
                status_code=500,
                detail="Supabase request failed: Could not find the 'is_certified' column of 'programs' in the schema cache",
            )
        return payload

    monkeypatch.setattr(admin, "request_supabase", fake_request_supabase)

    rows = await admin._upsert_program_payload(
        [
            {
                "hrd_id": "HRD-1",
                "title": "추천 파이프라인 테스트",
                "category": "IT",
                "is_certified": True,
                "is_active": True,
            }
        ]
    )

    assert len(calls) == 2
    assert "is_certified" in calls[0]
    assert "is_certified" not in calls[1]
    assert rows == [
        {
            "hrd_id": "HRD-1",
            "title": "추천 파이프라인 테스트",
            "category": "IT",
            "is_active": True,
        }
    ]


@pytest.mark.asyncio
async def test_upsert_program_payload_retries_row_by_row_with_existing_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    post_conflict_targets: list[str] = []

    async def fake_request_supabase(*, method, path, params=None, payload=None, prefer=None):
        assert path == "/rest/v1/programs"
        if method == "GET":
            if params == {"select": "id", "hrd_id": "eq.HRD-2", "limit": "1"}:
                return [{"id": "existing-program-id"}]
            return []

        assert method == "POST"
        post_conflict_targets.append(str((params or {}).get("on_conflict")))
        if params == {"on_conflict": "hrd_id"}:
            raise HTTPException(
                status_code=500,
                detail='Supabase request failed: duplicate key value violates unique constraint "programs_unique"',
            )
        return payload

    monkeypatch.setattr(admin, "request_supabase", fake_request_supabase)

    rows = await admin._upsert_program_payload(
        [
            {
                "hrd_id": "HRD-2",
                "title": "중복 제약 테스트",
                "source": "고용24",
                "is_active": True,
            }
        ]
    )

    assert post_conflict_targets == ["hrd_id", "id"]
    assert rows == [
        {
            "id": "existing-program-id",
            "hrd_id": "HRD-2",
            "title": "중복 제약 테스트",
            "source": "고용24",
            "is_active": True,
        }
    ]
