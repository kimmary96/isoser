"""Activity-to-STAR and portfolio conversion helpers."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Mapping

ACTIVITY_TYPES = ("회사경력", "프로젝트", "대외활동", "학생활동")

PORTFOLIO_CHECKLIST = (
    "프로젝트 개요",
    "문제 정의",
    "기술 선택 근거",
    "구현 디테일",
    "정량적 성과",
    "역할 명확화",
)

STAR_PLACEHOLDERS = {
    "star_situation": "활동이 시작된 배경이나 해결하려던 문제를 입력해주세요.",
    "star_task": "본인이 맡았던 목표와 해결 과제를 입력해주세요.",
    "star_action": "실제로 수행한 구현·개선 행동을 입력해주세요.",
    "star_result": "결과와 수치를 입력해주세요.",
}

TECH_DECISION_PLACEHOLDER = "비교한 대안과 선택 이유를 입력해주세요."
METRIC_PLACEHOLDER = {"value": "[수치 보완 필요]", "label": "정량 성과를 입력해주세요."}

REVIEW_TAG_NEEDS_REVIEW = "[검토 필요]"
REVIEW_TAG_NEEDS_METRICS = "[수치 보완 필요]"
REVIEW_TAG_NEEDS_PERSONAL_CONTEXT = "[본인 경험으로 수정 필요]"

METRIC_PATTERN = re.compile(
    r"\d[\d,]*(?:\.\d+)?\s*(?:%|배|건|명|회|개|시간|분|초|ms|건수|원|만원|억|점)"
)
PERIOD_SPLIT_PATTERN = re.compile(r"\s*(?:~|-|–|—)\s*")
YEAR_MONTH_PATTERN = re.compile(r"(?P<year>\d{4})[./-]?\s*(?P<month>\d{1,2})")

PROBLEM_KEYWORDS = ("문제", "이슈", "배경", "상황", "병목", "장애", "기존", "불편", "리스크")
TASK_KEYWORDS = ("목표", "과제", "해결", "달성", "줄이", "높이", "구축", "전환")
ACTION_KEYWORDS = ("구현", "설계", "도입", "적용", "개선", "개발", "구축", "분석", "자동화", "최적화", "리팩터링", "운영")
DECISION_KEYWORDS = ("선택", "비교", "대안", "도입", "채택", "결정", "대신", "전환")
DECISION_RATIONALE_KEYWORDS = ("비교", "대안", "대신", "선택", "이유", "근거", "판단")
RESULT_KEYWORDS = ("성과", "개선", "증가", "감소", "단축", "달성", "향상", "절감", "완료", "처리")


def _safe_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _normalize_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for item in value:
        text = _safe_text(item)
        if text:
            normalized.append(text)
    return normalized


def _ensure_sentence(text: str) -> str:
    normalized = _safe_text(text)
    if not normalized:
        return ""
    if normalized[-1] in ".!?":
        return normalized
    return f"{normalized}."


def _strip_trailing_punctuation(text: str) -> str:
    return _safe_text(text).rstrip(" .,!?:;")


def _split_sentences(*parts: str) -> list[str]:
    sentences: list[str] = []
    for part in parts:
        normalized = _safe_text(part)
        if not normalized:
            continue
        chunks = re.split(r"(?<=[.!?])\s+|\n+", normalized)
        for chunk in chunks:
            sentence = _ensure_sentence(chunk)
            if sentence and sentence not in sentences:
                sentences.append(sentence)
    return sentences


def _first_sentence_with_keywords(sentences: list[str], keywords: tuple[str, ...]) -> str:
    for sentence in sentences:
        lowered = sentence.lower()
        if any(keyword in lowered for keyword in keywords):
            return sentence
    return ""


def _first_sentence_with_metric(sentences: list[str]) -> str:
    for sentence in sentences:
        if METRIC_PATTERN.search(sentence):
            return sentence
    return ""


def _extract_metric_pairs(*parts: str) -> list[dict[str, str]]:
    metrics: list[dict[str, str]] = []
    for sentence in _split_sentences(*parts):
        matches = list(METRIC_PATTERN.finditer(sentence))
        if not matches:
            continue
        multi_metric_sentence = len(matches) > 1
        for index, match in enumerate(matches):
            value = _safe_text(match.group(0))
            if multi_metric_sentence:
                if index == 0:
                    label = "개선 전 수치"
                elif index == 1:
                    label = "개선 후 수치"
                else:
                    label = "추가 성과 지표"
            else:
                label = _safe_text(
                    sentence.replace(match.group(0), " ").replace("  ", " ").strip(" -:,.")
                )
            metrics.append({"value": value, "label": label or "성과 지표"})
            if len(metrics) >= 3:
                return metrics
    return metrics


def _parse_period(period: str) -> dict[str, str | None]:
    normalized = _safe_text(period)
    if not normalized:
        return {"raw": None, "start": None, "end": None, "duration": None}

    parts = PERIOD_SPLIT_PATTERN.split(normalized, maxsplit=1)
    start = _safe_text(parts[0]) if parts else ""
    end = _safe_text(parts[1]) if len(parts) > 1 else ""

    duration: str | None = None
    start_match = YEAR_MONTH_PATTERN.search(start)
    end_match = YEAR_MONTH_PATTERN.search(end)
    if start_match and end_match:
        start_month = datetime(int(start_match.group("year")), int(start_match.group("month")), 1)
        end_month = datetime(int(end_match.group("year")), int(end_match.group("month")), 1)
        month_delta = (end_month.year - start_month.year) * 12 + (end_month.month - start_month.month)
        duration = f"약 {max(1, month_delta)}개월"

    return {
        "raw": normalized,
        "start": start or None,
        "end": end or None,
        "duration": duration,
    }


def _build_role_clarification(
    *,
    team_size: int | None,
    team_composition: str,
    role_text: str,
    contributions: list[str],
) -> str:
    parts: list[str] = []
    if team_size:
        team_part = f"{team_size}인 팀"
        if team_composition:
            team_part += f"({team_composition})"
        parts.append(team_part)
    if role_text:
        parts.append(f"{role_text} 역할을 맡았습니다")
    if contributions:
        normalized_contributions = [_strip_trailing_punctuation(item) for item in contributions[:3]]
        parts.append(f"주요 기여는 {', '.join(normalized_contributions)}입니다")
    return _ensure_sentence(" ".join(parts))


def _validate_activity(activity: Mapping[str, Any]) -> None:
    title = _safe_text(activity.get("title"))
    activity_type = _safe_text(activity.get("type"))

    if not title:
        raise ValueError("activity.title은 비어 있을 수 없습니다.")
    if activity_type not in ACTIVITY_TYPES:
        allowed = ", ".join(ACTIVITY_TYPES)
        raise ValueError(f"activity.type은 다음 값만 허용됩니다: {allowed}")

    has_content = any(
        [
            _safe_text(activity.get("description")),
            _safe_text(activity.get("star_situation")),
            _safe_text(activity.get("star_task")),
            _safe_text(activity.get("star_action")),
            _safe_text(activity.get("star_result")),
            _normalize_list(activity.get("contributions")),
        ]
    )
    if not has_content:
        raise ValueError("활동 설명, STAR 필드, contributions 중 하나 이상은 필요합니다.")


def activity_to_star(activity: Mapping[str, Any]) -> dict[str, Any]:
    """Convert an activity row into STAR fields without inventing facts."""

    _validate_activity(activity)

    description = _safe_text(activity.get("description"))
    contributions = _normalize_list(activity.get("contributions"))
    contribution_text = _ensure_sentence(" ".join(contributions))
    sentences = _split_sentences(
        description,
        _safe_text(activity.get("star_situation")),
        _safe_text(activity.get("star_task")),
        _safe_text(activity.get("star_action")),
        _safe_text(activity.get("star_result")),
        contribution_text,
    )

    review_tags: list[str] = []
    missing_fields: list[str] = []

    situation = _safe_text(activity.get("star_situation")) or _first_sentence_with_keywords(
        sentences,
        PROBLEM_KEYWORDS,
    )
    task = _safe_text(activity.get("star_task")) or _first_sentence_with_keywords(sentences, TASK_KEYWORDS)
    action = _safe_text(activity.get("star_action")) or contribution_text or _first_sentence_with_keywords(
        sentences,
        ACTION_KEYWORDS,
    ) or description
    result = _safe_text(activity.get("star_result")) or _first_sentence_with_metric(sentences)

    if not situation:
        situation = STAR_PLACEHOLDERS["star_situation"]
        missing_fields.append("star_situation")
        review_tags.append(REVIEW_TAG_NEEDS_REVIEW)
    if not task:
        task = STAR_PLACEHOLDERS["star_task"]
        missing_fields.append("star_task")
        review_tags.append(REVIEW_TAG_NEEDS_REVIEW)
    if not action:
        action = STAR_PLACEHOLDERS["star_action"]
        missing_fields.append("star_action")
        review_tags.append(REVIEW_TAG_NEEDS_REVIEW)
    if not result:
        result = STAR_PLACEHOLDERS["star_result"]
        missing_fields.append("star_result")
        review_tags.append(REVIEW_TAG_NEEDS_METRICS)

    return {
        "activity_id": _safe_text(activity.get("id")) or None,
        "title": _safe_text(activity.get("title")),
        "type": _safe_text(activity.get("type")),
        "star_situation": _ensure_sentence(situation),
        "star_task": _ensure_sentence(task),
        "star_action": _ensure_sentence(action),
        "star_result": _ensure_sentence(result),
        "missing_fields": missing_fields,
        "review_tags": sorted(set(review_tags)),
    }


def activity_to_portfolio(activity: Mapping[str, Any]) -> dict[str, Any]:
    """Convert an activity row into the 6-step portfolio structure."""

    _validate_activity(activity)

    star = activity_to_star(activity)
    description = _safe_text(activity.get("description"))
    contributions = _normalize_list(activity.get("contributions"))
    skills = _normalize_list(activity.get("skills"))
    organization = _safe_text(activity.get("organization"))
    team_size = activity.get("team_size")
    if isinstance(team_size, bool):
        team_size = None
    if not isinstance(team_size, int):
        try:
            team_size = int(team_size) if team_size is not None else None
        except (TypeError, ValueError):
            team_size = None

    team_composition = _safe_text(activity.get("team_composition"))
    role_text = _safe_text(activity.get("my_role")) or _safe_text(activity.get("role"))
    period_info = _parse_period(_safe_text(activity.get("period")))

    decision_sentences = _split_sentences(
        _safe_text(activity.get("star_action")),
        description,
        " ".join(contributions),
        _safe_text(activity.get("star_task")),
    )
    tech_decision = _first_sentence_with_keywords(decision_sentences, DECISION_KEYWORDS)
    review_tags = set(star["review_tags"])

    if not tech_decision:
        tech_decision = TECH_DECISION_PLACEHOLDER
        review_tags.add(REVIEW_TAG_NEEDS_PERSONAL_CONTEXT)
    elif not any(keyword in tech_decision.lower() for keyword in DECISION_RATIONALE_KEYWORDS):
        review_tags.add(REVIEW_TAG_NEEDS_PERSONAL_CONTEXT)

    overview_summary = description or star["star_action"]
    overview_contributions = contributions or (
        [star["star_action"]] if "star_action" not in star["missing_fields"] else []
    )
    implementation_highlights = contributions or (
        [star["star_action"]] if "star_action" not in star["missing_fields"] else []
    )
    metrics = _extract_metric_pairs(star["star_result"], description)
    if not metrics:
        metrics = [METRIC_PLACEHOLDER]
        review_tags.add(REVIEW_TAG_NEEDS_METRICS)

    role_clarification = _build_role_clarification(
        team_size=team_size,
        team_composition=team_composition,
        role_text=role_text,
        contributions=contributions,
    )
    if not role_clarification:
        role_clarification = STAR_PLACEHOLDERS["star_task"]
        review_tags.add(REVIEW_TAG_NEEDS_REVIEW)

    missing_elements: list[str] = []
    if not period_info["raw"] or not role_text:
        missing_elements.append("프로젝트 개요")
    if "star_situation" in star["missing_fields"]:
        missing_elements.append("문제 정의")
    if tech_decision == TECH_DECISION_PLACEHOLDER:
        missing_elements.append("기술 선택 근거")
    if "star_action" in star["missing_fields"] and not contributions:
        missing_elements.append("구현 디테일")
    if metrics == [METRIC_PLACEHOLDER]:
        missing_elements.append("정량적 성과")
    if not role_text or not team_size:
        missing_elements.append("역할 명확화")

    ordered_missing = [item for item in PORTFOLIO_CHECKLIST if item in missing_elements]

    return {
        "activity_id": _safe_text(activity.get("id")) or None,
        "project_overview": {
            "title": _safe_text(activity.get("title")),
            "activity_type": _safe_text(activity.get("type")),
            "organization": organization or None,
            "period": period_info["raw"],
            "period_start": period_info["start"],
            "period_end": period_info["end"],
            "duration": period_info["duration"],
            "team_size": team_size,
            "team_composition": team_composition or None,
            "role": role_text or None,
            "skills": skills,
            "summary": _ensure_sentence(overview_summary) or STAR_PLACEHOLDERS["star_action"],
            "contributions": overview_contributions,
        },
        "problem_definition": {
            "label": "문제 정의",
            "content": _ensure_sentence(
                " ".join(
                    part
                    for part in (star["star_situation"], star["star_task"])
                    if part and part not in STAR_PLACEHOLDERS.values()
                )
            )
            or STAR_PLACEHOLDERS["star_situation"],
        },
        "tech_decision": {
            "label": "기술 선택 근거",
            "content": _ensure_sentence(tech_decision),
        },
        "implementation_detail": {
            "label": "구현 디테일",
            "summary": star["star_action"],
            "highlights": implementation_highlights,
        },
        "quantified_result": {
            "label": "정량적 성과",
            "summary": star["star_result"],
            "metrics": metrics,
        },
        "role_clarification": {
            "label": "역할 명확화",
            "content": _ensure_sentence(role_clarification),
        },
        "missing_elements": ordered_missing,
        "review_tags": sorted(review_tags),
    }


__all__ = ["activity_to_portfolio", "activity_to_star"]
