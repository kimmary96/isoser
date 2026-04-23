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


def test_normalize_program_row_does_not_copy_work24_end_date_to_deadline() -> None:
    row = admin._normalize_program_row(
        {
            "hrd_id": "HRD-1",
            "title": "고용24 훈련 과정",
            "source": "고용24",
            "start_date": "2026-05-01",
            "end_date": "2026-06-30",
        }
    )

    assert row["end_date"] == "2026-06-30"
    assert row["deadline"] is None


def test_normalize_program_row_keeps_distinct_work24_deadline() -> None:
    row = admin._normalize_program_row(
        {
            "hrd_id": "HRD-1",
            "title": "고용24 훈련 과정",
            "source": "고용24",
            "end_date": "2026-06-30",
            "deadline": "2026-05-20",
        }
    )

    assert row["deadline"] == "2026-05-20"


def test_normalize_program_row_trusts_training_start_deadline_source_for_one_day_course() -> None:
    row = admin._normalize_program_row(
        {
            "hrd_id": "HRD-1",
            "title": "고용24 1일 과정",
            "source": "고용24",
            "start_date": "2026-05-20",
            "end_date": "2026-05-20",
            "deadline": "2026-05-20",
            "deadline_source": "traStartDate",
        }
    )

    assert row["deadline"] == "2026-05-20"


def test_normalize_program_row_preserves_work24_region_fields() -> None:
    row = admin._normalize_program_row(
        {
            "hrd_id": "HRD-1",
            "title": "고용24 훈련 과정",
            "source": "고용24",
            "location": "경기도 성남시 분당구",
        }
    )

    assert row["region"] == "경기"
    assert row["region_detail"] == "성남시 분당구"


def test_normalize_program_row_builds_work24_source_unique_key_from_raw_session_fields() -> None:
    row = admin._normalize_program_row(
        {
            "hrd_id": "AIG202500001",
            "title": "고용24 훈련 과정",
            "source": "고용24",
            "raw": {
                "trprId": "AIG202500001",
                "trprDegr": "7",
                "trainstCstId": "500012345678",
                "title": "고용24 훈련 과정",
                "titleLink": "https://www.work24.go.kr/hr/a/a/3100/selectTracseDetl.do?tracseId=AIG202500001&tracseTme=7&trainstCstmrId=500012345678",
                "ncsCd": "20010201",
                "contents": "Python과 React 실습 과정",
            },
        }
    )

    assert row["source_unique_key"] == "work24:AIG202500001:7:500012345678"
    assert row["link"]
    assert row["compare_meta"]["trpr_degr"] == "7"
    assert row["skills"]


def test_deduplicate_program_rows_preserves_same_hrd_id_with_distinct_source_unique_keys() -> None:
    rows = admin._deduplicate_program_rows(
        [
            {"hrd_id": "HRD-1", "source_unique_key": "work24:HRD-1:1:1000", "title": "1회차"},
            {"hrd_id": "HRD-1", "source_unique_key": "work24:HRD-1:2:1000", "title": "2회차"},
            {"hrd_id": "HRD-1", "source_unique_key": "work24:HRD-1:2:1000", "title": "2회차 갱신"},
        ]
    )

    assert [row["title"] for row in rows] == ["1회차", "2회차 갱신"]


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
async def test_upsert_program_payload_batches_large_sync_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    call_sizes: list[int] = []

    async def fake_request_supabase(*, method, path, params=None, payload=None, prefer=None):
        assert method == "POST"
        assert path == "/rest/v1/programs"
        assert isinstance(payload, list)
        call_sizes.append(len(payload))
        return payload

    monkeypatch.setattr(admin, "request_supabase", fake_request_supabase)

    rows = await admin._upsert_program_payload(
        [
            {
                "hrd_id": f"HRD-{index}",
                "source_unique_key": f"work24:HRD-{index}:1:5000",
                "title": f"훈련 과정 {index}",
                "source": "고용24",
                "category": "IT",
                "is_active": True,
            }
            for index in range(admin.PROGRAM_UPSERT_BATCH_SIZE + 1)
        ]
    )

    assert call_sizes == [admin.PROGRAM_UPSERT_BATCH_SIZE, 1]
    assert len(rows) == admin.PROGRAM_UPSERT_BATCH_SIZE + 1


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


@pytest.mark.asyncio
async def test_upsert_single_source_unique_key_does_not_merge_by_hrd_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    get_params: list[dict] = []
    post_conflict_targets: list[str] = []

    async def fake_request_supabase(*, method, path, params=None, payload=None, prefer=None):
        assert path == "/rest/v1/programs"
        if method == "GET":
            get_params.append(params or {})
            return []

        assert method == "POST"
        post_conflict_targets.append(str((params or {}).get("on_conflict")))
        return payload

    monkeypatch.setattr(admin, "request_supabase", fake_request_supabase)

    rows = await admin._upsert_single_program_row(
        {
            "hrd_id": "HRD-2",
            "source_unique_key": "work24:HRD-2:2:5000",
            "title": "중복 제약 테스트",
            "source": "고용24",
            "is_active": True,
        }
    )

    assert get_params == [
        {
            "select": "id",
            "source_unique_key": "eq.work24:HRD-2:2:5000",
            "limit": "1",
        }
    ]
    assert post_conflict_targets == ["source_unique_key"]
    assert rows == [
        {
            "hrd_id": "HRD-2",
            "source_unique_key": "work24:HRD-2:2:5000",
            "title": "중복 제약 테스트",
            "source": "고용24",
            "is_active": True,
        }
    ]


@pytest.mark.asyncio
async def test_sync_programs_passes_documented_work24_filters(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}

    class FakeAdapter:
        def fetch_all(self, **kwargs):
            captured.update(kwargs)
            return []

    monkeypatch.setenv("ADMIN_SECRET_KEY", "secret")
    monkeypatch.setenv("WORK24_TRAINING_AUTH_KEY", "work24-key")
    monkeypatch.delenv("WORK24_COMMON_CODES_AUTH_KEY", raising=False)
    monkeypatch.setattr(admin, "Work24TrainingAdapter", lambda: FakeAdapter())

    result = await admin.sync_programs(
        authorization="secret",
        start_dt="20260423",
        end_dt="20261023",
        area_code=None,
        srch_tra_area1="11",
        area2_code="11680",
        ncs_code="20010201",
        ncs1_code="20",
        ncs2_code="2001",
        ncs3_code="200102",
        ncs4_code="20010201",
        weekend_code="3",
        course_type="C0104",
        training_category="M1005",
        training_type="M1010",
        process_name="AI",
        organization_name="테스트기관",
        sort="DESC",
        sort_col="5",
        max_pages=2,
    )

    assert result["synced"] == 0
    assert captured == {
        "start_dt": "20260423",
        "end_dt": "20261023",
        "area_code": "11",
        "area2_code": "11680",
        "ncs_code": "20010201",
        "ncs1_code": "20",
        "ncs2_code": "2001",
        "ncs3_code": "200102",
        "ncs4_code": "20010201",
        "weekend_code": "3",
        "course_type": "C0104",
        "training_category": "M1005",
        "training_type": "M1010",
        "process_name": "AI",
        "organization_name": "테스트기관",
        "sort": "DESC",
        "sort_col": "5",
        "max_pages": 2,
    }
