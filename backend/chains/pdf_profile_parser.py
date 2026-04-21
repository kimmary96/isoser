# Profile extraction helpers for source-text PDF fallback
from typing import Any

from chains.pdf_parse_utils import (
    _CAREER_SECTION_HEADERS,
    _DATE_RANGE_RE,
    _EMAIL_RE,
    _NON_CAREER_SECTION_HEADERS,
    _PHONE_RE,
    _dedupe_string_list,
    _normalize_section_header,
)

def _extract_profile_from_text(text: str) -> dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    email_match = _EMAIL_RE.search(text)
    phone_match = _PHONE_RE.search(text)

    return {
        "name": _extract_name_from_lines(lines),
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
        "education": _extract_education_from_lines(lines),
        "career": [],
        "education_history": _extract_education_history_from_lines(lines),
        "awards": _extract_section_items(lines, {"수상", "awards"}),
        "certifications": _extract_section_items(lines, {"자격증", "certifications", "certificate"}),
        "languages": _extract_section_items(lines, {"외국어", "languages", "language"}),
        "skills": _extract_skills_from_text(text),
        "self_intro": _extract_self_intro_from_lines(lines),
    }

def _extract_name_from_lines(lines: list[str]) -> str:
    for idx, line in enumerate(lines):
        if _normalize_section_header(line) in {"이름", "name"} and idx + 1 < len(lines):
            return lines[idx + 1].strip()
    for line in lines[:8]:
        normalized = _normalize_section_header(line)
        if normalized and normalized not in {"backend developer", "developer", "resume"}:
            if not _EMAIL_RE.search(line) and not _PHONE_RE.search(line):
                return line
    return ""

def _extract_self_intro_from_lines(lines: list[str]) -> str:
    intro_lines: list[str] = []
    for line in lines:
        normalized = _normalize_section_header(line)
        if normalized in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            if intro_lines:
                break
            continue
        if _EMAIL_RE.search(line) or _PHONE_RE.search(line):
            continue
        if len(line) >= 30 and not _DATE_RANGE_RE.search(line):
            intro_lines.append(line)
    return " ".join(intro_lines[:3]).strip()

def _extract_education_from_lines(lines: list[str]) -> str:
    for line in lines:
        if "대학교" in line or "대학" in line:
            return line
    return ""

def _extract_education_history_from_lines(lines: list[str]) -> list[str]:
    history: list[str] = []
    for idx, line in enumerate(lines):
        if "대학교" not in line and "대학" not in line:
            continue
        parts = []
        if idx > 0 and _DATE_RANGE_RE.search(lines[idx - 1]):
            parts.append(lines[idx - 1])
        parts.append(line)
        if idx + 1 < len(lines) and ("학사" in lines[idx + 1] or "학점" in lines[idx + 1]):
            parts.append(lines[idx + 1])
        history.append(" ".join(parts))
    return _dedupe_string_list(history)

def _extract_section_items(lines: list[str], section_headers: set[str]) -> list[str]:
    items: list[str] = []
    in_section = False
    for line in lines:
        normalized = _normalize_section_header(line)
        if normalized in section_headers:
            in_section = True
            continue
        if in_section and normalized in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            break
        if in_section and not _DATE_RANGE_RE.search(line):
            items.append(line)
    return _dedupe_string_list(items)

def _extract_skills_from_text(text: str) -> list[str]:
    known_skills = (
        "Python",
        "JavaScript",
        "TypeScript",
        "SQL",
        "FastAPI",
        "Django",
        "Node.js",
        "PostgreSQL",
        "Redis",
        "MySQL",
        "Docker",
        "AWS",
        "EC2",
        "S3",
        "GitHub Actions",
        "LangChain",
        "ChromaDB",
        "Gemini API",
        "WebSocket",
    )
    lowered = text.lower()
    return [skill for skill in known_skills if skill.lower() in lowered]
