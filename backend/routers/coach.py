"""Coach API router with request validation and structured responses."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from chains.coach_graph import run_coach_graph
from rag.schema import CoachResponse

router = APIRouter()

ALLOWED_SECTION_TYPES = {
    "회사경력",
    "프로젝트",
    "대외활동",
    "학생활동",
    "요약",
}


class CoachRequest(BaseModel):
    """Coach AI request payload."""

    model_config = ConfigDict(str_strip_whitespace=True)

    session_id: str | None = None
    activity_description: str
    job_title: str
    section_type: str
    selected_suggestion_index: int | None = None


def _validation_error(message: str) -> JSONResponse:
    """Build the requested 400 validation response payload."""

    return JSONResponse(
        status_code=400,
        content={"detail": message, "error_code": "VALIDATION_ERROR"},
    )


@router.post("/feedback", response_model=CoachResponse)
async def get_coach_feedback(request: CoachRequest):
    """Validate the request and return Coach AI feedback."""

    if len(request.activity_description) < 10:
        return _validation_error("활동 설명은 최소 10자 이상 입력해주세요.")

    if not request.job_title:
        return _validation_error("목표 직무를 입력해주세요.")

    if request.section_type not in ALLOWED_SECTION_TYPES:
        allowed = ", ".join(sorted(ALLOWED_SECTION_TYPES))
        return _validation_error(f"section_type은 다음 값만 허용됩니다: {allowed}")

    try:
        result = await run_coach_graph(
            session_id=request.session_id or "",
            activity_text=request.activity_description,
            job_title=request.job_title,
            section_type=request.section_type,
            selected_suggestion_index=request.selected_suggestion_index,
            history=[],
        )
        return CoachResponse.model_validate(result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI 코치 오류: {str(exc)}") from exc
