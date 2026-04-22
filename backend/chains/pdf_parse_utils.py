# Shared constants and normalizers for PDF parsing
# Rule-based PDF parsing helpers - normalize LLM output and source-text fallback
import json
import re
from typing import Any

from chains.pdf_parser_rules import (
    ACTIVITY_TYPE_ALIASES,
    ALLOWED_ACTIVITY_TYPES,
    CAREER_SECTION_HEADERS,
    CAREER_STOP_HEADERS,
    NON_CAREER_SECTION_HEADERS,
)

_ALLOWED_ACTIVITY_TYPES = ALLOWED_ACTIVITY_TYPES
_TYPE_ALIASES = ACTIVITY_TYPE_ALIASES
_CAREER_SECTION_HEADERS = CAREER_SECTION_HEADERS
_NON_CAREER_SECTION_HEADERS = NON_CAREER_SECTION_HEADERS
_CAREER_STOP_HEADERS = CAREER_STOP_HEADERS
_DATE_TOKEN_RE = re.compile(r"\d{4}[./-]\d{1,2}")
_DATE_RANGE_RE = re.compile(
    r"(?P<start>\d{4}[./-]\d{1,2})\s*(?:~|–|—|-)\s*(?P<end>\d{4}[./-]\d{1,2}|현재|진행중|present|Present|PRESENT)"
)
_CAREER_LINE_RE = re.compile(
    r"^(?P<company>.+?)\s*[\(\[]?\s*(?P<start>\d{4}[./-]\d{1,2})\s*(?:~|–|—|-)\s*(?P<end>\d{4}[./-]\d{1,2}|현재|진행중|present|Present|PRESENT)\s*[\)\]]?$"
)
_ACTIVITY_HEADER_RE = re.compile(
    r"^(?P<title>.+?)\s*[\(\[]?\s*(?P<start>\d{4}[./-]\d{1,2})\s*(?:~|–|—|-)\s*(?P<end>\d{4}[./-]\d{1,2}|현재|진행중|present|Present|PRESENT)\s*[\)\]]?$"
)
_ROLE_TEAM_RE = re.compile(r"^(?P<role>.+?)\s*\((?P<size>\d+)\s*인\s*(?:팀)?\s*:\s*(?P<composition>.+)\)$")
_COMPACT_TEAM_PART_RE = re.compile(r"(?P<role>[가-힣A-Za-z]+)\s*(?P<count>\d+)")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE_RE = re.compile(r"01[016789][-\s]?\d{3,4}[-\s]?\d{4}")

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

def _normalize_text_field(value: Any) -> str:
    text = str(value or "").strip()
    if text.lower() in {"none", "null", "n/a", "na", "-"}:
        return ""
    return text

def _normalize_optional_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if not text:
        return None
    match = re.search(r"\d+", text)
    if not match:
        return None
    return int(match.group(0))

def _normalize_period(period: str) -> str:
    match = _DATE_RANGE_RE.search(period)
    if not match:
        return period.strip()
    return _format_period(match.group("start"), match.group("end"))

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

def _normalize_section_header(line: str) -> str:
    return re.sub(r"[^a-zA-Z가-힣 ]", "", line).strip().lower()

def _extract_split_period(lines: list[str], idx: int) -> tuple[str, str] | None:
    if idx + 1 >= len(lines):
        return None
    if _DATE_TOKEN_RE.search(lines[idx]):
        return None
    match = _DATE_RANGE_RE.search(lines[idx + 1])
    if not match:
        return None
    return match.group("start"), match.group("end")

def _format_period(start: str, end: str) -> str:
    start_text = start.strip()
    end_text = end.strip()
    if not start_text and not end_text:
        return ""
    if not end_text:
        return start_text
    return f"{start_text} ~ {end_text}"

def _dedupe_string_list(items: list[str]) -> list[str]:
    seen = set()
    result = []
    for item in items:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result

def _clean_header_title(value: str) -> str:
    return value.strip(" \t•-|:")

def normalize(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()
