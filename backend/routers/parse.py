# PDF 파싱 엔드포인트 - 업로드된 이력서 PDF에서 프로필과 활동 목록 추출
from fastapi import APIRouter, UploadFile, File, HTTPException
from chains.pdf_chain import parse_resume_pdf

router = APIRouter()


@router.post("/pdf")
async def parse_pdf(file: UploadFile = File(...)) -> dict:
    """
    PDF 파일을 받아 프로필과 활동 목록을 추출해 반환한다.

    Args:
        file: 업로드된 PDF 파일

    Returns:
        profile: 이름, 이메일, 전화번호, 학력
        activities: 활동 목록 (type, title, period, role, skills, description)
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")

    try:
        pdf_bytes = await file.read()
        result = await parse_resume_pdf(pdf_bytes)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 파싱 실패: {str(e)}")
