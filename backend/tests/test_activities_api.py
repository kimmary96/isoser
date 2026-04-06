from __future__ import annotations


def _activity_payload() -> dict[str, object]:
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


def test_convert_activity_returns_both_payloads(client) -> None:
    response = client.post(
        "/activities/convert",
        json={"target": "both", "activity": _activity_payload()},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["target"] == "both"
    assert payload["star"]["star_situation"] == "피크타임마다 주문 배차가 지연되는 문제가 있었습니다."
    assert payload["portfolio"]["project_overview"]["title"] == "실시간 주문 처리 플랫폼"
    assert payload["portfolio"]["quantified_result"]["metrics"][0]["value"] == "12초"


def test_convert_activity_can_limit_target(client) -> None:
    response = client.post(
        "/activities/convert",
        json={"target": "star", "activity": _activity_payload()},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["target"] == "star"
    assert payload["star"] is not None
    assert payload["portfolio"] is None


def test_convert_activity_returns_400_when_no_convertible_content(client) -> None:
    response = client.post(
        "/activities/convert",
        json={
            "target": "both",
            "activity": {
                "type": "프로젝트",
                "title": "빈 활동",
                "description": "",
                "contributions": [],
                "star_situation": "",
                "star_task": "",
                "star_action": "",
                "star_result": "",
            },
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "활동 설명, STAR 필드, contributions 중 하나 이상은 필요합니다."
