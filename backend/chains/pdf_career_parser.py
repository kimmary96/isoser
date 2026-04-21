# Career extraction and normalization helpers for PDF parsing
import re
from typing import Any

from chains.pdf_parse_utils import (
    _CAREER_LINE_RE,
    _CAREER_SECTION_HEADERS,
    _CAREER_STOP_HEADERS,
    _DATE_RANGE_RE,
    _DATE_TOKEN_RE,
    _NON_CAREER_SECTION_HEADERS,
    _clean_header_title,
    _dedupe_string_list,
    _extract_split_period,
    _format_period,
    _normalize_section_header,
    normalize,
)

def _extract_career_entries_from_text(text: str) -> list[dict[str, str]]:
    if not text.strip():
        return []

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    entries: list[dict[str, str]] = []
    in_career_section = False
    idx = 0

    while idx < len(lines):
        line = lines[idx]
        normalized = _normalize_section_header(line)

        if normalized in _CAREER_SECTION_HEADERS:
            in_career_section = True
            idx += 1
            continue

        if in_career_section and normalized in _CAREER_STOP_HEADERS:
            in_career_section = False

        if not in_career_section:
            idx += 1
            continue
        if normalized in _NON_CAREER_SECTION_HEADERS:
            idx += 1
            continue

        match = _CAREER_LINE_RE.match(line)
        split_period = None if match else _extract_split_period(lines, idx)
        if match or split_period:
            if match:
                company = _clean_header_title(match.group("company"))
                start = match.group("start").strip()
                end = match.group("end").strip()
                role_start_idx = idx + 1
            else:
                company = _clean_header_title(line)
                start, end = split_period or ("", "")
                role_start_idx = idx + 2
            if _looks_like_project_line(company):
                idx += 1
                continue
            role = _extract_following_role(lines, role_start_idx)
            entries.append(
                {
                    "company": company,
                    "position": role,
                    "start": start,
                    "end": end,
                }
            )
        idx += 1

    return _dedupe_career_entries(entries)

def _postprocess_career_entries(
    normalized_profile: dict[str, Any],
    normalized_activities: list[dict[str, Any]],
    extracted_careers: list[dict[str, str]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    cleaned_career = []
    carry_into_intro = []
    for item in normalized_profile.get("career", []):
        if _looks_like_structured_career(item):
            cleaned_career.append(_normalize_career_string(item))
        elif item:
            carry_into_intro.append(item)

    for entry in extracted_careers:
        cleaned_career.append(_serialize_career_entry(entry))

    normalized_profile["career"] = _dedupe_career_strings(cleaned_career)

    if carry_into_intro:
        intro_parts = [normalized_profile.get("self_intro", "").strip(), " ".join(carry_into_intro).strip()]
        normalized_profile["self_intro"] = " ".join(part for part in intro_parts if part).strip()

    for entry in extracted_careers:
        period = _format_period(entry["start"], entry["end"])
        matched = False
        for activity in normalized_activities:
            if _is_matching_career_activity(activity, entry, period):
                activity["type"] = "회사경력"
                activity["title"] = entry["company"]
                activity["role"] = entry["position"]
                activity["period"] = period
                matched = True
                break

        if not matched:
            normalized_activities.append(
                {
                    "type": "회사경력",
                    "title": entry["company"],
                    "period": period,
                    "role": entry["position"],
                    "skills": [],
                    "description": "",
                }
            )

    return normalized_profile, normalized_activities

def _extract_following_role(lines: list[str], start_idx: int) -> str:
    idx = start_idx
    while idx < len(lines):
        candidate = lines[idx].strip()
        normalized = _normalize_section_header(candidate)
        if not candidate:
            idx += 1
            continue
        if normalized in _CAREER_SECTION_HEADERS or normalized in _NON_CAREER_SECTION_HEADERS:
            return ""
        if _CAREER_LINE_RE.match(candidate):
            return ""
        if _DATE_RANGE_RE.search(candidate):
            idx += 1
            continue
        role = _extract_role_from_sentence(candidate)
        if role:
            return role
        if len(candidate) <= 1:
            idx += 1
            continue
        if _looks_like_non_role_line(candidate):
            idx += 1
            continue
        if _looks_like_project_line(candidate):
            idx += 1
            continue
        if "근무" in candidate or "수행" in candidate or "참여" in candidate or candidate.endswith("에서"):
            idx += 1
            continue
        if len(candidate) > 24:
            idx += 1
            continue
        return candidate
    return ""

def _extract_role_from_sentence(line: str) -> str:
    candidates = (
        r"(?P<role>Game Designer/PM)",
        r"(?P<role>[가-힣A-Za-z/ ]*PM)",
        r"(?P<role>공사기사)",
        r"(?P<role>기획자)",
        r"(?P<role>백엔드 개발자)",
    )
    for pattern in candidates:
        match = re.search(pattern, line)
        if match:
            return match.group("role").strip()
    return ""

def _looks_like_non_role_line(line: str) -> bool:
    normalized = normalize(line)
    return (
        "link" in normalized
        or "스타트업" in line
        or "회사" in line
        or "연구소" in line
        or "현장" in line
        or "프로젝트" in line
    )

def _looks_like_project_line(line: str) -> bool:
    lowered = line.lower()
    return (
        "프로젝트" in line
        or "project" in lowered
        or len(line) > 40
    )

def _looks_like_structured_career(text: str) -> bool:
    parts = [part.strip() for part in text.split("|") if part.strip()]
    if len(parts) >= 4 and _DATE_TOKEN_RE.search(parts[2]):
        return True
    if len(parts) >= 3 and _DATE_RANGE_RE.search(parts[-1]):
        return True
    return False

def _normalize_career_string(text: str) -> str:
    parts = [part.strip() for part in text.split("|") if part.strip()]
    if len(parts) >= 4:
        return _serialize_career_entry(
            {
                "company": parts[0],
                "position": parts[1],
                "start": parts[2],
                "end": parts[3],
            }
        )
    if len(parts) >= 3:
        period_match = _DATE_RANGE_RE.search(parts[2])
        if period_match:
            return _serialize_career_entry(
                {
                    "company": parts[0],
                    "position": parts[1],
                    "start": period_match.group("start"),
                    "end": period_match.group("end"),
                }
            )
    return text.strip()

def _serialize_career_entry(entry: dict[str, str]) -> str:
    return " | ".join(
        [
            entry.get("company", "").strip() or "-",
            entry.get("position", "").strip() or "-",
            entry.get("start", "").strip() or "-",
            entry.get("end", "").strip() or "-",
        ]
    )

def _is_matching_career_activity(
    activity: dict[str, Any], entry: dict[str, str], period: str
) -> bool:
    title = str(activity.get("title", "")).strip()
    role = str(activity.get("role", "")).strip()
    existing_period = str(activity.get("period", "")).strip()

    if normalize(title) == normalize(entry["company"]):
        return True

    if role and entry["position"] and normalize(role) == normalize(entry["position"]):
        if existing_period and period and existing_period == period:
            return True

    return False

def _dedupe_career_entries(entries: list[dict[str, str]]) -> list[dict[str, str]]:
    seen = set()
    result = []
    for entry in entries:
        key = (
            normalize(entry.get("company", "")),
            normalize(entry.get("position", "")),
            entry.get("start", "").strip(),
            entry.get("end", "").strip(),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(entry)
    return result

def _dedupe_career_strings(items: list[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        normalized = item.strip()
        if not normalized:
            continue

        duplicate_idx = _find_duplicate_career_string_index(result, normalized)
        if duplicate_idx is None:
            result.append(normalized)
            continue

        if len(normalized) > len(result[duplicate_idx]):
            result[duplicate_idx] = normalized

    return result

def _find_duplicate_career_string_index(items: list[str], candidate: str) -> int | None:
    candidate_parts = [part.strip() for part in candidate.split("|")]
    if len(candidate_parts) < 4:
        return None

    candidate_company, candidate_position, candidate_start, candidate_end = candidate_parts[:4]
    for idx, item in enumerate(items):
        parts = [part.strip() for part in item.split("|")]
        if len(parts) < 4:
            continue

        company, position, start, end = parts[:4]
        same_timeline = (
            normalize(position) == normalize(candidate_position)
            and start == candidate_start
            and end == candidate_end
        )
        same_company = (
            normalize(company) == normalize(candidate_company)
            or normalize(company) in normalize(candidate_company)
            or normalize(candidate_company) in normalize(company)
        )
        if same_timeline and same_company:
            return idx

    return None
