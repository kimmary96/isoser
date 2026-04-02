# LangChain PDF 파싱 체인 - PyMuPDF 텍스트 추출 후 Gemini로 구조화
import os
import json
import fitz  # PyMuPDF
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

# 파싱 결과 스키마 예시 (Gemini에게 출력 형식 안내)
_PARSE_PROMPT = """
다음은 이력서 텍스트입니다. 아래 JSON 형식으로 구조화해서 반환하세요.
코드 블록 없이 순수 JSON만 반환하세요.

{{
  "profile": {{
    "name": "이름",
    "email": "이메일",
    "phone": "전화번호",
    "education": "최종 학력"
  }},
  "activities": [
    {{
      "type": "회사경력 | 프로젝트 | 대외활동 | 학생활동",
      "title": "활동명",
      "period": "기간 (예: 2024.01 ~ 2024.06)",
      "role": "역할",
      "skills": ["기술1", "기술2"],
      "description": "상세 설명"
    }}
  ]
}}

이력서 텍스트:
{text}
"""


async def parse_resume_pdf(pdf_bytes: bytes) -> dict:
    """
    PDF 바이너리에서 텍스트를 추출하고 Gemini로 프로필·활동 목록을 구조화한다.

    Args:
        pdf_bytes: PDF 파일 바이너리

    Returns:
        profile과 activities가 포함된 딕셔너리
    """
    # PyMuPDF로 텍스트 추출
    text = _extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        return {"profile": {}, "activities": []}

    # Gemini로 구조화
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ["GOOGLE_API_KEY"],
    )
    prompt = _PARSE_PROMPT.format(text=text[:8000])  # 토큰 제한 고려
    response = await llm.ainvoke([HumanMessage(content=prompt)])

    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        # JSON 파싱 실패 시 빈 결과 반환
        result = {"profile": {}, "activities": []}

    return result


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    PyMuPDF를 사용해 PDF 바이너리에서 텍스트를 추출한다.

    Args:
        pdf_bytes: PDF 파일 바이너리

    Returns:
        추출된 텍스트 문자열
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_text = [page.get_text() for page in doc]
        return "\n".join(pages_text)
    except Exception:
        return ""
