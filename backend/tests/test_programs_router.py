from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from routers import programs


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
    assert params["category_detail"] == "eq.web-development"
    assert "title" not in params
    assert params["search_text"] == "ilike.*부트캠프*"
    assert params["limit"] == "20"
    assert params["deadline"] == f"gte.{date.today().isoformat()}"
    assert params["order"] == "created_at.desc.nullslast"
    assert params["limit"] == "20"
    assert params["offset"] == "40"
    assert params["or"] == "(location.ilike.*서울*,location.ilike.*대전*,location.ilike.*충청*,location.ilike.*세종*)"


def test_build_program_query_params_expands_scan_limit_for_backend_search() -> None:
    params = programs._build_program_query_params(
        select="*",
        q="패스트캠퍼스",
    )

    assert params["limit"] == str(programs.PROGRAM_SEARCH_SCAN_LIMIT)
    assert "title" not in params
    assert params["search_text"] == "ilike.*패스트캠퍼스*"


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
    assert detail.application_end_date is None
    assert detail.program_start_date == "2026-04-23"
    assert detail.program_end_date == "2026-05-12"
    assert detail.schedule_text == "운영 2026-04-23 ~ 2026-05-12"
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
        sort="deadline",
        include_closed_recent=False,
        limit=10,
        offset=0,
    )

    assert [row["id"] for row in rows] == ["title-match", "provider-match", "description-match"]


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
async def test_build_cached_recommendation_items_recalculates_final_score(
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
            }
        ],
        top_k=5,
    )

    assert len(items) == 1
    assert items[0].score == 0.44
    assert items[0].program.final_score == 0.44
    assert items[0].program.relevance_score == 0.4
    assert items[0].program.urgency_score == 0.5


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

    async def fake_load_cached_recommendations(_: str) -> list[dict[str, object]]:
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

    async def fake_save_recommendations(_: str, __: list[programs.ProgramRecommendation]) -> None:
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

    async def fake_load_cached_recommendations(_: str) -> list[dict[str, object]]:
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
