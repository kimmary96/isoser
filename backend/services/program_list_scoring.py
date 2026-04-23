from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from math import sqrt
from typing import Any, Mapping


@dataclass(frozen=True, slots=True)
class ProgramScore:
    excellence_score: float
    bayesian_satisfaction: float
    review_confidence: float
    deadline_urgency: float
    freshness_score: float
    data_completeness: float
    recommended_score: float
    reasons: tuple[str, ...]


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _parse_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _parse_int(value: Any) -> int:
    parsed = _parse_float(value)
    return max(0, int(parsed)) if parsed is not None else 0


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _rating_to_unit(value: Any) -> float | None:
    parsed = _parse_float(value)
    if parsed is None or parsed <= 0:
        return None
    if parsed <= 5:
        return _clamp(parsed / 5)
    if parsed <= 100:
        return _clamp(parsed / 100)
    return None


def _deadline_confidence(row: Mapping[str, Any]) -> str:
    explicit = str(row.get("deadline_confidence") or "").strip().lower()
    if explicit in {"high", "medium", "low"}:
        return explicit

    meta = row.get("compare_meta") if isinstance(row.get("compare_meta"), Mapping) else {}
    if row.get("close_date") or any(meta.get(key) for key in ("application_deadline", "recruitment_deadline", "application_end_date", "recruitment_end_date")):
        return "high"
    source_text = " ".join(str(meta.get(key) or "") for key in ("deadline_source", "application_deadline_source", "recruitment_deadline_source"))
    normalized_source = source_text.replace("_", "").replace("-", "").lower()
    if normalized_source in {"trastartdate", "trainingstartdate", "trainingstart"}:
        return "medium"
    return "low"


def _freshness_score(value: Any, *, today: date) -> float:
    parsed = _parse_date(value)
    if parsed is None:
        return 0.3
    age_days = max(0, (today - parsed).days)
    if age_days <= 7:
        return 1.0
    if age_days >= 120:
        return 0.0
    return _clamp(1 - (age_days - 7) / 113)


def _deadline_urgency(deadline: Any, confidence: str, *, today: date) -> float:
    if confidence != "high":
        return 0.0
    parsed = _parse_date(deadline)
    if parsed is None:
        return 0.0
    days_left = (parsed - today).days
    if days_left < 0:
        return 0.0
    if days_left <= 3:
        return 1.0
    if days_left >= 30:
        return 0.0
    return _clamp(1 - (days_left - 3) / 27)


def _data_completeness(row: Mapping[str, Any]) -> float:
    keys = (
        "title",
        "provider",
        "summary",
        "category",
        "category_detail",
        "region",
        "teaching_method",
        "tuition_type",
        "study_time",
        "thumbnail_url",
    )
    filled = sum(1 for key in keys if str(row.get(key) or "").strip())
    return filled / len(keys)


def compute_recommended_score(row: Mapping[str, Any], *, today: date | None = None) -> ProgramScore:
    current_date = today or date.today()
    confidence = _deadline_confidence(row)
    meta = row.get("compare_meta") if isinstance(row.get("compare_meta"), Mapping) else {}
    satisfaction = _rating_to_unit(
        row.get("satisfaction_avg")
        or row.get("rating_normalized")
        or meta.get("satisfaction_score")
    )
    review_count = _parse_int(row.get("satisfaction_count") or row.get("review_count") or meta.get("review_count"))
    prior = 0.72
    prior_weight = 20
    bayesian = ((satisfaction or prior) * review_count + prior * prior_weight) / (review_count + prior_weight)
    review_confidence = _clamp(sqrt(review_count) / sqrt(100)) if review_count else 0.0
    excellence = 1.0 if row.get("is_certified") is True or row.get("excellence") is True else 0.0
    urgency = _deadline_urgency(row.get("close_date") or row.get("deadline"), confidence, today=current_date)
    freshness = _freshness_score(row.get("updated_at") or row.get("created_at"), today=current_date)
    completeness = _data_completeness(row)
    recommended = (
        excellence * 0.35
        + bayesian * 0.30
        + review_confidence * 0.10
        + urgency * 0.10
        + freshness * 0.10
        + completeness * 0.05
    )

    reasons: list[str] = []
    if excellence >= 1:
        reasons.append("우수기관")
    if bayesian >= 0.8 and review_confidence >= 0.2:
        reasons.append("만족도 상위")
    if urgency >= 0.75:
        reasons.append("마감임박")
    if freshness >= 0.85:
        reasons.append("최근 등록")
    if completeness >= 0.75:
        reasons.append("상세정보 충실")

    return ProgramScore(
        excellence_score=round(excellence, 4),
        bayesian_satisfaction=round(bayesian, 4),
        review_confidence=round(review_confidence, 4),
        deadline_urgency=round(urgency, 4),
        freshness_score=round(freshness, 4),
        data_completeness=round(completeness, 4),
        recommended_score=round(_clamp(recommended), 4),
        reasons=tuple(reasons),
    )
