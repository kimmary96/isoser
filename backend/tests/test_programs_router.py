from __future__ import annotations

from datetime import date, timedelta

from routers import programs


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
    assert params["is_active"] == "eq.true"
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
    assert params["is_active"] == "eq.true"


def test_normalize_regions_param_splits_csv_values() -> None:
    normalized = programs._normalize_regions_param(["서울,경기", "온라인"])

    assert normalized == ["서울", "경기", "온라인"]


def test_parse_content_range_total_reads_exact_count() -> None:
    assert programs._parse_content_range_total("0-0/57") == 57
    assert programs._parse_content_range_total("*/0") == 0
    assert programs._parse_content_range_total(None) == 0


def test_score_program_record_uses_hybrid_weights() -> None:
    deadline = (date.today() + timedelta(days=5)).isoformat()

    scored = programs._score_program_record(
        {"id": "program-1", "deadline": deadline},
        relevance_score=0.5,
        similarity_score=0.5,
    )

    assert scored["urgency_score"] == round(1.0 - 5 / 30, 4)
    assert scored["final_score"] == round(0.5 * 0.6 + scored["urgency_score"] * 0.4, 4)
    assert scored["days_left"] == 5


def test_build_default_recommendation_items_orders_by_urgency_then_deadline() -> None:
    sooner_deadline = (date.today() + timedelta(days=3)).isoformat()
    later_deadline = (date.today() + timedelta(days=10)).isoformat()

    items = programs._build_default_recommendation_items(
        [
            {"id": "later", "title": "Later", "deadline": later_deadline},
            {"id": "sooner", "title": "Sooner", "deadline": sooner_deadline},
        ],
        top_k=2,
        reason="default",
    )

    assert [item.program_id for item in items] == ["sooner", "later"]
    assert items[0].program.urgency_score > items[1].program.urgency_score


def test_build_calendar_recommendation_items_filters_expired_programs() -> None:
    expired_deadline = (date.today() - timedelta(days=1)).isoformat()
    active_deadline = (date.today() + timedelta(days=2)).isoformat()

    items = [
        programs.ProgramRecommendItem(
            program_id="expired",
            score=0.1,
            relevance_score=0.0,
            reason="expired",
            fit_keywords=[],
            program=programs.ProgramListItem.model_validate(
                programs._score_program_record(
                    {"id": "expired", "title": "Expired", "deadline": expired_deadline},
                    relevance_score=0.0,
                )
            ),
        ),
        programs.ProgramRecommendItem(
            program_id="active",
            score=0.2,
            relevance_score=0.0,
            reason="active",
            fit_keywords=[],
            program=programs.ProgramListItem.model_validate(
                programs._score_program_record(
                    {"id": "active", "title": "Active", "deadline": active_deadline},
                    relevance_score=0.0,
                )
            ),
        ),
    ]

    calendar_items = programs._build_calendar_recommendation_items(items)

    assert [item.program_id for item in calendar_items] == ["active"]
    assert calendar_items[0].d_day_label == "D-2"
