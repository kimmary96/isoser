from __future__ import annotations

import pytest

from routers import assistant, coach, programs
from routers.coach import CoachFeedbackApiResponse
from routers.programs import ProgramListItem


def test_program_recommend_smoke(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_fetch_program_rows(**kwargs):  # noqa: ANN003
        return [
            {
                "id": "program-1",
                "title": "Backend Bootcamp",
                "category": "IT",
                "location": "Seoul",
                "deadline": "2099-01-01",
                "is_active": True,
            }
        ]

    monkeypatch.setattr(programs, "_fetch_program_rows", _fake_fetch_program_rows)

    response = client.post("/programs/recommend", json={"top_k": 3})

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    assert payload["items"][0]["program"]["title"] == "Backend Bootcamp"


def test_coach_feedback_smoke(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_run_coach_graph(**kwargs):  # noqa: ANN003
        return {
            "feedback": "Add the problem statement before the result.",
            "structure_diagnosis": {
                "has_problem_definition": False,
                "has_tech_decision": True,
                "has_quantified_result": True,
                "has_role_clarification": True,
                "has_implementation_detail": True,
                "missing_elements": ["problem_definition"],
                "priority_focus": "problem_definition",
            },
            "rewrite_suggestions": [
                {
                    "text": "Start with the production problem, then quantify the latency gain.",
                    "focus": "problem_definition",
                    "section": "opening",
                    "rationale": "Adds clearer narrative structure.",
                    "reference_pattern": None,
                }
            ],
            "missing_elements": ["problem_definition"],
            "iteration_count": 1,
            "updated_history": [{"role": "user", "content": "코칭해줘"}],
        }

    monkeypatch.setattr(coach, "run_coach_graph", _fake_run_coach_graph)

    response = client.post(
        "/coach/feedback",
        json={
            "activity_description": "Built a Redis cache rollout that reduced API latency in production.",
            "job_title": "Backend Engineer",
            "section_type": "프로젝트",
            "history": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["feedback"] == "Add the problem statement before the result."


def test_assistant_message_smoke(client, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_recommend(payload, authorization=None):  # noqa: ANN001
        return programs.ProgramRecommendResponse(
            items=[
                programs.ProgramRecommendItem(
                    program_id="program-1",
                    score=0.8,
                    relevance_score=0.7,
                    reason="Matches backend goals.",
                    fit_keywords=["api"],
                    program=ProgramListItem(id="program-1", title="Backend Bootcamp"),
                )
            ]
        )

    monkeypatch.setattr(assistant, "recommend_programs", _fake_recommend)

    response = client.post(
        "/assistant/message",
        json={"message": "추천 프로그램 알려줘"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == "recommend"
    assert payload["recommendation_result"]["items"][0]["program"]["title"] == "Backend Bootcamp"
