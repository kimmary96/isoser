# Rule-based PDF parser orchestration - normalize LLM output and source-text fallback
import json
from typing import Any

from chains.pdf_activity_parser import (
    _extract_activity_details_from_text,
    _infer_activity_type_from_detail,
    _postprocess_activity_details,
)
from chains.pdf_career_parser import _extract_career_entries_from_text, _postprocess_career_entries
from chains.pdf_parse_utils import (
    _extract_json_object,
    _extract_text_from_llm_content,
    _normalize_activity_type,
    _normalize_optional_int,
    _normalize_period,
    _normalize_skills,
    _normalize_string_list,
    _normalize_text_field,
)
from chains.pdf_profile_parser import _extract_profile_from_text, _extract_skills_from_text

def _parse_and_normalize_result(raw_content: Any, source_text: str = "") -> dict:
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
                    "title": _normalize_text_field(item.get("title")),
                    "organization": _normalize_text_field(item.get("organization")),
                    "period": _normalize_period(str(item.get("period", "")).strip()),
                    "role": _normalize_text_field(item.get("role")),
                    "team_size": _normalize_optional_int(item.get("team_size")),
                    "team_composition": _normalize_text_field(item.get("team_composition")),
                    "my_role": _normalize_text_field(item.get("my_role")),
                    "skills": _normalize_skills(item.get("skills")),
                    "contributions": _normalize_string_list(item.get("contributions")),
                    "description": _normalize_text_field(item.get("description")),
                }
            )

    extracted_careers = _extract_career_entries_from_text(source_text)
    extracted_activity_details = _extract_activity_details_from_text(source_text)
    normalized_profile, normalized_activities = _postprocess_career_entries(
        normalized_profile=normalized_profile,
        normalized_activities=normalized_activities,
        extracted_careers=extracted_careers,
    )
    normalized_activities = _postprocess_activity_details(
        normalized_activities=normalized_activities,
        extracted_activity_details=extracted_activity_details,
    )

    return {
        "profile": normalized_profile,
        "activities": normalized_activities,
    }

def _build_source_fallback_result(source_text: str) -> dict:
    profile = _extract_profile_from_text(source_text)
    extracted_careers = _extract_career_entries_from_text(source_text)
    extracted_details = _extract_activity_details_from_text(source_text)

    activities = []
    for detail in extracted_details:
        activities.append(
            {
                "type": _infer_activity_type_from_detail(detail, extracted_careers),
                "title": detail.get("title", ""),
                "organization": detail.get("organization", ""),
                "period": detail.get("period", ""),
                "role": detail.get("role", ""),
                "team_size": detail.get("team_size"),
                "team_composition": detail.get("team_composition", ""),
                "my_role": detail.get("role", ""),
                "skills": _extract_skills_from_text(
                    " ".join(
                        [
                            detail.get("title", ""),
                            detail.get("description", ""),
                            " ".join(detail.get("contributions", [])),
                        ]
                    )
                ),
                "contributions": detail.get("contributions", []),
                "description": detail.get("description", ""),
            }
        )

    raw = json.dumps(
        {
            "profile": profile,
            "activities": activities,
        },
        ensure_ascii=False,
    )
    return _parse_and_normalize_result(raw, source_text)
