from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from chains.job_image_chain import extract_job_posting_from_image
from chains.match_chain import run_match_chain


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
        print("=== 공고 매칭 분석 실패 ===")
        print(repr(e))
        raise HTTPException(status_code=500, detail=f"공고 매칭 분석 실패: {str(e)}")


@router.post("/extract-job-image")
async def extract_job_image(file: UploadFile = File(...)):
    print("=== 이미지 추출 요청 들어옴 ===")
    print("filename:", file.filename)
    print("content_type:", file.content_type)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    try:
        image_bytes = await file.read()
        print("image bytes length:", len(image_bytes))

        result = await extract_job_posting_from_image(
            image_bytes=image_bytes,
            mime_type=file.content_type,
        )

        print("=== 이미지 추출 성공 ===")
        print(result)
        return result

    except Exception as e:
        print("=== 이미지 추출 실패 ===")
        print(repr(e))
        raise HTTPException(status_code=500, detail=f"이미지 공고 추출 실패: {str(e)}")
