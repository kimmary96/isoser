# 공고 매칭 엔드포인트 - 채용 공고와 유저 활동 목록 비교 분석
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from chains.match_chain import run_match_chain

router = APIRouter()


class ActivitySummary(BaseModel):
    """매칭 분석에 사용할 활동 요약 모델."""
    id: str | None = None
    title: str
    description: str | None = None


class MatchAnalyzeRequest(BaseModel):
    """공고 매칭 분석 요청 모델."""
    job_posting: str
    activities: list[ActivitySummary]


@router.post("/analyze")
async def analyze_match(request: MatchAnalyzeRequest) -> dict:
    """
    공고 텍스트와 유저 활동 목록을 비교해 매칭 점수와 분석 결과를 반환한다.

    Args:
        request: 공고 텍스트, 활동 목록

    Returns:
        match_score: 매칭 점수 (0-100)
        matched_keywords: 매칭된 키워드 목록
        missing_keywords: 부족한 키워드 목록
        recommended_activities: 추천 활동 ID 목록
        summary: 매칭 분석 요약 텍스트
    """
    if not request.job_posting.strip():
        raise HTTPException(status_code=400, detail="공고 텍스트를 입력해주세요.")

    try:
        result = await run_match_chain(
            job_posting=request.job_posting,
            activities=[a.model_dump() for a in request.activities],
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"매칭 분석 오류: {str(e)}")
