from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
import fitz

from chains.job_image_chain import extract_job_posting_from_image
from chains.job_posting_rewrite_chain import run_job_posting_rewrite_chain
from chains.match_chain import run_match_chain
from schemas.match_rewrite import MatchRewriteRequest, MatchRewriteResponse


router = APIRouter()


class MatchAnalyzeRequest(BaseModel):
    job_posting: str
    activities: list[dict]
    profile_context: dict | None = None


@router.post("/analyze")
async def analyze_match(payload: MatchAnalyzeRequest):
    try:
        result = await run_match_chain(
            job_posting=payload.job_posting,
            activities=payload.activities,
            profile_context=payload.profile_context,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"공고 매칭 분석 실패: {str(e)}")


@router.post("/rewrite", response_model=MatchRewriteResponse)
async def rewrite_match(
    payload: MatchRewriteRequest,
    user_id: str = Query(..., min_length=1),
):
    try:
        return await run_job_posting_rewrite_chain(
            user_id=user_id,
            job_posting_text=payload.job_posting_text,
            job_title=payload.job_title,
            activity_ids=payload.activity_ids,
            section_type=payload.section_type,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"공고 기반 리라이팅 실패: {str(e)}")


@router.post("/extract-job-image")
async def extract_job_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    try:
        image_bytes = await file.read()
        result = await extract_job_posting_from_image(
            image_bytes=image_bytes,
            mime_type=file.content_type,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이미지 공고 추출 실패: {str(e)}")


@router.post("/extract-job-pdf")
async def extract_job_pdf(file: UploadFile = File(...)):
    if not file.content_type or "pdf" not in file.content_type.lower():
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드할 수 있습니다.")

    try:
        pdf_bytes = await file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        chunks: list[str] = []
        for page in doc:
            chunks.append(page.get_text("text"))
        doc.close()

        text = "\n".join(chunks).strip()
        if not text:
            raise HTTPException(status_code=400, detail="PDF에서 텍스트를 추출하지 못했습니다.")

        return {"job_posting_text": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 공고 추출 실패: {str(e)}")
