# Activity extraction orchestration for PDF parsing
import logging
import os
from typing import Any

from chains.activity_header_parser import (
    _extract_activity_header_at,
    _is_activity_header_at,
    _looks_like_education_header_context,
)
from chains.activity_postprocessor import _extract_organization_from_title, _postprocess_activity_details
from chains.activity_team_parser import _extract_role_team_after_period
from chains.pdf_parse_utils import (
    _CAREER_SECTION_HEADERS,
    _NON_CAREER_SECTION_HEADERS,
    _dedupe_string_list,
    _format_period,
    _normalize_section_header,
    normalize,
)
from chains.pdf_sentence_scorer import classify_activity_sentence, looks_like_contribution_line


logger = logging.getLogger(__name__)

def _infer_activity_type_from_detail(
    detail: dict[str, Any],
    extracted_careers: list[dict[str, str]],
) -> str:
    title_key = normalize(str(detail.get("title", "")))
    period = str(detail.get("period", ""))
    for career in extracted_careers:
        if title_key == normalize(career.get("company", "")) and period == _format_period(
            career.get("start", ""),
            career.get("end", ""),
        ):
            return "회사경력"
    if "프로젝트" in str(detail.get("title", "")):
        return "프로젝트"
    return "프로젝트"

def _extract_activity_details_from_text(text: str) -> list[dict[str, Any]]:
    if not text.strip():
        return []

    lines = [line.strip(" \t•-") for line in text.splitlines() if line.strip()]
    details: list[dict[str, Any]] = []

    for idx, line in enumerate(lines):
        if _normalize_section_header(line) in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            continue
        header = _extract_activity_header_at(lines, idx)
        if header is None:
            continue
        if _looks_like_education_header_context(lines, idx, header["period_idx"]):
            continue

        role, team_size, team_composition, bullet_idx = _extract_role_team_after_period(
            lines,
            header["period_idx"] + 1,
        )

        details.append(
            {
                "title": header["title"],
                "organization": _extract_organization_from_title(header["title"]),
                "period": header["period"],
                "role": role,
                "team_size": team_size,
                "team_composition": team_composition,
                **_split_following_activity_bullets(lines, bullet_idx),
            }
        )

    return details

def _extract_following_contributions(lines: list[str], start_idx: int) -> list[str]:
    contributions: list[str] = []
    idx = start_idx
    while idx < len(lines):
        candidate = lines[idx].strip(" \t•-")
        if not candidate:
            idx += 1
            continue
        if _normalize_section_header(candidate) in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            break
        if _is_activity_header_at(lines, idx):
            break
        if candidate.startswith("성과:"):
            contributions.append(candidate)
            idx += 1
            continue
        if looks_like_contribution_line(candidate):
            contributions.append(candidate)
        idx += 1
    return _dedupe_string_list(contributions)

def _split_following_activity_bullets(lines: list[str], start_idx: int) -> dict[str, Any]:
    intro_lines: list[str] = []
    contributions: list[str] = []
    idx = start_idx

    while idx < len(lines):
        candidate = lines[idx].strip(" \t•-")
        if not candidate:
            idx += 1
            continue
        if _normalize_section_header(candidate) in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            break
        if _is_activity_header_at(lines, idx):
            break

        classification = classify_activity_sentence(candidate)
        _log_sentence_classification(candidate, classification)
        if classification.kind == "intro":
            intro_lines.append(candidate)
        elif classification.kind == "contribution":
            contributions.append(candidate)
        idx += 1

    return {
        "description": " ".join(_dedupe_string_list(intro_lines)),
        "contributions": _dedupe_string_list(contributions),
    }

def _log_sentence_classification(candidate: str, classification: Any) -> None:
    if os.getenv("ISOSER_PDF_PARSE_DEBUG_SCORER", "").lower() not in {"1", "true", "yes", "on"}:
        return
    logger.debug(
        "pdf_sentence_classified kind=%s score=%s reason=%s text=%s",
        classification.kind,
        classification.score,
        classification.reason,
        candidate,
    )
