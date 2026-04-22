# Activity team and role extraction helpers for PDF parsing
import re

from chains.activity_header_parser import _is_activity_header_at, _looks_like_link_or_tool_line
from chains.pdf_parse_utils import (
    _CAREER_SECTION_HEADERS,
    _COMPACT_TEAM_PART_RE,
    _NON_CAREER_SECTION_HEADERS,
    _ROLE_TEAM_RE,
    _dedupe_string_list,
    _normalize_optional_int,
    _normalize_section_header,
    normalize,
)

def _extract_role_team_after_period(
    lines: list[str],
    start_idx: int,
) -> tuple[str, int | None, str, int]:
    team_parts: list[str] = []
    role_parts: list[str] = []
    idx = start_idx

    while idx < len(lines):
        candidate = lines[idx].strip(" \t•-")
        if not candidate:
            idx += 1
            continue
        if _is_activity_header_at(lines, idx) or _normalize_section_header(candidate) in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            break
        role_match = _ROLE_TEAM_RE.match(candidate)
        if role_match:
            role_parts.append(role_match.group("role").strip())
            team_composition = role_match.group("composition").strip()
            return role_parts[0], _normalize_optional_int(role_match.group("size")), team_composition, idx + 1
        if _looks_like_link_or_tool_line(candidate):
            idx += 1
            continue
        if _looks_like_team_line(candidate):
            team_parts.append(candidate)
            idx += 1
            continue
        if _looks_like_role_line(candidate):
            role_parts.append(candidate)
            idx += 1
            continue
        break

    team_composition = _normalize_team_composition(" / ".join(team_parts))
    role = " / ".join(_dedupe_string_list(role_parts))
    team_size = _extract_team_size(team_composition)
    return role, team_size, team_composition, idx

def _looks_like_team_line(line: str) -> bool:
    normalized = normalize(line)
    return "/" in line and any(keyword in normalized for keyword in ("pm", "기획", "개발", "클라", "서버", "아트", "임베디드", "디자인"))

def _looks_like_role_line(line: str) -> bool:
    normalized = normalize(line)
    return bool(_COMPACT_TEAM_PART_RE.search(line)) and any(keyword in normalized for keyword in ("pm", "기획", "개발", "디자이너"))

def _normalize_team_composition(value: str) -> str:
    text = value.strip(" /")
    if not text:
        return ""
    text = re.sub(r"\s*/\s*/\s*", " / ", text)
    text = re.sub(r"\s*/\s*", " / ", text)
    return text.strip(" /")

def _extract_team_size(team_composition: str) -> int | None:
    if not team_composition:
        return None
    counts = [int(match.group("count")) for match in _COMPACT_TEAM_PART_RE.finditer(team_composition)]
    if not counts:
        return None
    return sum(counts)
