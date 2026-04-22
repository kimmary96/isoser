from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import logging
import re
from typing import Any, Literal, Mapping, Sequence

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field


def _should_fallback_to_backend(error: ModuleNotFoundError) -> bool:
    return error.name is not None and (
        error.name == "rag" or error.name.startswith("rag.")
    )


try:
    from backend.logging_config import get_logger, log_event
except ImportError:
    from logging_config import get_logger, log_event

try:
    from rag.collector.scheduler import run_all_collectors
    from rag.programs_rag import ProgramRecommendation, ProgramsRAG
except ModuleNotFoundError as error:
    if not _should_fallback_to_backend(error):
        raise
    from backend.rag.collector.scheduler import run_all_collectors
    from backend.rag.programs_rag import ProgramRecommendation, ProgramsRAG

from utils.supabase_admin import (
    get_current_user_from_authorization,
    request_supabase,
)

logger = get_logger(__name__)
programs_router = APIRouter(prefix="/programs", tags=["programs"])
router = programs_router
programs_rag = ProgramsRAG()

PROGRAM_SORT_OPTIONS = {"deadline", "latest"}
PROGRAM_TEACHING_METHODS = {"온라인", "오프라인", "혼합"}
RECOMMEND_CACHE_TTL_HOURS = 24
REGION_QUERY_ALIASES: dict[str, tuple[str, ...]] = {
    "서울": ("서울",),
    "경기": ("경기",),
    "부산": ("부산",),
    "대전·충청": ("대전", "충청", "세종"),
    "대구·경북": ("대구", "경북"),
    "온라인": ("온라인", "비대면", "원격"),
}


class ProgramListItem(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str | int | None = None
    title: str | None = None
    category: str | None = None
    location: str | None = None
    provider: str | None = None
    summary: str | None = None
    description: str | None = None
    tags: list[str] | str | None = None
    skills: list[str] | str | None = None
    application_url: str | None = None
    application_method: str | None = None
    source: str | None = None
    source_url: str | None = None
    link: str | None = None
    deadline: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    support_type: str | None = None
    teaching_method: str | None = None
    is_certified: bool | None = None
    is_active: bool | None = None
    is_ad: bool | None = None
    rating_raw: str | None = None
    rating_normalized: float | None = None
    rating_scale: int | None = None
    rating_display: str | None = None
    relevance_score: float | None = None
    final_score: float | None = None
    urgency_score: float | None = None
    days_left: int | None = None
    compare_meta: dict[str, Any] | None = None


class ProgramRecommendRequest(BaseModel):
    top_k: int = Field(default=9, ge=1, le=20)
    category: str | None = Field(default=None, description="카테고리 필터")
    region: str | None = Field(default=None, description="지역 필터")
    job_title: str | None = Field(default=None, description="직무명")
    force_refresh: bool = Field(default=False, description="캐시 무시 여부")


class ProgramRecommendItem(BaseModel):
    program_id: str
    score: float | None = None
    relevance_score: float | None = None
    reason: str
    fit_keywords: list[str] = Field(default_factory=list)
    program: ProgramListItem


class ProgramRecommendResponse(BaseModel):
    items: list[ProgramRecommendItem] = Field(default_factory=list)


class CalendarRecommendItem(BaseModel):
    program_id: str
    relevance_score: float
    urgency_score: float
    final_score: float
    deadline: str | None = None
    d_day_label: str
    reason: str
    program: ProgramListItem


class CalendarRecommendResponse(BaseModel):
    items: list[CalendarRecommendItem] = Field(default_factory=list)


class ProgramCompareRelevanceRequest(BaseModel):
    program_ids: list[str] = Field(default_factory=list)


class ProgramRelevanceItem(BaseModel):
    program_id: str
    relevance_score: float
    skill_match_score: float
    matched_skills: list[str] = Field(default_factory=list)
    fit_label: Literal["높음", "보통", "낮음"]
    fit_summary: str
    readiness_label: Literal["바로 지원 추천", "보완 후 지원", "탐색용 확인"]
    gap_tags: list[str] = Field(default_factory=list)


class ProgramCompareRelevanceResponse(BaseModel):
    items: list[ProgramRelevanceItem] = Field(default_factory=list)


class ProgramCountResponse(BaseModel):
    count: int


class ProgramDetailResponse(BaseModel):
    id: str | int | None = None
    title: str | None = None
    provider: str | None = None
    organizer: str | None = None
    location: str | None = None
    description: str | None = None
    application_start_date: str | None = None
    application_end_date: str | None = None
    program_start_date: str | None = None
    program_end_date: str | None = None
    teaching_method: str | None = None
    support_type: str | None = None
    source_url: str | None = None
    fee: int | None = None
    support_amount: int | None = None
    eligibility: list[str] = Field(default_factory=list)
    schedule_text: str | None = None
    rating: str | None = None
    rating_raw: str | None = None
    rating_normalized: float | None = None
    rating_scale: int | None = None
    rating_display: str | None = None
    review_count: int | None = None
    job_placement_rate: str | None = None
    capacity_total: int | None = None
    capacity_remaining: int | None = None
    manager_name: str | None = None
    phone: str | None = None
    email: str | None = None
    certifications: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    curriculum: list[str] = Field(default_factory=list)
    faq: list[dict[str, str]] = Field(default_factory=list)
    reviews: list[dict[str, Any]] = Field(default_factory=list)
    recommended_for: list[str] = Field(default_factory=list)
    learning_outcomes: list[str] = Field(default_factory=list)
    career_support: list[str] = Field(default_factory=list)
    event_banner: str | None = None
    ai_matching_summary: str | None = None


def _serialize_program_recommendation(item: ProgramRecommendation) -> ProgramRecommendItem:
    return ProgramRecommendItem(
        program_id=item.program_id,
        score=item.score,
        relevance_score=item.relevance_score,
        reason=item.reason,
        fit_keywords=item.fit_keywords,
        program=ProgramListItem.model_validate(item.program),
    )


def _clean_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _coerce_score(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_hash_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        normalized: dict[str, Any] = {}
        for key in sorted(value):
            normalized_value = _normalize_hash_value(value[key])
            if normalized_value in (None, "", [], {}):
                continue
            normalized[str(key)] = normalized_value
        return normalized
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        normalized_items: list[Any] = []
        for item in value:
            normalized_item = _normalize_hash_value(item)
            if normalized_item in (None, "", [], {}):
                continue
            normalized_items.append(normalized_item)
        return normalized_items
    if isinstance(value, str):
        return value.strip()
    return value


def _stable_hash(value: Any) -> str:
    payload = json.dumps(
        _normalize_hash_value(value),
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _build_condition_key_candidates(payload: ProgramRecommendRequest) -> list[str]:
    category = _clean_text(payload.category)
    region = _clean_text(payload.region)

    candidates: list[str] = []
    if category and region:
        candidates.append(f"{category}+{region}")
    if category:
        candidates.append(category)

    unique_candidates: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate and candidate not in seen:
            seen.add(candidate)
            unique_candidates.append(candidate)
    return unique_candidates


def _build_query_hash(payload: ProgramRecommendRequest) -> str:
    return _stable_hash(
        {
            "category": _clean_text(payload.category) or None,
            "region": _clean_text(payload.region) or None,
            "job_title": _clean_text(payload.job_title) or None,
        }
    )


def _build_profile_hash(
    profile: Mapping[str, Any],
    activities: Sequence[Mapping[str, Any]],
) -> str:
    profile_snapshot = {
        key: profile.get(key)
        for key in (
            "name",
            "bio",
            "education",
            "job_title",
            "self_intro",
            "portfolio_url",
            "career",
            "education_history",
            "awards",
            "certifications",
            "languages",
            "skills",
        )
    }
    activity_snapshot = [
        {
            key: activity.get(key)
            for key in ("id", "title", "role", "description", "skills", "period", "type")
        }
        for activity in activities[:20]
    ]
    return _stable_hash({"profile": profile_snapshot, "activities": activity_snapshot})


def _has_personalization_input(
    profile: Mapping[str, Any],
    activities: Sequence[Mapping[str, Any]],
) -> bool:
    if activities:
        return True

    for key in (
        "name",
        "bio",
        "education",
        "job_title",
        "self_intro",
        "portfolio_url",
        "career",
        "education_history",
        "awards",
        "certifications",
        "languages",
        "skills",
    ):
        value = profile.get(key)
        if isinstance(value, list):
            if any(_clean_text(item) for item in value):
                return True
            continue
        if _clean_text(value):
            return True
    return False


def _resolve_program_deadline(program: dict[str, Any]) -> str | None:
    raw = program.get("deadline") or program.get("end_date")
    text = str(raw).strip() if raw is not None else ""
    return text or None


def _parse_program_deadline(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _calculate_days_left(deadline: str | None) -> int | None:
    parsed = _parse_program_deadline(deadline)
    if parsed is None:
        return None
    return (parsed - date.today()).days


def _format_d_day_label(days_left: int | None) -> str:
    if days_left is None:
        return "정보 없음"
    if days_left < 0:
        return "마감"
    if days_left == 0:
        return "D-Day"
    return f"D-{days_left}"


def _recalculate_final_score(relevance_score: float | None, urgency_score: float | None) -> float:
    return programs_rag._final_score(relevance_score, urgency_score)


def _build_recommendation_program_record(
    program: dict[str, Any],
    *,
    relevance_score: float | None,
    urgency_score: float | None,
    final_score: float | None,
    similarity_score: float | None = None,
) -> dict[str, Any]:
    program_record = dict(program)
    deadline = _resolve_program_deadline(program_record)
    days_left = _calculate_days_left(deadline)
    program_record["deadline"] = deadline
    program_record["days_left"] = days_left
    program_record["similarity_score"] = similarity_score if similarity_score is not None else relevance_score
    program_record["relevance_score"] = relevance_score
    program_record["urgency_score"] = urgency_score
    program_record["final_score"] = final_score
    return program_record


def _is_expired_program(program: dict[str, Any]) -> bool:
    days_left = _calculate_days_left(_resolve_program_deadline(program))
    return days_left is not None and days_left < 0


def _compute_cache_expiry(recommendations: Sequence[ProgramRecommendation]) -> str:
    now = datetime.now(timezone.utc)
    default_expiry = now + timedelta(hours=RECOMMEND_CACHE_TTL_HOURS)
    future_deadlines = [
        parsed_deadline
        for item in recommendations
        if (parsed_deadline := _parse_program_deadline(_resolve_program_deadline(item.program)))
        and parsed_deadline >= now.date()
    ]
    if not future_deadlines:
        return default_expiry.isoformat()

    earliest_deadline = min(future_deadlines)
    earliest_expiry = datetime(
        earliest_deadline.year,
        earliest_deadline.month,
        earliest_deadline.day,
        23,
        59,
        59,
        tzinfo=timezone.utc,
    )
    return min(default_expiry, earliest_expiry).isoformat()


def _calendar_sort_key(item: CalendarRecommendItem) -> tuple[float, date]:
    parsed_deadline = _parse_program_deadline(item.deadline) or date.max
    return (-item.final_score, parsed_deadline)


def _build_calendar_item(
    *,
    program_id: str,
    reason: str,
    program: dict[str, Any],
    relevance_score: float,
    urgency_score: float,
) -> CalendarRecommendItem | None:
    deadline = _resolve_program_deadline(program)
    if _is_expired_program(program):
        return None

    final_score = _recalculate_final_score(relevance_score, urgency_score)
    program_record = _build_recommendation_program_record(
        program,
        relevance_score=relevance_score,
        urgency_score=urgency_score,
        final_score=final_score,
    )
    return CalendarRecommendItem(
        program_id=program_id,
        relevance_score=relevance_score,
        urgency_score=urgency_score,
        final_score=final_score,
        deadline=deadline,
        d_day_label=_format_d_day_label(program_record.get("days_left")),
        reason=reason,
        program=ProgramListItem.model_validate(program_record),
    )


def _build_calendar_items_from_recommendations(
    items: list[ProgramRecommendItem],
    *,
    top_k: int,
    anonymous: bool = False,
) -> list[CalendarRecommendItem]:
    calendar_items: list[CalendarRecommendItem] = []
    for item in items:
        program_id = str(item.program_id or "").strip()
        if not program_id:
            continue
        program_payload = item.program.model_dump()
        relevance_score = 0.0 if anonymous else (_coerce_score(item.relevance_score) or 0.0)
        urgency_score = _coerce_score(program_payload.get("urgency_score")) or 0.0
        calendar_item = _build_calendar_item(
            program_id=program_id,
            reason=item.reason,
            program=program_payload,
            relevance_score=relevance_score,
            urgency_score=urgency_score,
        )
        if calendar_item is not None:
            calendar_items.append(calendar_item)

    calendar_items.sort(key=_calendar_sort_key)
    return calendar_items[:top_k]


def _normalize_cached_recommendation_rows(
    cached_rows: list[dict[str, Any]],
) -> list[dict[str, Any]] | None:
    normalized_rows: list[dict[str, Any]] = []
    for row in cached_rows:
        relevance_score = _coerce_score(row.get("relevance_score"))
        urgency_score = _coerce_score(row.get("urgency_score"))
        if relevance_score is None or urgency_score is None:
            return None
        normalized_row = dict(row)
        normalized_row["relevance_score"] = relevance_score
        normalized_row["urgency_score"] = urgency_score
        normalized_row["final_score"] = _recalculate_final_score(relevance_score, urgency_score)
        normalized_rows.append(normalized_row)

    normalized_rows.sort(key=lambda row: float(row.get("final_score") or 0.0), reverse=True)
    return normalized_rows


def _normalize_regions_param(regions: list[str] | None) -> list[str]:
    if not regions:
        return []

    normalized: list[str] = []
    for raw in regions:
        if not raw:
            continue
        for token in str(raw).split(","):
            cleaned = token.strip()
            if cleaned:
                normalized.append(cleaned)
    return normalized


def _normalize_teaching_methods_param(teaching_methods: list[str] | None) -> list[str]:
    if not teaching_methods:
        return []

    normalized: list[str] = []
    for raw in teaching_methods:
        if not raw:
            continue
        for token in str(raw).split(","):
            cleaned = token.strip()
            if cleaned and cleaned in PROGRAM_TEACHING_METHODS and cleaned not in normalized:
                normalized.append(cleaned)
    return normalized


def _expand_region_keywords(regions: list[str]) -> list[str]:
    keywords: list[str] = []
    seen: set[str] = set()
    for region in regions:
        for keyword in REGION_QUERY_ALIASES.get(region, (region,)):
            if keyword not in seen:
                seen.add(keyword)
                keywords.append(keyword)
    return keywords


def _program_order_clause(sort: str) -> str:
    if sort == "latest":
        return "created_at.desc.nullslast"
    return "deadline.asc.nullslast"


def _build_program_query_params(
    *,
    select: str,
    category: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
    sort: str = "deadline",
    limit: int | None = None,
    offset: int | None = None,
) -> dict[str, Any]:
    effective_sort = sort if sort in PROGRAM_SORT_OPTIONS else "deadline"
    params: dict[str, Any] = {
        "select": select,
        "order": _program_order_clause(effective_sort),
    }

    if limit is not None:
        params["limit"] = str(limit)
    if offset is not None:
        params["offset"] = str(offset)
    if category:
        params["category"] = f"eq.{category}"
    if scope:
        params["scope"] = f"eq.{scope}"
    if region_detail:
        params["region_detail"] = f"eq.{region_detail}"
    if q:
        params["title"] = f"ilike.*{q.strip()}*"
    today_iso = date.today().isoformat()
    recent_cutoff_iso = (date.today() - timedelta(days=90)).isoformat()
    if include_closed_recent:
        params["deadline"] = f"gte.{recent_cutoff_iso}"
    elif recruiting_only or effective_sort == "deadline":
        params["deadline"] = f"gte.{today_iso}"
    normalized_teaching_methods = _normalize_teaching_methods_param(teaching_methods)
    if normalized_teaching_methods:
        quoted_values = ",".join(f'"{value}"' for value in normalized_teaching_methods)
        params["teaching_method"] = f"in.({quoted_values})"

    normalized_regions = _expand_region_keywords(_normalize_regions_param(regions))
    if normalized_regions:
        params["or"] = "(" + ",".join(f"location.ilike.*{keyword}*" for keyword in normalized_regions) + ")"

    return params


def _normalize_rating_fields(value: Any) -> dict[str, str | float | int | None]:
    raw = None if value is None else str(value).strip()
    result: dict[str, str | float | int | None] = {
        "rating_raw": raw or None,
        "rating_normalized": None,
        "rating_scale": None,
        "rating_display": None,
    }
    if not raw or raw.startswith("."):
        return result

    normalized_text = raw.replace(",", "")
    match = re.search(r"(?<![\d.])\d+(?:\.\d+)?(?![\d.])", normalized_text)
    if not match:
        return result

    score = float(match.group(0))
    if score <= 0 or score > 100:
        return result

    normalized_score = score if score <= 5 else score / 20
    normalized_score = round(normalized_score, 1)
    result["rating_normalized"] = normalized_score
    result["rating_scale"] = 5
    result["rating_display"] = f"{normalized_score:.1f}"
    return result


def _serialize_program_list_row(program: dict[str, Any]) -> dict[str, Any]:
    record = dict(program)
    compare_meta = record.get("compare_meta") if isinstance(record.get("compare_meta"), dict) else {}
    record.update(_normalize_rating_fields(record.get("rating") or compare_meta.get("satisfaction_score")))
    deadline = _resolve_program_deadline(record)
    days_left = _calculate_days_left(deadline)
    record["deadline"] = deadline
    record["days_left"] = days_left
    if days_left is not None:
        record["is_active"] = days_left >= 0
    return record


def _sort_program_list_rows(
    rows: list[dict[str, Any]],
    *,
    sort: str,
    include_closed_recent: bool,
) -> list[dict[str, Any]]:
    if sort != "deadline":
        return rows

    def sort_key(row: dict[str, Any]) -> tuple[int, int]:
        parsed_deadline = _parse_program_deadline(str(row.get("deadline") or ""))
        is_active = bool(row.get("is_active"))
        if include_closed_recent and not is_active:
            return (2, -(parsed_deadline.toordinal() if parsed_deadline else date.min.toordinal()))
        if parsed_deadline is None:
            return (1, date.max.toordinal())
        return (0, parsed_deadline.toordinal())

    return sorted(rows, key=sort_key)


def _postprocess_program_list_rows(
    rows: list[dict[str, Any]],
    *,
    sort: str,
    include_closed_recent: bool,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    serialized_rows = [_serialize_program_list_row(row) for row in rows]
    sorted_rows = _sort_program_list_rows(
        serialized_rows,
        sort=sort,
        include_closed_recent=include_closed_recent,
    )
    return sorted_rows[offset : offset + limit]


def _parse_content_range_total(value: str | None) -> int:
    if not value or "/" not in value:
        return 0

    total_raw = value.rsplit("/", maxsplit=1)[-1].strip()
    if not total_raw or total_raw == "*":
        return 0

    try:
        return int(total_raw)
    except ValueError:
        return 0


async def _fetch_program_rows(
    limit: int = 200,
    category: str | None = None,
    region: str | None = None,
) -> list[dict[str, Any]]:
    params: dict[str, str] = {
        "select": "*",
        "is_active": "eq.true",
        "order": "deadline.asc.nullslast",
        "limit": str(limit),
    }
    if category:
        params["category"] = f"ilike.*{category}*"
    if region:
        params["location"] = f"ilike.*{region}*"

    rows = await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params=params,
    )
    return rows if isinstance(rows, list) else []


async def _fetch_programs_by_ids(program_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not program_ids:
        return {}

    quoted_ids = ",".join(f'"{program_id}"' for program_id in program_ids if program_id)
    if not quoted_ids:
        return {}

    rows = await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": "*",
            "id": f"in.({quoted_ids})",
        },
    )
    if not isinstance(rows, list):
        return {}

    return {
        str(row.get("id")): row
        for row in rows
        if str(row.get("id") or "").strip()
    }


async def _load_recommendation_rule(condition_keys: Sequence[str]) -> dict[str, Any] | None:
    for condition_key in condition_keys:
        try:
            rows = await request_supabase(
                method="GET",
                path="/rest/v1/recommendation_rules",
                params={
                    "select": "condition_key,program_ids,reason_template,fit_keywords,priority",
                    "condition_key": f"eq.{condition_key}",
                    "limit": "1",
                },
            )
        except Exception as exc:
            log_event(logger, logging.WARNING, "recommend_rule_load_failed", error=str(exc))
            return None
        if isinstance(rows, list) and rows:
            return dict(rows[0])
    return None


async def _load_cached_recommendations(
    user_id: str,
    *,
    profile_hash: str | None = None,
    query_hash: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]] | None:
    params: dict[str, str] = {"user_id": f"eq.{user_id}", "limit": str(limit)}
    if profile_hash and query_hash:
        params.update(
            {
                "select": "program_id,similarity_score,relevance_score,urgency_score,final_score,generated_at,reason,fit_keywords,query_hash,profile_hash,expires_at",
                "profile_hash": f"eq.{profile_hash}",
                "query_hash": f"eq.{query_hash}",
                "expires_at": f"gte.{datetime.now(timezone.utc).isoformat()}",
                "order": "final_score.desc",
            }
        )
    else:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=RECOMMEND_CACHE_TTL_HOURS)).isoformat()
        params.update(
            {
                "select": "program_id,similarity_score,relevance_score,urgency_score,final_score,generated_at,reason,fit_keywords,query_hash,profile_hash,expires_at",
                "generated_at": f"gte.{cutoff}",
                "order": "final_score.desc",
            }
        )

    try:
        rows = await request_supabase(
            method="GET",
            path="/rest/v1/recommendations",
            params=params,
        )
    except Exception as exc:
        log_event(logger, logging.WARNING, "recommend_cache_load_failed", error=str(exc))
        return None
    return rows if isinstance(rows, list) and rows else None


async def _delete_cached_recommendations(
    user_id: str,
    *,
    query_hash: str | None = None,
    profile_hash: str | None = None,
) -> None:
    params: dict[str, str] = {"user_id": f"eq.{user_id}"}
    if query_hash:
        params["query_hash"] = f"eq.{query_hash}"
    if profile_hash:
        params["profile_hash"] = f"eq.{profile_hash}"
    try:
        await request_supabase(
            method="DELETE",
            path="/rest/v1/recommendations",
            params=params,
        )
    except Exception as exc:
        log_event(logger, logging.WARNING, "recommend_cache_delete_failed", error=str(exc))


async def _save_recommendations(
    user_id: str,
    recommendations: list[ProgramRecommendation],
    *,
    profile_hash: str | None = None,
    query_hash: str | None = None,
) -> None:
    if not recommendations:
        return

    now = datetime.now(timezone.utc).isoformat()
    expires_at = _compute_cache_expiry(recommendations)
    payload: list[dict[str, Any]] = []
    for item in recommendations:
        if not item.program_id:
            continue
        payload.append(
            {
                "user_id": user_id,
                "program_id": item.program_id,
                "similarity_score": float(item.program.get("similarity_score") or item.relevance_score or 0),
                "relevance_score": float(item.program.get("relevance_score") or item.relevance_score or 0),
                "urgency_score": float(item.program.get("urgency_score") or 0),
                "final_score": float(item.score or item.program.get("final_score") or 0),
                "reason": item.reason,
                "fit_keywords": item.fit_keywords,
                "query_hash": query_hash,
                "profile_hash": profile_hash,
                "generated_at": now,
                "expires_at": expires_at,
            }
        )

    if not payload:
        return

    try:
        await request_supabase(
            method="POST",
            path="/rest/v1/recommendations",
            params={"on_conflict": "user_id,query_hash,program_id"},
            payload=payload,
            prefer="resolution=merge-duplicates,return=minimal",
        )
    except Exception as exc:
        log_event(logger, logging.WARNING, "recommend_cache_save_failed", error=str(exc))


async def _delete_user_recommendations(user_id: str) -> None:
    await _delete_cached_recommendations(user_id)


def _build_default_recommendation_items(
    programs: list[dict[str, Any]],
    *,
    top_k: int,
    reason: str,
) -> list[ProgramRecommendItem]:
    scored_programs: list[dict[str, Any]] = []
    for program in programs:
        if _is_expired_program(program):
            continue
        urgency_score = programs_rag._urgency_score(program)
        scored_programs.append(
            _build_recommendation_program_record(
                program,
                relevance_score=0.0,
                urgency_score=urgency_score,
                final_score=_recalculate_final_score(0.0, urgency_score),
            )
        )

    scored_programs.sort(
        key=lambda program: (
            -float(program.get("final_score") or 0.0),
            _parse_program_deadline(program.get("deadline")) or date.max,
        )
    )

    return [
        ProgramRecommendItem(
            program_id=str(program.get("id") or ""),
            score=program.get("final_score"),
            relevance_score=program.get("relevance_score"),
            reason=reason,
            fit_keywords=[],
            program=ProgramListItem.model_validate(program),
        )
        for program in scored_programs[:top_k]
        if str(program.get("id") or "").strip()
    ]


async def _build_cached_recommendation_items(
    cached_rows: list[dict[str, Any]],
    *,
    top_k: int,
) -> list[ProgramRecommendItem]:
    program_ids = [
        str(row.get("program_id") or "").strip()
        for row in cached_rows
        if str(row.get("program_id") or "").strip()
    ]
    programs_by_id = await _fetch_programs_by_ids(program_ids)

    items: list[ProgramRecommendItem] = []
    for row in cached_rows:
        program_id = str(row.get("program_id") or "").strip()
        if not program_id:
            continue
        program = programs_by_id.get(program_id)
        if not program:
            continue

        cached_relevance_score = _coerce_score(row.get("relevance_score")) or 0.0
        cached_urgency_score = _coerce_score(row.get("urgency_score")) or 0.0
        cached_final_score = _recalculate_final_score(
            cached_relevance_score,
            cached_urgency_score,
        )
        program_record = _build_recommendation_program_record(
            program,
            similarity_score=_coerce_score(row.get("similarity_score")),
            relevance_score=cached_relevance_score,
            urgency_score=cached_urgency_score,
            final_score=cached_final_score,
        )
        if _is_expired_program(program_record):
            continue
        fit_keywords = [
            _clean_text(item)
            for item in (row.get("fit_keywords") or [])
            if _clean_text(item)
        ][:3]
        items.append(
            ProgramRecommendItem(
                program_id=program_id,
                score=cached_final_score,
                relevance_score=cached_relevance_score,
                reason=_clean_text(row.get("reason")) or "최근 생성된 추천 결과를 캐시에서 불러왔습니다.",
                fit_keywords=fit_keywords,
                program=ProgramListItem.model_validate(program_record),
            )
        )
        if len(items) >= top_k:
            break

    return items


async def _build_rule_recommendation_items(
    rule: Mapping[str, Any],
    *,
    top_k: int,
) -> list[ProgramRecommendItem]:
    program_ids = [
        _clean_text(program_id)
        for program_id in (rule.get("program_ids") or [])
        if _clean_text(program_id)
    ]
    programs_by_id = await _fetch_programs_by_ids(program_ids)
    fit_keywords = [
        _clean_text(item)
        for item in (rule.get("fit_keywords") or [])
        if _clean_text(item)
    ][:3]
    reason = _clean_text(rule.get("reason_template")) or "미리 정의된 추천 규칙에 맞는 프로그램입니다."

    items: list[ProgramRecommendItem] = []
    for index, program_id in enumerate(program_ids):
        program = programs_by_id.get(program_id)
        if not program:
            continue

        relevance_score = round(max(0.4, 1.0 - index * 0.05), 4)
        urgency_score = programs_rag._urgency_score(program)
        final_score = _recalculate_final_score(relevance_score, urgency_score)
        program_record = _build_recommendation_program_record(
            program,
            similarity_score=relevance_score,
            relevance_score=relevance_score,
            urgency_score=urgency_score,
            final_score=final_score,
        )
        if _is_expired_program(program_record):
            continue
        items.append(
            ProgramRecommendItem(
                program_id=program_id,
                score=final_score,
                relevance_score=relevance_score,
                reason=reason,
                fit_keywords=fit_keywords,
                program=ProgramListItem.model_validate(program_record),
            )
        )

    items.sort(
        key=lambda item: (
            -float(item.score or 0.0),
            _parse_program_deadline(item.program.deadline) or date.max,
        )
    )
    return items[:top_k]


def _build_default_calendar_items(
    programs: list[dict[str, Any]],
    *,
    top_k: int,
    reason: str,
) -> list[CalendarRecommendItem]:
    items: list[CalendarRecommendItem] = []
    for program in programs:
        program_id = str(program.get("id") or "").strip()
        if not program_id:
            continue
        urgency_score = programs_rag._urgency_score(program)
        item = _build_calendar_item(
            program_id=program_id,
            reason=reason,
            program=program,
            relevance_score=0.0,
            urgency_score=urgency_score,
        )
        if item is not None:
            items.append(item)

    items.sort(key=_calendar_sort_key)
    return items[:top_k]


async def _count_program_rows(
    *,
    category: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
) -> int:
    params = _build_program_query_params(
        select="id,deadline,end_date,is_active,created_at",
        category=category,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        teaching_methods=teaching_methods,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
    )
    rows = await request_supabase(method="GET", path="/rest/v1/programs", params=params)
    if not isinstance(rows, list):
        return 0
    return len(
        _sort_program_list_rows(
            [_serialize_program_list_row(row) for row in rows],
            sort="deadline",
            include_closed_recent=include_closed_recent,
        )
    )


async def _fetch_profile_row(user_id: str) -> dict[str, Any]:
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/profiles",
        params={
            "select": "*",
            "id": f"eq.{user_id}",
            "limit": "1",
        },
    )
    if isinstance(rows, list) and rows:
        return dict(rows[0])
    return {}


async def _fetch_activity_rows(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/activities",
        params={
            "select": "id,title,role,description,skills,period,type",
            "user_id": f"eq.{user_id}",
            "is_visible": "eq.true",
            "order": "updated_at.desc",
            "limit": str(limit),
        },
    )
    return rows if isinstance(rows, list) else []


def _normalize_text_tokens(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        source = " ".join(str(item).strip() for item in value if str(item).strip())
    else:
        source = str(value).strip()
    return programs_rag._tokenize_text(source)


def _normalize_text_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    if not text:
        return []
    return [item.strip() for item in text.split(",") if item.strip()]


def _first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value not in (None, "", [], {}) and not isinstance(value, (dict, list)):
            return str(value).strip()
    return None


def _int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    text = "".join(ch for ch in str(value) if ch.isdigit() or ch == "-")
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _compact_text_list(*values: Any) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for value in values:
        for item in _normalize_text_list(value):
            if item not in seen:
                seen.add(item)
                items.append(item)
    return items


def _format_detail_schedule_text(
    *,
    application_start_date: str | None,
    application_end_date: str | None,
    program_start_date: str | None,
    program_end_date: str | None,
) -> str | None:
    if application_start_date or application_end_date:
        start = application_start_date or "시작일 미정"
        end = application_end_date or "마감일 미정"
        return f"신청 {start} ~ {end}"
    if program_start_date or program_end_date:
        start = program_start_date or "시작일 미정"
        end = program_end_date or "종료일 미정"
        return f"운영 {start} ~ {end}"
    return None


def _build_program_detail_response(program: dict[str, Any]) -> ProgramDetailResponse:
    compare_meta = program.get("compare_meta") if isinstance(program.get("compare_meta"), dict) else {}
    source = str(program.get("source") or "").casefold()
    is_kstartup = "k-startup" in source or "kstartup" in source
    is_work24 = "고용24" in source or "work24" in source

    application_start_date = _first_text(program.get("reg_start_date"))
    application_end_date = _first_text(program.get("close_date"), program.get("deadline"))
    program_start_date = _first_text(program.get("start_date"))
    program_end_date = _first_text(program.get("end_date"))
    if is_kstartup:
        application_start_date = _first_text(program.get("start_date"), program.get("reg_start_date"))
        application_end_date = _first_text(program.get("end_date"), program.get("deadline"), program.get("close_date"))
        program_start_date = None
        program_end_date = None
    elif is_work24:
        application_start_date = _first_text(program.get("reg_start_date"))
        application_end_date = _first_text(program.get("close_date"))
        program_start_date = _first_text(program.get("start_date"))
        program_end_date = _first_text(program.get("end_date"))

    capacity_total = _int_or_none(compare_meta.get("capacity"))
    registered_count = _int_or_none(compare_meta.get("registered_count"))
    capacity_remaining = None
    if capacity_total is not None and registered_count is not None:
        capacity_remaining = max(0, capacity_total - registered_count)

    certification = _first_text(compare_meta.get("certificate"))
    rating_raw = _first_text(compare_meta.get("satisfaction_score"))
    rating_fields = _normalize_rating_fields(rating_raw)
    return ProgramDetailResponse(
        id=program.get("id"),
        title=_first_text(program.get("title")),
        provider=_first_text(program.get("provider")),
        organizer=_first_text(program.get("sponsor_name"), compare_meta.get("supervising_institution"), compare_meta.get("department")),
        location=_first_text(program.get("location"), program.get("region_detail"), program.get("region")),
        description=_first_text(program.get("description"), program.get("summary")),
        application_start_date=application_start_date,
        application_end_date=application_end_date,
        program_start_date=program_start_date,
        program_end_date=program_end_date,
        teaching_method=_first_text(program.get("teaching_method"), compare_meta.get("teaching_method")),
        support_type=_first_text(program.get("support_type"), compare_meta.get("business_type"), compare_meta.get("subsidy_rate")),
        source_url=_first_text(program.get("application_url"), compare_meta.get("application_url"), program.get("source_url"), program.get("link")),
        fee=_int_or_none(program.get("cost")),
        support_amount=_int_or_none(program.get("subsidy_amount")),
        eligibility=_compact_text_list(program.get("target"), compare_meta.get("target_group"), compare_meta.get("target_detail"), compare_meta.get("target_age")),
        schedule_text=_format_detail_schedule_text(
            application_start_date=application_start_date,
            application_end_date=application_end_date,
            program_start_date=program_start_date,
            program_end_date=program_end_date,
        ),
        rating=rating_fields["rating_display"],
        rating_raw=rating_fields["rating_raw"],
        rating_normalized=rating_fields["rating_normalized"],
        rating_scale=rating_fields["rating_scale"],
        rating_display=rating_fields["rating_display"],
        job_placement_rate=_first_text(compare_meta.get("employment_rate_6m"), compare_meta.get("employment_rate_3m")),
        capacity_total=capacity_total,
        capacity_remaining=capacity_remaining,
        manager_name=_first_text(compare_meta.get("manager_name"), compare_meta.get("department")),
        phone=_first_text(compare_meta.get("contact_phone")),
        email=_first_text(compare_meta.get("application_method_email")),
        certifications=[certification] if certification else [],
        tech_stack=_compact_text_list(program.get("skills")),
        tags=_compact_text_list(program.get("tags")),
    )


def _has_meaningful_profile_text(profile: dict[str, Any]) -> bool:
    for key in ("self_intro", "bio"):
        value = profile.get(key)
        if isinstance(value, str) and len(value.strip()) >= 20:
            return True

    career_items = _normalize_text_list(profile.get("career"))
    return any(len(item.strip()) >= 8 for item in career_items)


def _derive_fit_label(
    *,
    relevance_score: float,
    skill_match_score: float,
) -> Literal["높음", "보통", "낮음"]:
    if relevance_score >= 0.7 and skill_match_score >= 0.5:
        return "높음"
    if relevance_score >= 0.4 or skill_match_score >= 0.3:
        return "보통"
    return "낮음"


def _derive_readiness_label(
    *,
    fit_label: Literal["높음", "보통", "낮음"],
    matched_skills_count: int,
) -> Literal["바로 지원 추천", "보완 후 지원", "탐색용 확인"]:
    if fit_label == "높음" and matched_skills_count >= 2:
        return "바로 지원 추천"
    if fit_label == "낮음":
        return "탐색용 확인"
    return "보완 후 지원"


def _build_gap_tags(
    *,
    profile: dict[str, Any],
    activities: list[dict[str, Any]],
    matched_skills: list[str],
    relevance_score: float,
) -> list[str]:
    gap_tags: list[str] = []

    if not _normalize_text_list(profile.get("skills")):
        gap_tags.append("프로필 기술 정보 부족")
    if len(activities) < 1:
        gap_tags.append("활동 근거 부족")
    if not matched_skills:
        gap_tags.append("기술 스택 근거 부족")
    if relevance_score < 0.4:
        gap_tags.append("직무 연관성 근거 부족")
    if not _has_meaningful_profile_text(profile):
        gap_tags.append("프로필 정보 보강 필요")

    return gap_tags[:3]


def _build_fit_summary(
    *,
    fit_label: Literal["높음", "보통", "낮음"],
    gap_tags: list[str],
) -> str:
    if fit_label == "높음":
        base = "보유 기술과 활동 이력이 프로그램 내용과 전반적으로 잘 맞습니다."
    elif fit_label == "보통":
        base = "일부 기술과 경험은 맞지만, 지원 전에 근거를 조금 더 보강하는 편이 좋습니다."
    else:
        base = "현재 프로필 정보만으로는 프로그램과의 직접 연관성이 충분히 확인되지 않습니다."

    if gap_tags:
        return f"{base} {gap_tags[0]}."
    return base


def _compute_program_relevance_items(
    *,
    profile: dict[str, Any],
    activities: list[dict[str, Any]],
    programs_by_id: dict[str, dict[str, Any]],
    program_ids: list[str],
) -> list[ProgramRelevanceItem]:
    profile_keywords = programs_rag._profile_keywords(profile, activities)
    raw_profile_skills = _normalize_text_list(profile.get("skills"))
    skill_tokens = {
        skill: set(programs_rag._tokenize_text(skill))
        for skill in raw_profile_skills
        if programs_rag._tokenize_text(skill)
    }

    items: list[ProgramRelevanceItem] = []
    for program_id in program_ids:
        program = programs_by_id.get(program_id)
        if not program:
            continue

        matched_keywords, relevance_score = programs_rag._program_match_context(program, profile_keywords)
        program_token_set = set(
            _normalize_text_tokens(program.get("title"))
            + _normalize_text_tokens(program.get("name"))
            + _normalize_text_tokens(program.get("skills"))
            + _normalize_text_tokens(program.get("summary"))
            + _normalize_text_tokens(program.get("description"))
        )
        matched_skills = [
            skill
            for skill, tokens in skill_tokens.items()
            if tokens and program_token_set.intersection(tokens)
        ][:5]
        skill_match_score = (
            min(1.0, len(matched_skills) / max(1, min(len(skill_tokens), 5)))
            if skill_tokens
            else 0.0
        )
        normalized_matched_skills = matched_skills or matched_keywords[:5]
        rounded_relevance_score = round(relevance_score, 4)
        rounded_skill_match_score = round(skill_match_score, 4)
        fit_label = _derive_fit_label(
            relevance_score=rounded_relevance_score,
            skill_match_score=rounded_skill_match_score,
        )
        gap_tags = _build_gap_tags(
            profile=profile,
            activities=activities,
            matched_skills=normalized_matched_skills,
            relevance_score=rounded_relevance_score,
        )
        items.append(
            ProgramRelevanceItem(
                program_id=program_id,
                relevance_score=rounded_relevance_score,
                skill_match_score=rounded_skill_match_score,
                matched_skills=normalized_matched_skills,
                fit_label=fit_label,
                fit_summary=_build_fit_summary(fit_label=fit_label, gap_tags=gap_tags),
                readiness_label=_derive_readiness_label(
                    fit_label=fit_label,
                    matched_skills_count=len(normalized_matched_skills),
                ),
                gap_tags=gap_tags,
            )
        )

    return items


@programs_router.get("/")
async def list_programs(
    category: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = Query(default=None),
    teaching_methods: list[str] | None = Query(default=None),
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
    sort: str = Query(default="deadline"),
    limit: int = Query(default=20, ge=1),
    offset: int = Query(default=0, ge=0),
) -> Any:
    params = _build_program_query_params(
        select="*",
        category=category,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        teaching_methods=teaching_methods,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=sort,
    )
    rows = await request_supabase(method="GET", path="/rest/v1/programs", params=params)
    if not isinstance(rows, list):
        return []
    return _postprocess_program_list_rows(
        rows,
        sort=sort,
        include_closed_recent=include_closed_recent,
        limit=limit,
        offset=offset,
    )


@programs_router.get("/count", response_model=ProgramCountResponse)
async def count_programs(
    category: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = Query(default=None),
    teaching_methods: list[str] | None = Query(default=None),
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
) -> ProgramCountResponse:
    count = await _count_program_rows(
        category=category,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        teaching_methods=teaching_methods,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
    )
    return ProgramCountResponse(count=count)


@programs_router.get("/popular")
async def list_popular_programs() -> Any:
    return await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": "*",
            "is_ad": "eq.false",
            "order": "deadline.asc.nullslast",
            "limit": "10",
        },
    )


@programs_router.get("/{program_id}/detail", response_model=ProgramDetailResponse)
async def get_program_detail(program_id: str) -> ProgramDetailResponse:
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": "*",
            "id": f"eq.{program_id}",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Program not found")
    return _build_program_detail_response(dict(rows[0]))


@programs_router.get("/{program_id}")
async def get_program(program_id: str) -> Any:
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": "*",
            "id": f"eq.{program_id}",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Program not found")
    return rows[0]


@programs_router.post("/recommend", response_model=ProgramRecommendResponse)
async def recommend_programs(
    payload: ProgramRecommendRequest,
    authorization: str | None = Header(default=None),
) -> ProgramRecommendResponse:
    programs = await _fetch_program_rows(
        limit=max(payload.top_k * 10, 50),
        category=payload.category,
        region=payload.region,
    )
    if not programs:
        return ProgramRecommendResponse(items=[])

    if not authorization:
        return ProgramRecommendResponse(
            items=_build_default_recommendation_items(
                programs,
                top_k=payload.top_k,
                reason="최근 마감 일정과 공개 정보 기준으로 우선 노출한 프로그램입니다.",
            )
        )

    current_user = await get_current_user_from_authorization(authorization)
    profile = await _fetch_profile_row(current_user.id)
    if payload.job_title:
        profile = dict(profile)
        profile["job_title"] = payload.job_title
    activities = await _fetch_activity_rows(current_user.id)
    profile_hash = _build_profile_hash(profile, activities)
    query_hash = _build_query_hash(payload)

    if payload.force_refresh:
        await _delete_cached_recommendations(current_user.id, query_hash=query_hash)
    else:
        rule = await _load_recommendation_rule(_build_condition_key_candidates(payload))
        if rule:
            rule_items = await _build_rule_recommendation_items(rule, top_k=payload.top_k)
            if rule_items:
                log_event(
                    logger,
                    logging.INFO,
                    "recommend_rule_hit",
                    user_id=current_user.id,
                    condition_key=_clean_text(rule.get("condition_key")),
                    item_count=len(rule_items),
                )
                return ProgramRecommendResponse(items=rule_items)

        cached_rows = await _load_cached_recommendations(
            current_user.id,
            profile_hash=profile_hash,
            query_hash=query_hash,
            limit=max(payload.top_k * 2, 20),
        )
        if cached_rows:
            normalized_cached_rows = _normalize_cached_recommendation_rows(cached_rows)
            if normalized_cached_rows:
                cached_items = await _build_cached_recommendation_items(
                    normalized_cached_rows,
                    top_k=payload.top_k,
                )
                if cached_items:
                    log_event(
                        logger,
                        logging.INFO,
                        "recommend_cache_hit",
                        user_id=current_user.id,
                        query_hash=query_hash[:12],
                        profile_hash=profile_hash[:12],
                        item_count=len(cached_items),
                    )
                    return ProgramRecommendResponse(items=cached_items)
            else:
                log_event(
                    logger,
                    logging.INFO,
                    "recommend_cache_stale_recompute",
                    user_id=current_user.id,
                    query_hash=query_hash[:12],
                )

    if not _has_personalization_input(profile, activities):
        log_event(
            logger,
            logging.INFO,
            "recommend_profile_fallback",
            user_id=current_user.id,
            query_hash=query_hash[:12],
        )
        return ProgramRecommendResponse(
            items=_build_default_recommendation_items(
                programs,
                top_k=payload.top_k,
                reason="프로필 기반 추천 데이터가 충분하지 않아 기본 프로그램 목록을 보여줍니다.",
            )
        )

    recommendations = await programs_rag.recommend(
        profile=profile,
        activities=activities,
        programs=programs,
        top_k=payload.top_k,
        category=payload.category,
        region=payload.region,
    )

    if not recommendations:
        return ProgramRecommendResponse(
            items=_build_default_recommendation_items(
                programs,
                top_k=payload.top_k,
                reason="프로필 기반 추천 데이터가 충분하지 않아 기본 프로그램 목록을 보여줍니다.",
            )
        )

    await _save_recommendations(
        current_user.id,
        recommendations,
        profile_hash=profile_hash,
        query_hash=query_hash,
    )

    return ProgramRecommendResponse(
        items=[_serialize_program_recommendation(item) for item in recommendations]
    )


@programs_router.get("/recommend/calendar", response_model=CalendarRecommendResponse)
async def recommend_programs_calendar(
    authorization: str | None = Header(default=None),
    top_k: int = Query(default=9, ge=1, le=20),
    category: str | None = None,
    region: str | None = None,
    force_refresh: bool = False,
) -> CalendarRecommendResponse:
    programs = await _fetch_program_rows(
        limit=max(top_k * 10, 50),
        category=category,
        region=region,
    )
    if not programs:
        return CalendarRecommendResponse(items=[])

    if not authorization:
        return CalendarRecommendResponse(
            items=_build_default_calendar_items(
                programs,
                top_k=top_k,
                reason="최근 마감 일정과 공개 정보 기준으로 우선 노출한 프로그램입니다.",
            )
        )

    current_user = await get_current_user_from_authorization(authorization)
    profile = await _fetch_profile_row(current_user.id)
    activities = await _fetch_activity_rows(current_user.id)
    request_payload = ProgramRecommendRequest(
        top_k=top_k,
        category=category,
        region=region,
        force_refresh=force_refresh,
    )
    profile_hash = _build_profile_hash(profile, activities)
    query_hash = _build_query_hash(request_payload)

    if force_refresh:
        await _delete_cached_recommendations(current_user.id, query_hash=query_hash)
    else:
        cached_rows = await _load_cached_recommendations(
            current_user.id,
            profile_hash=profile_hash,
            query_hash=query_hash,
            limit=max(top_k * 2, 20),
        )
        if cached_rows:
            normalized_cached_rows = _normalize_cached_recommendation_rows(cached_rows)
            if normalized_cached_rows:
                cached_items = await _build_cached_recommendation_items(
                    normalized_cached_rows,
                    top_k=top_k,
                )
                if cached_items:
                    return CalendarRecommendResponse(
                        items=_build_calendar_items_from_recommendations(cached_items, top_k=top_k)
                    )
            else:
                log_event(
                    logger,
                    logging.INFO,
                    "recommend_calendar_cache_stale_recompute",
                    user_id=current_user.id,
                    query_hash=query_hash[:12],
                )

    if not _has_personalization_input(profile, activities):
        return CalendarRecommendResponse(
            items=_build_default_calendar_items(
                programs,
                top_k=top_k,
                reason="프로필 기반 추천 데이터가 충분하지 않아 기본 프로그램 목록을 보여줍니다.",
            )
        )

    recommendations = await programs_rag.recommend(
        profile=profile,
        activities=activities,
        programs=programs,
        top_k=top_k,
        category=category,
        region=region,
    )

    if not recommendations:
        return CalendarRecommendResponse(
            items=_build_default_calendar_items(
                programs,
                top_k=top_k,
                reason="프로필 기반 추천 데이터가 충분하지 않아 기본 프로그램 목록을 보여줍니다.",
            )
        )

    await _save_recommendations(
        current_user.id,
        recommendations,
        profile_hash=profile_hash,
        query_hash=query_hash,
    )

    return CalendarRecommendResponse(
        items=_build_calendar_items_from_recommendations(
            [_serialize_program_recommendation(item) for item in recommendations],
            top_k=top_k,
        )
    )


@programs_router.post("/compare-relevance", response_model=ProgramCompareRelevanceResponse)
async def compare_program_relevance(
    payload: ProgramCompareRelevanceRequest,
    authorization: str | None = Header(default=None),
) -> ProgramCompareRelevanceResponse:
    if not authorization:
        raise HTTPException(status_code=401, detail="로그인 후 관련도를 확인할 수 있습니다.")

    deduped_program_ids: list[str] = []
    seen_program_ids: set[str] = set()
    for program_id in payload.program_ids:
        normalized = str(program_id or "").strip()
        if not normalized or normalized in seen_program_ids:
            continue
        seen_program_ids.add(normalized)
        deduped_program_ids.append(normalized)

    if not deduped_program_ids:
        return ProgramCompareRelevanceResponse(items=[])

    current_user = await get_current_user_from_authorization(authorization)
    profile = await _fetch_profile_row(current_user.id)
    activities = await _fetch_activity_rows(current_user.id)
    programs_by_id = await _fetch_programs_by_ids(deduped_program_ids)

    return ProgramCompareRelevanceResponse(
        items=_compute_program_relevance_items(
            profile=profile,
            activities=activities,
            programs_by_id=programs_by_id,
            program_ids=deduped_program_ids,
        )
    )


@programs_router.post("/sync")
async def sync_programs(background_tasks: BackgroundTasks) -> dict[str, str]:
    background_tasks.add_task(run_all_collectors)
    return {"message": "동기화 시작됨", "status": "running"}
