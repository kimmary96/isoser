# Activity post-processing helpers for PDF parsing
from typing import Any

from chains.pdf_parse_utils import (
    _dedupe_string_list,
    _normalize_optional_int,
    _normalize_period,
    _normalize_string_list,
    _normalize_text_field,
    normalize,
)
from chains.pdf_sentence_scorer import looks_like_contribution_line

def _postprocess_activity_details(
    normalized_activities: list[dict[str, Any]],
    extracted_activity_details: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    for detail in extracted_activity_details:
        matched = _find_matching_activity(normalized_activities, detail["title"])
        if matched is None:
            continue

        _absorb_fragment_activities(matched, normalized_activities, detail)
        matched["period"] = _normalize_period(str(matched.get("period") or detail["period"]))
        if not matched.get("organization") or _is_generic_organization(str(matched.get("organization", ""))):
            matched["organization"] = detail["organization"]
        if not matched.get("role"):
            matched["role"] = detail["role"]
        if not matched.get("my_role"):
            matched["my_role"] = matched.get("role") or detail["role"]
        if not matched.get("team_size"):
            matched["team_size"] = detail["team_size"]
        if not matched.get("team_composition"):
            matched["team_composition"] = detail["team_composition"]
        if detail["contributions"]:
            matched["contributions"] = detail["contributions"]
        current_description = _normalize_text_field(matched.get("description"))
        contribution_keys = {normalize(item) for item in _normalize_string_list(matched.get("contributions"))}
        if detail["description"] or normalize(current_description) in contribution_keys:
            matched["description"] = detail["description"]

    for activity in normalized_activities:
        activity["description"] = _normalize_text_field(activity.get("description"))
        activity["period"] = _normalize_period(str(activity.get("period", "")))
        if not activity.get("my_role"):
            activity["my_role"] = str(activity.get("role", "")).strip()
        if not activity.get("organization"):
            activity["organization"] = _extract_organization_from_title(str(activity.get("title", "")))
        if activity.get("team_size") is not None:
            activity["team_size"] = _normalize_optional_int(activity.get("team_size"))

    return normalized_activities

def _absorb_fragment_activities(
    matched: dict[str, Any],
    activities: list[dict[str, Any]],
    detail: dict[str, Any],
) -> None:
    fragment_lines = _dedupe_string_list(
        [
            *detail.get("contributions", []),
            *[line.strip() for line in str(detail.get("description", "")).split(".") if line.strip()],
        ]
    )
    fragment_keys = {normalize(line) for line in fragment_lines if line}
    if not fragment_keys:
        return

    retained: list[dict[str, Any]] = []
    absorbed_contributions = _normalize_string_list(matched.get("contributions"))
    absorbed_description = str(matched.get("description", "")).strip()

    for activity in activities:
        if activity is matched:
            retained.append(activity)
            continue

        title_key = normalize(str(activity.get("title", "")))
        description_key = normalize(str(activity.get("description", "")))
        is_fragment = title_key in fragment_keys or description_key in fragment_keys

        if not is_fragment:
            retained.append(activity)
            continue

        title = str(activity.get("title", "")).strip()
        description = str(activity.get("description", "")).strip()
        if looks_like_contribution_line(title):
            absorbed_contributions.append(title)
        elif title and not absorbed_description:
            absorbed_description = title
        if looks_like_contribution_line(description):
            absorbed_contributions.append(description)
        elif description and not absorbed_description:
            absorbed_description = description

    activities[:] = retained
    matched["contributions"] = _dedupe_string_list(absorbed_contributions)
    matched["description"] = absorbed_description

def _find_matching_activity(
    activities: list[dict[str, Any]],
    title: str,
) -> dict[str, Any] | None:
    normalized_title = normalize(title)
    for activity in activities:
        candidate = normalize(str(activity.get("title", "")))
        if candidate == normalized_title or candidate in normalized_title or normalized_title in candidate:
            return activity
    return None

def _extract_organization_from_title(title: str) -> str:
    for separator in ("—", "–", "-", "|", ":"):
        if separator in title:
            return title.split(separator, 1)[0].strip()
    return title.strip()

def _is_generic_organization(value: str) -> bool:
    return normalize(value) in {"팀프로젝트", "개인프로젝트", "프로젝트"}
