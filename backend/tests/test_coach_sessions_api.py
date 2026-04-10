from __future__ import annotations

from typing import Any

import pytest

from repositories.coach_session_repo import CoachSessionRecord
from routers import coach as coach_router


class FakeCoachSessionRepo:
    def __init__(self) -> None:
        self.sessions: dict[str, CoachSessionRecord] = {}
        self.last_updated_payload: dict[str, Any] | None = None

    async def create_session(
        self,
        *,
        user_id: str,
        job_title: str,
        section_type: str,
        activity_description: str,
        session_id: str | None = None,
        selected_suggestion_index: int | None = None,
        suggestion_type: str | None = None,
    ) -> CoachSessionRecord:
        session = CoachSessionRecord(
            id=session_id or "generated-session",
            user_id=user_id,
            job_title=job_title,
            section_type=section_type,
            activity_description=activity_description,
            iteration_count=1,
            last_feedback=None,
            last_suggestions=[],
            selected_suggestion_index=selected_suggestion_index,
            suggestion_type=suggestion_type,
            last_structure_diagnosis={},
            missing_elements=[],
            created_at="2026-04-03T00:00:00+00:00",
            updated_at="2026-04-03T00:00:00+00:00",
        )
        self.sessions[session.id] = session
        return session

    async def get_session(self, session_id: str, user_id: str) -> CoachSessionRecord | None:
        session = self.sessions.get(session_id)
        if session is None or session.user_id != user_id:
            return None
        return session

    async def get_user_sessions(
        self,
        user_id: str,
        *,
        limit: int = 20,
    ) -> list[CoachSessionRecord]:
        return [
            session
            for session in self.sessions.values()
            if session.user_id == user_id
        ][:limit]

    async def update_session(
        self,
        session_id: str,
        user_id: str,
        *,
        job_title: str,
        section_type: str,
        activity_description: str,
        iteration_count: int,
        last_feedback: str,
        last_suggestions: list[dict[str, Any]],
        selected_suggestion_index: int | None,
        suggestion_type: str | None,
        last_structure_diagnosis: dict[str, Any],
        missing_elements: list[str],
    ) -> CoachSessionRecord:
        self.last_updated_payload = {
            "session_id": session_id,
            "user_id": user_id,
            "job_title": job_title,
            "section_type": section_type,
            "activity_description": activity_description,
            "iteration_count": iteration_count,
            "last_feedback": last_feedback,
            "last_suggestions": last_suggestions,
            "selected_suggestion_index": selected_suggestion_index,
            "suggestion_type": suggestion_type,
            "last_structure_diagnosis": last_structure_diagnosis,
            "missing_elements": missing_elements,
        }
        session = CoachSessionRecord(
            id=session_id,
            user_id=user_id,
            job_title=job_title,
            section_type=section_type,
            activity_description=activity_description,
            iteration_count=iteration_count,
            last_feedback=last_feedback,
            last_suggestions=last_suggestions,
            selected_suggestion_index=selected_suggestion_index,
            suggestion_type=suggestion_type,
            last_structure_diagnosis=last_structure_diagnosis,
            missing_elements=missing_elements,
            created_at="2026-04-03T00:00:00+00:00",
            updated_at="2026-04-03T00:05:00+00:00",
        )
        self.sessions[session_id] = session
        return session

    async def restore_conversation(self, session_id: str, user_id: str) -> list[dict[str, str]]:
        session = await self.get_session(session_id, user_id)
        return session.restore_conversation() if session else []


@pytest.fixture
def fake_repo(monkeypatch: pytest.MonkeyPatch) -> FakeCoachSessionRepo:
    repo = FakeCoachSessionRepo()
    monkeypatch.setattr(coach_router, "get_coach_session_repo", lambda: repo)
    return repo


def _graph_result(activity_text: str) -> dict[str, Any]:
    return {
        "feedback": f"feedback for {activity_text}",
        "structure_diagnosis": {
            "has_problem_definition": True,
            "has_tech_decision": True,
            "has_quantified_result": False,
            "has_role_clarification": True,
            "has_implementation_detail": True,
            "missing_elements": ["정량적 성과"],
            "priority_focus": "정량적 성과",
        },
        "rewrite_suggestions": [
            {
                "text": "Add quantified impact to the sentence.",
                "focus": "quantification",
                "section": "성과",
                "rationale": "Numbers make the result concrete.",
                "reference_pattern": "Technical Achievement  Quantified Impact  Business Value",
            }
        ],
        "missing_elements": ["정량적 성과"],
        "iteration_count": 2,
        "updated_history": [
            {"role": "user", "content": activity_text},
            {"role": "assistant", "content": f"feedback for {activity_text}"},
        ],
    }


def _intro_graph_result(activity_text: str) -> dict[str, Any]:
    return {
        "intro_candidates": [
            activity_text,
            f"이 활동은 {activity_text}",
        ]
    }


def test_feedback_creates_session_and_persists_structure(client, fake_repo, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_run_coach_graph(**kwargs):  # noqa: ANN003
        return _graph_result(kwargs["activity_text"])

    monkeypatch.setattr(coach_router, "run_coach_graph", fake_run_coach_graph)

    response = client.post(
        "/coach/feedback",
        json={
            "session_id": "session-1",
            "user_id": "user-1",
            "activity_description": "Redis cache rollout improved API latency.",
            "job_title": "Backend Engineer",
            "section_type": "프로젝트",
            "selected_suggestion_index": 0,
            "history": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == "session-1"
    assert payload["structure_diagnosis"]["priority_focus"] == "정량적 성과"
    assert fake_repo.last_updated_payload is not None
    assert fake_repo.last_updated_payload["last_structure_diagnosis"]["priority_focus"] == "정량적 성과"
    assert fake_repo.last_updated_payload["suggestion_type"] == "quantification"


def test_get_user_sessions_returns_summaries(client, fake_repo) -> None:
    fake_repo.sessions["session-1"] = CoachSessionRecord(
        id="session-1",
        user_id="user-1",
        job_title="Backend Engineer",
        section_type="프로젝트",
        activity_description="Redis cache rollout improved API latency.",
        iteration_count=2,
        last_feedback="feedback",
        last_suggestions=[],
        selected_suggestion_index=None,
        suggestion_type="quantification",
        last_structure_diagnosis={"priority_focus": "정량적 성과"},
        missing_elements=["정량적 성과"],
        created_at="2026-04-03T00:00:00+00:00",
        updated_at="2026-04-03T00:05:00+00:00",
    )

    response = client.get("/coach/sessions", params={"user_id": "user-1"})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == "session-1"
    assert payload[0]["suggestion_type"] == "quantification"


def test_get_session_detail_restores_last_exchange(client, fake_repo) -> None:
    fake_repo.sessions["session-1"] = CoachSessionRecord(
        id="session-1",
        user_id="user-1",
        job_title="Backend Engineer",
        section_type="프로젝트",
        activity_description="Redis cache rollout improved API latency.",
        iteration_count=2,
        last_feedback="feedback",
        last_suggestions=[],
        selected_suggestion_index=None,
        suggestion_type="quantification",
        last_structure_diagnosis={"priority_focus": "정량적 성과"},
        missing_elements=["정량적 성과"],
        created_at="2026-04-03T00:00:00+00:00",
        updated_at="2026-04-03T00:05:00+00:00",
    )

    response = client.get("/coach/sessions/session-1", params={"user_id": "user-1"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "session-1"
    assert payload["restored_history"] == [
        {"role": "user", "content": "Redis cache rollout improved API latency."},
        {"role": "assistant", "content": "feedback"},
    ]


def test_intro_generate_skips_session_persistence(client, fake_repo, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_run_coach_graph(**kwargs):  # noqa: ANN003
        assert kwargs["mode"] == "intro_generate"
        return _intro_graph_result(kwargs["activity_text"])

    monkeypatch.setattr(coach_router, "run_coach_graph", fake_run_coach_graph)

    response = client.post(
        "/coach/feedback",
        json={
            "mode": "intro_generate",
            "session_id": "session-1",
            "user_id": "user-1",
            "activity_description": "사용자 인터뷰를 진행하고 온보딩 플로우를 개선했습니다.",
            "section_type": "프로젝트",
            "history": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["intro_candidates"]
    assert fake_repo.last_updated_payload is None
    assert "session-1" not in fake_repo.sessions
