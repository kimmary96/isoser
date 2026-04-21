# Activity header detection helpers for PDF parsing
from typing import Any
import re

from chains.pdf_parse_utils import (
    _ACTIVITY_HEADER_RE,
    _CAREER_SECTION_HEADERS,
    _DATE_RANGE_RE,
    _NON_CAREER_SECTION_HEADERS,
    _clean_header_title,
    _extract_split_period,
    _format_period,
    _normalize_section_header,
    normalize,
)

def _extract_activity_header_at(lines: list[str], idx: int) -> dict[str, Any] | None:
    line = lines[idx].strip(" \t•-")
    match = _ACTIVITY_HEADER_RE.match(line)
    if match:
        title = _clean_header_title(match.group("title"))
        if _is_bad_activity_title(title):
            return None
        return {
            "title": title,
            "period": _format_period(match.group("start"), match.group("end")),
            "period_idx": idx,
        }

    if _looks_like_project_category_line(line):
        category_period_match = None
        category_period_idx = idx + 1
        for candidate_idx in range(idx + 1, min(len(lines), idx + 4)):
            category_period_match = _DATE_RANGE_RE.search(lines[candidate_idx])
            if category_period_match:
                category_period_idx = candidate_idx
                break
        if category_period_match:
            title = _find_previous_activity_title(lines, idx)
            if title:
                return {
                    "title": title,
                    "period": _format_period(
                        category_period_match.group("start"),
                        category_period_match.group("end"),
                    ),
                    "period_idx": category_period_idx,
                }

    split_period = _extract_split_period(lines, idx)
    if split_period:
        title = _clean_header_title(line)
        if _is_bad_activity_title(title):
            return None
        return {
            "title": title,
            "period": _format_period(split_period[0], split_period[1]),
            "period_idx": idx + 1,
        }

    return None

def _find_previous_activity_title(lines: list[str], idx: int) -> str:
    candidates: list[str] = []
    cursor = idx - 1
    while cursor >= 0 and len(candidates) < 3:
        candidate = _clean_header_title(lines[cursor])
        normalized = _normalize_section_header(candidate)
        if (
            not candidate
            or normalized in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS
            or _DATE_RANGE_RE.search(candidate)
            or _looks_like_link_or_tool_line(candidate)
            or _looks_like_team_context_line(candidate)
        ):
            break
        candidates.append(candidate)
        cursor -= 1

    if not candidates:
        return ""
    return candidates[0]

def _looks_like_project_category_line(line: str) -> bool:
    stripped = line.strip()
    normalized = normalize(stripped).strip("|")
    if stripped == "|":
        return True
    if not line.strip().startswith("|"):
        return False
    category_keywords = (
        "b2b",
        "b2g",
        "라이브서비스",
        "커미션",
        "신규게임",
        "하이퍼캐주얼",
        "힐링시뮬레이션",
        "게임개발",
    )
    return any(keyword in normalized for keyword in category_keywords) or normalized == ""

def _looks_like_link_or_tool_line(line: str) -> bool:
    normalized = normalize(line)
    link_keywords = {
        "youtube",
        "instagram",
        "instargram",
        "news",
        "googleplaystore",
        "appstore",
        "userflow",
        "gameplay",
        "ppt",
        "link",
    }
    return normalized in link_keywords

def _looks_like_team_context_line(line: str) -> bool:
    normalized = normalize(line)
    return "/" in line and any(keyword in normalized for keyword in ("pm", "기획", "개발", "클라", "서버", "아트", "임베디드", "디자인"))

def _is_bad_activity_title(title: str) -> bool:
    normalized = _normalize_section_header(title)
    return not title or len(title) <= 1 or normalized in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS or title.startswith("|")

def _looks_like_education_header_context(lines: list[str], title_idx: int, period_idx: int) -> bool:
    window = " ".join(lines[max(0, title_idx - 4) : min(len(lines), period_idx + 3)]).lower()
    if any(keyword in window for keyword in ("university", "대학교", "대학", "학점", "졸업", "편입", "중퇴")):
        return True
    if period_idx + 1 < len(lines) and re.match(r"^\d+(?:\.\d+)?\s*/\s*\d+(?:\.\d+)?$", lines[period_idx + 1].strip()):
        return True
    return False

def _is_activity_header_at(lines: list[str], idx: int) -> bool:
    if idx >= len(lines):
        return False
    candidate = lines[idx].strip(" \t•-")
    return bool(
        _ACTIVITY_HEADER_RE.match(candidate)
        or _extract_split_period(lines, idx)
        or (
            _looks_like_project_category_line(candidate)
            and any(_DATE_RANGE_RE.search(lines[candidate_idx]) for candidate_idx in range(idx + 1, min(len(lines), idx + 4)))
        )
    )
