from __future__ import annotations

from utils.activity_converter import activity_to_portfolio, activity_to_star


def _rich_activity() -> dict[str, object]:
    return {
        "id": "activity-1",
        "type": "프로젝트",
        "title": "실시간 주문 처리 플랫폼",
        "organization": "이소서",
        "team_size": 5,
        "team_composition": "PM 1 / 백엔드 2 / 프론트엔드 1 / 디자이너 1",
        "my_role": "백엔드 개발자",
        "contributions": [
            "Redis 기반 매칭 엔진을 구현했습니다.",
            "주문 API를 비동기 구조로 전환했습니다.",
        ],
        "period": "2025.03 ~ 2025.07",
        "role": "백엔드 개발자",
        "skills": ["FastAPI", "Redis", "PostgreSQL"],
        "description": (
            "기존 수동 배차 프로세스의 병목을 해결하기 위해 PostgreSQL 대신 Redis를 선택했고 "
            "주문 처리 시간을 12초에서 3초로 단축했습니다."
        ),
        "star_situation": "피크타임마다 주문 배차가 지연되는 문제가 있었습니다.",
        "star_task": "주문 처리 시간을 3개월 안에 절반 이하로 줄이는 것이 목표였습니다.",
        "star_action": (
            "PostgreSQL 대신 Redis 기반 매칭 엔진을 설계하고 주문 API를 비동기 구조로 전환했습니다."
        ),
        "star_result": "주문 처리 시간을 12초에서 3초로 단축하고 일 15,000건 주문을 안정적으로 처리했습니다.",
    }


def test_activity_to_star_prefers_existing_star_fields() -> None:
    result = activity_to_star(_rich_activity())

    assert result["activity_id"] == "activity-1"
    assert result["star_situation"] == "피크타임마다 주문 배차가 지연되는 문제가 있었습니다."
    assert result["star_task"] == "주문 처리 시간을 3개월 안에 절반 이하로 줄이는 것이 목표였습니다."
    assert result["star_action"].startswith("PostgreSQL 대신 Redis 기반 매칭 엔진을 설계")
    assert result["star_result"].startswith("주문 처리 시간을 12초에서 3초로 단축")
    assert result["missing_fields"] == []
    assert result["review_tags"] == []


def test_activity_to_star_adds_placeholders_when_fields_are_missing() -> None:
    result = activity_to_star(
        {
            "type": "프로젝트",
            "title": "온보딩 개선",
            "description": "회원가입 플로우를 개선했습니다.",
        }
    )

    assert result["star_action"] == "회원가입 플로우를 개선했습니다."
    assert result["missing_fields"] == ["star_situation", "star_task", "star_result"]
    assert "[검토 필요]" in result["review_tags"]
    assert "[수치 보완 필요]" in result["review_tags"]


def test_activity_to_portfolio_maps_into_six_step_structure() -> None:
    result = activity_to_portfolio(_rich_activity())

    assert result["project_overview"]["title"] == "실시간 주문 처리 플랫폼"
    assert result["project_overview"]["duration"] == "약 4개월"
    assert result["problem_definition"]["label"] == "문제 정의"
    assert result["tech_decision"]["content"].startswith("PostgreSQL 대신 Redis")
    assert result["implementation_detail"]["highlights"] == [
        "Redis 기반 매칭 엔진을 구현했습니다.",
        "주문 API를 비동기 구조로 전환했습니다.",
    ]
    assert result["quantified_result"]["metrics"][0]["value"] == "12초"
    assert result["role_clarification"]["content"].startswith("5인 팀")
    assert result["missing_elements"] == []
    assert result["review_tags"] == []
