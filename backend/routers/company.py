from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from chains.company_research import get_company_insight


router = APIRouter()


class CompanyInsightRequest(BaseModel):
    company_name: str


@router.post("/insight")
async def company_insight(payload: CompanyInsightRequest):
    company_name = payload.company_name.strip()
    if not company_name:
        raise HTTPException(status_code=400, detail="company_name은 필수입니다.")

    try:
        return await get_company_insight(company_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"기업 정보 조회 실패: {str(e)}")
