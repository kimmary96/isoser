# LangChain PDF 파싱 체인 - PyMuPDF 텍스트 추출 후 Gemini/로컬 fallback 구조화
from typing import Any

import fitz  # PyMuPDF

from chains.pdf_llm import invoke_parse_llm
from chains.pdf_parser import (
    _build_source_fallback_result,
    _extract_career_entries_from_text,
    _parse_and_normalize_result,
)


async def parse_resume_pdf(pdf_bytes: bytes) -> dict:
    """PDF 바이너리에서 텍스트를 추출하고 프로필·활동 목록을 구조화한다."""
    text = _extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        return {"profile": {}, "activities": []}

    try:
        response_content = await invoke_parse_llm(text)
    except Exception:
        return _build_source_fallback_result(text)

    return _parse_and_normalize_result(response_content, text)


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


