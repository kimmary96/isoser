from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

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


def test_build_program_query_params_for_filtered_list() -> None:
    params = programs._build_program_query_params(
        select="*",
        category="IT",
        q="부트캠프",
        regions=["서울", "대전·충청"],
        recruiting_only=True,
        sort="latest",
        limit=20,
        offset=40,
    )

    assert params["select"] == "*"
    assert params["category"] == "eq.IT"
    assert params["title"] == "ilike.*부트캠프*"
    assert params["deadline"] == f"gte.{date.today().isoformat()}"
    assert params["order"] == "created_at.desc.nullslast"
    assert params["limit"] == "20"
    assert params["offset"] == "40"
    assert params["or"] == "(location.ilike.*서울*,location.ilike.*대전*,location.ilike.*충청*,location.ilike.*세종*)"


def test_build_program_query_params_deadline_sort_only_includes_active_programs() -> None:
    params = programs._build_program_query_params(
        select="*",
        sort="deadline",
    )

    assert params["order"] == "deadline.asc.nullslast"
    assert params["deadline"] == f"gte.{date.today().isoformat()}"


def test_build_program_query_params_include_closed_recent_uses_90_day_cutoff() -> None:
    params = programs._build_program_query_params(
        select="*",
        include_closed_recent=True,
        sort="deadline",
    )

    assert params["deadline"] == f"gte.{(date.today() - timedelta(days=90)).isoformat()}"


def test_normalize_regions_param_splits_csv_values() -> None:
    normalized = programs._normalize_regions_param(["서울,경기", "온라인"])
    assert normalized == ["서울", "경기", "온라인"]


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
        ],
        sort="deadline",
        include_closed_recent=True,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["active", "closed-recent", "closed-older"]
    assert rows[0]["is_active"] is True
    assert rows[1]["is_active"] is False


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
