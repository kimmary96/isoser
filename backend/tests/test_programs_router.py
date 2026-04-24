from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
import re
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from services.program_list_scoring import compute_recommended_score
from routers import programs


def _sample_program(program_id: str = "program-1", *, deadline: str | None = None) -> dict[str, object]:
    return {
        "id": program_id,
        "title": "AI 부트캠프",
        "category": "IT",
        "location": "서울",
        "is_active": True,
        "deadline": deadline or (date.today() + timedelta(days=7)).isoformat(),
    }


def test_program_surface_serializers_split_base_and_card_layers() -> None:
    program = {
        **_sample_program(),
        "summary": "AI와 데이터 기초를 배우는 과정",
        "description": "설명",
        "tags": ["AI"],
        "skills": ["Python"],
        "compare_meta": {"satisfaction_score": "4.7"},
    }

    base = programs._serialize_program_base_summary(program)
    card = programs._serialize_program_card_summary(program)
    list_row = programs._serialize_program_list_row(program)

    assert base["deadline"] is not None
    assert base["days_left"] is not None
    assert "display_categories" not in base
    assert card["display_categories"] is not None
    assert "selection_process_label" in card
    assert card["deadline_confidence"] in {"high", "medium", "low"}
    assert list_row == card


def test_serialize_program_recommendation_uses_card_summary_serializer() -> None:
    item = SimpleNamespace(
        program_id="program-1",
        score=0.82,
        relevance_score=0.76,
        reason="프로필과 잘 맞는 과정입니다.",
        fit_keywords=["AI", "서울"],
        program={
            **_sample_program(),
            "summary": "AI와 데이터 기초를 배우는 과정",
        },
    )

    serialized = programs._serialize_program_recommendation(item)

    assert serialized.program.id == "program-1"
    assert serialized.program.days_left is not None
    assert serialized.program.deadline_confidence in {"high", "medium", "low"}
    assert serialized.program.display_categories is not None
    assert serialized.relevance_reasons


def test_build_program_query_params_for_filtered_list() -> None:
    params = programs._build_program_query_params(
        select="*",
        category="IT",
        category_detail="web-development",
        q="부트캠프",
        regions=["서울", "대전·충청"],
        recruiting_only=True,
        sort="latest",
        limit=20,
        offset=40,
    )

    assert params["select"] == "*"
    assert params["category"] == "eq.IT"
    assert "category_detail" not in params
    assert "title" not in params
    assert params["search_text"] == "ilike.*부트캠프*"
    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)
    assert "deadline" not in params
    assert params["order"] == "created_at.desc.nullslast"
    assert "offset" not in params
    assert params["or"] == "(location.ilike.*서울*,location.ilike.*대전*,location.ilike.*충청*,location.ilike.*세종*)"


def test_recommended_score_uses_weighted_components_and_reasons() -> None:
    score = compute_recommended_score(
        {
            "title": "AI 부트캠프",
            "provider": "우수기관",
            "summary": "요약",
            "category": "AI",
            "category_detail": "data-ai",
            "region": "서울",
            "teaching_method": "온라인",
            "tuition_type": "무료",
            "study_time": "풀타임",
            "thumbnail_url": "https://example.com/image.png",
            "is_certified": True,
            "satisfaction_avg": 4.8,
            "satisfaction_count": 64,
            "close_date": (date.today() + timedelta(days=2)).isoformat(),
            "updated_at": date.today().isoformat(),
        },
        today=date.today(),
    )

    assert score.excellence_score == 1
    assert score.deadline_urgency == 1
    assert score.recommended_score > 0.85
    assert "우수기관" in score.reasons
    assert "마감임박" in score.reasons


def test_recommended_score_excludes_low_confidence_deadline_urgency() -> None:
    score = compute_recommended_score(
        {
            "title": "AI 부트캠프",
            "deadline": (date.today() + timedelta(days=1)).isoformat(),
            "deadline_confidence": "low",
            "satisfaction_avg": 5,
            "satisfaction_count": 1,
        },
        today=date.today(),
    )

    assert score.deadline_urgency == 0
    assert "마감임박" not in score.reasons


def test_recommended_score_accepts_read_model_cost_and_time_fields() -> None:
    score = compute_recommended_score(
        {
            "title": "AI 부트캠프",
            "provider": "교육기관",
            "summary": "요약",
            "category": "AI",
            "category_detail": "data-ai",
            "region": "서울",
            "teaching_method": "온라인",
            "cost_type": "free",
            "participation_time": "part-time",
            "thumbnail_url": "https://example.com/image.png",
        },
        today=date.today(),
    )

    assert score.data_completeness == 1
    assert "상세정보 충실" in score.reasons


def test_program_cursor_round_trip_is_stable_for_recommended_sort() -> None:
    row = {"id": "00000000-0000-0000-0000-000000000001", "recommended_score": 0.92}
    cursor = programs._encode_program_cursor(row, sort="default")
    decoded = programs._decode_program_cursor(cursor)

    assert decoded == {
        "sort": "default",
        "value": 0.92,
        "id": "00000000-0000-0000-0000-000000000001",
    }


def test_read_model_mode_splits_browse_search_and_archive() -> None:
    assert programs._program_list_mode(q=None, scope=None, include_closed_recent=False) == "browse"
    assert programs._program_list_mode(q="ai", scope=None, include_closed_recent=False) == "search"
    assert programs._program_list_mode(q=None, scope="all", include_closed_recent=False) == "search"
    assert programs._program_list_mode(q=None, scope=None, include_closed_recent=True) == "archive"


def test_read_model_query_limits_default_browse_pool() -> None:
    params, mode = programs._build_read_model_params(
        category=None,
        category_detail=None,
        scope=None,
        region_detail=None,
        q=None,
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        recruiting_only=True,
        include_closed_recent=False,
        sort="default",
        limit=20,
    )

    assert mode == "browse"
    assert params["browse_rank"] == "lte.300"
    assert params["is_open"] == "eq.true"
    assert params["order"].startswith("recommended_score.desc")


def test_read_model_query_popular_sort_skips_browse_pool() -> None:
    params, mode = programs._build_read_model_params(
        category=None,
        category_detail=None,
        scope=None,
        region_detail=None,
        q=None,
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        recruiting_only=True,
        include_closed_recent=False,
        sort="popular",
        limit=20,
    )

    assert mode == "browse"
    assert "browse_rank" not in params
    assert params["is_open"] == "eq.true"
    assert params["order"].startswith("click_hotness_score.desc")


def test_read_model_query_scope_all_switches_mode_without_scope_column_filter() -> None:
    params, mode = programs._build_read_model_params(
        category=None,
        category_detail=None,
        scope="all",
        region_detail=None,
        q=None,
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        recruiting_only=True,
        include_closed_recent=False,
        sort="default",
        limit=20,
    )

    assert mode == "search"
    assert "scope" not in params
    assert "browse_rank" not in params
    assert params["is_open"] == "eq.true"


def test_read_model_query_combines_cursor_and_region_or_filters() -> None:
    cursor = programs._encode_program_cursor(
        {"id": "00000000-0000-0000-0000-000000000001", "recommended_score": 0.8},
        sort="default",
    )
    params, mode = programs._build_read_model_params(
        category=None,
        category_detail=None,
        scope=None,
        region_detail=None,
        q=None,
        regions=["서울", "경기"],
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        recruiting_only=True,
        include_closed_recent=False,
        sort="default",
        limit=20,
        cursor=cursor,
    )

    assert mode == "browse"
    assert "or" not in params
    assert "and" in params
    assert "recommended_score.lt.0.8" in params["and"]
    assert "location.ilike.*서울*" in params["and"]
    assert "location.ilike.*경기*" in params["and"]


def test_default_browse_entry_request_requires_unfiltered_first_page() -> None:
    assert (
        programs._is_default_browse_entry_request(
            mode="browse",
            sort="default",
            offset=0,
            cursor=None,
        )
        is True
    )
    assert (
        programs._is_default_browse_entry_request(
            mode="browse",
            sort="default",
            offset=0,
            cursor=None,
            regions=["서울"],
        )
        is False
    )
    assert (
        programs._is_default_browse_entry_request(
            mode="browse",
            sort="default",
            offset=0,
            cursor=None,
            category_detail="data-ai",
        )
        is False
    )
    assert (
        programs._is_default_browse_entry_request(
            mode="search",
            sort="default",
            offset=0,
            cursor=None,
        )
        is False
    )


def test_read_model_query_supports_offset_pagination() -> None:
    params, mode = programs._build_read_model_params(
        category=None,
        category_detail=None,
        scope=None,
        region_detail=None,
        q=None,
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        recruiting_only=True,
        include_closed_recent=False,
        sort="default",
        limit=20,
        offset=40,
    )

    assert mode == "browse"
    assert params["limit"] == "21"
    assert params["offset"] == "40"


def test_read_model_summary_select_excludes_heavy_detail_fields() -> None:
    selected = set(programs.PROGRAM_LIST_SUMMARY_SELECT.split(","))

    assert "compare_meta" not in selected
    assert "description" not in selected
    assert "raw_data" not in selected
    assert "recommended_score" in selected


def test_program_list_quality_migration_hardens_refresh_policy() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260423195000_improve_program_list_browse_pool_quality.sql"
    ).read_text(encoding="utf-8")

    assert "program_list_infer_cost_type" in migration
    assert "program_list_infer_participation_time" in migration
    assert "source_group" in migration
    assert "source_rank_calc" in migration
    assert "0.70" in migration
    assert "organic_browse_rank" in migration


def test_program_participation_display_migration_uses_conservative_policy() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260423203000_conservative_program_participation_display.sql"
    ).read_text(encoding="utf-8")

    assert "program_list_participation_mode_label" in migration
    assert "program_list_participation_time_text" in migration
    assert "trg_program_list_apply_participation_display" in migration
    assert "duration_days" not in migration


def test_program_detail_click_hotness_migration_adds_daily_stats_and_rpc() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260424110000_add_program_detail_click_hotness.sql"
    ).read_text(encoding="utf-8")

    assert "program_detail_daily_stats" in migration
    assert "record_program_detail_view" in migration
    assert "click_hotness_score" in migration
    assert "detail_view_count_7d" in migration


def test_program_click_hotness_helper_matches_sql_contract() -> None:
    assert (
        programs._calculate_program_click_hotness_score(
            recent_count=3,
            total_count=12,
            recommended=0.75,
        )
        == 3 * programs.PROGRAM_CLICK_HOTNESS_RECENT_WEIGHT + 12 + 0.75
    )
    assert (
        programs._calculate_program_click_hotness_score(
            recent_count=-4,
            total_count=-9,
            recommended=0.25,
        )
        == 0.25
    )
    assert (
        programs._calculate_program_click_hotness_score(
            recent_count=1,
            total_count=programs.PROGRAM_CLICK_HOTNESS_TOTAL_CAP + 50,
            recommended=0.5,
        )
        == programs.PROGRAM_CLICK_HOTNESS_RECENT_WEIGHT + programs.PROGRAM_CLICK_HOTNESS_TOTAL_CAP + 0.5
    )


def test_program_detail_click_hotness_migration_formula_matches_backend_contract() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260424110000_add_program_detail_click_hotness.sql"
    ).read_text(encoding="utf-8")

    recent_weight_pattern = rf"greatest\(coalesce\(recent_count,\s*0\),\s*0\)::numeric\s*\*\s*{programs.PROGRAM_CLICK_HOTNESS_RECENT_WEIGHT}"
    total_cap_pattern = rf"least\(greatest\(coalesce\(total_count,\s*0\),\s*0\),\s*{programs.PROGRAM_CLICK_HOTNESS_TOTAL_CAP}\)::numeric"

    assert re.search(recent_weight_pattern, migration)
    assert re.search(total_cap_pattern, migration)
    assert "+ coalesce(recommended, 0);" in migration


def test_pg_trgm_extension_warning_has_separate_migration() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260423200000_move_pg_trgm_extension_schema.sql"
    ).read_text(encoding="utf-8")

    assert "create schema if not exists extensions" in migration
    assert "alter extension pg_trgm set schema extensions" in migration


@pytest.mark.asyncio
async def test_filter_options_use_facet_snapshot_for_default_browse(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_load_facet_snapshot(*, mode: str):  # noqa: ANN202
        assert mode == "browse"
        return (
            programs.ProgramFacetSnapshot(
                source=[
                    programs.ProgramFacetBucket(value="고용24", count=300),
                    programs.ProgramFacetBucket(value="sesac", count=12),
                ]
            ),
            "2026-04-23T00:00:00Z",
        )

    async def fail_legacy_request(**_: object) -> list[dict[str, object]]:
        raise AssertionError("legacy filter option scan should not run for default browse")

    monkeypatch.setattr(programs, "_load_program_facet_snapshot", fake_load_facet_snapshot)
    monkeypatch.setattr(programs, "request_supabase", fail_legacy_request)
    monkeypatch.setenv("ENABLE_PROGRAM_LIST_READ_MODEL", "true")

    response = await programs.get_program_filter_options(teaching_methods=None)

    assert [item.value for item in response.sources] == ["고용24", "sesac"]
    assert response.targets
    assert response.selection_processes == []


@pytest.mark.asyncio
async def test_list_programs_page_uses_read_model_and_cursor(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []

    async def fake_request_supabase(**kwargs: object) -> list[dict[str, object]]:
        calls.append(kwargs)
        params = kwargs.get("params")
        assert isinstance(params, dict)
        if params.get("select") == "id":
            return [{"id": "program-1"}]
        return [
            {
                "id": "00000000-0000-0000-0000-000000000001",
                "title": "AI 과정",
                "source": "고용24",
                "recommended_score": 0.9,
            },
            {
                "id": "00000000-0000-0000-0000-000000000002",
                "title": "백엔드 과정",
                "source": "고용24",
                "recommended_score": 0.8,
            },
        ]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)
    monkeypatch.setenv("ENABLE_PROGRAM_LIST_READ_MODEL", "true")
    monkeypatch.setenv("PROGRAM_PROMOTED_SLOT_LIMIT", "0")

    response = await programs.list_programs_page(
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        cursor=None,
        limit=1,
    )

    assert response.source == "read_model"
    assert response.mode == "browse"
    assert len(response.items) == 1
    assert response.items[0].program.id == "00000000-0000-0000-0000-000000000001"
    assert response.next_cursor is not None
    assert response.count == 1


@pytest.mark.asyncio
async def test_list_programs_page_forwards_offset_to_read_model(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []

    async def fake_request_supabase(**kwargs: object) -> list[dict[str, object]]:
        calls.append(kwargs)
        params = kwargs.get("params")
        assert isinstance(params, dict)
        if params.get("select") == "id":
            return [{"id": "program-1"}]
        return [
            {
                "id": "00000000-0000-0000-0000-000000000021",
                "title": "21번째 과정",
                "source": "고용24",
                "recommended_score": 0.7,
            }
        ]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)
    monkeypatch.setenv("ENABLE_PROGRAM_LIST_READ_MODEL", "true")
    monkeypatch.setenv("PROGRAM_PROMOTED_SLOT_LIMIT", "0")

    response = await programs.list_programs_page(
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        offset=20,
        limit=20,
    )

    assert response.source == "read_model"
    assert calls[0]["params"]["offset"] == "20"  # type: ignore[index]


@pytest.mark.asyncio
async def test_list_popular_programs_prefers_read_model_popular_sort(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch_program_list_read_model_rows(**kwargs: object) -> programs.ProgramListPageResponse:
        assert kwargs["sort"] == "popular"
        assert kwargs["recruiting_only"] is True
        return programs.ProgramListPageResponse(
            items=[
                programs.ProgramListRowItem(
                    program=programs.ProgramListItem(
                        id="00000000-0000-0000-0000-000000000111",
                        title="실제 클릭 인기 과정",
                        source="고용24",
                        detail_view_count_7d=7,
                        detail_view_count=11,
                        click_hotness_score=7_000_011.9,
                        recommended_score=0.9,
                    )
                )
            ],
            mode="browse",
            source="read_model",
        )

    monkeypatch.setattr(programs, "_fetch_program_list_read_model_rows", fake_fetch_program_list_read_model_rows)
    monkeypatch.setenv("ENABLE_PROGRAM_LIST_READ_MODEL", "true")

    response = await programs.list_popular_programs()

    assert response[0]["title"] == "실제 클릭 인기 과정"
    assert response[0]["detail_view_count_7d"] == 7


def test_promoted_and_organic_read_model_params_do_not_mix_scores() -> None:
    params, _ = programs._build_read_model_params(
        category=None,
        category_detail=None,
        scope=None,
        region_detail=None,
        q=None,
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        recruiting_only=True,
        include_closed_recent=False,
        sort="default",
        limit=20,
    )

    assert "promoted_rank" not in params["order"]
    assert "recommended_score" in params["order"]
    assert params["is_ad"] == "eq.false"


@pytest.mark.asyncio
async def test_list_programs_page_returns_fastcampus_promoted_layer_without_organic_duplicate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_request_supabase(**kwargs: object) -> list[dict[str, object]]:
        params = kwargs.get("params")
        assert isinstance(params, dict)
        if params.get("select") == "id":
            return [{"id": "program-fastcampus"}, {"id": "program-organic"}]
        if params.get("is_ad") == "eq.true":
            return []
        if "search_text.ilike.*패스트캠퍼스*" in str(params.get("or", "")) or "search_text.ilike.*패스트캠퍼스*" in str(params.get("and", "")):
            return [
                {
                    "id": "program-fastcampus",
                    "title": "패스트캠퍼스 AI 과정",
                    "provider": "패스트캠퍼스",
                    "source": "Fast Campus",
                    "recommended_score": 0.6,
                }
            ]
        return [
            {
                "id": "program-fastcampus",
                "title": "패스트캠퍼스 AI 과정",
                "provider": "패스트캠퍼스",
                "source": "Fast Campus",
                "recommended_score": 0.6,
            },
            {
                "id": "program-organic",
                "title": "일반 AI 과정",
                "provider": "일반기관",
                "source": "고용24",
                "recommended_score": 0.5,
            },
        ]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)
    monkeypatch.setenv("ENABLE_PROGRAM_LIST_READ_MODEL", "true")
    monkeypatch.setenv("PROGRAM_PROMOTED_SLOT_LIMIT", "1")
    monkeypatch.setenv("PROGRAM_PROMOTED_PROVIDER_MATCHES", "패스트캠퍼스")

    response = await programs.list_programs_page(
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        limit=1,
    )

    assert [item.program.id for item in response.promoted_items] == ["program-fastcampus"]
    assert response.promoted_items[0].program.is_ad is True
    assert response.promoted_items[0].context is not None
    assert response.promoted_items[0].context.promoted_rank == 1
    assert "광고" in response.promoted_items[0].program.recommendation_reasons
    assert [item.program.id for item in response.items] == ["program-organic"]


@pytest.mark.asyncio
async def test_list_programs_page_skips_promoted_layer_for_filtered_browse(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed_ad_request = {"value": False}

    async def fake_request_supabase(**kwargs: object) -> list[dict[str, object]]:
        params = kwargs.get("params")
        assert isinstance(params, dict)
        if params.get("select") == "id":
            return [{"id": "program-organic"}]
        if params.get("is_ad") == "eq.true":
            observed_ad_request["value"] = True
            return [
                {
                    "id": "program-promoted",
                    "title": "스폰서 과정",
                    "provider": "패스트캠퍼스",
                    "source": "Fast Campus",
                    "recommended_score": 0.9,
                }
            ]
        return [
            {
                "id": "program-organic",
                "title": "일반 AI 과정",
                "provider": "일반기관",
                "source": "고용24",
                "recommended_score": 0.5,
            }
        ]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)
    monkeypatch.setenv("ENABLE_PROGRAM_LIST_READ_MODEL", "true")
    monkeypatch.setenv("PROGRAM_PROMOTED_SLOT_LIMIT", "1")
    monkeypatch.setenv("PROGRAM_PROMOTED_PROVIDER_MATCHES", "패스트캠퍼스")

    response = await programs.list_programs_page(
        category="AI",
        regions=None,
        sources=None,
        teaching_methods=None,
        cost_types=None,
        participation_times=None,
        targets=None,
        limit=20,
    )

    assert observed_ad_request["value"] is False
    assert response.promoted_items == []
    assert [item.program.id for item in response.items] == ["program-organic"]


@pytest.mark.asyncio
async def test_fetch_promoted_read_model_rows_dedupes_explicit_ads_and_provider_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_request_supabase(**kwargs: object) -> list[dict[str, object]]:
        params = kwargs.get("params")
        assert isinstance(params, dict)
        if params.get("is_ad") == "eq.true":
            return [
                {
                    "id": "program-fastcampus",
                    "title": "패스트캠퍼스 AI 과정",
                    "provider": "패스트캠퍼스",
                    "source": "Fast Campus",
                    "recommended_score": 0.9,
                    "promoted_rank": 1,
                }
            ]
        return [
            {
                "id": "program-fastcampus",
                "title": "패스트캠퍼스 AI 과정",
                "provider": "패스트캠퍼스",
                "source": "Fast Campus",
                "recommended_score": 0.8,
            }
        ]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)
    monkeypatch.setenv("PROGRAM_PROMOTED_SLOT_LIMIT", "2")
    monkeypatch.setenv("PROGRAM_PROMOTED_PROVIDER_MATCHES", "패스트캠퍼스")

    promoted_items = await programs._fetch_promoted_read_model_rows(recruiting_only=True)

    assert [item.id for item in promoted_items] == ["program-fastcampus"]
    assert promoted_items[0].promoted_rank == 1
    assert promoted_items[0].is_ad is True


@pytest.mark.asyncio
async def test_record_program_detail_view_calls_rpc(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str, dict[str, object] | None]] = []

    async def fake_request_supabase(
        *,
        method: str,
        path: str,
        params: dict[str, object] | None = None,
        payload: dict[str, object] | None = None,
        prefer: str | None = None,
    ) -> int:
        assert params is None
        assert prefer is None
        calls.append((method, path, payload))
        return 3

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    response = await programs.record_program_detail_view("00000000-0000-0000-0000-000000000123")

    assert response == {"ok": True}
    assert calls == [
        (
            "POST",
            "/rest/v1/rpc/record_program_detail_view",
            {"target_program_id": "00000000-0000-0000-0000-000000000123"},
        )
    ]


def test_build_program_query_params_uses_parent_category_for_category_detail() -> None:
    params = programs._build_program_query_params(
        select="*",
        category_detail="data-ai",
        recruiting_only=True,
        sort="default",
        limit=20,
    )

    assert params["category"] == "eq.AI"
    assert "category_detail" not in params


def test_build_program_query_params_expands_scan_limit_for_backend_search() -> None:
    params = programs._build_program_query_params(
        select="*",
        q="패스트캠퍼스",
    )

    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)
    assert "title" not in params
    assert params["search_text"] == "ilike.*패스트캠퍼스*"


def test_build_program_query_params_skips_index_for_short_ascii_search() -> None:
    params = programs._build_program_query_params(
        select="*",
        q="ai",
    )

    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)
    assert "search_text" not in params


def test_program_query_filter_matches_category_detail_aliases() -> None:
    rows = [
        {
            "id": "program-1",
            "title": "프론트엔드 실무 과정",
            "category": "IT",
            "category_detail": "web-development",
        },
        {
            "id": "program-2",
            "title": "마케팅 실무 과정",
            "category": "경영",
            "category_detail": "planning-marketing-other",
        },
    ]

    assert [row["id"] for row in programs._filter_program_rows_by_query(rows, "웹개발")] == ["program-1"]
    assert [row["id"] for row in programs._filter_program_rows_by_query(rows, "data-ai")] == []


def test_program_query_filter_matches_category_label_without_middle_dot() -> None:
    rows = [
        {
            "id": "program-1",
            "title": "비전공자 입문 과정",
            "category": "AI",
            "category_detail": "data-ai",
        }
    ]

    assert [row["id"] for row in programs._filter_program_rows_by_query(rows, "데이터AI")] == ["program-1"]


def test_category_detail_filter_matches_inferred_ai_programs() -> None:
    rows = [
        programs._serialize_program_list_row(
            {
                "id": "program-ai",
                "title": "AI 서비스 개발 과정",
                "category": "AI",
                "category_detail": None,
                "deadline": (date.today() + timedelta(days=3)).isoformat(),
            }
        ),
        programs._serialize_program_list_row(
            {
                "id": "program-business",
                "title": "ESG 경영 실무",
                "category": "경영",
                "category_detail": None,
                "deadline": (date.today() + timedelta(days=3)).isoformat(),
            }
        ),
    ]

    assert [row["id"] for row in programs._filter_program_rows_by_category_detail(rows, "data-ai")] == ["program-ai"]


def test_build_program_query_params_expands_latest_recruiting_scan_limit() -> None:
    params = programs._build_program_query_params(
        select="*",
        recruiting_only=True,
        sort="latest",
    )

    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)
    assert "deadline" not in params
    assert params["order"] == "created_at.desc.nullslast"


def test_build_program_query_params_deadline_sort_only_includes_active_programs() -> None:
    params = programs._build_program_query_params(
        select="*",
        sort="default",
    )

    assert params["order"] == "deadline.asc.nullslast"
    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)
    assert "deadline" not in params


def test_build_program_query_params_default_sort_preserves_deadline_scan() -> None:
    params = programs._build_program_query_params(
        select="*",
        sort="default",
    )

    assert params["order"] == "deadline.asc.nullslast"
    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)
    assert "deadline" not in params


def test_build_program_query_params_computed_sort_expands_scan_limit() -> None:
    params = programs._build_program_query_params(
        select="*",
        sort="cost_low",
    )

    assert params["order"] == "cost.asc.nullslast"
    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)


def test_build_program_query_params_include_closed_recent_uses_90_day_cutoff() -> None:
    params = programs._build_program_query_params(
        select="*",
        include_closed_recent=True,
        sort="deadline",
    )

    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)
    assert "deadline" not in params


def test_normalize_regions_param_splits_csv_values() -> None:
    normalized = programs._normalize_regions_param(["서울,경기", "온라인"])
    assert normalized == ["서울", "경기", "온라인"]


def test_program_extra_filters_classify_cost_types() -> None:
    deadline = (date.today() + timedelta(days=10)).isoformat()
    rows = programs._postprocess_program_list_rows(
        [
            {
                "id": "card",
                "title": "국민내일배움카드 AI 과정",
                "cost": 0,
                "deadline": deadline,
                "compare_meta": {"naeilbaeumcard_required": True},
            },
            {
                "id": "free",
                "title": "무료 창업 특강",
                "cost": 0,
                "deadline": deadline,
            },
            {
                "id": "paid",
                "title": "유료 디자인 과정",
                "cost": 150000,
                "deadline": deadline,
            },
        ],
        cost_types=["free-no-card"],
        sort="deadline",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["free"]


def test_program_extra_filters_classify_participation_times() -> None:
    deadline = (date.today() + timedelta(days=10)).isoformat()
    rows = programs._postprocess_program_list_rows(
        [
            {
                "id": "part-time",
                "title": "주말 데이터 특강",
                "start_date": "2026-05-01",
                "end_date": "2026-05-02",
                "deadline": deadline,
            },
            {
                "id": "full-time",
                "title": "웹개발 부트캠프",
                "description": "월,화,수,목,금 09:00 ~ 18:00 운영",
                "start_date": "2026-05-01",
                "end_date": "2026-06-30",
                "deadline": deadline,
            },
        ],
        participation_times=["full-time"],
        sort="deadline",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["full-time"]


def test_program_participation_time_does_not_classify_from_date_span_only() -> None:
    assert (
        programs._program_participation_time(
            {
                "id": "date-only",
                "title": "웹개발 과정",
                "start_date": "2026-05-01",
                "end_date": "2026-06-30",
            }
        )
        is None
    )


def test_extract_program_filter_options_uses_present_program_values() -> None:
    rows = [
        {
            "source": "고용24",
            "title": "청년 AI 부트캠프",
            "description": "서류와 면접으로 선발하며 취업지원 멘토링을 제공합니다.",
            "target": ["청년"],
        },
        {
            "source": "kstartup",
            "title": "창업 지원 사업",
            "summary": "선착순 모집, 인턴십 연계",
            "target": ["창업"],
        },
    ]

    options = programs._extract_program_filter_options(rows)

    assert [option.value for option in options.sources] == ["kstartup", "고용24"]
    assert [option.label for option in options.sources] == ["K-Startup", "고용24"]
    assert {option.value for option in options.targets} == {"청년", "창업"}
    assert {option.value for option in options.selection_processes} == {"서류", "면접", "선착순"}
    assert {option.value for option in options.employment_links} == {"취업지원", "멘토링", "인턴십"}


def test_get_program_filter_options_endpoint(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_request_supabase(*, method: str, path: str, params: dict, **_: object) -> list[dict]:
        assert method == "GET"
        assert path == "/rest/v1/programs"
        assert "source" in params["select"]
        return [
            {
                "source": "sesac",
                "title": "청년 웹개발 과정",
                "description": "면접 후 선발하며 채용연계 과정입니다.",
                "deadline": (date.today() + timedelta(days=10)).isoformat(),
            }
        ]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    response = client.get("/programs/filter-options?recruiting_only=true")

    assert response.status_code == 200
    payload = response.json()
    assert payload["sources"] == [{"value": "sesac", "label": "SeSAC"}]
    assert payload["targets"] == [{"value": "청년", "label": "청년"}]
    assert payload["selection_processes"] == [{"value": "면접", "label": "면접"}]
    assert payload["employment_links"] == [{"value": "채용연계", "label": "채용연계"}]


def test_get_program_detail_returns_404_for_invalid_uuid(client: TestClient) -> None:
    response = client.get("/programs/not-a-real-program-id/detail")

    assert response.status_code == 404
    assert response.json()["detail"] == "Program not found"


def test_get_program_returns_404_for_invalid_uuid(client: TestClient) -> None:
    response = client.get("/programs/not-a-real-program-id")

    assert response.status_code == 404
    assert response.json()["detail"] == "Program not found"


@pytest.mark.asyncio
async def test_fetch_program_list_rows_falls_back_when_category_detail_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict] = []

    async def fake_request_supabase(*, method: str, path: str, params: dict, **_: object) -> list[dict]:
        calls.append(dict(params))
        if "category_detail" in params:
            raise RuntimeError("column programs.category_detail does not exist")
        return [{"id": "fallback-row"}]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    rows = await programs._fetch_program_list_rows(
        {
            "select": "*",
            "category": "eq.IT",
            "category_detail": "eq.web-development",
        },
        q=None,
    )

    assert rows == [{"id": "fallback-row"}]
    assert "category_detail" in calls[0]
    assert "category_detail" not in calls[1]


def test_parse_content_range_total_reads_exact_count() -> None:
    assert programs._parse_content_range_total("0-0/57") == 57
    assert programs._parse_content_range_total("*/0") == 0
    assert programs._parse_content_range_total(None) == 0


def test_query_hash_ignores_top_k_and_force_refresh() -> None:
    base = programs.ProgramRecommendRequest(top_k=5, category="IT", region="서울")
    variant = programs.ProgramRecommendRequest(
        top_k=20,
        category="IT",
        region="서울",
        force_refresh=True,
    )

    assert programs._build_query_hash(base) == programs._build_query_hash(variant)


def test_build_condition_key_candidates_prefers_specific_then_broad() -> None:
    payload = programs.ProgramRecommendRequest(category="IT", region="서울")
    assert programs._build_condition_key_candidates(payload) == ["IT+서울", "IT"]


def test_recalculate_final_score_uses_recovered_weights() -> None:
    assert programs._recalculate_final_score(0.75, 0.25) == 0.55


@pytest.mark.parametrize(
    ("raw_value", "expected_display", "expected_normalized"),
    [
        ("4.6", "4.6", 4.6),
        ("100", "5.0", 5.0),
        ("90", "4.5", 4.5),
        ("0", None, None),
        (None, None, None),
        (".7", None, None),
        ("120", None, None),
    ],
)
def test_normalize_rating_fields_uses_five_point_scale(
    raw_value: object,
    expected_display: str | None,
    expected_normalized: float | None,
) -> None:
    fields = programs._normalize_rating_fields(raw_value)

    assert fields["rating_display"] == expected_display
    assert fields["rating_normalized"] == expected_normalized
    assert fields["rating_scale"] == (5 if expected_display else None)


def test_serialize_program_list_row_adds_normalized_rating_fields() -> None:
    row = programs._serialize_program_list_row(
        {
            "id": "program-1",
            "deadline": (date.today() + timedelta(days=3)).isoformat(),
            "compare_meta": {"satisfaction_score": "100"},
        }
    )

    assert row["rating_raw"] == "100"
    assert row["rating_normalized"] == 5.0
    assert row["rating_scale"] == 5
    assert row["rating_display"] == "5.0"


def test_serialize_program_list_row_derives_display_metadata_from_real_text() -> None:
    row = programs._serialize_program_list_row(
        {
            "id": "program-ai",
            "title": "MCP를 활용한 AI 서비스 개발 양성과정",
            "category": "IT",
            "category_detail": "data-ai",
            "summary": "Python, RAG, LLM 기반 프로젝트를 진행합니다.",
            "description": "서류 검토와 면접 후 선발합니다. 월,화,수,목,금 09:00 ~ 18:00 운영",
            "tags": ["MCP", "머신러닝", "취업지원"],
            "skills": ["Python", "RAG", "LLM"],
            "deadline": (date.today() + timedelta(days=3)).isoformat(),
            "compare_meta": {
                "interview_required": True,
                "portfolio_required": True,
            },
        }
    )

    assert row["display_categories"] == ["AI서비스"]
    assert row["participation_mode_label"] == "풀타임"
    assert row["participation_time_text"] == "월,화,수,목,금 / 09:00 ~ 18:00"
    assert row["selection_process_label"] == "포트폴리오 / 면접 / 서류"
    assert {"Python", "RAG", "LLM", "MCP", "머신러닝"}.issubset(set(row["extracted_keywords"]))


def test_serialize_program_list_row_derives_online_method_from_work24_target() -> None:
    row = programs._serialize_program_list_row(
        {
            "id": "program-online",
            "title": "인공지능 실무",
            "category": "AI",
            "target": ["근로자원격훈련"],
            "raw_data": {"trainTarget": "근로자원격훈련"},
            "deadline": (date.today() + timedelta(days=3)).isoformat(),
        }
    )

    assert row["teaching_method"] == "온라인"


def test_serialize_program_list_row_derives_weekend_and_semiconductor_metadata() -> None:
    row = programs._serialize_program_list_row(
        {
            "id": "program-chip",
            "title": "FPGA SoC 반도체설계 주말반",
            "category": "IT",
            "description": "주말 10:00~17:00 Verilog RTL 실습",
            "deadline": (date.today() + timedelta(days=5)).isoformat(),
        }
    )

    assert row["display_categories"] == ["반도체"]
    assert row["participation_mode_label"] == "주말반"
    assert row["participation_time_text"] == "주말 / 10:00 ~ 17:00"
    assert {"FPGA", "SoC", "RTL", "Verilog", "반도체설계"}.issubset(set(row["extracted_keywords"]))


def test_serialize_program_list_row_uses_work24_day_night_metadata() -> None:
    row = programs._serialize_program_list_row(
        {
            "id": "program-night",
            "title": "AI 실무 야간 과정",
            "category": "AI",
            "deadline": (date.today() + timedelta(days=5)).isoformat(),
            "compare_meta": {
                "day_night": "야간",
                "weekend_text": "주중",
            },
        }
    )

    assert row["participation_mode_label"] == "저녁반"
    assert row["participation_time_text"] == "주중"


def test_serialize_program_list_row_uses_work24_total_training_time() -> None:
    row = programs._serialize_program_list_row(
        {
            "id": "program-total-hours",
            "title": "AI 엔지니어 양성",
            "category": "AI",
            "deadline": (date.today() + timedelta(days=5)).isoformat(),
            "compare_meta": {
                "day_night": "주간",
                "weekend_text": "주중",
                "training_time": "88일 · 총 700시간",
            },
        }
    )

    assert row["participation_time_text"] == "주중 / 88일 · 총 700시간"


def test_serialize_program_list_row_uses_deadline_not_training_end_date_for_d_day() -> None:
    deadline = (date.today() + timedelta(days=4)).isoformat()
    training_end_date = (date.today() + timedelta(days=30)).isoformat()

    row = programs._serialize_program_list_row(
        {
            "id": "program-1",
            "deadline": deadline,
            "end_date": training_end_date,
        }
    )

    assert row["deadline"] == deadline
    assert row["days_left"] == 4
    assert row["end_date"] == training_end_date


def test_serialize_program_list_row_does_not_fallback_to_training_end_date_for_d_day() -> None:
    training_end_date = (date.today() + timedelta(days=30)).isoformat()

    row = programs._serialize_program_list_row(
        {
            "id": "program-1",
            "deadline": None,
            "end_date": training_end_date,
        }
    )

    assert row["deadline"] is None
    assert row["days_left"] is None
    assert row["end_date"] == training_end_date


def test_serialize_program_list_row_ignores_work24_deadline_copied_from_training_end_date() -> None:
    training_end_date = (date.today() + timedelta(days=30)).isoformat()

    row = programs._serialize_program_list_row(
        {
            "id": "program-1",
            "source": "고용24",
            "deadline": training_end_date,
            "end_date": training_end_date,
        }
    )

    assert row["deadline"] is None
    assert row["days_left"] is None
    assert row["end_date"] == training_end_date


def test_serialize_program_list_row_trusts_work24_training_start_deadline_marker() -> None:
    one_day_date = (date.today() + timedelta(days=3)).isoformat()

    row = programs._serialize_program_list_row(
        {
            "id": "work24-one-day",
            "source": "고용24",
            "deadline": one_day_date,
            "start_date": one_day_date,
            "end_date": one_day_date,
            "compare_meta": {"deadline_source": "traStartDate"},
        }
    )

    assert row["deadline"] == one_day_date
    assert row["days_left"] == 3


def test_serialize_program_list_row_uses_close_date_when_deadline_is_missing() -> None:
    close_date = (date.today() + timedelta(days=6)).isoformat()
    training_end_date = (date.today() + timedelta(days=20)).isoformat()

    row = programs._serialize_program_list_row(
        {
            "id": "program-1",
            "close_date": close_date,
            "end_date": training_end_date,
        }
    )

    assert row["deadline"] == close_date
    assert row["days_left"] == 6
    assert row["end_date"] == training_end_date


def test_build_program_detail_response_maps_kstartup_dates_as_application_period() -> None:
    detail = programs._build_program_detail_response(
        {
            "id": "kstartup-1",
            "source": "K-Startup 창업진흥원",
            "title": "2026년 서울여성 창업아이디어 공모전",
            "provider": "서울시여성능력개발원",
            "location": "서울",
            "description": "창업 아이디어 공모전 설명",
            "start_date": "2026-03-30",
            "end_date": "2026-04-23",
            "deadline": "2026-04-23",
            "source_url": "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?pbancSn=176678",
            "cost": 0,
            "compare_meta": {
                "application_url": "https://forms.gle/example",
                "target_detail": "서울 소재 여성 예비창업자",
                "target_age": "만 20세 이상",
                "business_type": "행사ㆍ네트워크",
                "supervising_institution": "민간",
                "department": "광역새일팀",
                "contact_phone": "07041481934",
            },
        }
    )

    assert detail.title == "2026년 서울여성 창업아이디어 공모전"
    assert detail.provider == "서울시여성능력개발원"
    assert detail.organizer == "민간"
    assert detail.location == "서울"
    assert detail.application_start_date == "2026-03-30"
    assert detail.application_end_date == "2026-04-23"
    assert detail.program_start_date is None
    assert detail.program_end_date is None
    assert detail.schedule_text == "신청 2026-03-30 ~ 2026-04-23"
    assert detail.source_url == "https://forms.gle/example"
    assert detail.fee == 0
    assert detail.support_type == "행사ㆍ네트워크"
    assert detail.eligibility == ["서울 소재 여성 예비창업자", "만 20세 이상"]
    assert detail.manager_name == "광역새일팀"
    assert detail.phone == "07041481934"


def test_build_program_detail_response_maps_work24_dates_as_program_period() -> None:
    detail = programs._build_program_detail_response(
        {
            "id": "work24-1",
            "source": "고용24",
            "title": "Python 자료구조&알고리즘 프로그래밍",
            "provider": "그린컴퓨터아트학원",
            "location": "서울 종로구",
            "description": "그린컴퓨터아트학원",
            "start_date": "2026-04-23",
            "end_date": "2026-05-12",
            "deadline": "2026-05-01",
            "source_url": "https://www.work24.go.kr/hr/a/a/3100/selectTracseDetl.do?tracseId=AIG20230000419940",
            "cost": 0,
            "subsidy_amount": 238320,
            "compare_meta": {
                "capacity": "20",
                "registered_count": "3",
                "satisfaction_score": "91.4",
                "contact_phone": "02-722-2111",
                "source_url": "https://www.work24.go.kr/hr/a/a/3100/selectTracseDetl.do?tracseId=AIG20230000419940",
            },
        }
    )

    assert detail.title == "Python 자료구조&알고리즘 프로그래밍"
    assert detail.provider == "그린컴퓨터아트학원"
    assert detail.location == "서울 종로구"
    assert detail.application_start_date is None
    assert detail.application_end_date == "2026-05-01"
    assert detail.program_start_date == "2026-04-23"
    assert detail.program_end_date == "2026-05-12"
    assert detail.schedule_text == "신청 시작일 미정 ~ 2026-05-01"
    assert detail.source_url == "https://www.work24.go.kr/hr/a/a/3100/selectTracseDetl.do?tracseId=AIG20230000419940"
    assert detail.fee == 0
    assert detail.support_amount == 238320
    assert detail.rating == "4.6"
    assert detail.rating_raw == "91.4"
    assert detail.rating_normalized == 4.6
    assert detail.rating_scale == 5
    assert detail.rating_display == "4.6"
    assert detail.capacity_total == 20
    assert detail.capacity_remaining == 17
    assert detail.phone == "02-722-2111"


def test_build_program_detail_response_uses_work24_application_deadline_from_meta() -> None:
    detail = programs._build_program_detail_response(
        {
            "id": "work24-application-deadline",
            "source": "고용24",
            "title": "고용24 신청기간 보강 과정",
            "start_date": "2026-04-23",
            "end_date": "2026-05-12",
            "deadline": "2026-05-12",
            "compare_meta": {"application_deadline": "2026-04-20"},
        }
    )

    assert detail.application_end_date == "2026-04-20"
    assert detail.program_start_date == "2026-04-23"
    assert detail.program_end_date == "2026-05-12"
    assert detail.schedule_text == "신청 시작일 미정 ~ 2026-04-20"


@pytest.mark.asyncio
async def test_get_program_details_batch_reuses_detail_mapping(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_fetch_programs_by_ids(program_ids: list[str]) -> dict[str, dict[str, object]]:
        assert program_ids == ["program-1", "program-2"]
        return {
            "program-1": {
                "id": "program-1",
                "source": "고용24",
                "title": "Python 과정",
                "provider": "훈련기관",
                "location": "서울",
                "start_date": "2026-05-01",
                "end_date": "2026-06-01",
            },
            "program-2": {
                "id": "program-2",
                "source": "K-Startup",
                "title": "창업 멘토링",
                "provider": "창업진흥원",
                "start_date": "2026-05-10",
                "end_date": "2026-05-20",
            },
        }

    monkeypatch.setattr(programs, "_fetch_programs_by_ids", fake_fetch_programs_by_ids)

    response = await programs.get_program_details_batch(
        programs.ProgramDetailBatchRequest(program_ids=["program-1", "program-2", "program-1"])
    )

    assert [item.id for item in response.items] == ["program-1", "program-2"]
    assert response.items[0].program_start_date == "2026-05-01"
    assert response.items[1].application_end_date == "2026-05-20"


@pytest.mark.asyncio
async def test_get_programs_batch_preserves_requested_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_fetch_programs_by_ids(program_ids: list[str]) -> dict[str, dict[str, object]]:
        assert program_ids == ["program-2", "program-1"]
        return {
            "program-1": {"id": "program-1", "title": "첫 번째", "deadline": "2026-06-01", "source": "고용24"},
            "program-2": {"id": "program-2", "title": "두 번째", "deadline": "2026-05-01", "source": "K-Startup"},
        }

    monkeypatch.setattr(programs, "_fetch_programs_by_ids", fake_fetch_programs_by_ids)

    response = await programs.get_programs_batch(
        programs.ProgramDetailBatchRequest(program_ids=["program-2", "program-1", "program-2"])
    )

    assert [item.id for item in response.items] == ["program-2", "program-1"]


def test_normalize_cached_recommendation_rows_marks_missing_component_scores_stale() -> None:
    normalized = programs._normalize_cached_recommendation_rows(
        [
            {
                "program_id": "program-1",
                "relevance_score": 0.8,
                "urgency_score": None,
                "final_score": 0.9,
            }
        ]
    )

    assert normalized is None


def test_postprocess_program_list_rows_keeps_active_first_then_recent_closed() -> None:
    active_deadline = (date.today() + timedelta(days=2)).isoformat()
    closed_deadline = (date.today() - timedelta(days=5)).isoformat()
    older_closed_deadline = (date.today() - timedelta(days=20)).isoformat()

    rows = programs._postprocess_program_list_rows(
        [
          {"id": "closed-older", "title": "closed-older", "deadline": older_closed_deadline, "is_active": True},
          {"id": "closed-recent", "title": "closed-recent", "deadline": closed_deadline, "is_active": True},
          {"id": "active", "title": "active", "deadline": active_deadline, "is_active": True},
          {"id": "unknown", "title": "unknown", "source": "고용24", "deadline": active_deadline, "end_date": active_deadline, "is_active": True},
        ],
        sort="deadline",
        include_closed_recent=True,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["active", "closed-recent", "closed-older"]
    assert rows[0]["is_active"] is True
    assert rows[1]["is_active"] is False


def test_postprocess_program_list_rows_recruiting_only_drops_unresolved_deadlines() -> None:
    future_deadline = (date.today() + timedelta(days=5)).isoformat()
    training_end_date = (date.today() + timedelta(days=30)).isoformat()

    rows = programs._postprocess_program_list_rows(
        [
            {
                "id": "work24-training-end-only",
                "title": "훈련 종료일만 있는 과정",
                "source": "고용24",
                "deadline": training_end_date,
                "end_date": training_end_date,
            },
            {
                "id": "open-program",
                "title": "모집중 과정",
                "source": "K-Startup",
                "deadline": future_deadline,
            },
        ],
        recruiting_only=True,
        sort="latest",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["open-program"]
    assert rows[0]["deadline"] == future_deadline


def test_postprocess_program_list_rows_keeps_active_work24_without_recruiting_deadline() -> None:
    future_deadline = (date.today() + timedelta(days=5)).isoformat()
    training_end_date = (date.today() + timedelta(days=30)).isoformat()

    rows = programs._postprocess_program_list_rows(
        [
            {
                "id": "work24-training-end-only",
                "title": "훈련 종료일만 있는 과정",
                "source": "고용24",
                "deadline": training_end_date,
                "end_date": training_end_date,
                "is_active": True,
            },
            {
                "id": "open-program",
                "title": "모집중 과정",
                "source": "K-Startup",
                "deadline": future_deadline,
            },
        ],
        recruiting_only=True,
        sort="deadline",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["open-program", "work24-training-end-only"]
    assert rows[1]["deadline"] is None


def test_postprocess_program_list_rows_balances_work24_default_mix() -> None:
    future_deadline = (date.today() + timedelta(days=5)).isoformat()
    rows = programs._postprocess_program_list_rows(
        [
            *[
                {
                    "id": f"kstartup-{index}",
                    "title": f"창업 지원 {index}",
                    "source": "K-Startup 창업진흥원",
                    "deadline": future_deadline,
                }
                for index in range(10)
            ],
            *[
                {
                    "id": f"work24-{index}",
                    "title": f"고용24 훈련 {index}",
                    "source": "고용24",
                    "deadline": future_deadline,
                    "is_active": True,
                }
                for index in range(10)
            ],
        ],
        recruiting_only=True,
        sort="deadline",
        include_closed_recent=False,
        limit=10,
        offset=0,
        prefer_work24_default_mix=True,
    )

    work24_count = sum(1 for row in rows if row["source"] == "고용24")
    assert work24_count == 7


def test_should_apply_work24_default_mix_skips_startup_filters_and_explicit_sources() -> None:
    assert programs._should_apply_work24_default_mix(category="IT") is True
    assert programs._should_apply_work24_default_mix(category="창업") is False
    assert programs._should_apply_work24_default_mix(category_detail="project-career-startup") is False
    assert programs._should_apply_work24_default_mix(q="스타트업 지원") is False
    assert programs._should_apply_work24_default_mix(sources=["K-Startup 창업진흥원"]) is False


def test_postprocess_program_list_rows_searches_provider_and_orders_by_match_field() -> None:
    deadline = (date.today() + timedelta(days=10)).isoformat()

    rows = programs._postprocess_program_list_rows(
        [
            {
                "id": "description-match",
                "title": "AI 심화 캠프",
                "provider": "다른 기관",
                "description": "패스트캠퍼스 연계 과정",
                "deadline": deadline,
            },
            {
                "id": "provider-match",
                "title": "Business Analyst Course",
                "provider": "패스트캠퍼스강남학원",
                "description": "",
                "deadline": deadline,
            },
            {
                "id": "title-match",
                "title": "패스트캠퍼스 데이터 과정",
                "provider": "다른 기관",
                "description": "",
                "deadline": deadline,
            },
            {
                "id": "no-match",
                "title": "그래픽 디자인",
                "provider": "다른 기관",
                "description": "",
                "deadline": deadline,
            },
        ],
        q="패스트 캠퍼스",
        sort="default",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["title-match", "provider-match", "description-match"]


def test_postprocess_program_list_rows_sorts_by_start_date() -> None:
    deadline = (date.today() + timedelta(days=30)).isoformat()

    rows = programs._postprocess_program_list_rows(
        [
            {"id": "later", "title": "later", "start_date": "2026-06-10", "end_date": "2026-07-01", "deadline": deadline},
            {"id": "unknown", "title": "unknown", "deadline": deadline},
            {"id": "earlier", "title": "earlier", "start_date": "2026-05-01", "end_date": "2026-05-20", "deadline": deadline},
        ],
        sort="start_soon",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["earlier", "later", "unknown"]


def test_postprocess_program_list_rows_sorts_by_cost_low_and_high() -> None:
    deadline = (date.today() + timedelta(days=30)).isoformat()
    source_rows = [
        {"id": "paid-high", "title": "paid-high", "cost": 500000, "deadline": deadline},
        {"id": "free", "title": "무료 특강", "cost": 0, "deadline": deadline},
        {"id": "paid-low", "title": "paid-low", "cost": 100000, "deadline": deadline},
        {"id": "unknown", "title": "unknown", "deadline": deadline},
    ]

    low_rows = programs._postprocess_program_list_rows(
        source_rows,
        sort="cost_low",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )
    high_rows = programs._postprocess_program_list_rows(
        source_rows,
        sort="cost_high",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in low_rows] == ["free", "paid-low", "paid-high", "unknown"]
    assert [row["id"] for row in high_rows] == ["paid-high", "paid-low", "free", "unknown"]


def test_postprocess_program_list_rows_sorts_by_duration_short_and_long() -> None:
    deadline = (date.today() + timedelta(days=30)).isoformat()
    source_rows = [
        {"id": "medium", "title": "medium", "start_date": "2026-05-01", "end_date": "2026-05-20", "deadline": deadline},
        {"id": "short", "title": "short", "start_date": "2026-05-01", "end_date": "2026-05-02", "deadline": deadline},
        {"id": "long", "title": "long", "start_date": "2026-05-01", "end_date": "2026-07-31", "deadline": deadline},
        {"id": "unknown", "title": "unknown", "deadline": deadline},
    ]

    short_rows = programs._postprocess_program_list_rows(
        source_rows,
        sort="duration_short",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )
    long_rows = programs._postprocess_program_list_rows(
        source_rows,
        sort="duration_long",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in short_rows] == ["short", "medium", "long", "unknown"]
    assert [row["id"] for row in long_rows] == ["long", "medium", "short", "unknown"]


def test_postprocess_program_list_rows_honors_explicit_sort_with_search_query() -> None:
    deadline = (date.today() + timedelta(days=30)).isoformat()

    rows = programs._postprocess_program_list_rows(
        [
            {"id": "expensive", "title": "AI 과정", "cost": 500000, "deadline": deadline},
            {"id": "cheap", "title": "AI 과정", "cost": 100000, "deadline": deadline},
        ],
        q="AI",
        sort="cost_low",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["cheap", "expensive"]


def test_postprocess_program_list_rows_searches_compare_meta_values() -> None:
    deadline = (date.today() + timedelta(days=10)).isoformat()

    rows = programs._postprocess_program_list_rows(
        [
            {
                "id": "meta-match",
                "title": "AI 심화 캠프",
                "provider": "다른 기관",
                "compare_meta": {"training_institution": "패스트캠퍼스강남학원"},
                "deadline": deadline,
            },
            {
                "id": "no-match",
                "title": "그래픽 디자인",
                "provider": "다른 기관",
                "compare_meta": {"training_institution": "다른 학원"},
                "deadline": deadline,
            },
        ],
        q="패스트캠퍼스",
        sort="deadline",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["meta-match"]


def test_postprocess_program_list_rows_ignores_compare_meta_url_and_ids_for_search() -> None:
    deadline = (date.today() + timedelta(days=10)).isoformat()

    rows = programs._postprocess_program_list_rows(
        [
            {
                "id": "url-only-match",
                "title": "국제바리스타 자격취득과정",
                "provider": "커피학원",
                "compare_meta": {
                    "hrd_id": "AIG202500001",
                    "source_url": "https://www.work24.go.kr/hr/detail?tracseId=AIG202500001",
                },
                "deadline": deadline,
            },
            {
                "id": "content-match",
                "title": "AI 서비스 기획 과정",
                "provider": "교육기관",
                "deadline": deadline,
            },
        ],
        q="ai",
        sort="deadline",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["content-match"]


def test_serialize_program_list_row_uses_work24_application_deadline_from_compare_meta() -> None:
    deadline = (date.today() + timedelta(days=7)).isoformat()
    training_end_date = (date.today() + timedelta(days=30)).isoformat()

    row = programs._serialize_program_list_row(
        {
            "id": "work24-application-deadline",
            "source": "고용24",
            "deadline": training_end_date,
            "end_date": training_end_date,
            "compare_meta": {"application_deadline": deadline},
        }
    )

    assert row["deadline"] == deadline
    assert row["days_left"] == 7


@pytest.mark.asyncio
async def test_fetch_program_list_rows_paginates_search_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []

    async def fake_request_supabase(*, method: str, path: str, params: dict, **_: object) -> list[dict]:
        calls.append(dict(params))
        offset = int(params.get("offset", 0))
        if offset == 0:
            return [{"id": f"row-{index}"} for index in range(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)]
        if offset == programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE:
            return [{"id": "row-last"}]
        return []

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    rows = await programs._fetch_program_list_rows({"select": "*"}, q="패스트캠퍼스")

    assert len(rows) == programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE + 1
    assert calls[0]["limit"] == str(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)
    assert calls[0]["offset"] == "0"
    assert calls[1]["offset"] == str(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)


@pytest.mark.asyncio
async def test_fetch_program_list_rows_paginates_large_non_search_candidates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict] = []

    async def fake_request_supabase(*, method: str, path: str, params: dict, **_: object) -> list[dict]:
        calls.append(dict(params))
        offset = int(params.get("offset", 0))
        if offset == 0:
            return [{"id": f"row-{index}"} for index in range(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)]
        if offset == programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE:
            return [{"id": "row-last"}]
        return []

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    rows = await programs._fetch_program_list_rows(
        {"select": "*", "limit": str(programs.PROGRAM_SEARCH_SCAN_LIMIT)},
        q=None,
    )

    assert len(rows) == programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE + 1
    assert calls[0]["limit"] == str(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)
    assert calls[0]["offset"] == "0"
    assert calls[1]["offset"] == str(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)


@pytest.mark.asyncio
async def test_fetch_program_rows_paginates_large_recommendation_candidates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict] = []

    async def fake_request_supabase(*, method: str, path: str, params: dict, **_: object) -> list[dict]:
        calls.append(dict(params))
        offset = int(params.get("offset", 0))
        if offset == 0:
            return [{"id": f"row-{index}"} for index in range(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)]
        if offset == programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE:
            return [{"id": "row-last"}]
        return []

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    rows = await programs._fetch_program_rows(limit=programs.PROGRAM_SEARCH_SCAN_LIMIT)

    assert len(rows) == programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE + 1
    assert calls[0]["limit"] == str(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)
    assert calls[0]["offset"] == "0"
    assert calls[1]["offset"] == str(programs.PROGRAM_SEARCH_SCAN_PAGE_SIZE)


@pytest.mark.asyncio
async def test_fetch_program_list_rows_falls_back_when_search_index_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict] = []

    async def fake_request_supabase(*, method: str, path: str, params: dict, **_: object) -> list[dict]:
        calls.append(dict(params))
        if programs.PROGRAM_SEARCH_INDEX_COLUMN in params:
            raise RuntimeError("column programs.search_text does not exist")
        return [{"id": "fallback-row"}]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    rows = await programs._fetch_program_list_rows(
        {
            "select": "*",
            programs.PROGRAM_SEARCH_INDEX_COLUMN: "ilike.*패스트캠퍼스*",
        },
        q="패스트캠퍼스",
    )

    assert rows == [{"id": "fallback-row"}]
    assert programs.PROGRAM_SEARCH_INDEX_COLUMN in calls[0]
    assert programs.PROGRAM_SEARCH_INDEX_COLUMN not in calls[1]


def test_compute_program_relevance_items_adds_fit_interpretation_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        programs.programs_rag,
        "_profile_keywords",
        lambda profile, activities: ["react", "typescript", "frontend"],
    )
    monkeypatch.setattr(
        programs.programs_rag,
        "_program_match_context",
        lambda program, profile_keywords: (["React", "TypeScript"], 0.82),
    )
    monkeypatch.setattr(
        programs.programs_rag,
        "_tokenize_text",
        lambda value: [token.lower() for token in str(value).replace(",", " ").split() if token.strip()],
    )

    items = programs._compute_program_relevance_items(
        profile={
            "skills": ["React", "TypeScript", "Next.js"],
            "self_intro": "프론트엔드 프로젝트 경험을 꾸준히 정리하고 있습니다.",
            "bio": "사용자 경험 중심 개발자",
            "career": ["프론트엔드 인턴 6개월"],
        },
        activities=[
            {"id": "act-1", "title": "프로젝트", "description": "React 대시보드 구축", "skills": ["React"]},
        ],
        programs_by_id={
            "program-1": {
                "id": "program-1",
                "title": "React TypeScript 부트캠프",
                "skills": ["React", "TypeScript"],
                "summary": "실전 프론트엔드 과정",
                "description": "React와 TypeScript 중심 교육",
            }
        },
        program_ids=["program-1"],
    )

    assert len(items) == 1
    item = items[0]
    assert item.program_id == "program-1"
    assert item.relevance_score == 0.82
    assert item.skill_match_score > 0.5
    assert item.matched_skills[:2] == ["React", "TypeScript"]
    assert item.fit_label == "높음"
    assert item.readiness_label == "바로 지원 추천"
    assert "전반적으로 잘 맞습니다." in item.fit_summary
    assert item.gap_tags == []
    assert item.score_breakdown["region"] == 0
    assert item.score_breakdown["skills"] == 20
    assert item.score_breakdown["experience"] == 20


def test_compute_program_relevance_items_adds_region_signal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        programs.programs_rag,
        "_profile_keywords",
        lambda profile, activities: ["ai"],
    )
    monkeypatch.setattr(
        programs.programs_rag,
        "_program_match_context",
        lambda program, profile_keywords: (["AI"], 0.5),
    )
    monkeypatch.setattr(
        programs.programs_rag,
        "_tokenize_text",
        lambda value: [token.lower() for token in str(value).replace(",", " ").split() if token.strip()],
    )

    items = programs._compute_program_relevance_items(
        profile={
            "skills": ["AI"],
            "region": "서울",
            "region_detail": "서울 강남구",
            "self_intro": "AI 프로젝트 경험을 바탕으로 교육 과정을 찾고 있습니다.",
            "career": ["AI 서비스 개발"],
        },
        activities=[{"id": "act-1", "title": "AI 프로젝트", "skills": ["AI"]}],
        programs_by_id={
            "program-1": {
                "id": "program-1",
                "title": "AI 부트캠프",
                "skills": ["AI"],
                "location": "서울 강남구",
            }
        },
        program_ids=["program-1"],
    )

    item = items[0]
    assert item.region_match_score == 1.0
    assert item.matched_regions == ["서울"]
    assert item.relevance_score == 0.575
    assert item.score_breakdown["region"] == 15
    assert item.score_breakdown["skills"] == 25
    assert item.score_breakdown["experience"] == 15


def test_compute_region_match_scores_adjacent_and_online_programs() -> None:
    assert programs._compute_region_match(
        profile_region="서울",
        profile_region_detail=None,
        program={"location": "경기 성남시"},
    ) == (["경기"], 0.6667)
    assert programs._compute_region_match(
        profile_region="전북",
        profile_region_detail=None,
        program={"teaching_method": "온라인"},
    ) == (["온라인"], 0.8)
    assert programs._compute_region_match(
        profile_region="전북",
        profile_region_detail=None,
        program={"teaching_method": "온라인/오프라인 병행"},
    ) == (["혼합"], 0.6667)
    assert programs._compute_region_match(
        profile_region="전북",
        profile_region_detail=None,
        program={"teaching_method": "온라인", "summary": "혼합형 실습 과정"},
    ) == (["온라인"], 0.8)
    assert programs._compute_region_match(
        profile_region="서울",
        profile_region_detail=None,
        program={"title": "온라인 AI 과정", "location": "서울 강남구"},
    ) == (["혼합"], 0.6667)
    assert programs._compute_region_match(
        profile_region="충북",
        profile_region_detail=None,
        program={"compare_meta": {"region": "충청북도 청주시"}},
    ) == (["충북"], 1.0)
    assert programs._compute_region_match(
        profile_region="경기",
        profile_region_detail=None,
        program={
            "region": "경기",
            "location": "서울 강남구",
            "compare_meta": {"region": "부산"},
        },
    ) == (["경기"], 1.0)
    assert programs._compute_region_match(
        profile_region="부산",
        profile_region_detail=None,
        program={
            "location": "서울 강남구",
            "compare_meta": {"region": "부산"},
        },
    ) == ([], 0.0)
    assert programs._compute_region_match(
        profile_region="부산",
        profile_region_detail=None,
        program={"compare_meta": {"region": "부산광역시 해운대구"}},
    ) == (["부산"], 1.0)


def test_compute_program_relevance_items_handles_sparse_profile_without_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        programs.programs_rag,
        "_profile_keywords",
        lambda profile, activities: [],
    )
    monkeypatch.setattr(
        programs.programs_rag,
        "_program_match_context",
        lambda program, profile_keywords: ([], 0.2),
    )
    monkeypatch.setattr(programs.programs_rag, "_tokenize_text", lambda value: [])

    items = programs._compute_program_relevance_items(
        profile={
            "skills": [],
            "self_intro": "",
            "bio": "",
            "career": [],
        },
        activities=[],
        programs_by_id={
            "program-1": {
                "id": "program-1",
                "title": "데이터 부트캠프",
                "summary": "데이터 분석 기초",
            }
        },
        program_ids=["program-1"],
    )

    assert len(items) == 1
    item = items[0]
    assert item.fit_label == "낮음"
    assert item.readiness_label == "탐색용 확인"
    assert item.gap_tags == [
        "프로필 기술 정보 부족",
        "활동 근거 부족",
        "기술 스택 근거 부족",
    ]
    assert "직접 연관성이 충분히 확인되지 않습니다." in item.fit_summary


@pytest.mark.asyncio
async def test_build_cached_recommendation_items_recalculates_final_score_and_preserves_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_fetch_programs_by_ids(program_ids: list[str]) -> dict[str, dict[str, object]]:
        assert program_ids == ["program-1"]
        return {
            "program-1": {
                "id": "program-1",
                "title": "AI 부트캠프",
                "deadline": "2099-05-01",
            }
        }

    monkeypatch.setattr(programs, "_fetch_programs_by_ids", fake_fetch_programs_by_ids)

    items = await programs._build_cached_recommendation_items(
        [
            {
                "program_id": "program-1",
                "similarity_score": 0.8,
                "relevance_score": 0.4,
                "urgency_score": 0.5,
                "final_score": 0.99,
                "reason": "캐시된 추천입니다.",
                "fit_keywords": ["AI", "서울"],
            }
        ],
        top_k=5,
    )

    assert len(items) == 1
    assert items[0].score == 0.44
    assert items[0].reason == "캐시된 추천입니다."
    assert items[0].fit_keywords == ["AI", "서울"]
    assert items[0].program.final_score == 0.44
    assert items[0].program.relevance_score == 0.4
    assert items[0].program.urgency_score == 0.5


def test_build_profile_hash_prefers_recommendation_profile_hash_when_present() -> None:
    profile_hash = programs._build_profile_hash(
        {
            "job_title": "백엔드 개발자",
            "skills": ["Python"],
            "recommendation_profile_hash": "derived-hash-123",
        },
        [],
    )

    assert profile_hash == "derived-hash-123"


@pytest.mark.asyncio
async def test_fetch_profile_row_prefers_user_recommendation_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_request_supabase(
        *,
        method: str,
        path: str,
        params: dict[str, object] | None = None,
        payload: object | None = None,
        prefer: str | None = None,
    ) -> list[dict[str, object]]:
        assert method == "GET"
        assert payload is None
        assert prefer is None
        assert params is not None
        if path == "/rest/v1/user_recommendation_profile":
            assert params["select"] == programs.USER_RECOMMENDATION_PROFILE_SELECT
            return [
                {
                    "user_id": "user-1",
                    "effective_target_job": "데이터 분석가",
                    "profile_keywords": ["데이터 분석", "sql"],
                    "evidence_skills": ["Python", "SQL"],
                    "desired_skills": ["Tableau"],
                    "activity_keywords": ["프로젝트"],
                    "preferred_regions": ["서울"],
                    "profile_completeness_score": 0.7,
                    "recommendation_ready": True,
                    "recommendation_profile_hash": "derived-hash",
                    "derivation_version": 1,
                    "source_snapshot": {
                        "profile": {
                            "region": "서울",
                            "region_detail": "강남구",
                        }
                    },
                    "last_derived_at": "2026-04-24T12:00:00+00:00",
                }
            ]
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    profile = await programs._fetch_profile_row("user-1")

    assert profile["job_title"] == "데이터 분석가"
    assert profile["target_job"] == "데이터 분석가"
    assert profile["skills"] == ["Python", "SQL"]
    assert profile["desired_skills"] == ["Tableau"]
    assert profile["region"] == "서울"
    assert profile["region_detail"] == "강남구"
    assert profile["recommendation_profile_hash"] == "derived-hash"
    assert profile["recommendation_ready"] is True


@pytest.mark.asyncio
async def test_fetch_profile_row_falls_back_to_profiles_when_recommendation_profile_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    async def fake_request_supabase(
        *,
        method: str,
        path: str,
        params: dict[str, object] | None = None,
        payload: object | None = None,
        prefer: str | None = None,
    ) -> list[dict[str, object]]:
        assert method == "GET"
        assert payload is None
        assert prefer is None
        assert params is not None
        calls.append(path)
        if path == "/rest/v1/user_recommendation_profile":
            raise RuntimeError('Supabase request failed: relation "user_recommendation_profile" does not exist')
        if path == "/rest/v1/profiles":
            return [{"id": "user-1", "job_title": "백엔드 개발자", "skills": ["FastAPI"]}]
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    profile = await programs._fetch_profile_row("user-1")

    assert calls == ["/rest/v1/user_recommendation_profile", "/rest/v1/profiles"]
    assert profile["job_title"] == "백엔드 개발자"
    assert profile["skills"] == ["FastAPI"]


@pytest.mark.asyncio
async def test_recommend_programs_uses_rule_before_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch_program_rows(**_: object) -> list[dict[str, object]]:
        return [_sample_program("program-1"), _sample_program("program-2")]

    async def fake_get_current_user(_: str) -> object:
        return type("User", (), {"id": "user-1"})()

    async def fake_fetch_profile_row(_: str) -> dict[str, object]:
        return {"job_title": "백엔드 개발자"}

    async def fake_fetch_activity_rows(_: str, limit: int = 50) -> list[dict[str, object]]:
        return [{"id": "activity-1", "title": "포트폴리오", "role": "개발"}]

    async def fake_load_rule(_: list[str]) -> dict[str, object]:
        return {
            "condition_key": "IT+서울",
            "program_ids": ["program-2", "program-1"],
            "reason_template": "서울 지역 IT 프로그램 추천입니다.",
            "fit_keywords": ["IT", "서울"],
            "priority": 200,
        }

    async def fail_cache_load(*args: object, **kwargs: object) -> None:
        raise AssertionError("cache should not be loaded when a rule hit exists")

    async def fake_fetch_programs_by_ids(_: list[str]) -> dict[str, dict[str, object]]:
        return {
            "program-1": _sample_program("program-1"),
            "program-2": _sample_program("program-2"),
        }

    monkeypatch.setattr(programs, "_fetch_program_rows", fake_fetch_program_rows)
    monkeypatch.setattr(programs, "get_current_user_from_authorization", fake_get_current_user)
    monkeypatch.setattr(programs, "_fetch_profile_row", fake_fetch_profile_row)
    monkeypatch.setattr(programs, "_fetch_activity_rows", fake_fetch_activity_rows)
    monkeypatch.setattr(programs, "_load_recommendation_rule", fake_load_rule)
    monkeypatch.setattr(programs, "_load_cached_recommendations", fail_cache_load)
    monkeypatch.setattr(programs, "_fetch_programs_by_ids", fake_fetch_programs_by_ids)

    response = await programs.recommend_programs(
        programs.ProgramRecommendRequest(top_k=1, category="IT", region="서울"),
        authorization="Bearer token",
    )

    assert len(response.items) == 1
    assert response.items[0].program_id == "program-2"
    assert response.items[0].reason == "서울 지역 IT 프로그램 추천입니다."
    assert response.items[0].fit_keywords == ["IT", "서울"]


@pytest.mark.asyncio
async def test_recommend_programs_uses_hash_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch_program_rows(**_: object) -> list[dict[str, object]]:
        return [_sample_program("program-1")]

    async def fake_get_current_user(_: str) -> object:
        return type("User", (), {"id": "user-1"})()

    async def fake_fetch_profile_row(_: str) -> dict[str, object]:
        return {"job_title": "데이터 분석가"}

    async def fake_fetch_activity_rows(_: str, limit: int = 50) -> list[dict[str, object]]:
        return [{"id": "activity-1", "title": "데이터 프로젝트"}]

    async def fake_load_rule(_: list[str]) -> None:
        return None

    async def fake_load_cache(*args: object, **kwargs: object) -> list[dict[str, object]]:
        return [
            {
                "program_id": "program-1",
                "similarity_score": 0.7,
                "relevance_score": 0.6,
                "urgency_score": 0.2,
                "final_score": 0.9,
                "reason": "캐시된 추천입니다.",
                "fit_keywords": ["데이터", "서울"],
            }
        ]

    async def fake_fetch_programs_by_ids(_: list[str]) -> dict[str, dict[str, object]]:
        return {"program-1": _sample_program("program-1")}

    monkeypatch.setattr(programs, "_fetch_program_rows", fake_fetch_program_rows)
    monkeypatch.setattr(programs, "get_current_user_from_authorization", fake_get_current_user)
    monkeypatch.setattr(programs, "_fetch_profile_row", fake_fetch_profile_row)
    monkeypatch.setattr(programs, "_fetch_activity_rows", fake_fetch_activity_rows)
    monkeypatch.setattr(programs, "_load_recommendation_rule", fake_load_rule)
    monkeypatch.setattr(programs, "_load_cached_recommendations", fake_load_cache)
    monkeypatch.setattr(programs, "_fetch_programs_by_ids", fake_fetch_programs_by_ids)

    response = await programs.recommend_programs(
        programs.ProgramRecommendRequest(top_k=3),
        authorization="Bearer token",
    )

    assert len(response.items) == 1
    assert response.items[0].program_id == "program-1"
    assert response.items[0].reason == "캐시된 추천입니다."
    assert response.items[0].fit_keywords == ["데이터", "서울"]


@pytest.mark.asyncio
async def test_recommend_programs_force_refresh_skips_rule_and_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    deleted: list[str] = []
    saved: list[tuple[str, str]] = []

    async def fake_fetch_program_rows(**_: object) -> list[dict[str, object]]:
        return [_sample_program("program-1")]

    async def fake_get_current_user(_: str) -> object:
        return type("User", (), {"id": "user-1"})()

    async def fake_fetch_profile_row(_: str) -> dict[str, object]:
        return {"job_title": "개발자"}

    async def fake_fetch_activity_rows(_: str, limit: int = 50) -> list[dict[str, object]]:
        return [{"id": "activity-1", "title": "개발", "role": "백엔드"}]

    async def fail_rule(*args: object, **kwargs: object) -> None:
        raise AssertionError("force_refresh should bypass rule lookup")

    async def fail_cache(*args: object, **kwargs: object) -> None:
        raise AssertionError("force_refresh should bypass cache lookup")

    async def fake_delete_cache(
        user_id: str,
        *,
        query_hash: str | None = None,
        profile_hash: str | None = None,
    ) -> None:
        deleted.append(f"{user_id}:{query_hash}:{profile_hash}")

    async def fake_rag_recommend(**_: object) -> list[programs.ProgramRecommendation]:
        return [
            programs.ProgramRecommendation(
                program_id="program-1",
                score=0.82,
                relevance_score=0.8,
                reason="실시간으로 다시 계산한 추천입니다.",
                fit_keywords=["IT"],
                program={
                    **_sample_program("program-1"),
                    "similarity_score": 0.8,
                    "relevance_score": 0.8,
                    "urgency_score": 0.2,
                    "final_score": 0.82,
                },
            )
        ]

    async def fake_save(
        user_id: str,
        recommendations: list[programs.ProgramRecommendation],
        *,
        profile_hash: str | None = None,
        query_hash: str | None = None,
    ) -> None:
        assert user_id == "user-1"
        assert recommendations
        assert profile_hash is not None
        assert query_hash is not None
        saved.append((profile_hash, query_hash))

    monkeypatch.setattr(programs, "_fetch_program_rows", fake_fetch_program_rows)
    monkeypatch.setattr(programs, "get_current_user_from_authorization", fake_get_current_user)
    monkeypatch.setattr(programs, "_fetch_profile_row", fake_fetch_profile_row)
    monkeypatch.setattr(programs, "_fetch_activity_rows", fake_fetch_activity_rows)
    monkeypatch.setattr(programs, "_load_recommendation_rule", fail_rule)
    monkeypatch.setattr(programs, "_load_cached_recommendations", fail_cache)
    monkeypatch.setattr(programs, "_delete_cached_recommendations", fake_delete_cache)
    monkeypatch.setattr(programs.programs_rag, "recommend", fake_rag_recommend)
    monkeypatch.setattr(programs, "_save_recommendations", fake_save)

    response = await programs.recommend_programs(
        programs.ProgramRecommendRequest(top_k=3, force_refresh=True),
        authorization="Bearer token",
    )

    assert len(response.items) == 1
    assert deleted
    assert saved


@pytest.mark.asyncio
async def test_recommend_programs_returns_default_for_empty_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch_program_rows(**_: object) -> list[dict[str, object]]:
        return [_sample_program("program-1")]

    async def fake_get_current_user(_: str) -> object:
        return type("User", (), {"id": "user-1"})()

    async def fake_fetch_profile_row(_: str) -> dict[str, object]:
        return {}

    async def fake_fetch_activity_rows(_: str, limit: int = 50) -> list[dict[str, object]]:
        return []

    async def fake_load_rule(_: list[str]) -> None:
        return None

    async def fake_load_cache(*args: object, **kwargs: object) -> None:
        return None

    async def fail_rag(**_: object) -> None:
        raise AssertionError("rag recommend should not run without profile/activity input")

    monkeypatch.setattr(programs, "_fetch_program_rows", fake_fetch_program_rows)
    monkeypatch.setattr(programs, "get_current_user_from_authorization", fake_get_current_user)
    monkeypatch.setattr(programs, "_fetch_profile_row", fake_fetch_profile_row)
    monkeypatch.setattr(programs, "_fetch_activity_rows", fake_fetch_activity_rows)
    monkeypatch.setattr(programs, "_load_recommendation_rule", fake_load_rule)
    monkeypatch.setattr(programs, "_load_cached_recommendations", fake_load_cache)
    monkeypatch.setattr(programs.programs_rag, "recommend", fail_rag)

    response = await programs.recommend_programs(
        programs.ProgramRecommendRequest(top_k=3),
        authorization="Bearer token",
    )

    assert len(response.items) == 1
    assert "프로필 기반 추천 데이터가 충분하지 않아" in response.items[0].reason
@pytest.mark.asyncio
async def test_load_cached_recommendations_falls_back_to_legacy_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    async def fake_request_supabase(
        *,
        method: str,
        path: str,
        params: dict[str, object] | None = None,
        payload: object | None = None,
        prefer: str | None = None,
    ) -> list[dict[str, object]]:
        assert method == "GET"
        assert path == "/rest/v1/recommendations"
        assert payload is None
        assert prefer is None
        select = str((params or {}).get("select") or "")
        calls.append(select)
        if "generated_at" in select:
            raise RuntimeError("column recommendations.generated_at does not exist")
        return [
            {
                "program_id": "program-1",
                "score": 0.73,
                "created_at": "2099-01-01T00:00:00+00:00",
            }
        ]

    monkeypatch.setattr(programs, "request_supabase", fake_request_supabase)

    rows = await programs._load_cached_recommendations("user-1")

    assert calls == [
        "program_id,similarity_score,relevance_score,urgency_score,final_score,generated_at,reason,fit_keywords,query_hash,profile_hash,expires_at",
        "program_id,score,created_at",
    ]
    assert rows == [
        {
            "program_id": "program-1",
            "similarity_score": 0.73,
            "relevance_score": 0.73,
            "urgency_score": 0.0,
            "final_score": 0.73,
            "generated_at": "2099-01-01T00:00:00+00:00",
        }
    ]


def test_recommend_calendar_anonymous_returns_contract_shape(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    future_deadline = (date.today() + timedelta(days=2)).isoformat()

    async def fake_fetch_program_rows(
        limit: int = 200,
        category: str | None = None,
        region: str | None = None,
    ) -> list[dict[str, object]]:
        assert limit >= 50
        return [
            {
                "id": "program-1",
                "title": "데이터 분석 과정",
                "deadline": future_deadline,
                "location": "서울",
                "is_active": True,
            }
        ]

    monkeypatch.setattr(programs, "_fetch_program_rows", fake_fetch_program_rows)

    response = client.get("/programs/recommend/calendar")

    assert response.status_code == 200
    payload = response.json()
    assert list(payload.keys()) == ["items"]
    assert len(payload["items"]) == 1
    item = payload["items"][0]
    assert item["program_id"] == "program-1"
    assert item["deadline"] == future_deadline
    assert item["d_day_label"] == "D-2"
    assert item["relevance_score"] == 0.0
    assert item["urgency_score"] > 0
    assert item["final_score"] == programs._recalculate_final_score(0.0, item["urgency_score"])
    assert item["reason"]
    assert item["fit_keywords"] == []
    assert item["relevance_reasons"] == [item["reason"]]
    assert item["relevance_badge"] is None
    assert item["relevance_grade"] == "none"
    assert item["program"]["id"] == "program-1"


def test_recommend_calendar_uses_fresh_path_when_cache_rows_are_stale(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    future_deadline = (date.today() + timedelta(days=5)).isoformat()
    recommend_called = {"value": False}

    async def fake_fetch_program_rows(
        limit: int = 200,
        category: str | None = None,
        region: str | None = None,
    ) -> list[dict[str, object]]:
        return [
            {
                "id": "program-1",
                "title": "AI 서비스 기획",
                "deadline": future_deadline,
                "location": "서울",
                "is_active": True,
            }
        ]

    async def fake_get_current_user_from_authorization(_: str) -> SimpleNamespace:
        return SimpleNamespace(id="user-1")

    async def fake_load_cached_recommendations(*args: object, **kwargs: object) -> list[dict[str, object]]:
        return [
            {
                "program_id": "program-1",
                "relevance_score": 0.8,
                "urgency_score": None,
                "final_score": 0.95,
            }
        ]

    async def fake_fetch_profile_row(_: str) -> dict[str, object]:
        return {"id": "user-1", "skills": ["기획"]}

    async def fake_fetch_activity_rows(_: str, limit: int = 50) -> list[dict[str, object]]:
        return []

    async def fake_recommend(**_: object) -> list[programs.ProgramRecommendation]:
        recommend_called["value"] = True
        return [
            programs.ProgramRecommendation(
                program_id="program-1",
                score=programs._recalculate_final_score(0.7, 0.4),
                relevance_score=0.7,
                reason="프로필과 잘 맞는 과정입니다.",
                fit_keywords=["기획"],
                program={
                    "id": "program-1",
                    "title": "AI 서비스 기획",
                    "deadline": future_deadline,
                    "location": "서울",
                    "relevance_score": 0.7,
                    "urgency_score": 0.4,
                    "final_score": programs._recalculate_final_score(0.7, 0.4),
                },
            )
        ]

    async def fake_save_recommendations(
        _: str,
        __: list[programs.ProgramRecommendation],
        *,
        profile_hash: str | None = None,
        query_hash: str | None = None,
    ) -> None:
        return None

    monkeypatch.setattr(programs, "_fetch_program_rows", fake_fetch_program_rows)
    monkeypatch.setattr(programs, "get_current_user_from_authorization", fake_get_current_user_from_authorization)
    monkeypatch.setattr(programs, "_load_cached_recommendations", fake_load_cached_recommendations)
    monkeypatch.setattr(programs, "_fetch_profile_row", fake_fetch_profile_row)
    monkeypatch.setattr(programs, "_fetch_activity_rows", fake_fetch_activity_rows)
    monkeypatch.setattr(programs.programs_rag, "recommend", fake_recommend)
    monkeypatch.setattr(programs, "_save_recommendations", fake_save_recommendations)

    response = client.get(
        "/programs/recommend/calendar",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    assert recommend_called["value"] is True
    payload = response.json()
    assert payload["items"][0]["final_score"] == programs._recalculate_final_score(0.7, 0.4)
    assert payload["items"][0]["relevance_score"] == 0.7
    assert payload["items"][0]["fit_keywords"] == ["기획"]
    assert payload["items"][0]["relevance_reasons"] == ["기획 키워드와 연관", "프로필과 잘 맞는 과정입니다."]
    assert payload["items"][0]["relevance_badge"] == "추천"
    assert payload["items"][0]["relevance_grade"] == "medium"


def test_recommend_calendar_sorts_by_final_score_then_deadline_and_excludes_expired(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    earlier_deadline = (date.today() + timedelta(days=3)).isoformat()
    later_deadline = (date.today() + timedelta(days=9)).isoformat()
    expired_deadline = (date.today() - timedelta(days=1)).isoformat()

    async def fake_fetch_program_rows(
        limit: int = 200,
        category: str | None = None,
        region: str | None = None,
    ) -> list[dict[str, object]]:
        return [
            {"id": "program-1", "title": "A", "deadline": earlier_deadline, "is_active": True},
            {"id": "program-2", "title": "B", "deadline": later_deadline, "is_active": True},
            {"id": "program-3", "title": "C", "deadline": expired_deadline, "is_active": True},
        ]

    async def fake_get_current_user_from_authorization(_: str) -> SimpleNamespace:
        return SimpleNamespace(id="user-1")

    async def fake_load_cached_recommendations(*args: object, **kwargs: object) -> list[dict[str, object]]:
        return [
            {
                "program_id": "program-2",
                "relevance_score": 0.6,
                "urgency_score": 0.4,
                "final_score": 0.1,
            },
            {
                "program_id": "program-1",
                "relevance_score": 0.6,
                "urgency_score": 0.4,
                "final_score": 0.9,
            },
            {
                "program_id": "program-3",
                "relevance_score": 0.95,
                "urgency_score": 0.95,
                "final_score": 0.95,
            },
        ]

    async def fake_fetch_programs_by_ids(program_ids: list[str]) -> dict[str, dict[str, object]]:
        assert set(program_ids) == {"program-1", "program-2", "program-3"}
        return {
            "program-1": {"id": "program-1", "title": "A", "deadline": earlier_deadline},
            "program-2": {"id": "program-2", "title": "B", "deadline": later_deadline},
            "program-3": {"id": "program-3", "title": "C", "deadline": expired_deadline},
        }

    monkeypatch.setattr(programs, "_fetch_program_rows", fake_fetch_program_rows)
    monkeypatch.setattr(programs, "get_current_user_from_authorization", fake_get_current_user_from_authorization)
    async def fake_fetch_profile_row(user_id: str) -> dict[str, object]:
        assert user_id == "user-1"
        return {}

    async def fake_fetch_activity_rows(user_id: str) -> list[dict[str, object]]:
        assert user_id == "user-1"
        return []

    monkeypatch.setattr(programs, "_fetch_profile_row", fake_fetch_profile_row)
    monkeypatch.setattr(programs, "_fetch_activity_rows", fake_fetch_activity_rows)
    monkeypatch.setattr(programs, "_load_cached_recommendations", fake_load_cached_recommendations)
    monkeypatch.setattr(programs, "_fetch_programs_by_ids", fake_fetch_programs_by_ids)

    response = client.get(
        "/programs/recommend/calendar",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert [item["program_id"] for item in payload["items"]] == ["program-1", "program-2"]
    assert payload["items"][0]["deadline"] == earlier_deadline
    assert payload["items"][1]["deadline"] == later_deadline


def test_build_calendar_item_drops_unresolved_work24_deadline() -> None:
    training_end_date = (date.today() + timedelta(days=30)).isoformat()

    item = programs._build_calendar_item(
        program_id="work24-training-end-only",
        reason="fallback",
        program={
            "id": "work24-training-end-only",
            "source": "고용24",
            "title": "훈련 종료일만 있는 과정",
            "deadline": training_end_date,
            "end_date": training_end_date,
        },
        relevance_score=0,
        urgency_score=0,
    )

    assert item is None


def test_build_calendar_item_trusts_work24_training_start_deadline_marker() -> None:
    one_day_date = (date.today() + timedelta(days=5)).isoformat()

    item = programs._build_calendar_item(
        program_id="work24-training-start-deadline",
        reason="fallback",
        program={
            "id": "work24-training-start-deadline",
            "source": "고용24",
            "title": "훈련시작일을 모집기한으로 쓰는 과정",
            "deadline": one_day_date,
            "start_date": one_day_date,
            "end_date": one_day_date,
            "compare_meta": {"deadline_source": "traStartDate"},
        },
        relevance_score=0,
        urgency_score=0,
    )

    assert item is not None
    assert item.deadline == one_day_date
