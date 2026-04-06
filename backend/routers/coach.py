"""Coach API router with validation and session persistence."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from chains.coach_graph import IntroGenerateResponse, run_coach_graph
from rag.schema import CoachResponse
from repositories.coach_session_repo import (
    CoachSessionRecord,
    CoachSessionRepoError,
    get_coach_session_repo,
)

router = APIRouter()

ALLOWED_SECTION_TYPES = {
    "회사경력",
    "프로젝트",
    "대외활동",
    "학생활동",
    "요약",
}


class CoachMessage(BaseModel):
    """A single coach conversation message."""

    model_config = ConfigDict(str_strip_whitespace=True)

    role: Literal["user", "assistant"]
    content: str


class CoachRequest(BaseModel):
    """Coach AI request payload."""

    model_config = ConfigDict(str_strip_whitespace=True)

    mode: Literal["feedback", "intro_generate"] = "feedback"
    session_id: str | None = None
    user_id: str | None = None
    activity_description: str
    activity_type: str | None = None
    org_name: str | None = None
    period: str | None = None
    team_size: int | None = None
    role: str | None = None
    skills: list[str] | None = None
    contribution: str | None = None
    job_title: str = ""
    section_type: str = ""
    selected_suggestion_index: int | None = None
    history: list[CoachMessage] = Field(default_factory=list)


class CoachFeedbackApiResponse(CoachResponse):
    """Response payload for POST /coach/feedback."""

    session_id: str
    updated_history: list[CoachMessage] = Field(default_factory=list)


class CoachIntroGenerateApiResponse(IntroGenerateResponse):
    """Response payload for POST /coach/feedback with mode=intro_generate."""


class CoachSessionSummaryResponse(BaseModel):
    """Session list item returned by GET /coach/sessions."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str
    user_id: str
    job_title: str
    section_type: str
    activity_description: str
    iteration_count: int
    last_feedback: str | None = None
    suggestion_type: str | None = None
    missing_elements: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class CoachSessionDetailResponse(CoachSessionSummaryResponse):
    """Full session details plus restored conversation."""

    last_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    selected_suggestion_index: int | None = None
    last_structure_diagnosis: dict[str, Any] = Field(default_factory=dict)
    restored_history: list[CoachMessage] = Field(default_factory=list)


def _validation_error(message: str) -> JSONResponse:
    """Build the requested 400 validation response payload."""

    return JSONResponse(
        status_code=400,
        content={"detail": message, "error_code": "VALIDATION_ERROR"},
    )


def _summary_payload(session: CoachSessionRecord) -> dict[str, Any]:
    return {
        "id": session.id,
        "user_id": session.user_id,
        "job_title": session.job_title,
        "section_type": session.section_type,
        "activity_description": session.activity_description,
        "iteration_count": session.iteration_count,
        "last_feedback": session.last_feedback,
        "suggestion_type": session.suggestion_type,
        "missing_elements": session.missing_elements,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


def _detail_payload(session: CoachSessionRecord) -> dict[str, Any]:
    return {
        **_summary_payload(session),
        "last_suggestions": session.last_suggestions,
        "selected_suggestion_index": session.selected_suggestion_index,
        "last_structure_diagnosis": session.last_structure_diagnosis,
        "restored_history": session.restore_conversation(),
    }


def _build_intro_generate_activity_text(request: CoachRequest) -> str:
    """Build intro-generation source text from structured fields when present."""

    structured_segments: list[str] = []

    if request.activity_type:
        structured_segments.append(f"활동 유형: {request.activity_type}")
    if request.org_name:
        structured_segments.append(f"조직: {request.org_name}")
    if request.period:
        structured_segments.append(f"기간: {request.period}")
    if request.team_size and request.team_size > 0:
        structured_segments.append(f"인원: {request.team_size}명")
    if request.role:
        structured_segments.append(f"역할: {request.role}")
    if request.skills:
        normalized_skills = [skill.strip() for skill in request.skills if str(skill).strip()]
        if normalized_skills:
            structured_segments.append(f"사용 기술: {', '.join(normalized_skills)}")
    if request.contribution:
        structured_segments.append(f"기여 내용: {request.contribution}")

    if structured_segments:
        if request.activity_description:
            structured_segments.append(f"소개 초안: {request.activity_description}")
        return "\n".join(structured_segments)

    return request.activity_description


def _resolve_suggestion_type(
    rewrite_suggestions: list[dict[str, Any]],
    selected_index: int | None,
) -> str | None:
    if not rewrite_suggestions:
        return None

    if selected_index is not None and 0 <= selected_index < len(rewrite_suggestions):
        focus = rewrite_suggestions[selected_index].get("focus")
        return str(focus) if focus is not None else None

    focus = rewrite_suggestions[0].get("focus")
    return str(focus) if focus is not None else None


@router.post(
    "/feedback",
    response_model=CoachFeedbackApiResponse | CoachIntroGenerateApiResponse,
)
async def get_coach_feedback(request: CoachRequest):
    """Create or load a coach session, run coaching, and persist the latest result."""

    activity_input_text = request.activity_description
    if request.mode == "intro_generate":
        activity_input_text = _build_intro_generate_activity_text(request)

    if len(activity_input_text) < 10:
        return _validation_error("활동 설명은 최소 10자 이상 입력해주세요.")

    if request.mode == "feedback" and not request.job_title:
        return _validation_error("목표 직무를 입력해주세요.")

    if request.mode == "feedback" and not request.section_type:
        return _validation_error("section_type을 입력해주세요.")

    if request.section_type and request.section_type not in ALLOWED_SECTION_TYPES:
        allowed = ", ".join(sorted(ALLOWED_SECTION_TYPES))
        return _validation_error(f"section_type은 다음 값만 허용됩니다: {allowed}")

    if (
        request.mode == "feedback"
        and request.selected_suggestion_index is not None
        and request.selected_suggestion_index < 0
    ):
        return _validation_error("selected_suggestion_index는 0 이상의 값만 허용됩니다.")

    should_persist_session = request.mode == "feedback"
    repo = get_coach_session_repo() if should_persist_session and request.user_id else None
    if should_persist_session and request.user_id and repo is None:
        raise HTTPException(status_code=503, detail="coach session persistence is not configured")

    saved_session: CoachSessionRecord | None = None
    restored_history = [message.model_dump() for message in request.history]
    session_id = request.session_id or ""

    try:
        if should_persist_session and repo is not None and request.user_id:
            if request.session_id:
                saved_session = await repo.get_session(request.session_id, request.user_id)

            if saved_session is None:
                saved_session = await repo.create_session(
                    session_id=request.session_id,
                    user_id=request.user_id,
                    job_title=request.job_title,
                    section_type=request.section_type,
                    activity_description=request.activity_description,
                    selected_suggestion_index=request.selected_suggestion_index,
                )
            else:
                restored_history = saved_session.restore_conversation() or restored_history

            session_id = saved_session.id

        result = await run_coach_graph(
            session_id=session_id,
            activity_text=activity_input_text,
            job_title=request.job_title or "일반",
            section_type=request.section_type,
            selected_suggestion_index=request.selected_suggestion_index,
            history=restored_history,
            mode=request.mode,
        )

        if should_persist_session and repo is not None and request.user_id:
            await repo.update_session(
                session_id=session_id,
                user_id=request.user_id,
                job_title=request.job_title,
                section_type=request.section_type,
                activity_description=request.activity_description,
                iteration_count=int(result["iteration_count"]),
                last_feedback=str(result["feedback"]),
                last_suggestions=list(result["rewrite_suggestions"]),
                selected_suggestion_index=request.selected_suggestion_index,
                suggestion_type=_resolve_suggestion_type(
                    result.get("rewrite_suggestions", []),
                    request.selected_suggestion_index,
                ),
                last_structure_diagnosis=dict(result["structure_diagnosis"]),
                missing_elements=list(result["missing_elements"]),
            )

        if request.mode == "intro_generate":
            return CoachIntroGenerateApiResponse.model_validate(result)

        payload = {**result, "session_id": session_id}
        return CoachFeedbackApiResponse.model_validate(payload)
    except CoachSessionRepoError as exc:
        raise HTTPException(status_code=500, detail=f"coach session persistence error: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI 코치 오류: {str(exc)}") from exc


@router.get("/sessions", response_model=list[CoachSessionSummaryResponse])
async def get_user_sessions(user_id: str = Query(..., min_length=1)):
    """Return recent coach sessions for a user."""

    repo = get_coach_session_repo()
    if repo is None:
        raise HTTPException(status_code=503, detail="coach session persistence is not configured")

    try:
        sessions = await repo.get_user_sessions(user_id)
        return [CoachSessionSummaryResponse.model_validate(_summary_payload(session)) for session in sessions]
    except CoachSessionRepoError as exc:
        raise HTTPException(status_code=500, detail=f"coach session persistence error: {exc}") from exc


@router.get("/sessions/{session_id}", response_model=CoachSessionDetailResponse)
async def get_session_detail(session_id: str, user_id: str = Query(..., min_length=1)):
    """Return a session row plus the restored conversation."""

    repo = get_coach_session_repo()
    if repo is None:
        raise HTTPException(status_code=503, detail="coach session persistence is not configured")

    try:
        session = await repo.get_session(session_id, user_id)
        if session is None:
            raise HTTPException(status_code=404, detail="coach session not found")
        return CoachSessionDetailResponse.model_validate(_detail_payload(session))
    except CoachSessionRepoError as exc:
        raise HTTPException(status_code=500, detail=f"coach session persistence error: {exc}") from exc
