import asyncio
import base64
import json
import os
from typing import Any

import google.generativeai as genai

_IMAGE_MODEL_CANDIDATES = [
    os.getenv("GEMINI_IMAGE_MODEL", "").strip(),
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]


_IMAGE_JOB_PROMPT = """
당신은 채용 공고 텍스트 추출 전문가입니다.

사용자가 업로드한 채용 공고 이미지를 보고 아래 작업을 수행하세요.

1. 이미지 속 텍스트를 최대한 정확하게 읽으세요.
2. 채용 공고 문맥에 맞게 줄바꿈과 섹션을 정리하세요.
3. 보이는 정보만 사용하고, 없는 내용은 추측하지 마세요.
4. 반드시 코드 블록 없이 순수 JSON만 반환하세요.

반환 형식:
{
  "job_posting_text": "정리된 공고 전체 텍스트",
  "sections": {
    "company": "회사명",
    "role": "직무명",
    "requirements": "자격요건",
    "preferred": "우대사항",
    "skills": "기술스택",
    "etc": "기타"
  }
}
"""


def _parse_json_object(raw_text: str) -> dict[str, Any]:
    text = (raw_text or "").strip()

    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else {}
    except json.JSONDecodeError:
        cleaned = text.replace("```json", "").replace("```", "").strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return {}
        try:
            obj = json.loads(cleaned[start:end + 1])
            return obj if isinstance(obj, dict) else {}
        except json.JSONDecodeError:
            return {}


def _generate_image_content_sync(image_bytes: bytes, mime_type: str) -> str:
    """
    Gemini 이미지 입력은 동기 호출이므로, 이벤트 루프 블로킹을 피하려고
    asyncio.to_thread로 감싸 호출할 수 있도록 분리한 함수.
    """
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY 또는 GEMINI_API_KEY가 설정되지 않았습니다.")

    genai.configure(api_key=api_key)

    print("=== Gemini 이미지 모델 호출 시작 ===")
    print("mime_type:", mime_type)
    print("image bytes:", len(image_bytes))

    last_error: Exception | None = None
    candidates = [name for name in _IMAGE_MODEL_CANDIDATES if name]

    response = None
    for model_name in candidates:
        try:
            print(f"=== Gemini 이미지 모델 시도: {model_name} ===")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                contents=[
                    {
                        "role": "user",
                        "parts": [
                            {"text": _IMAGE_JOB_PROMPT},
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": base64.b64encode(image_bytes).decode("utf-8"),
                                }
                            },
                        ],
                    }
                ]
            )
            break
        except Exception as e:
            last_error = e
            print(f"=== Gemini 이미지 모델 실패: {model_name} / {repr(e)} ===")

    if response is None:
        raise RuntimeError(
            f"이미지 추출 가능한 Gemini 모델을 찾지 못했습니다. 후보: {candidates}, 마지막 오류: {repr(last_error)}"
        ) from last_error

    print("=== Gemini 응답 수신 완료 ===")

    text = getattr(response, "text", "") or ""
    print("Gemini raw text preview:", text[:300])

    return text


async def extract_job_posting_from_image(image_bytes: bytes, mime_type: str) -> dict[str, Any]:
    """
    이미지 파일을 Gemini 멀티모달로 분석해 공고 텍스트를 추출한다.
    """
    # 동기 Gemini 호출을 별도 스레드로 실행해서 FastAPI 이벤트 루프가 멈춘 것처럼 보이는 현상 완화
    raw_text = await asyncio.to_thread(_generate_image_content_sync, image_bytes, mime_type)

    parsed = _parse_json_object(raw_text)

    if not parsed:
        raise ValueError("이미지 공고 파싱에 실패했습니다. Gemini 응답이 JSON 형식이 아닙니다.")

    job_posting_text = str(parsed.get("job_posting_text", "")).strip()
    sections = parsed.get("sections", {}) or {}

    if not job_posting_text:
        raise ValueError("이미지에서 추출된 공고 텍스트가 비어 있습니다.")

    return {
        "job_posting_text": job_posting_text,
        "sections": sections,
    }
