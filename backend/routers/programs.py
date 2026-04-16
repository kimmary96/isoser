from datetime import datetime, timedelta, timezone
import logging
from typing import Any

import httpx
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
    build_service_headers,
    get_current_user_from_authorization,
    get_supabase_admin_settings,
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


class ProgramCompareRelevanceRequest(BaseModel):
    program_ids: list[str] = Field(default_factory=list)


class ProgramRelevanceItem(BaseModel):
    program_id: str
    relevance_score: float
    skill_match_score: float
    matched_skills: list[str] = Field(default_factory=list)


class ProgramCompareRelevanceResponse(BaseModel):
    items: list[ProgramRelevanceItem] = Field(default_factory=list)


class ProgramCountResponse(BaseModel):
    count: int


def _serialize_program_recommendation(item: ProgramRecommendation) -> ProgramRecommendItem:
    return ProgramRecommendItem(
        program_id=item.program_id,
        score=item.score,
        relevance_score=item.relevance_score,
        reason=item.reason,
        fit_keywords=item.fit_keywords,
        program=ProgramListItem.model_validate(item.program),
    )


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
    if recruiting_only or effective_sort == "deadline":
        params["is_active"] = "eq.true"
    normalized_teaching_methods = _normalize_teaching_methods_param(teaching_methods)
    if normalized_teaching_methods:
        quoted_values = ",".join(f'"{value}"' for value in normalized_teaching_methods)
        params["teaching_method"] = f"in.({quoted_values})"

    normalized_regions = _expand_region_keywords(_normalize_regions_param(regions))
    if normalized_regions:
        params["or"] = "(" + ",".join(f"location.ilike.*{keyword}*" for keyword in normalized_regions) + ")"

    return params


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


async def _load_cached_recommendations(user_id: str) -> list[dict[str, Any]] | None:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=RECOMMEND_CACHE_TTL_HOURS)).isoformat()
    try:
        rows = await request_supabase(
            method="GET",
            path="/rest/v1/recommendations",
            params={
                "select": "program_id,similarity_score,relevance_score,urgency_score,final_score,generated_at",
                "user_id": f"eq.{user_id}",
                "generated_at": f"gte.{cutoff}",
                "order": "final_score.desc",
                "limit": "20",
            },
        )
    except Exception as exc:
        log_event(logger, logging.WARNING, "recommend_cache_load_failed", error=str(exc))
        return None
    return rows if isinstance(rows, list) and rows else None


async def _save_recommendations(
    user_id: str,
    recommendations: list[ProgramRecommendation],
) -> None:
    if not recommendations:
        return

    now = datetime.now(timezone.utc).isoformat()
    payload = []
    for item in recommendations:
        if not item.program_id:
            continue
        payload.append(
            {
                "user_id": user_id,
                "program_id": item.program_id,
                "similarity_score": float(item.program.get("similarity_score") or 0),
                "relevance_score": float(item.program.get("relevance_score") or item.relevance_score or 0),
                "urgency_score": float(item.program.get("urgency_score") or 0),
                "final_score": float(item.score or 0),
                "generated_at": now,
            }
        )

    if not payload:
        return

    try:
        await request_supabase(
            method="POST",
            path="/rest/v1/recommendations",
            params={"on_conflict": "user_id,program_id"},
            payload=payload,
            prefer="resolution=merge-duplicates,return=minimal",
        )
    except Exception as exc:
        log_event(logger, logging.WARNING, "recommend_cache_save_failed", error=str(exc))


async def _delete_user_recommendations(user_id: str) -> None:
    try:
        await request_supabase(
            method="DELETE",
            path="/rest/v1/recommendations",
            params={"user_id": f"eq.{user_id}"},
        )
    except Exception as exc:
        log_event(logger, logging.WARNING, "recommend_cache_delete_failed", error=str(exc))


def _build_default_recommendation_items(
    programs: list[dict[str, Any]],
    *,
    top_k: int,
    reason: str,
) -> list[ProgramRecommendItem]:
    return [
        ProgramRecommendItem(
            program_id=str(program.get("id") or ""),
            score=program.get("final_score"),
            relevance_score=program.get("relevance_score"),
            reason=reason,
            fit_keywords=[],
            program=ProgramListItem.model_validate(program),
        )
        for program in programs[:top_k]
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

        program_record = dict(program)
        cached_relevance_score = row.get("relevance_score")
        if cached_relevance_score is None:
            cached_relevance_score = row.get("final_score")
        program_record["similarity_score"] = row.get("similarity_score")
        program_record["relevance_score"] = cached_relevance_score
        program_record["urgency_score"] = row.get("urgency_score")
        program_record["final_score"] = row.get("final_score")
        items.append(
            ProgramRecommendItem(
                program_id=program_id,
                score=float(row.get("final_score") or 0),
                relevance_score=float(cached_relevance_score or 0),
                reason="최근 생성된 추천 결과를 캐시에서 불러왔습니다.",
                fit_keywords=[],
                program=ProgramListItem.model_validate(program_record),
            )
        )
        if len(items) >= top_k:
            break

    return items


async def _count_program_rows(
    *,
    category: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    recruiting_only: bool = False,
) -> int:
    settings = get_supabase_admin_settings()
    params = _build_program_query_params(
        select="id",
        category=category,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        teaching_methods=teaching_methods,
        recruiting_only=recruiting_only,
        limit=1,
        offset=0,
    )

    async with httpx.AsyncClient(timeout=settings.timeout_seconds, trust_env=False) as client:
        response = await client.get(
            f"{settings.url}/rest/v1/programs",
            params=params,
            headers=build_service_headers(settings.service_role_key, prefer="count=exact"),
        )

    if not response.is_success:
        detail = response.text
        try:
            body = response.json()
        except ValueError:
            body = None
        if isinstance(body, dict):
            detail = str(body.get("message") or body.get("hint") or body.get("details") or detail)
        raise HTTPException(status_code=500, detail=f"Supabase request failed: {detail}")

    return _parse_content_range_total(response.headers.get("content-range"))


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
        # Prefer explicit skill matches for compare UI, then fall back to weighted keyword matches.
        normalized_matched_skills = matched_skills or matched_keywords[:5]
        items.append(
            ProgramRelevanceItem(
                program_id=program_id,
                relevance_score=round(relevance_score, 4),
                skill_match_score=round(skill_match_score, 4),
                matched_skills=normalized_matched_skills,
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
        sort=sort,
        limit=limit,
        offset=offset,
    )

    return await request_supabase(method="GET", path="/rest/v1/programs", params=params)


@programs_router.get("/count", response_model=ProgramCountResponse)
async def count_programs(
    category: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = Query(default=None),
    teaching_methods: list[str] | None = Query(default=None),
    recruiting_only: bool = False,
) -> ProgramCountResponse:
    count = await _count_program_rows(
        category=category,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        teaching_methods=teaching_methods,
        recruiting_only=recruiting_only,
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
        return ProgramRecommendResponse(items=_build_default_recommendation_items(
            programs,
            top_k=payload.top_k,
            reason="최근 마감 일정과 공개 정보 기준으로 우선 노출한 프로그램입니다.",
        ))

    current_user = await get_current_user_from_authorization(authorization)
    use_cache = (
        not payload.force_refresh
        and not payload.category
        and not payload.region
        and not payload.job_title
    )

    if use_cache:
        cached_rows = await _load_cached_recommendations(current_user.id)
        if cached_rows:
            cached_items = await _build_cached_recommendation_items(
                cached_rows,
                top_k=payload.top_k,
            )
            if cached_items:
                return ProgramRecommendResponse(items=cached_items)

    if payload.force_refresh and not payload.category and not payload.region and not payload.job_title:
        await _delete_user_recommendations(current_user.id)

    profile = await _fetch_profile_row(current_user.id)
    if payload.job_title:
        profile = dict(profile)
        profile["job_title"] = payload.job_title
    activities = await _fetch_activity_rows(current_user.id)
    recommendations = await programs_rag.recommend(
        profile=profile,
        activities=activities,
        programs=programs,
        top_k=payload.top_k,
        category=payload.category,
        region=payload.region,
    )

    if not recommendations:
        return ProgramRecommendResponse(items=_build_default_recommendation_items(
            programs,
            top_k=payload.top_k,
            reason="프로필 기반 추천 데이터가 충분하지 않아 기본 프로그램 목록을 보여줍니다.",
        ))

    if not payload.category and not payload.region and not payload.job_title:
        await _save_recommendations(current_user.id, recommendations)

    return ProgramRecommendResponse(
        items=[_serialize_program_recommendation(item) for item in recommendations]
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
