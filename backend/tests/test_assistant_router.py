from __future__ import annotations

import pytest

from backend.routers import assistant
from backend.routers.coach import CoachFeedbackApiResponse
from backend.routers.programs import (
    CalendarRecommendItem,
    CalendarRecommendResponse,
    ProgramListItem,
    ProgramRecommendItem,
    ProgramRecommendResponse,
)


@pytest.mark.asyncio
async def test_detect_intent_prefers_calendar_when_requested() -> None:
    intent = assistant._detect_intent(
        assistant.AssistantMessageRequest(
            message="\uce98\ub9b0\ub354\uc5d0 \ubcf4\uc77c \ucd94\ucc9c \uc77c\uc815 \ubcf4\uc5ec\uc918",
            include_calendar=True,
        )
    )

    assert intent == "recommend_calendar"


@pytest.mark.asyncio
async def test_detect_intent_respects_preferred_coach_intent() -> None:
    intent = assistant._detect_intent(
        assistant.AssistantMessageRequest(
            message="\ucd94\ucc9c\ub3c4 \ud574\uc8fc\uace0 \ucf54\uce6d\ub3c4 \ud574\uc918",
            preferred_intent="coach",
            history=[],
        )
    )

    assert intent == "coach"


@pytest.mark.asyncio
async def test_detect_intent_returns_clarify_for_mixed_request_without_hint() -> None:
    intent = assistant._detect_intent(
        assistant.AssistantMessageRequest(
            message="\ucd94\ucc9c\ub3c4 \ud574\uc8fc\uace0 \ucf54\uce6d\ub3c4 \ud574\uc918",
        )
    )

    assert intent == "clarify"


def test_assistant_routes_to_recommendation(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_recommend(payload, authorization=None):  # noqa: ANN001
        assert payload.top_k == 2
        assert authorization is None
        return ProgramRecommendResponse(
            items=[
                ProgramRecommendItem(
                    program_id="program-1",
                    score=0.9,
                    relevance_score=0.8,
                    reason="Matches backend work.",
                    fit_keywords=["redis", "api"],
                    program=ProgramListItem(id="program-1", title="Backend Bootcamp"),
                )
            ]
        )

    monkeypatch.setattr(assistant, "recommend_programs", _fake_recommend)

    response = client.post(
        "/assistant/message",
        json={
            "message": "\ucd94\ucc9c \ud504\ub85c\uadf8\ub7a8 \uc54c\ub824\uc918",
            "top_k": 2,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "recommend"
    assert payload["tool_call"]["name"] == "recommend_programs"
    assert "Backend Bootcamp" in payload["reply"]


def test_assistant_routes_to_calendar_recommendation(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_calendar(*, authorization=None, top_k=9, category=None, region=None, force_refresh=False):
        assert authorization is None
        assert top_k == 3
        assert category == "IT"
        assert region == "\uc11c\uc6b8"
        assert force_refresh is False
        return CalendarRecommendResponse(
            items=[
                CalendarRecommendItem(
                    program_id="program-1",
                    relevance_score=0.7,
                    urgency_score=0.8,
                    final_score=0.74,
                    deadline="2026-05-01",
                    d_day_label="D-11",
                    reason="Deadline is near.",
                    program=ProgramListItem(id="program-1", title="Spring Hiring Sprint"),
                )
            ]
        )

    monkeypatch.setattr(assistant, "recommend_programs_calendar", _fake_calendar)

    response = client.post(
        "/assistant/message",
        json={
            "message": "\uce98\ub9b0\ub354 \ucd94\ucc9c \ubcf4\uc5ec\uc918",
            "top_k": 3,
            "category": "IT",
            "region": "\uc11c\uc6b8",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "recommend_calendar"
    assert payload["tool_call"]["name"] == "recommend_calendar"
    assert "Spring Hiring Sprint" in payload["reply"]


def test_assistant_routes_to_coach(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_coach(request):  # noqa: ANN001
        assert request.user_id == "user-1"
        assert request.activity_description == "Built a Redis cache layer for a high-traffic API."
        assert request.history[-1].content == "\uc774 \ud65c\ub3d9\uc744 \ucf54\uce6d\ud574\uc918"
        return CoachFeedbackApiResponse(
            session_id="session-1",
            feedback="Lead with the latency reduction and your decision criteria.",
            structure_diagnosis={
                "has_problem_definition": True,
                "has_tech_decision": True,
                "has_quantified_result": False,
                "has_role_clarification": True,
                "has_implementation_detail": True,
                "missing_elements": ["quantified_result"],
                "priority_focus": "quantified_result",
            },
            rewrite_suggestions=[
                {
                    "text": "Reduced API latency from 780ms to 290ms by introducing Redis caching.",
                    "focus": "quantification",
                    "section": "result",
                    "rationale": "Makes the outcome concrete.",
                    "reference_pattern": None,
                }
            ],
            missing_elements=["quantified_result"],
            iteration_count=1,
            updated_history=[
                {"role": "user", "content": "\uc774 \ud65c\ub3d9\uc744 \ucf54\uce6d\ud574\uc918"},
                {
                    "role": "assistant",
                    "content": "Lead with the latency reduction and your decision criteria.",
                },
            ],
        )

    monkeypatch.setattr(assistant, "get_coach_feedback", _fake_coach)

    response = client.post(
        "/assistant/message",
        json={
            "message": "\uc774 \ud65c\ub3d9\uc744 \ucf54\uce6d\ud574\uc918",
            "preferred_intent": "coach",
            "user_id": "user-1",
            "activity_description": "Built a Redis cache layer for a high-traffic API.",
            "job_title": "Backend Engineer",
            "section_type": "\ud504\ub85c\uc81d\ud2b8",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "coach"
    assert payload["tool_call"]["name"] == "coach_feedback"
    assert "latency reduction" in payload["reply"]


def test_assistant_returns_clarify_when_intent_is_unclear(client) -> None:
    response = client.post(
        "/assistant/message",
        json={"message": "\ubd10\uc918"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "clarify"
    assert payload["tool_call"]["name"] == "clarify"
