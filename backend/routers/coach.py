# AI 코치 엔드포인트 - STAR 기법 기반 멀티턴 피드백 생성
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from chains.coach_graph import run_coach_graph

router = APIRouter()


class CoachFeedbackRequest(BaseModel):
    """AI 코치 피드백 요청 모델."""
    session_id: str
    activity_description: str
    job_title: str
    history: list[dict]


@router.post("/feedback")
async def get_feedback(request: CoachFeedbackRequest) -> dict:
    """
    활동 설명에 대해 STAR 기준 멀티턴 AI 코치 피드백을 생성한다.

    Args:
        request: 세션 ID, 활동 설명, 직무명, 이전 대화 이력

    Returns:
        feedback: 피드백 텍스트
        missing_elements: 부족한 STAR 요소 목록
        iteration_count: 현재 대화 턴 수
        updated_history: 업데이트된 대화 이력
    """
    try:
        result = await run_coach_graph(
            session_id=request.session_id,
            activity_text=request.activity_description,
            job_title=request.job_title,
            history=request.history,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 코치 오류: {str(e)}")
