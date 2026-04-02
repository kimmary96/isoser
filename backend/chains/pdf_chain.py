# LangChain PDF 파싱 체인 - PyMuPDF 텍스트 추출 후 Gemini로 구조화
import json
import os
from typing import Any

import fitz  # PyMuPDF
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

# 파싱 결과 스키마 예시 (Gemini에게 출력 형식 안내)
_PARSE_PROMPT = """
다음은 이력서 텍스트입니다. 아래 JSON 형식으로 구조화해서 반환하세요.
코드 블록 없이 순수 JSON만 반환하세요.
activities[].type은 반드시 아래 4개 중 하나만 사용하세요: 회사경력, 프로젝트, 대외활동, 학생활동

{{
  "profile": {{
    "name": "이름",
    "email": "이메일",
    "phone": "전화번호",
    "education": "최종 학력",
    "career": ["경력 요약1", "경력 요약2"],
    "education_history": ["학력1", "학력2"],
    "awards": ["수상경력1"],
    "certifications": ["자격증1"],
    "languages": ["외국어1"],
    "skills": ["스킬1", "스킬2"],
    "self_intro": "자기소개 초안"
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

_ALLOWED_ACTIVITY_TYPES = {"회사경력", "프로젝트", "대외활동", "학생활동"}
_TYPE_ALIASES = {
    "인턴": "회사경력",
    "경력": "회사경력",
    "업무경험": "회사경력",
    "직무경험": "회사경력",
    "work": "회사경력",
    "experience": "회사경력",
    "프로젝트 경험": "프로젝트",
    "project": "프로젝트",
    "활동": "대외활동",
    "동아리": "대외활동",
    "봉사": "대외활동",
    "contest": "대외활동",
    "competition": "대외활동",
    "school": "학생활동",
    "학내활동": "학생활동",
    "학술활동": "학생활동",
}


async def parse_resume_pdf(pdf_bytes: bytes) -> dict:
    """
    PDF 바이너리에서 텍스트를 추출하고 Gemini로 프로필·활동 목록을 구조화한다.

    Args:
        pdf_bytes: PDF 파일 바이너리

    Returns:
        profile과 activities가 포함된 딕셔너리
    """
    text = _extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        return {"profile": {}, "activities": []}

    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=os.environ["GOOGLE_API_KEY"],
        )
        prompt = _PARSE_PROMPT.format(text=text[:8000])
        response = await llm.ainvoke([HumanMessage(content=prompt)])
    except Exception as e:
        raise RuntimeError(f"AI 파싱 호출 실패: {str(e)}") from e

    return _parse_and_normalize_result(response.content)


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


def _parse_and_normalize_result(raw_content: Any) -> dict:
    """
    LLM 응답에서 JSON을 추출하고, profile/activities 스키마로 정규화한다.

    Args:
        raw_content: LLM 응답 원본 콘텐츠

    Returns:
        profile/activities가 보장된 결과 딕셔너리
    """
    text = _extract_text_from_llm_content(raw_content).strip()
    parsed: dict[str, Any]

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        json_text = _extract_json_object(text)
        if not json_text:
            return {"profile": {}, "activities": []}
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError:
            return {"profile": {}, "activities": []}

    profile = parsed.get("profile", {}) if isinstance(parsed, dict) else {}
    activities = parsed.get("activities", []) if isinstance(parsed, dict) else []

    normalized_profile = {
        "name": str(profile.get("name", "")).strip(),
        "email": str(profile.get("email", "")).strip(),
        "phone": str(profile.get("phone", "")).strip(),
        "education": str(profile.get("education", "")).strip(),
        "career": _normalize_string_list(profile.get("career")),
        "education_history": _normalize_string_list(profile.get("education_history")),
        "awards": _normalize_string_list(profile.get("awards")),
        "certifications": _normalize_string_list(profile.get("certifications")),
        "languages": _normalize_string_list(profile.get("languages")),
        "skills": _normalize_string_list(profile.get("skills")),
        "self_intro": str(profile.get("self_intro", "")).strip(),
    }

    normalized_activities = []
    if isinstance(activities, list):
        for item in activities:
            if not isinstance(item, dict):
                continue
            normalized_activities.append(
                {
                    "type": _normalize_activity_type(item.get("type")),
                    "title": str(item.get("title", "")).strip(),
                    "period": str(item.get("period", "")).strip(),
                    "role": str(item.get("role", "")).strip(),
                    "skills": _normalize_skills(item.get("skills")),
                    "description": str(item.get("description", "")).strip(),
                }
            )

    return {
        "profile": normalized_profile,
        "activities": normalized_activities,
    }


def _extract_text_from_llm_content(raw_content: Any) -> str:
    """
    LLM 콘텐츠를 문자열로 변환한다.

    Args:
        raw_content: 문자열 또는 블록 리스트 등

    Returns:
        문자열 형태의 콘텐츠
    """
    if isinstance(raw_content, str):
        return raw_content
    if isinstance(raw_content, list):
        parts: list[str] = []
        for block in raw_content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    return str(raw_content)


def _extract_json_object(text: str) -> str:
    """
    문자열에서 JSON 객체 본문을 추출한다.

    Args:
        text: 원본 텍스트

    Returns:
        JSON 객체 문자열 또는 빈 문자열
    """
    cleaned = text.replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return ""
    return cleaned[start : end + 1]


def _normalize_activity_type(raw_type: Any) -> str:
    """
    활동 타입을 DB 제약에 맞는 4개 타입 중 하나로 정규화한다.

    Args:
        raw_type: 원본 타입 값

    Returns:
        정규화된 활동 타입
    """
    text = str(raw_type or "").strip()
    if text in _ALLOWED_ACTIVITY_TYPES:
        return text

    lowered = text.lower()
    if lowered in _TYPE_ALIASES:
        return _TYPE_ALIASES[lowered]
    if text in _TYPE_ALIASES:
        return _TYPE_ALIASES[text]

    return "프로젝트"


def _normalize_skills(raw_skills: Any) -> list[str]:
    """
    skills 필드를 문자열 리스트로 정규화한다.

    Args:
        raw_skills: 원본 skills 값

    Returns:
        스킬 문자열 리스트
    """
    if isinstance(raw_skills, list):
        return [str(skill).strip() for skill in raw_skills if str(skill).strip()]
    if isinstance(raw_skills, str):
        candidates = [part.strip() for part in raw_skills.split(",")]
        return [item for item in candidates if item]
    return []


def _normalize_string_list(value: Any) -> list[str]:
    """
    임의 입력을 문자열 배열로 정규화한다.

    Args:
        value: 리스트 또는 문자열

    Returns:
        공백 제거된 문자열 리스트
    """
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []
