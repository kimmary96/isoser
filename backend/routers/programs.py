from __future__ import annotations

import base64
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import logging
import os
import re
import time
from typing import Any, Literal, Mapping, Sequence
from uuid import UUID

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
    from backend.services.program_list_scoring import compute_recommended_score
except ImportError:
    from services.program_list_scoring import compute_recommended_score

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

PROGRAM_DEADLINE_SORTS = {"default", "deadline"}
PROGRAM_COMPUTED_SORTS = {"start_soon", "cost_low", "cost_high", "duration_short", "duration_long"}
PROGRAM_POPULAR_SORTS = {"popular"}
PROGRAM_SORT_OPTIONS = PROGRAM_DEADLINE_SORTS | PROGRAM_COMPUTED_SORTS | PROGRAM_POPULAR_SORTS | {"latest"}
PROGRAM_TEACHING_METHODS = {"온라인", "오프라인", "혼합"}
PROGRAM_COST_TYPES = {"naeil-card", "free-no-card", "paid"}
PROGRAM_PARTICIPATION_TIMES = {"part-time", "full-time"}
PROGRAM_TARGETS = {"청년", "여성", "중장년", "창업", "재직자", "구직자", "대학생"}
PROGRAM_SELECTION_PROCESSES = {"서류", "면접", "테스트", "선착순", "추첨"}
PROGRAM_EMPLOYMENT_LINKS = {"채용연계", "인턴십", "취업지원", "멘토링"}
PROGRAM_CATEGORY_LABELS: dict[str, str] = {
    "web-development": "웹 풀스택",
    "mobile": "프론트엔드",
    "data-ai": "AI서비스",
    "cloud-security": "클라우드",
    "iot-embedded-semiconductor": "반도체",
    "game-blockchain": "기타",
    "planning-marketing-other": "PM/기획",
    "design-3d": "UX/UI/디자인",
    "project-career-startup": "PM/기획",
}
PROGRAM_CATEGORY_SEARCH_ALIASES: dict[str, tuple[str, ...]] = {
    "web-development": ("웹개발", "웹 개발", "웹 풀스택", "fullstack"),
    "mobile": ("모바일", "앱", "프론트엔드"),
    "data-ai": ("ai", "데이터", "데이터AI", "데이터 AI", "AI서비스", "인공지능", "llm", "rag"),
    "cloud-security": ("클라우드", "보안", "클라우드보안"),
    "iot-embedded-semiconductor": ("IoT", "임베디드", "반도체"),
    "game-blockchain": ("게임", "블록체인"),
    "planning-marketing-other": ("기획", "마케팅", "PM", "기타"),
    "design-3d": ("디자인", "3D", "UX", "UI"),
    "project-career-startup": ("프로젝트", "취준", "창업", "스타트업"),
}
PROGRAM_CATEGORY_PARENT_CATEGORIES: dict[str, str] = {
    "web-development": "IT",
    "mobile": "IT",
    "data-ai": "AI",
    "cloud-security": "IT",
    "iot-embedded-semiconductor": "IT",
    "game-blockchain": "IT",
    "planning-marketing-other": "경영",
    "design-3d": "디자인",
    "project-career-startup": "창업",
}
PROGRAM_CATEGORY_DETAIL_DISPLAY_MATCHES: dict[str, tuple[str, ...]] = {
    "web-development": ("웹 풀스택", "백엔드", "프론트엔드"),
    "mobile": ("프론트엔드",),
    "data-ai": ("AI서비스", "AI역량강화", "데이터분석", "데이터엔지니어링"),
    "cloud-security": ("클라우드", "보안", "인프라"),
    "iot-embedded-semiconductor": ("반도체", "임베디드"),
    "game-blockchain": ("게임", "블록체인"),
    "planning-marketing-other": ("PM/기획",),
    "design-3d": ("UX/UI/디자인",),
    "project-career-startup": ("PM/기획",),
}
PROGRAM_CATEGORY_DETAIL_BROAD_FALLBACKS: dict[str, tuple[str, ...]] = {
    "data-ai": ("AI",),
    "planning-marketing-other": ("경영",),
    "design-3d": ("디자인",),
    "project-career-startup": ("창업",),
}
PROGRAM_CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("AI서비스", ("ai", "인공지능", "llm", "rag", "생성형", "챗봇", "머신러닝", "딥러닝", "mcp")),
    ("AI역량강화", ("ai 활용", "ai 역량", "프롬프트", "업무자동화", "노코드", "로우코드")),
    ("웹 풀스택", ("풀스택", "fullstack", "웹개발", "웹 개발", "spring", "django", "react", "next.js", "node")),
    ("백엔드", ("백엔드", "backend", "java", "spring", "api", "서버", "restapi")),
    ("프론트엔드", ("프론트엔드", "frontend", "react", "vue", "next.js", "javascript", "typescript", "모바일", "앱")),
    ("데이터분석", ("데이터분석", "데이터 분석", "시각화", "bi", "sql", "통계", "pandas")),
    ("데이터엔지니어링", ("데이터엔지니어링", "데이터 엔지니어링", "데이터 파이프라인", "etl", "spark", "airflow", "db")),
    ("UX/UI/디자인", ("ux", "ui", "uxui", "디자인", "figma", "피그마", "와이어프레임", "프로토타입")),
    ("PM/기획", ("pm", "기획", "서비스기획", "프로덕트", "마케팅", "사업계획", "창업")),
    ("클라우드", ("클라우드", "aws", "azure", "gcp", "devops", "쿠버네티스", "kubernetes", "docker")),
    ("반도체", ("반도체", "fpga", "soc", "rtl", "verilog", "회로", "반도체설계")),
    ("임베디드", ("임베디드", "iot", "arm", "펌웨어", "라즈베리", "아두이노")),
    ("보안", ("정보보안", "보안 실무", "보안 엔지니어", "클라우드 보안", "사이버보안", "security", "해킹", "모의해킹", "침해대응", "침해 사고", "정보보호")),
    ("인프라", ("인프라", "네트워크 인프라", "네트워크 관리", "네트워크 엔지니어", "linux", "리눅스", "ccna", "서버관리")),
)
PROGRAM_KEYWORD_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("AI", ("ai", "인공지능")),
    ("Python", ("python", "파이썬")),
    ("Java", ("java", "자바")),
    ("JavaScript", ("javascript", "자바스크립트")),
    ("TypeScript", ("typescript", "타입스크립트")),
    ("React", ("react", "리액트")),
    ("Next.js", ("next.js", "nextjs")),
    ("FastAPI", ("fastapi",)),
    ("Spring", ("spring", "스프링")),
    ("SQL", ("sql",)),
    ("DB", ("db", "database", "데이터베이스")),
    ("데이터분석", ("데이터분석", "데이터 분석")),
    ("머신러닝", ("머신러닝", "machine learning", "ml")),
    ("딥러닝", ("딥러닝", "deep learning")),
    ("RAG", ("rag",)),
    ("LLM", ("llm", "대규모 언어모델")),
    ("MCP", ("mcp",)),
    ("ChatGPT", ("chatgpt", "chat gpt")),
    ("Vibe Coding", ("vibe coding", "바이브코딩", "바이브 코딩")),
    ("PRD", ("prd",)),
    ("UXUI", ("ux/ui", "uxui", "ux ui")),
    ("UIUX", ("ui/ux", "uiux", "ui ux")),
    ("와이어프레임", ("와이어프레임", "wireframe")),
    ("Figma", ("figma", "피그마")),
    ("HTML5", ("html5",)),
    ("CSS3", ("css3",)),
    ("Bootstrap", ("bootstrap", "부트스트랩")),
    ("PremierePro", ("premierepro", "premiere pro", "프리미어 프로", "프리미어프로")),
    ("AfterEffect", ("aftereffect", "after effect", "애프터 이펙트", "에프터 이펙트", "에프터이펙트")),
    ("Blender", ("blender", "블렌더")),
    ("영상 편집", ("영상 편집", "영상편집")),
    ("클라우드", ("클라우드", "cloud")),
    ("AWS", ("aws",)),
    ("Docker", ("docker", "도커")),
    ("Kubernetes", ("kubernetes", "쿠버네티스", "k8s")),
    ("FPGA", ("fpga",)),
    ("SoC", ("soc",)),
    ("RTL", ("rtl",)),
    ("Verilog", ("verilog",)),
    ("반도체설계", ("반도체설계", "반도체 설계")),
    ("NVIDIA", ("nvidia", "엔비디아")),
    ("Jetson", ("jetson",)),
    ("Physical AI", ("physical ai",)),
    ("Sim-to-Real", ("sim-to-real", "sim to real")),
    ("OpenUSD", ("openusd",)),
    ("Omniverse", ("omniverse",)),
    ("Isaac Sim", ("isaac sim",)),
    ("CCNA", ("ccna",)),
    ("포트폴리오", ("포트폴리오", "portfolio")),
    ("면접", ("면접", "인터뷰")),
    ("현직자멘토링", ("현직자", "멘토링")),
    ("취업지원", ("취업지원", "취업 지원")),
    ("채용연계", ("채용연계", "채용 연계")),
)
PROGRAM_SEARCH_SCAN_LIMIT = 10000
PROGRAM_SEARCH_SCAN_PAGE_SIZE = 1000
PROGRAM_SEARCH_INDEX_COLUMN = "search_text"
PROGRAM_SHORT_ASCII_SEARCH_MAX_LENGTH = 2
PROGRAM_LIST_INDEX_TABLE = "program_list_index"
PROGRAM_LIST_FACET_TABLE = "program_list_facet_snapshots"
PROGRAM_BROWSE_POOL_LIMIT = 300
PROGRAM_PROMOTED_SLOT_LIMIT = 15
PROGRAM_LIST_SUMMARY_SELECT = (
    "id,title,provider,summary,category,category_detail,region,region_detail,location,"
    "teaching_method,cost,cost_type,participation_time,source,source_url,link,deadline,"
    "close_date,start_date,end_date,is_active,is_ad,display_categories,participation_mode_label,participation_time_text,"
    "selection_process_label,extracted_keywords,tags,skills,days_left,"
    "deadline_confidence,recommended_score,recommendation_reasons,detail_view_count,detail_view_count_7d,"
    "click_hotness_score,last_detail_viewed_at,promoted_rank,updated_at"
)
PROGRAM_DEFAULT_WORK24_TARGET_RATIO = 0.7
PROGRAM_STARTUP_FILTER_KEYWORDS = (
    "창업",
    "스타트업",
    "startup",
    "k-startup",
    "kstartup",
    "project-career-startup",
)
PROGRAM_SEARCHABLE_COMPARE_META_KEYS = {
    "address",
    "application_deadline",
    "application_end_date",
    "business_type",
    "certificate",
    "curriculum",
    "day_night",
    "day_night_type",
    "delivery_method",
    "employment_connection",
    "location",
    "ncs_code",
    "ncs_name",
    "region",
    "recruitment_deadline",
    "schedule_text",
    "selection_process",
    "target_detail",
    "target_group",
    "target_job",
    "teaching_method",
    "training_schedule",
    "training_institution",
    "training_time",
    "training_type",
    "weekend_text",
    "weekend_yn",
    "weekday_text",
}
PROGRAM_DEADLINE_COMPARE_META_KEYS = (
    "application_deadline",
    "application_end_date",
    "recruitment_deadline",
    "recruitment_end_date",
)
RECOMMEND_CACHE_TTL_HOURS = 24
REGION_QUERY_ALIASES: dict[str, tuple[str, ...]] = {
    "서울": ("서울",),
    "경기": ("경기",),
    "제주": ("제주",),
    "부산": ("부산",),
    "강원": ("강원",),
    "해외": ("해외", "국외", "글로벌", "global", "online"),
    "대구": ("대구",),
    "충북": ("충북", "충청북도"),
    "인천": ("인천",),
    "충남": ("충남", "충청남도"),
    "광주": ("광주",),
    "전북": ("전북", "전라북도"),
    "대전": ("대전",),
    "전남": ("전남", "전라남도"),
    "울산": ("울산",),
    "경북": ("경북", "경상북도"),
    "세종": ("세종",),
    "경남": ("경남", "경상남도"),
    "대전·충청": ("대전", "충청", "세종"),
    "대구·경북": ("대구", "경북"),
    "온라인": ("온라인", "비대면", "원격"),
}
REGION_ALIASES: dict[str, tuple[str, ...]] = {
    **REGION_QUERY_ALIASES,
    "서울": ("서울", "서울특별시", "서울시"),
    "경기": ("경기", "경기도"),
    "인천": ("인천", "인천광역시", "인천시"),
    "부산": ("부산", "부산광역시", "부산시"),
    "대구": ("대구", "대구광역시", "대구시"),
    "광주": ("광주", "광주광역시", "광주시"),
    "대전": ("대전", "대전광역시", "대전시"),
    "울산": ("울산", "울산광역시", "울산시"),
    "세종": ("세종", "세종특별자치시", "세종시"),
    "강원": ("강원", "강원도", "강원특별자치도"),
    "전북": ("전북", "전라북도", "전북특별자치도"),
    "제주": ("제주", "제주도", "제주특별자치도"),
}
REGION_GROUPS = (
    {"서울", "경기", "인천"},
    {"대전", "세종", "충북", "충남"},
    {"부산", "울산", "경남"},
    {"대구", "경북"},
    {"광주", "전북", "전남"},
)
ONLINE_KEYWORDS = ("온라인", "비대면", "원격")
HYBRID_KEYWORDS = ("혼합", "블렌디드", "온오프", "온·오프")
OFFLINE_KEYWORDS = ("오프라인", "대면", "현장")


class ProgramListItem(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str | int | None = None
    title: str | None = None
    category: str | None = None
    category_detail: str | None = None
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
    cost: int | str | None = None
    cost_type: str | None = None
    participation_time: str | None = None
    subsidy_amount: int | str | None = None
    support_type: str | None = None
    teaching_method: str | None = None
    is_certified: bool | None = None
    is_active: bool | None = None
    is_ad: bool | None = None
    rating_raw: str | None = None
    rating_normalized: float | None = None
    rating_scale: int | None = None
    rating_display: str | None = None
    display_categories: list[str] = Field(default_factory=list)
    participation_mode_label: str | None = None
    participation_time_text: str | None = None
    selection_process_label: str | None = None
    extracted_keywords: list[str] = Field(default_factory=list)
    relevance_score: float | None = None
    final_score: float | None = None
    urgency_score: float | None = None
    days_left: int | None = None
    deadline_confidence: Literal["high", "medium", "low"] | None = None
    recommended_score: float | None = None
    recommendation_reasons: list[str] = Field(default_factory=list)
    detail_view_count: int | None = None
    detail_view_count_7d: int | None = None
    click_hotness_score: float | None = None
    last_detail_viewed_at: str | None = None
    promoted_rank: int | None = None
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
    relevance_reasons: list[str] = Field(default_factory=list)
    score_breakdown: dict[str, int] = Field(default_factory=dict)
    relevance_grade: Literal["high", "medium", "low", "none"] = "none"
    relevance_badge: str | None = None
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
    fit_keywords: list[str] = Field(default_factory=list)
    relevance_reasons: list[str] = Field(default_factory=list)
    score_breakdown: dict[str, int] = Field(default_factory=dict)
    relevance_grade: Literal["high", "medium", "low", "none"] = "none"
    relevance_badge: str | None = None
    program: ProgramListItem


class CalendarRecommendResponse(BaseModel):
    items: list[CalendarRecommendItem] = Field(default_factory=list)


class ProgramCompareRelevanceRequest(BaseModel):
    program_ids: list[str] = Field(default_factory=list)


class ProgramDetailBatchRequest(BaseModel):
    program_ids: list[str] = Field(default_factory=list, max_length=20)


class ProgramBatchResponse(BaseModel):
    items: list[ProgramListItem] = Field(default_factory=list)


class ProgramFilterOption(BaseModel):
    value: str
    label: str


class ProgramFilterOptionsResponse(BaseModel):
    sources: list[ProgramFilterOption] = Field(default_factory=list)
    targets: list[ProgramFilterOption] = Field(default_factory=list)
    selection_processes: list[ProgramFilterOption] = Field(default_factory=list)
    employment_links: list[ProgramFilterOption] = Field(default_factory=list)


class ProgramRelevanceItem(BaseModel):
    program_id: str
    relevance_score: float
    skill_match_score: float
    region_match_score: float = 0.0
    matched_skills: list[str] = Field(default_factory=list)
    matched_regions: list[str] = Field(default_factory=list)
    relevance_reasons: list[str] = Field(default_factory=list)
    score_breakdown: dict[str, int] = Field(default_factory=dict)
    relevance_grade: Literal["high", "medium", "low", "none"] = "none"
    relevance_badge: str | None = None
    fit_label: Literal["높음", "보통", "낮음"]
    fit_summary: str
    readiness_label: Literal["바로 지원 추천", "보완 후 지원", "탐색용 확인"]
    gap_tags: list[str] = Field(default_factory=list)


class ProgramCompareRelevanceResponse(BaseModel):
    items: list[ProgramRelevanceItem] = Field(default_factory=list)


class ProgramCountResponse(BaseModel):
    count: int


class ProgramFacetBucket(BaseModel):
    value: str
    count: int


class ProgramFacetSnapshot(BaseModel):
    category: list[ProgramFacetBucket] = Field(default_factory=list)
    region: list[ProgramFacetBucket] = Field(default_factory=list)
    teaching_method: list[ProgramFacetBucket] = Field(default_factory=list)
    cost_type: list[ProgramFacetBucket] = Field(default_factory=list)
    participation_time: list[ProgramFacetBucket] = Field(default_factory=list)
    source: list[ProgramFacetBucket] = Field(default_factory=list)


class ProgramListPageResponse(BaseModel):
    promoted_items: list[ProgramListItem] = Field(default_factory=list)
    items: list[ProgramListItem] = Field(default_factory=list)
    next_cursor: str | None = None
    count: int | None = None
    mode: Literal["browse", "search", "archive"] = "browse"
    source: Literal["read_model", "legacy"] = "legacy"
    cache_hit: bool = False
    facets: ProgramFacetSnapshot | None = None


class ProgramFacetSnapshotResponse(BaseModel):
    scope: Literal["browse", "search", "archive"] = "browse"
    pool_limit: int
    generated_at: str | None = None
    facets: ProgramFacetSnapshot = Field(default_factory=ProgramFacetSnapshot)


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


class ProgramDetailBatchResponse(BaseModel):
    items: list[ProgramDetailResponse] = Field(default_factory=list)


def _serialize_program_recommendation(item: ProgramRecommendation) -> ProgramRecommendItem:
    relevance_score = item.relevance_score
    score_percent = _score_to_percent(relevance_score)
    return ProgramRecommendItem(
        program_id=item.program_id,
        score=item.score,
        relevance_score=relevance_score,
        reason=item.reason,
        fit_keywords=item.fit_keywords,
        relevance_reasons=_recommendation_reasons(item),
        score_breakdown=_default_score_breakdown(score_percent),
        relevance_grade=_relevance_grade(score_percent),
        relevance_badge=_relevance_badge(score_percent),
        program=ProgramListItem.model_validate(item.program),
    )


def _clean_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _score_to_percent(value: float | None) -> int:
    if value is None:
        return 0
    score = value * 100 if value <= 1 else value
    return max(0, min(100, round(score)))


def _relevance_grade(score_percent: int) -> Literal["high", "medium", "low", "none"]:
    if score_percent >= 80:
        return "high"
    if score_percent >= 60:
        return "medium"
    if score_percent >= 40:
        return "low"
    return "none"


def _relevance_badge(score_percent: int) -> str | None:
    if score_percent >= 80:
        return "\ub531 \ub9de\uc544\uc694"
    if score_percent >= 60:
        return "\ucd94\ucc9c"
    if score_percent >= 40:
        return "\uc870\uac74 \uc77c\uce58"
    return None


def _default_score_breakdown(score_percent: int) -> dict[str, int]:
    return {
        "target_job": 0,
        "skills": 0,
        "experience": 0,
        "region": 0,
        "readiness": min(10, round(score_percent * 0.1)),
        "behavior": 0,
    }


def _recommendation_reasons(item: ProgramRecommendation) -> list[str]:
    reasons: list[str] = []
    if item.fit_keywords:
        reasons.append(f"{', '.join(item.fit_keywords[:3])} \ud0a4\uc6cc\ub4dc\uc640 \uc5f0\uad00")
    if item.reason:
        reasons.append(item.reason)
    return reasons[:3]


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
    close_date = program.get("close_date")
    compare_meta = program.get("compare_meta") if isinstance(program.get("compare_meta"), dict) else {}
    meta_deadline = next(
        (
            compare_meta.get(key)
            for key in PROGRAM_DEADLINE_COMPARE_META_KEYS
            if str(compare_meta.get(key) or "").strip()
        ),
        None,
    )
    raw = close_date or meta_deadline or program.get("deadline")
    text = str(raw).strip() if raw is not None else ""
    if not text:
        return None

    end_date = str(program.get("end_date") or "").strip()
    if (
        _is_work24_program(program)
        and not close_date
        and not meta_deadline
        and end_date
        and text[:10] == end_date[:10]
        and not _uses_work24_training_start_deadline(compare_meta)
    ):
        return None

    return text


def _uses_work24_training_start_deadline(compare_meta: Mapping[str, Any]) -> bool:
    for key in ("deadline_source", "application_deadline_source", "recruitment_deadline_source"):
        normalized = str(compare_meta.get(key) or "").replace("_", "").replace("-", "").casefold()
        if normalized in {"trastartdate", "trainingstartdate", "trainingstart"}:
            return True
    return False


def _program_deadline_confidence(program: Mapping[str, Any]) -> Literal["high", "medium", "low"]:
    explicit = str(program.get("deadline_confidence") or "").strip().lower()
    if explicit in {"high", "medium", "low"}:
        return explicit  # type: ignore[return-value]

    compare_meta = program.get("compare_meta") if isinstance(program.get("compare_meta"), Mapping) else {}
    if program.get("close_date") or any(compare_meta.get(key) for key in PROGRAM_DEADLINE_COMPARE_META_KEYS):
        return "high"
    if _uses_work24_training_start_deadline(compare_meta):
        return "medium"
    return "low"


def _is_work24_source_value(value: Any) -> bool:
    source_text = str(value or "").casefold()
    return "고용24" in source_text or "work24" in source_text


def _is_work24_program(program: Mapping[str, Any]) -> bool:
    return _is_work24_source_value(program.get("source"))


def _is_active_work24_with_unknown_deadline(row: Mapping[str, Any]) -> bool:
    return (
        _is_work24_program(row)
        and row.get("is_active") is True
        and row.get("deadline") is None
        and row.get("days_left") is None
    )


def _contains_startup_filter_value(value: Any) -> bool:
    text = _normalize_search_text(value).casefold()
    return bool(text) and any(keyword in text for keyword in PROGRAM_STARTUP_FILTER_KEYWORDS)


def _should_apply_work24_default_mix(
    *,
    category: str | None = None,
    category_detail: str | None = None,
    q: str | None = None,
    sources: list[str] | None = None,
    targets: list[str] | None = None,
) -> bool:
    if sources:
        return False
    if any(_contains_startup_filter_value(value) for value in (category, category_detail, q)):
        return False
    if any(_contains_startup_filter_value(value) for value in (targets or [])):
        return False
    return True


def _mix_work24_default_rows(
    rows: list[dict[str, Any]],
    *,
    target_ratio: float = PROGRAM_DEFAULT_WORK24_TARGET_RATIO,
) -> list[dict[str, Any]]:
    if not rows or target_ratio <= 0 or target_ratio >= 1:
        return rows

    work24_rows = [row for row in rows if _is_work24_program(row)]
    other_rows = [row for row in rows if not _is_work24_program(row)]
    if not work24_rows or not other_rows:
        return rows

    mixed: list[dict[str, Any]] = []
    work24_index = 0
    other_index = 0
    total = len(rows)
    for position in range(total):
        desired_work24_count = round((position + 1) * target_ratio)
        should_take_work24 = (
            work24_index < len(work24_rows)
            and (
                work24_index < desired_work24_count
                or other_index >= len(other_rows)
            )
        )
        if should_take_work24:
            mixed.append(work24_rows[work24_index])
            work24_index += 1
            continue
        if other_index < len(other_rows):
            mixed.append(other_rows[other_index])
            other_index += 1
            continue
        if work24_index < len(work24_rows):
            mixed.append(work24_rows[work24_index])
            work24_index += 1

    return mixed


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
    fit_keywords: list[str] | None = None,
    relevance_reasons: list[str] | None = None,
    score_breakdown: dict[str, int] | None = None,
    relevance_grade: Literal["high", "medium", "low", "none"] | None = None,
    relevance_badge: str | None = None,
) -> CalendarRecommendItem | None:
    deadline = _resolve_program_deadline(program)
    if not deadline:
        return None
    if _is_expired_program(program):
        return None

    final_score = _recalculate_final_score(relevance_score, urgency_score)
    score_percent = _score_to_percent(relevance_score)
    resolved_relevance_reasons = relevance_reasons or ([reason] if reason else [])
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
        fit_keywords=fit_keywords or [],
        relevance_reasons=resolved_relevance_reasons[:3],
        score_breakdown=score_breakdown or _default_score_breakdown(score_percent),
        relevance_grade=relevance_grade or _relevance_grade(score_percent),
        relevance_badge=relevance_badge if relevance_badge is not None else _relevance_badge(score_percent),
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
            fit_keywords=[] if anonymous else item.fit_keywords,
            relevance_reasons=[] if anonymous else item.relevance_reasons,
            score_breakdown={} if anonymous else item.score_breakdown,
            relevance_grade="none" if anonymous else item.relevance_grade,
            relevance_badge=None if anonymous else item.relevance_badge,
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


def _normalize_option_param(values: list[str] | None, allowed_values: set[str]) -> list[str]:
    if not values:
        return []

    normalized: list[str] = []
    for raw in values:
        if not raw:
            continue
        for token in str(raw).split(","):
            cleaned = token.strip()
            if cleaned and cleaned in allowed_values and cleaned not in normalized:
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
    if sort == "start_soon":
        return "start_date.asc.nullslast"
    if sort == "cost_low":
        return "cost.asc.nullslast"
    if sort == "cost_high":
        return "cost.desc.nullslast"
    return "deadline.asc.nullslast"


def _requires_resolved_deadline_scan(
    *,
    recruiting_only: bool,
    include_closed_recent: bool,
    sort: str,
) -> bool:
    return include_closed_recent or recruiting_only or sort in PROGRAM_DEADLINE_SORTS or sort in PROGRAM_COMPUTED_SORTS


def _build_program_query_params(
    *,
    select: str,
    category: str | None = None,
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = None,
    sources: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
    sort: str = "default",
    limit: int | None = None,
    offset: int | None = None,
) -> dict[str, Any]:
    effective_sort = sort if sort in PROGRAM_SORT_OPTIONS else "deadline"
    params: dict[str, Any] = {
        "select": select,
        "order": _program_order_clause(effective_sort),
    }

    should_scan_resolved_deadline = _requires_resolved_deadline_scan(
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=effective_sort,
    )
    if limit is not None:
        params["limit"] = str(PROGRAM_SEARCH_SCAN_LIMIT if should_scan_resolved_deadline else limit)
    elif q or should_scan_resolved_deadline:
        params["limit"] = str(PROGRAM_SEARCH_SCAN_LIMIT)
    if offset is not None and not should_scan_resolved_deadline:
        params["offset"] = str(offset)
    effective_category = category or PROGRAM_CATEGORY_PARENT_CATEGORIES.get(str(category_detail or "").strip())
    if effective_category:
        params["category"] = f"eq.{effective_category}"
    if scope:
        params["scope"] = f"eq.{scope}"
    if region_detail:
        params["region_detail"] = f"eq.{region_detail}"
    normalized_teaching_methods = _normalize_teaching_methods_param(teaching_methods)
    if normalized_teaching_methods:
        quoted_values = ",".join(f'"{value}"' for value in normalized_teaching_methods)
        params["teaching_method"] = f"in.({quoted_values})"

    normalized_regions = _expand_region_keywords(_normalize_regions_param(regions))
    if normalized_regions:
        params["or"] = "(" + ",".join(f"location.ilike.*{keyword}*" for keyword in normalized_regions) + ")"

    normalized_sources = [source.strip() for source in (sources or []) if source.strip()]
    if normalized_sources:
        quoted_sources = ",".join(f'"{source}"' for source in normalized_sources)
        params["source"] = f"in.({quoted_sources})"

    search_filter = _program_search_index_filter(q) if _can_use_program_search_index(q) else None
    if search_filter:
        params[PROGRAM_SEARCH_INDEX_COLUMN] = search_filter

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


def _normalize_search_text(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").lower())


def _program_search_index_filter(q: str | None) -> str | None:
    needle = _normalize_search_text(q)
    if not needle:
        return None
    return f"ilike.*{needle}*"


def _can_use_program_search_index(q: str | None) -> bool:
    needle = _normalize_search_text(q)
    if not needle:
        return False
    if len(needle) <= PROGRAM_SHORT_ASCII_SEARCH_MAX_LENGTH and re.fullmatch(r"[a-z0-9]+", needle):
        return False
    return True


def _flatten_search_values(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, dict):
        values: list[str] = []
        for item in value.values():
            values.extend(_flatten_search_values(item))
        return values
    if isinstance(value, list):
        values = []
        for item in value:
            values.extend(_flatten_search_values(item))
        return values
    text = str(value).strip()
    return [text] if text else []


def _searchable_compare_meta_values(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return []
    values: list[str] = []
    for key, item in value.items():
        if key in PROGRAM_SEARCHABLE_COMPARE_META_KEYS:
            values.extend(_flatten_search_values(item))
    return values


def _program_category_search_values(row: dict[str, Any]) -> list[str]:
    values = _flatten_search_values(row.get("category")) + _flatten_search_values(row.get("category_detail"))
    category_detail = str(row.get("category_detail") or "").strip()
    if category_detail:
        values.append(category_detail.replace("-", ""))
        values.extend(PROGRAM_CATEGORY_SEARCH_ALIASES.get(category_detail, ()))
        label = PROGRAM_CATEGORY_LABELS.get(category_detail)
        if label:
            values.extend((label, re.sub(r"[\s·/]+", "", label)))
    return values


def _program_search_groups(row: dict[str, Any]) -> list[tuple[int, list[str]]]:
    return [
        (0, _flatten_search_values(row.get("title"))),
        (1, _flatten_search_values(row.get("provider"))),
        (2, _program_category_search_values(row)),
        (3, _flatten_search_values(row.get("description")) + _flatten_search_values(row.get("summary"))),
        (4, _flatten_search_values(row.get("location")) + _flatten_search_values(row.get("region_detail")) + _flatten_search_values(row.get("region"))),
        (5, _flatten_search_values(row.get("tags")) + _flatten_search_values(row.get("skills"))),
        (6, _searchable_compare_meta_values(row.get("compare_meta"))),
    ]


def _program_search_match_rank(row: dict[str, Any], q: str | None) -> int | None:
    needle = _normalize_search_text(q)
    if not needle:
        return None
    for rank, values in _program_search_groups(row):
        if any(needle in _normalize_search_text(value) for value in values):
            return rank
    return None


def _filter_program_rows_by_query(rows: list[dict[str, Any]], q: str | None) -> list[dict[str, Any]]:
    if not _normalize_search_text(q):
        return rows
    return [row for row in rows if _program_search_match_rank(row, q) is not None]


def _row_matches_category_detail(row: dict[str, Any], category_detail: str | None) -> bool:
    target = str(category_detail or "").strip()
    if not target:
        return True

    if str(row.get("category_detail") or "").strip() == target:
        return True

    display_labels = _flatten_search_values(row.get("display_categories"))
    if any(label in PROGRAM_CATEGORY_DETAIL_DISPLAY_MATCHES.get(target, ()) for label in display_labels):
        return True

    broad_categories = PROGRAM_CATEGORY_DETAIL_BROAD_FALLBACKS.get(target, ())
    if broad_categories and str(row.get("category") or "").strip() in broad_categories:
        return True

    values = (
        _program_source_text_values(row)
        + _flatten_search_values(row.get("category"))
        + display_labels
    )
    text = " ".join(values).casefold()
    aliases = (
        PROGRAM_CATEGORY_SEARCH_ALIASES.get(target, ())
        + PROGRAM_CATEGORY_DETAIL_DISPLAY_MATCHES.get(target, ())
        + ((PROGRAM_CATEGORY_LABELS[target],) if target in PROGRAM_CATEGORY_LABELS else ())
    )
    return any(_text_has_keyword(text, alias) for alias in aliases)


def _filter_program_rows_by_category_detail(
    rows: list[dict[str, Any]],
    category_detail: str | None,
) -> list[dict[str, Any]]:
    if not str(category_detail or "").strip():
        return rows
    return [row for row in rows if _row_matches_category_detail(row, category_detail)]


def _program_text_blob(row: dict[str, Any]) -> str:
    values = (
        _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("provider"))
        + _flatten_search_values(row.get("summary"))
        + _flatten_search_values(row.get("description"))
        + _flatten_search_values(row.get("support_type"))
        + _flatten_search_values(row.get("teaching_method"))
        + _flatten_search_values(row.get("tags"))
        + _flatten_search_values(row.get("skills"))
        + _searchable_compare_meta_values(row.get("compare_meta"))
    )
    return " ".join(values).casefold()


def _dedupe_preserve_order(values: list[str], *, limit: int | None = None) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = str(value or "").strip()
        if not cleaned:
            continue
        key = re.sub(r"\s+", "", cleaned).casefold()
        if not key or key in seen:
            continue
        seen.add(key)
        items.append(cleaned)
        if limit is not None and len(items) >= limit:
            break
    return items


def _program_source_text_values(row: dict[str, Any]) -> list[str]:
    raw_data = row.get("raw_data") if isinstance(row.get("raw_data"), dict) else {}
    return (
        _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("summary"))
        + _flatten_search_values(row.get("description"))
        + _flatten_search_values(row.get("target"))
        + _flatten_search_values(row.get("tags"))
        + _flatten_search_values(row.get("skills"))
        + _flatten_search_values(row.get("support_type"))
        + _flatten_search_values(row.get("teaching_method"))
        + _flatten_search_values(raw_data.get("trainTarget"))
        + _searchable_compare_meta_values(row.get("compare_meta"))
    )


def _text_has_keyword(text: str, keyword: str) -> bool:
    normalized_keyword = keyword.casefold()
    if re.fullmatch(r"[a-z0-9.+#/-]+", normalized_keyword):
        escaped = re.escape(normalized_keyword)
        return re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", text) is not None
    return normalized_keyword in text


def _derive_teaching_method(row: dict[str, Any]) -> str | None:
    explicit = str(row.get("teaching_method") or "").strip()
    if explicit in PROGRAM_TEACHING_METHODS:
        return explicit

    raw_data = row.get("raw_data") if isinstance(row.get("raw_data"), dict) else {}
    compare_meta = row.get("compare_meta") if isinstance(row.get("compare_meta"), dict) else {}
    values = (
        _flatten_search_values(explicit)
        + _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("summary"))
        + _flatten_search_values(row.get("description"))
        + _flatten_search_values(row.get("target"))
        + _flatten_search_values(raw_data.get("trainTarget"))
        + _flatten_search_values(compare_meta.get("training_type"))
        + _flatten_search_values(compare_meta.get("teaching_method"))
    )
    text = " ".join(values).casefold()
    if not text:
        return explicit or None

    online_keywords = ONLINE_KEYWORDS + ("원격훈련", "원격 교육", "원격교육", "이러닝", "e-learning")
    offline_keywords = OFFLINE_KEYWORDS + ("집체훈련", "집체 교육", "집체교육")
    has_online = any(keyword.casefold() in text for keyword in online_keywords)
    has_offline = any(keyword.casefold() in text for keyword in offline_keywords)
    has_hybrid = any(keyword.casefold() in text for keyword in HYBRID_KEYWORDS)

    if has_hybrid or (has_online and has_offline):
        return "혼합"
    if has_online:
        return "온라인"
    if has_offline:
        return "오프라인"
    return explicit or None


def _infer_display_categories(row: dict[str, Any]) -> list[str]:
    candidates: list[str] = []
    category_detail = str(row.get("category_detail") or "").strip()
    category = str(row.get("category") or "").strip()

    if category_detail in PROGRAM_CATEGORY_LABELS:
        mapped = PROGRAM_CATEGORY_LABELS[category_detail]
        if mapped != "기타":
            candidates.append(mapped)

    text = " ".join(_program_source_text_values(row)).casefold()
    for label, keywords in PROGRAM_CATEGORY_RULES:
        if any(_text_has_keyword(text, keyword) for keyword in keywords):
            candidates.append(label)

    if category and category not in {"IT", "AI", "디자인", "경영", "창업", "기타", "전체"}:
        candidates.append(category)
    elif category == "AI":
        candidates.append("AI서비스")
    elif category == "디자인" and any(_text_has_keyword(text, keyword) for keyword in ("디자인", "ux", "ui", "figma", "피그마")):
        candidates.append("UX/UI/디자인")
    elif category == "창업":
        candidates.append("PM/기획")

    deduped = _dedupe_preserve_order(candidates, limit=2)
    return deduped if deduped else ["기타"]


def _extract_time_detail(text_values: list[str]) -> str | None:
    source = " / ".join(text_values)
    weekday_match = re.search(r"(월\s*[,~·/ ]\s*화\s*[,~·/ ]\s*수\s*[,~·/ ]\s*목\s*[,~·/ ]\s*금|월\s*[~-]\s*금|평일)", source)
    weekday_broad_match = re.search(r"주중", source)
    weekend_match = re.search(r"(토\s*[,~·/ ]\s*일|주말)", source)
    time_match = re.search(r"([01]?\d|2[0-3])[:시]\s*([0-5]\d)?\s*(?:~|-|부터|에서)\s*([01]?\d|2[0-3])[:시]\s*([0-5]\d)?", source)
    weekly_hours_match = re.search(r"주\s*(\d{1,2})\s*시간", source)
    daily_hours_match = re.search(r"(?:일|하루)\s*(\d{1,2})\s*시간", source)
    total_hours_match = re.search(r"(?:(\d{1,3})\s*일\s*[·,/]?\s*)?총\s*(\d{1,4})\s*시간", source)

    day_text = None
    if weekend_match:
        day_text = "주말"
    elif weekday_match:
        day_text = "월,화,수,목,금"
    elif weekday_broad_match:
        day_text = "주중"

    if time_match:
        start_hour = int(time_match.group(1))
        start_minute = time_match.group(2) or "00"
        end_hour = int(time_match.group(3))
        end_minute = time_match.group(4) or "00"
        time_text = f"{start_hour:02d}:{start_minute} ~ {end_hour:02d}:{end_minute}"
        return f"{day_text} / {time_text}" if day_text else time_text
    if weekly_hours_match:
        return f"주 {weekly_hours_match.group(1)}시간 학습 권장"
    if daily_hours_match:
        return f"일 {daily_hours_match.group(1)}시간 학습 권장"
    if total_hours_match:
        duration_text = (
            f"{total_hours_match.group(1)}일 · 총 {total_hours_match.group(2)}시간"
            if total_hours_match.group(1)
            else f"총 {total_hours_match.group(2)}시간"
        )
        return f"{day_text} / {duration_text}" if day_text else duration_text
    if day_text:
        return day_text
    return None


def _extract_time_hours(text_values: list[str]) -> tuple[int | None, int | None]:
    source = " ".join(text_values)
    time_match = re.search(r"([01]?\d|2[0-3])[:시]\s*(?:[0-5]\d)?\s*(?:~|-|부터|에서)\s*([01]?\d|2[0-3])", source)
    if not time_match:
        return None, None
    return int(time_match.group(1)), int(time_match.group(2))


def _time_span_hours(start_hour: int | None, end_hour: int | None) -> int | None:
    if start_hour is None or end_hour is None:
        return None
    span = end_hour - start_hour
    if span < 0:
        span += 24
    return span


def _derive_participation_display(row: dict[str, Any]) -> tuple[str | None, str | None]:
    explicit = str(row.get("participation_time") or "").strip()
    text_values = _program_source_text_values(row)
    text = " ".join(text_values).casefold()
    time_detail = _extract_time_detail(text_values)
    start_hour, end_hour = _extract_time_hours(text_values)
    span_hours = _time_span_hours(start_hour, end_hour)

    if "주말" in text or re.search(r"토\s*[,~·/ ]\s*일", " ".join(text_values)):
        label = "주말반"
    elif "야간" in text or "저녁" in text or (start_hour is not None and start_hour >= 18):
        label = "저녁반"
    elif "자율" in text or "자유 학습" in text or "개별 자유" in text:
        label = "자율학습"
    elif explicit == "full-time" or "풀타임" in text or "전일" in text or (start_hour is not None and end_hour is not None and start_hour <= 10 and end_hour >= 17):
        label = "풀타임"
    elif explicit == "part-time" or any(keyword in text for keyword in ("파트타임", "part-time", "특강", "세미나")) or (span_hours is not None and 0 < span_hours <= 5):
        label = "파트타임"
    else:
        inferred = _program_participation_time(row)
        label = {"full-time": "풀타임", "part-time": "파트타임"}.get(inferred or "")

    if label and time_detail:
        return label, time_detail
    if label:
        return label, None
    return None, time_detail


def _derive_selection_process_label(row: dict[str, Any]) -> str | None:
    compare_meta = row.get("compare_meta") if isinstance(row.get("compare_meta"), dict) else {}
    candidates: list[str] = []
    if compare_meta.get("coding_skill_required") in (True, "pass", "warn") or "코딩테스트" in _program_text_blob(row):
        candidates.append("코딩 테스트")
    if compare_meta.get("portfolio_required") is True:
        candidates.append("포트폴리오")
    if compare_meta.get("interview_required") is True:
        candidates.append("면접")

    text = _program_text_blob(row)
    selection_map = (
        ("서류", ("서류", "신청서", "자기소개서")),
        ("면접", ("면접", "인터뷰")),
        ("테스트", ("테스트", "코딩테스트", "역량평가")),
        ("선착순", ("선착순",)),
        ("추첨", ("추첨",)),
    )
    for label, keywords in selection_map:
        if any(keyword.casefold() in text for keyword in keywords):
            candidates.append(label)

    deduped = _dedupe_preserve_order(candidates, limit=3)
    return " / ".join(deduped) if deduped else "선발 절차 없음"


def _is_useful_keyword(value: str) -> bool:
    cleaned = value.strip(" #[](){}·,./")
    if len(cleaned) < 2 or len(cleaned) > 18:
        return False
    generic = {
        "교육",
        "과정",
        "프로그램",
        "모집",
        "무료",
        "오프라인",
        "온라인",
        "혼합",
        "서울",
        "경기",
        "청년",
        "구직자",
        "재직자",
    }
    return cleaned not in generic


def _extract_program_keywords(row: dict[str, Any]) -> list[str]:
    keywords: list[str] = []
    text = " ".join(_program_source_text_values(row)).casefold()

    for label, aliases in PROGRAM_KEYWORD_RULES:
        if any(_text_has_keyword(text, alias) for alias in aliases):
            keywords.append(label)

    for value in _normalize_text_list(row.get("skills")) + _normalize_text_list(row.get("tags")):
        cleaned = value.strip(" #[](){}·,./")
        if _is_useful_keyword(cleaned):
            keywords.append(cleaned)

    for value in _flatten_search_values((row.get("compare_meta") if isinstance(row.get("compare_meta"), dict) else {}).get("target_job")):
        cleaned = value.strip()
        if _is_useful_keyword(cleaned):
            keywords.append(cleaned)

    return _dedupe_preserve_order(keywords, limit=8)


def _program_cost_type(row: dict[str, Any]) -> str | None:
    explicit_cost_type = str(row.get("cost_type") or "").strip()
    if explicit_cost_type in PROGRAM_COST_TYPES:
        return explicit_cost_type

    text = _program_text_blob(row)
    compare_meta = row.get("compare_meta") if isinstance(row.get("compare_meta"), dict) else {}
    card_required = compare_meta.get("naeilbaeumcard_required")
    has_card_keyword = "내일배움" in text or "내배카" in text or "국민내일배움" in text
    if card_required is True or card_required == "pass" or has_card_keyword:
        return "naeil-card"

    cost = _int_or_none(row.get("cost"))
    if cost is not None:
        return "paid" if cost > 0 else "free-no-card"

    if "무료" in text or "전액 지원" in text or "자부담 0" in text:
        return "free-no-card"
    if "유료" in text or "자부담" in text or "수강료" in text:
        return "paid"
    return None


def _program_sort_date(
    row: dict[str, Any],
    *,
    row_keys: Sequence[str],
    meta_keys: Sequence[str],
) -> date | None:
    compare_meta = row.get("compare_meta") if isinstance(row.get("compare_meta"), dict) else {}
    for key in row_keys:
        parsed = _parse_program_deadline(_first_text(row.get(key)))
        if parsed:
            return parsed
    for key in meta_keys:
        parsed = _parse_program_deadline(_first_text(compare_meta.get(key)))
        if parsed:
            return parsed
    return None


def _program_start_sort_date(row: dict[str, Any]) -> date | None:
    return _program_sort_date(
        row,
        row_keys=("program_start_date", "start_date"),
        meta_keys=("program_start_date", "training_start_date", "tra_start_date", "traStartDate", "course_start_date"),
    )


def _program_end_sort_date(row: dict[str, Any]) -> date | None:
    return _program_sort_date(
        row,
        row_keys=("program_end_date", "end_date"),
        meta_keys=("program_end_date", "training_end_date", "tra_end_date", "traEndDate", "course_end_date"),
    )


def _program_sort_duration_days(row: dict[str, Any]) -> int | None:
    start = _program_start_sort_date(row)
    end = _program_end_sort_date(row)
    if start is None or end is None or end < start:
        return None
    return (end - start).days + 1


def _program_sort_cost_amount(row: dict[str, Any]) -> int | None:
    direct_cost = _int_or_none(row.get("cost"))
    if direct_cost is not None:
        return max(0, direct_cost)

    compare_meta = row.get("compare_meta") if isinstance(row.get("compare_meta"), dict) else {}
    for key in ("cost", "fee", "tuition", "course_fee", "training_fee", "self_payment", "out_of_pocket"):
        parsed = _int_or_none(compare_meta.get(key))
        if parsed is not None:
            return max(0, parsed)

    cost_type = _program_cost_type(row)
    if cost_type in {"free-no-card", "naeil-card"}:
        return 0
    return None


def _program_participation_time(row: dict[str, Any]) -> str | None:
    explicit_participation_time = str(row.get("participation_time") or "").strip()
    if explicit_participation_time in PROGRAM_PARTICIPATION_TIMES:
        return explicit_participation_time

    text_values = _program_source_text_values(row)
    text = " ".join(text_values).casefold()
    start_hour, end_hour = _extract_time_hours(text_values)
    span_hours = _time_span_hours(start_hour, end_hour)

    if any(keyword in text for keyword in ("풀타임", "full-time", "전일", "종일")):
        return "full-time"
    if start_hour is not None and end_hour is not None and start_hour <= 10 and end_hour >= 17:
        return "full-time"

    if any(keyword in text for keyword in ("파트타임", "part-time", "야간", "저녁", "주말", "특강", "세미나")):
        return "part-time"
    if start_hour is not None and start_hour >= 18:
        return "part-time"
    if span_hours is not None and 0 < span_hours <= 5:
        return "part-time"
    return None


def _filter_program_rows_by_extra_filters(
    rows: list[dict[str, Any]],
    *,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    selection_processes: list[str] | None = None,
    employment_links: list[str] | None = None,
) -> list[dict[str, Any]]:
    normalized_cost_types = set(_normalize_option_param(cost_types, PROGRAM_COST_TYPES))
    normalized_participation_times = set(_normalize_option_param(participation_times, PROGRAM_PARTICIPATION_TIMES))
    normalized_targets = set(_normalize_option_param(targets, PROGRAM_TARGETS))
    normalized_selection_processes = set(_normalize_option_param(selection_processes, PROGRAM_SELECTION_PROCESSES))
    normalized_employment_links = set(_normalize_option_param(employment_links, PROGRAM_EMPLOYMENT_LINKS))
    if (
        not normalized_cost_types
        and not normalized_participation_times
        and not normalized_targets
        and not normalized_selection_processes
        and not normalized_employment_links
    ):
        return rows

    filtered_rows: list[dict[str, Any]] = []
    for row in rows:
        if normalized_cost_types and _program_cost_type(row) not in normalized_cost_types:
            continue
        if normalized_participation_times and _program_participation_time(row) not in normalized_participation_times:
            continue
        if normalized_targets and not _program_matches_targets(row, normalized_targets):
            continue
        if normalized_selection_processes and not _program_matches_any(row, normalized_selection_processes):
            continue
        if normalized_employment_links and not _program_matches_any(row, normalized_employment_links):
            continue
        filtered_rows.append(row)
    return filtered_rows


def _program_matches_targets(row: dict[str, Any], targets: set[str]) -> bool:
    text = _program_text_blob(row) + " " + " ".join(_flatten_search_values(row.get("target")))
    return any(target.casefold() in text.casefold() for target in targets)


def _program_matches_any(row: dict[str, Any], keywords: set[str]) -> bool:
    text = _program_text_blob(row)
    return any(keyword.casefold() in text.casefold() for keyword in keywords)


def _program_source_label(source: str) -> str:
    normalized = source.strip()
    labels = {
        "kstartup": "K-Startup",
        "K-Startup": "K-Startup",
        "sesac": "SeSAC",
        "SeSAC": "SeSAC",
    }
    return labels.get(normalized, normalized)


def _build_named_filter_options(values: list[str], *, source_labels: bool = False) -> list[ProgramFilterOption]:
    seen: set[str] = set()
    options: list[ProgramFilterOption] = []
    for value in values:
        normalized = str(value or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        options.append(
            ProgramFilterOption(
                value=normalized,
                label=_program_source_label(normalized) if source_labels else normalized,
            )
        )
    return options


def _extract_program_filter_options(rows: list[dict[str, Any]]) -> ProgramFilterOptionsResponse:
    sources: list[str] = []
    targets: list[str] = []
    selection_processes: list[str] = []
    employment_links: list[str] = []

    for row in rows:
        source = str(row.get("source") or "").strip()
        if source:
            sources.append(source)

        target_text = (_program_text_blob(row) + " " + " ".join(_flatten_search_values(row.get("target")))).casefold()
        targets.extend(target for target in sorted(PROGRAM_TARGETS) if target.casefold() in target_text)
        selection_processes.extend(
            process for process in sorted(PROGRAM_SELECTION_PROCESSES) if _program_matches_any(row, {process})
        )
        employment_links.extend(
            link for link in sorted(PROGRAM_EMPLOYMENT_LINKS) if _program_matches_any(row, {link})
        )

    return ProgramFilterOptionsResponse(
        sources=_build_named_filter_options(sorted(sources, key=str.casefold), source_labels=True),
        targets=_build_named_filter_options(targets),
        selection_processes=_build_named_filter_options(selection_processes),
        employment_links=_build_named_filter_options(employment_links),
    )


def _filter_options_from_facet_snapshot(facets: ProgramFacetSnapshot) -> ProgramFilterOptionsResponse:
    return ProgramFilterOptionsResponse(
        sources=[
            ProgramFilterOption(value=bucket.value, label=_program_source_label(bucket.value))
            for bucket in facets.source
            if bucket.value
        ],
        targets=[ProgramFilterOption(value=value, label=value) for value in sorted(PROGRAM_TARGETS)],
        selection_processes=[],
        employment_links=[],
    )


def _serialize_program_list_row(program: dict[str, Any]) -> dict[str, Any]:
    record = dict(program)
    compare_meta = record.get("compare_meta") if isinstance(record.get("compare_meta"), dict) else {}
    record.update(_normalize_rating_fields(record.get("rating") or compare_meta.get("satisfaction_score")))
    record["teaching_method"] = _derive_teaching_method(record)
    deadline = _resolve_program_deadline(record)
    days_left = _calculate_days_left(deadline)
    participation_mode_label, participation_time_text = _derive_participation_display(record)
    record["deadline"] = deadline
    record["days_left"] = days_left
    record["display_categories"] = _infer_display_categories(record)
    record["participation_mode_label"] = participation_mode_label
    record["participation_time_text"] = participation_time_text
    record["selection_process_label"] = _derive_selection_process_label(record)
    record["extracted_keywords"] = _extract_program_keywords(record)
    if days_left is not None:
        record["is_active"] = days_left >= 0
    score = compute_recommended_score(record)
    record["deadline_confidence"] = _program_deadline_confidence(record)
    record["recommended_score"] = score.recommended_score
    record["recommendation_reasons"] = list(score.reasons)
    return record


def _program_detail_view_count(row: Mapping[str, Any], *, recent_only: bool = False) -> int:
    key = "detail_view_count_7d" if recent_only else "detail_view_count"
    return _int_or_none(row.get(key)) or 0


def _program_click_hotness_score(row: Mapping[str, Any]) -> float:
    explicit = _coerce_score(row.get("click_hotness_score"))
    if explicit is not None:
        return explicit
    recent_count = _program_detail_view_count(row, recent_only=True)
    total_count = _program_detail_view_count(row)
    recommended = _coerce_score(row.get("recommended_score")) or 0.0
    return recent_count * 1_000_000 + min(total_count, 999_999) + recommended


def _sort_program_list_rows(
    rows: list[dict[str, Any]],
    *,
    sort: str,
    include_closed_recent: bool,
) -> list[dict[str, Any]]:
    if sort == "latest":
        return rows

    def deadline_sort_key(row: dict[str, Any]) -> tuple[int, int]:
        parsed_deadline = _parse_program_deadline(str(row.get("deadline") or ""))
        is_active = bool(row.get("is_active"))
        if include_closed_recent and not is_active:
            return (2, -(parsed_deadline.toordinal() if parsed_deadline else date.min.toordinal()))
        if parsed_deadline is None:
            return (1, date.max.toordinal())
        return (0, parsed_deadline.toordinal())

    if sort in PROGRAM_DEADLINE_SORTS:
        return sorted(rows, key=deadline_sort_key)

    if sort == "start_soon":
        return sorted(
            rows,
            key=lambda row: (
                1 if _program_start_sort_date(row) is None else 0,
                (_program_start_sort_date(row) or date.max).toordinal(),
                deadline_sort_key(row),
            ),
        )

    if sort in {"cost_low", "cost_high"}:
        reverse_cost = sort == "cost_high"
        return sorted(
            rows,
            key=lambda row: (
                1 if _program_sort_cost_amount(row) is None else 0,
                -(_program_sort_cost_amount(row) or 0) if reverse_cost else (_program_sort_cost_amount(row) or 0),
                deadline_sort_key(row),
            ),
        )

    if sort in {"duration_short", "duration_long"}:
        reverse_duration = sort == "duration_long"
        return sorted(
            rows,
            key=lambda row: (
                1 if _program_sort_duration_days(row) is None else 0,
                -(_program_sort_duration_days(row) or 0)
                if reverse_duration
                else (_program_sort_duration_days(row) or 0),
                deadline_sort_key(row),
            ),
        )

    if sort == "popular":
        return sorted(
            rows,
            key=lambda row: (
                -_program_detail_view_count(row, recent_only=True),
                -_program_detail_view_count(row),
                -(_coerce_score(row.get("recommended_score")) or 0.0),
                deadline_sort_key(row),
                str(row.get("id") or ""),
            ),
        )

    return sorted(rows, key=deadline_sort_key)


def _filter_program_rows_by_deadline_window(
    rows: list[dict[str, Any]],
    *,
    recruiting_only: bool,
    include_closed_recent: bool,
    sort: str,
) -> list[dict[str, Any]]:
    if include_closed_recent:
        recent_cutoff = date.today() - timedelta(days=90)
        return [
            row
            for row in rows
            if (
                (parsed_deadline := _parse_program_deadline(str(row.get("deadline") or "")))
                and parsed_deadline >= recent_cutoff
            )
        ]
    if not recruiting_only and sort not in PROGRAM_DEADLINE_SORTS:
        return rows
    return [
        row
        for row in rows
        if (isinstance(row.get("days_left"), int) and row["days_left"] >= 0)
        or _is_active_work24_with_unknown_deadline(row)
    ]


def _postprocess_program_list_rows(
    rows: list[dict[str, Any]],
    *,
    category_detail: str | None = None,
    q: str | None = None,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    selection_processes: list[str] | None = None,
    employment_links: list[str] | None = None,
    recruiting_only: bool = False,
    sort: str,
    include_closed_recent: bool,
    limit: int,
    offset: int,
    prefer_work24_default_mix: bool = False,
) -> list[dict[str, Any]]:
    serialized_rows = _filter_program_rows_by_deadline_window(
        _filter_program_rows_by_extra_filters(
            _filter_program_rows_by_category_detail(
                _filter_program_rows_by_query(
                    [_serialize_program_list_row(row) for row in rows],
                    q,
                ),
                category_detail,
            ),
            cost_types=cost_types,
            participation_times=participation_times,
            targets=targets,
            selection_processes=selection_processes,
            employment_links=employment_links,
        ),
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=sort,
    )
    if _normalize_search_text(q) and sort == "default":
        sorted_rows = sorted(
            serialized_rows,
            key=lambda row: (
                _program_search_match_rank(row, q) if _program_search_match_rank(row, q) is not None else 99,
                (_parse_program_deadline(str(row.get("deadline") or "")) or date.max).toordinal(),
            ),
        )
    else:
        sorted_rows = _sort_program_list_rows(
            serialized_rows,
            sort=sort,
            include_closed_recent=include_closed_recent,
        )
    if prefer_work24_default_mix:
        sorted_rows = _mix_work24_default_rows(sorted_rows)
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

    if limit <= PROGRAM_SEARCH_SCAN_PAGE_SIZE:
        rows = await request_supabase(
            method="GET",
            path="/rest/v1/programs",
            params=params,
        )
        return rows if isinstance(rows, list) else []

    rows: list[dict[str, Any]] = []
    offset = 0
    while len(rows) < limit:
        page_params = {
            **params,
            "limit": str(min(PROGRAM_SEARCH_SCAN_PAGE_SIZE, limit - len(rows))),
            "offset": str(offset),
        }
        page = await request_supabase(
            method="GET",
            path="/rest/v1/programs",
            params=page_params,
        )
        if not isinstance(page, list) or not page:
            break
        rows.extend(page)
        if len(page) < PROGRAM_SEARCH_SCAN_PAGE_SIZE:
            break
        offset += PROGRAM_SEARCH_SCAN_PAGE_SIZE
    return rows


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
        return await _load_legacy_cached_recommendations(user_id=user_id, cutoff=cutoff)
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


async def _load_legacy_cached_recommendations(
    *,
    user_id: str,
    cutoff: str,
) -> list[dict[str, Any]] | None:
    try:
        rows = await request_supabase(
            method="GET",
            path="/rest/v1/recommendations",
            params={
                "select": "program_id,score,created_at",
                "user_id": f"eq.{user_id}",
                "created_at": f"gte.{cutoff}",
                "order": "score.desc.nullslast",
                "limit": "20",
            },
        )
    except Exception as exc:
        log_event(logger, logging.WARNING, "recommend_legacy_cache_load_failed", error=str(exc))
        return None
    if not isinstance(rows, list) or not rows:
        return None

    normalized_rows: list[dict[str, Any]] = []
    for row in rows:
        score = _coerce_score(row.get("score")) or 0.0
        normalized_rows.append(
            {
                "program_id": row.get("program_id"),
                "similarity_score": score,
                "relevance_score": score,
                "urgency_score": 0.0,
                "final_score": score,
                "generated_at": row.get("created_at"),
            }
        )
    return normalized_rows


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
    prefer_work24_default_mix: bool = False,
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
    if prefer_work24_default_mix:
        scored_programs = _mix_work24_default_rows(scored_programs)

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
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = None,
    sources: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    selection_processes: list[str] | None = None,
    employment_links: list[str] | None = None,
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
) -> int:
    has_extra_filters = bool(
        _normalize_option_param(cost_types, PROGRAM_COST_TYPES)
        or _normalize_option_param(participation_times, PROGRAM_PARTICIPATION_TIMES)
        or _normalize_option_param(targets, PROGRAM_TARGETS)
        or _normalize_option_param(selection_processes, PROGRAM_SELECTION_PROCESSES)
        or _normalize_option_param(employment_links, PROGRAM_EMPLOYMENT_LINKS)
    )
    params = _build_program_query_params(
        select=(
            "*"
            if _normalize_search_text(q) or has_extra_filters or category_detail
            else "id,source,deadline,close_date,end_date,compare_meta,is_active,created_at"
        ),
        category=category,
        category_detail=category_detail,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        sources=sources,
        teaching_methods=teaching_methods,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
    )
    rows = await _fetch_program_list_rows(params, q=q)
    return len(
        _sort_program_list_rows(
            _filter_program_rows_by_deadline_window(
                _filter_program_rows_by_extra_filters(
                    _filter_program_rows_by_category_detail(
                        _filter_program_rows_by_query([_serialize_program_list_row(row) for row in rows], q),
                        category_detail,
                    ),
                    cost_types=cost_types,
                    participation_times=participation_times,
                    targets=targets,
                    selection_processes=selection_processes,
                    employment_links=employment_links,
                ),
                recruiting_only=recruiting_only,
                include_closed_recent=include_closed_recent,
                sort="deadline",
            ),
            sort="deadline",
            include_closed_recent=include_closed_recent,
        )
    )


def _program_list_read_model_enabled() -> bool:
    return os.getenv("ENABLE_PROGRAM_LIST_READ_MODEL", "true").strip().lower() not in {"0", "false", "no", "off"}


def _can_use_program_list_read_model(
    *,
    selection_processes: list[str] | None = None,
    employment_links: list[str] | None = None,
) -> bool:
    return _program_list_read_model_enabled() and not (
        _normalize_option_param(selection_processes, PROGRAM_SELECTION_PROCESSES)
        or _normalize_option_param(employment_links, PROGRAM_EMPLOYMENT_LINKS)
    )


def _program_browse_pool_limit() -> int:
    raw = os.getenv("PROGRAM_BROWSE_POOL_LIMIT", str(PROGRAM_BROWSE_POOL_LIMIT))
    try:
        return max(1, min(1000, int(raw)))
    except ValueError:
        return PROGRAM_BROWSE_POOL_LIMIT


def _program_promoted_slot_limit() -> int:
    raw = os.getenv("PROGRAM_PROMOTED_SLOT_LIMIT", str(PROGRAM_PROMOTED_SLOT_LIMIT))
    try:
        return max(0, min(50, int(raw)))
    except ValueError:
        return PROGRAM_PROMOTED_SLOT_LIMIT


def _program_promoted_provider_terms() -> list[str]:
    raw = os.getenv("PROGRAM_PROMOTED_PROVIDER_MATCHES", "패스트캠퍼스,Fast Campus,fastcampus")
    terms: list[str] = []
    for term in raw.split(","):
        normalized = re.sub(r"\s+", "", term.strip().lower())
        if normalized and normalized not in terms:
            terms.append(normalized)
    return terms


def _program_list_mode(*, q: str | None, scope: str | None, include_closed_recent: bool) -> Literal["browse", "search", "archive"]:
    normalized_scope = str(scope or "default").strip().lower()
    if include_closed_recent or normalized_scope in {"archive", "closed", "recent_closed"}:
        return "archive"
    if _normalize_search_text(q) or normalized_scope == "all":
        return "search"
    return "browse"


def _normalize_program_sort(sort: Any) -> str:
    return sort if isinstance(sort, str) and sort in PROGRAM_SORT_OPTIONS else "default"


def _is_default_browse_entry_request(
    *,
    mode: Literal["browse", "search", "archive"],
    sort: str,
    offset: int,
    cursor: str | None,
    category: str | None = None,
    category_detail: str | None = None,
    region_detail: str | None = None,
    regions: list[str] | None = None,
    sources: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
) -> bool:
    if mode != "browse" or sort != "default" or offset != 0 or cursor:
        return False
    if category or category_detail or region_detail:
        return False
    return not any(
        (
            regions,
            sources,
            teaching_methods,
            cost_types,
            participation_times,
            targets,
        )
    )


def _encode_program_cursor(row: Mapping[str, Any], *, sort: str) -> str | None:
    program_id = str(row.get("id") or "").strip()
    if not program_id:
        return None
    if sort == "deadline":
        sort_value = row.get("deadline") or "9999-12-31"
    elif sort == "popular":
        sort_value = _program_click_hotness_score(row)
    elif sort == "latest":
        sort_value = row.get("updated_at") or ""
    else:
        sort_value = row.get("recommended_score") if row.get("recommended_score") is not None else 0
    payload = json.dumps({"sort": sort, "value": sort_value, "id": program_id}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")


def _decode_program_cursor(cursor: str | None) -> dict[str, Any] | None:
    if not cursor:
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
        decoded = json.loads(payload)
    except (ValueError, json.JSONDecodeError):
        return None
    return decoded if isinstance(decoded, dict) and decoded.get("id") else None


def _add_read_model_or_filter(params: dict[str, Any], group: str) -> None:
    normalized_group = group if group.startswith("(") and group.endswith(")") else f"({group})"
    existing_or = params.pop("or", None)
    if existing_or:
        existing_and = params.pop("and", None)
        clauses: list[str] = []
        if existing_and:
            existing_inner = str(existing_and).strip()
            if existing_inner.startswith("(") and existing_inner.endswith(")"):
                existing_inner = existing_inner[1:-1]
            if existing_inner:
                clauses.append(existing_inner)
        clauses.append(f"or{existing_or}")
        clauses.append(f"or{normalized_group}")
        params["and"] = "(" + ",".join(clauses) + ")"
        return
    if "and" in params:
        existing_inner = str(params["and"]).strip()
        if existing_inner.startswith("(") and existing_inner.endswith(")"):
            existing_inner = existing_inner[1:-1]
        params["and"] = f"({existing_inner},or{normalized_group})" if existing_inner else f"(or{normalized_group})"
        return
    params["or"] = normalized_group


def _read_model_order(sort: str) -> str:
    if sort == "deadline":
        return "deadline.asc.nullslast,recommended_score.desc.nullslast,id.asc"
    if sort == "popular":
        return "click_hotness_score.desc.nullslast,deadline.asc.nullslast,id.asc"
    if sort == "latest":
        return "updated_at.desc.nullslast,id.asc"
    return "recommended_score.desc.nullslast,id.asc"


def _apply_read_model_cursor(params: dict[str, Any], *, cursor: str | None, sort: str) -> None:
    decoded = _decode_program_cursor(cursor)
    if not decoded or decoded.get("sort") != sort:
        return
    cursor_id = str(decoded.get("id") or "").strip()
    value = decoded.get("value")
    if not cursor_id:
        return
    if sort == "deadline":
        _add_read_model_or_filter(params, f"(deadline.gt.{value},and(deadline.eq.{value},id.gt.{cursor_id}))")
    elif sort == "popular":
        _add_read_model_or_filter(params, f"(click_hotness_score.lt.{value},and(click_hotness_score.eq.{value},id.gt.{cursor_id}))")
    elif sort == "latest":
        _add_read_model_or_filter(params, f"(updated_at.lt.{value},and(updated_at.eq.{value},id.gt.{cursor_id}))")
    else:
        _add_read_model_or_filter(params, f"(recommended_score.lt.{value},and(recommended_score.eq.{value},id.gt.{cursor_id}))")


def _build_read_model_params(
    *,
    category: str | None,
    category_detail: str | None,
    scope: str | None,
    region_detail: str | None,
    q: str | None,
    regions: list[str] | None,
    sources: list[str] | None,
    teaching_methods: list[str] | None,
    cost_types: list[str] | None,
    participation_times: list[str] | None,
    targets: list[str] | None,
    recruiting_only: bool,
    include_closed_recent: bool,
    sort: str,
    limit: int,
    offset: int = 0,
    cursor: str | None = None,
    count: bool = False,
) -> tuple[dict[str, Any], Literal["browse", "search", "archive"]]:
    mode = _program_list_mode(q=q, scope=scope, include_closed_recent=include_closed_recent)
    effective_sort = sort if sort in PROGRAM_SORT_OPTIONS else "default"
    use_browse_pool = mode == "browse" and effective_sort != "popular"
    params: dict[str, Any] = {
        "select": "id" if count else PROGRAM_LIST_SUMMARY_SELECT,
        "order": _read_model_order(effective_sort),
        "is_ad": "eq.false",
    }
    if not count:
        params["limit"] = str(limit + 1)
        if cursor:
            _apply_read_model_cursor(params, cursor=cursor, sort=effective_sort)
        elif offset > 0:
            params["offset"] = str(offset)

    effective_category = category or PROGRAM_CATEGORY_PARENT_CATEGORIES.get(str(category_detail or "").strip())
    if effective_category:
        params["category"] = f"eq.{effective_category}"
    if category_detail:
        params["category_detail"] = f"eq.{category_detail}"
    if region_detail:
        params["region_detail"] = f"eq.{region_detail}"

    normalized_regions = _expand_region_keywords(_normalize_regions_param(regions))
    if normalized_regions:
        _add_read_model_or_filter(params, "(" + ",".join(f"location.ilike.*{keyword}*" for keyword in normalized_regions) + ")")

    normalized_sources = [source.strip() for source in (sources or []) if source.strip()]
    if normalized_sources:
        quoted_sources = ",".join(f'"{source}"' for source in normalized_sources)
        params["source"] = f"in.({quoted_sources})"

    normalized_teaching_methods = _normalize_teaching_methods_param(teaching_methods)
    if normalized_teaching_methods:
        quoted_methods = ",".join(f'"{method}"' for method in normalized_teaching_methods)
        params["teaching_method"] = f"in.({quoted_methods})"

    normalized_cost_types = _normalize_option_param(cost_types, PROGRAM_COST_TYPES)
    if normalized_cost_types:
        params["cost_type"] = "in.(" + ",".join(f'"{value}"' for value in normalized_cost_types) + ")"

    normalized_participation_times = _normalize_option_param(participation_times, PROGRAM_PARTICIPATION_TIMES)
    if normalized_participation_times:
        params["participation_time"] = "in.(" + ",".join(f'"{value}"' for value in normalized_participation_times) + ")"

    normalized_targets = _normalize_option_param(targets, PROGRAM_TARGETS)
    if normalized_targets:
        params["target_summary"] = "cs.{" + ",".join(f'"{value}"' for value in normalized_targets) + "}"

    if use_browse_pool:
        params["browse_rank"] = f"lte.{_program_browse_pool_limit()}"
        params["is_open"] = "eq.true"
    elif mode == "browse":
        params["is_open"] = "eq.true"
    elif mode == "archive":
        params["is_open"] = "eq.false"
    elif recruiting_only:
        params["is_open"] = "eq.true"

    search_filter = _program_search_index_filter(q) if _can_use_program_search_index(q) else None
    if search_filter:
        params["search_text"] = search_filter
    return params, mode


def _mark_program_as_promoted(row: Mapping[str, Any], *, rank: int) -> dict[str, Any]:
    promoted = dict(row)
    promoted["is_ad"] = True
    promoted["promoted_rank"] = _int_or_none(promoted.get("promoted_rank")) or rank
    reasons = _normalize_text_list(promoted.get("recommendation_reasons"))
    promoted["recommendation_reasons"] = ["광고", *[reason for reason in reasons if reason != "광고"]]
    return promoted


async def _fetch_promoted_read_model_rows(
    *,
    category: str | None = None,
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    regions: list[str] | None = None,
    sources: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
) -> list[ProgramListItem]:
    slot_limit = _program_promoted_slot_limit()
    if slot_limit <= 0:
        return []
    mode = _program_list_mode(q=None, scope=scope, include_closed_recent=include_closed_recent)
    if mode != "browse":
        return []

    base_args = dict(
        category=category,
        category_detail=category_detail,
        scope=scope,
        region_detail=region_detail,
        q=None,
        regions=regions,
        sources=sources,
        teaching_methods=teaching_methods,
        cost_types=cost_types,
        participation_times=participation_times,
        targets=targets,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort="default",
    )
    promoted_rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    ad_params, _ = _build_read_model_params(**base_args, limit=slot_limit)
    ad_params.pop("browse_rank", None)
    ad_params["is_ad"] = "eq.true"
    ad_params["order"] = "promoted_rank.asc.nullslast,recommended_score.desc.nullslast,id.asc"
    ad_params["limit"] = str(slot_limit)
    explicit_ads = await request_supabase(method="GET", path=f"/rest/v1/{PROGRAM_LIST_INDEX_TABLE}", params=ad_params)
    for row in explicit_ads if isinstance(explicit_ads, list) else []:
        row_id = str(row.get("id") or "").strip() if isinstance(row, Mapping) else ""
        if not row_id or row_id in seen_ids:
            continue
        seen_ids.add(row_id)
        promoted_rows.append(_mark_program_as_promoted(row, rank=len(promoted_rows) + 1))
        if len(promoted_rows) >= slot_limit:
            break

    remaining = slot_limit - len(promoted_rows)
    provider_terms = _program_promoted_provider_terms()
    if remaining > 0 and provider_terms:
        sponsor_params, _ = _build_read_model_params(**base_args, limit=remaining)
        sponsor_params.pop("browse_rank", None)
        sponsor_params["is_ad"] = "eq.false"
        sponsor_params["order"] = "recommended_score.desc.nullslast,id.asc"
        sponsor_params["limit"] = str(remaining)
        sponsor_clauses = [f"search_text.ilike.*{term}*" for term in provider_terms]
        _add_read_model_or_filter(sponsor_params, "(" + ",".join(sponsor_clauses) + ")")
        sponsored_rows = await request_supabase(method="GET", path=f"/rest/v1/{PROGRAM_LIST_INDEX_TABLE}", params=sponsor_params)
        for row in sponsored_rows if isinstance(sponsored_rows, list) else []:
            row_id = str(row.get("id") or "").strip() if isinstance(row, Mapping) else ""
            if not row_id or row_id in seen_ids:
                continue
            seen_ids.add(row_id)
            promoted_rows.append(_mark_program_as_promoted(row, rank=len(promoted_rows) + 1))
            if len(promoted_rows) >= slot_limit:
                break

    return [ProgramListItem.model_validate(row) for row in promoted_rows]


async def _fetch_program_list_read_model_rows(
    *,
    category: str | None = None,
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = None,
    sources: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
    sort: str = "default",
    limit: int = 20,
    offset: int = 0,
    cursor: str | None = None,
) -> ProgramListPageResponse:
    started = time.perf_counter()
    mode = _program_list_mode(q=q, scope=scope, include_closed_recent=include_closed_recent)
    effective_sort = _normalize_program_sort(sort)
    promoted_items: list[ProgramListItem] = []
    if _is_default_browse_entry_request(
        mode=mode,
        sort=effective_sort,
        offset=offset,
        cursor=cursor,
        category=category,
        category_detail=category_detail,
        region_detail=region_detail,
        regions=regions,
        sources=sources,
        teaching_methods=teaching_methods,
        cost_types=cost_types,
        participation_times=participation_times,
        targets=targets,
    ):
        promoted_items = await _fetch_promoted_read_model_rows(
            category=category,
            category_detail=category_detail,
            scope=scope,
            region_detail=region_detail,
            regions=regions,
            sources=sources,
            teaching_methods=teaching_methods,
            cost_types=cost_types,
            participation_times=participation_times,
            targets=targets,
            recruiting_only=recruiting_only,
            include_closed_recent=include_closed_recent,
        )
    promoted_ids = {str(item.id) for item in promoted_items if item.id is not None}
    fetch_limit = limit + len(promoted_ids)
    params, mode = _build_read_model_params(
        category=category,
        category_detail=category_detail,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        sources=sources,
        teaching_methods=teaching_methods,
        cost_types=cost_types,
        participation_times=participation_times,
        targets=targets,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=effective_sort,
        limit=fetch_limit,
        offset=offset,
        cursor=cursor,
    )
    rows = await request_supabase(method="GET", path=f"/rest/v1/{PROGRAM_LIST_INDEX_TABLE}", params=params)
    read_rows = rows if isinstance(rows, list) else []
    organic_rows = [row for row in read_rows if str(row.get("id") or "") not in promoted_ids]
    page_rows = organic_rows[:limit]
    next_cursor = _encode_program_cursor(page_rows[-1], sort=effective_sort) if len(organic_rows) > limit and page_rows else None
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    log_event(
        logger,
        logging.INFO,
        "program_list_read_model",
        mode=mode,
        promoted_count=len(promoted_items),
        item_count=len(page_rows),
        elapsed_ms=elapsed_ms,
        cache_hit=False,
    )
    return ProgramListPageResponse(
        promoted_items=promoted_items,
        items=[ProgramListItem.model_validate(row) for row in page_rows],
        next_cursor=next_cursor,
        mode=mode,
        source="read_model",
        cache_hit=False,
    )


async def _count_program_read_model_rows(
    *,
    category: str | None = None,
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = None,
    sources: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
    sort: str = "default",
) -> int:
    params, _ = _build_read_model_params(
        category=category,
        category_detail=category_detail,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        sources=sources,
        teaching_methods=teaching_methods,
        cost_types=cost_types,
        participation_times=participation_times,
        targets=targets,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=sort,
        limit=1,
        count=True,
    )
    rows = await request_supabase(method="GET", path=f"/rest/v1/{PROGRAM_LIST_INDEX_TABLE}", params=params)
    return len(rows) if isinstance(rows, list) else 0


async def _record_program_detail_view(program_id: str) -> None:
    await request_supabase(
        method="POST",
        path="/rest/v1/rpc/record_program_detail_view",
        payload={"target_program_id": program_id},
    )


async def _fetch_program_list_rows(params: dict[str, Any], *, q: str | None) -> list[dict[str, Any]]:
    if not _normalize_search_text(q):
        requested_limit = _int_or_none(params.get("limit"))
        if requested_limit is not None and requested_limit > PROGRAM_SEARCH_SCAN_PAGE_SIZE:
            rows: list[dict[str, Any]] = []
            offset = _int_or_none(params.get("offset")) or 0
            while len(rows) < requested_limit:
                page_params = {
                    **params,
                    "limit": str(min(PROGRAM_SEARCH_SCAN_PAGE_SIZE, requested_limit - len(rows))),
                    "offset": str(offset),
                }
                try:
                    page = await request_supabase(method="GET", path="/rest/v1/programs", params=page_params)
                except Exception:
                    if "category_detail" not in page_params:
                        raise
                    fallback_params = dict(page_params)
                    fallback_params.pop("category_detail", None)
                    page = await request_supabase(method="GET", path="/rest/v1/programs", params=fallback_params)
                if not isinstance(page, list) or not page:
                    break
                rows.extend(page)
                if len(page) < PROGRAM_SEARCH_SCAN_PAGE_SIZE:
                    break
                offset += PROGRAM_SEARCH_SCAN_PAGE_SIZE
            return rows[:requested_limit]

        try:
            rows = await request_supabase(method="GET", path="/rest/v1/programs", params=params)
        except Exception:
            if "category_detail" not in params:
                raise
            fallback_params = dict(params)
            fallback_params.pop("category_detail", None)
            rows = await request_supabase(method="GET", path="/rest/v1/programs", params=fallback_params)
        return rows if isinstance(rows, list) else []

    rows: list[dict[str, Any]] = []
    offset = 0
    while offset < PROGRAM_SEARCH_SCAN_LIMIT:
        page_params = {
            **params,
            "limit": str(PROGRAM_SEARCH_SCAN_PAGE_SIZE),
            "offset": str(offset),
        }
        try:
            page = await request_supabase(method="GET", path="/rest/v1/programs", params=page_params)
        except Exception:
            if PROGRAM_SEARCH_INDEX_COLUMN not in page_params:
                if "category_detail" in page_params:
                    fallback_params = dict(params)
                    fallback_params.pop("category_detail", None)
                    return await _fetch_program_list_rows(fallback_params, q=q)
                raise
            fallback_params = dict(params)
            fallback_params.pop(PROGRAM_SEARCH_INDEX_COLUMN, None)
            return await _fetch_program_list_rows(fallback_params, q=q)
        if not isinstance(page, list) or not page:
            break
        rows.extend(page)
        if len(page) < PROGRAM_SEARCH_SCAN_PAGE_SIZE:
            break
        offset += PROGRAM_SEARCH_SCAN_PAGE_SIZE
    return rows[:PROGRAM_SEARCH_SCAN_LIMIT]


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
        application_end_date = _first_text(program.get("close_date"), _resolve_program_deadline(program))
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


def _compute_region_match(
    *,
    profile_region: str | None,
    profile_region_detail: str | None,
    program: dict[str, Any],
) -> tuple[list[str], float]:
    normalized_profile_region = _normalize_region_name(profile_region_detail) or _normalize_region_name(profile_region)
    if not normalized_profile_region:
        return [], 0.0

    compare_meta = program.get("compare_meta") if isinstance(program.get("compare_meta"), dict) else {}
    explicit_method_text = " ".join(
        _compact_text_list(
            program.get("teaching_method"),
            compare_meta.get("teaching_method"),
            compare_meta.get("method"),
            compare_meta.get("delivery_method"),
        )
    )
    explicit_delivery = _classify_delivery_region_signal(explicit_method_text)
    if explicit_delivery == "hybrid":
        return ["혼합"], 0.6667
    if explicit_delivery == "online":
        return ["온라인"], 0.8

    program_region = _normalize_region_name_by_priority(
        program.get("region"),
        program.get("location"),
        program.get("region_detail"),
        compare_meta.get("region"),
        compare_meta.get("location"),
        compare_meta.get("address"),
    )

    fallback_text = " ".join(
        _compact_text_list(
            program.get("title"),
            program.get("summary"),
            program.get("description"),
            program.get("location"),
            program.get("region_detail"),
            program.get("region"),
            compare_meta,
        )
    )
    fallback_delivery = _classify_delivery_region_signal(fallback_text)
    if fallback_delivery == "hybrid":
        return ["혼합"], 0.6667
    if fallback_delivery == "online":
        return ["온라인"], 0.8

    if not program_region:
        return [], 0.0

    if program_region == normalized_profile_region:
        return [normalized_profile_region], 1.0

    if _are_adjacent_regions(normalized_profile_region, program_region):
        return [program_region], 0.6667

    return [], 0.0


def _classify_delivery_region_signal(value: str) -> Literal["online", "hybrid"] | None:
    if not value:
        return None
    has_online = _contains_any(value, ONLINE_KEYWORDS)
    has_offline = _contains_any(value, OFFLINE_KEYWORDS)
    has_hybrid = _contains_any(value, HYBRID_KEYWORDS)
    normalized_region = _normalize_region_name(value)
    has_region = normalized_region is not None and normalized_region not in {"온라인", "해외"}
    if has_hybrid or (has_online and (has_offline or has_region)):
        return "hybrid"
    if has_online:
        return "online"
    return None


def _contains_any(value: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword.casefold() in value.casefold() for keyword in keywords)


def _normalize_region_name_by_priority(*values: Any) -> str | None:
    for value in values:
        normalized = _normalize_region_name(value)
        if normalized:
            return normalized
    return None


def _normalize_region_name(*values: Any) -> str | None:
    text = " ".join(_compact_text_list(*values)).replace(" ", "")
    if not text:
        return None
    for region, aliases in REGION_ALIASES.items():
        if any(alias.replace(" ", "") in text for alias in aliases):
            return region
    return None


def _are_adjacent_regions(left: str, right: str) -> bool:
    return any(left in group and right in group for group in REGION_GROUPS)


def _build_compare_score_breakdown(
    *,
    profile: dict[str, Any],
    activities: list[dict[str, Any]],
    skill_match_score: float,
    region_match_score: float,
    has_profile_region: bool,
) -> dict[str, int]:
    weights = (
        {"target_job": 30, "skills": 25, "experience": 15, "region": 15, "readiness": 10, "behavior": 5}
        if has_profile_region
        else {"target_job": 35, "skills": 30, "experience": 20, "region": 0, "readiness": 10, "behavior": 5}
    )
    target_job = weights["target_job"] if _first_text(profile.get("target_job"), profile.get("desired_job"), profile.get("job_title")) else 0
    skills = round(skill_match_score * weights["skills"])
    experience = weights["experience"] if activities else 0
    region = round(region_match_score * 15)
    readiness = weights["readiness"] if _has_meaningful_profile_text(profile) else 0
    behavior = weights["behavior"] if activities and _normalize_text_list(profile.get("skills")) else 0
    return {
        "target_job": target_job,
        "skills": skills,
        "experience": experience,
        "region": region,
        "readiness": readiness,
        "behavior": behavior,
    }


def _build_relevance_reasons(
    *,
    matched_skills: list[str],
    matched_regions: list[str],
    score_breakdown: dict[str, int],
) -> list[str]:
    candidates = [
        ("target_job", score_breakdown.get("target_job", 0), "희망 직무 정보와 연관"),
        ("skills", score_breakdown.get("skills", 0), f"{', '.join(matched_skills[:3])} 키워드 매칭" if matched_skills else ""),
        ("experience", score_breakdown.get("experience", 0), "활동 이력 기반 경험 신호 보유"),
        ("region", score_breakdown.get("region", 0), f"{matched_regions[0]} 지역 조건과 일치" if matched_regions else ""),
        ("readiness", score_breakdown.get("readiness", 0), "프로필 소개와 경력 정보 보유"),
        ("behavior", score_breakdown.get("behavior", 0), "프로필과 활동 정보가 함께 입력됨"),
    ]
    priority = {key: index for index, key in enumerate(["target_job", "skills", "experience", "region", "readiness", "behavior"])}
    return [
        label
        for key, score, label in sorted(candidates, key=lambda item: (-item[1], priority[item[0]]))
        if score >= 8 and label
    ][:3]


def _compute_program_relevance_items(
    *,
    profile: dict[str, Any],
    activities: list[dict[str, Any]],
    programs_by_id: dict[str, dict[str, Any]],
    program_ids: list[str],
) -> list[ProgramRelevanceItem]:
    profile_keywords = programs_rag._profile_keywords(profile, activities)
    raw_profile_skills = _normalize_text_list(profile.get("skills"))
    profile_region = _first_text(profile.get("region"))
    profile_region_detail = _first_text(profile.get("region_detail"), profile.get("address"))
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
        matched_regions, region_match_score = _compute_region_match(
            profile_region=profile_region,
            profile_region_detail=profile_region_detail,
            program=program,
        )
        skill_match_score = (
            min(1.0, len(matched_skills) / max(1, min(len(skill_tokens), 5)))
            if skill_tokens
            else 0.0
        )
        normalized_matched_skills = matched_skills or matched_keywords[:5]
        adjusted_relevance_score = (
            min(1.0, relevance_score * 0.85 + region_match_score * 0.15)
            if profile_region or profile_region_detail
            else relevance_score
        )
        rounded_relevance_score = round(adjusted_relevance_score, 4)
        rounded_skill_match_score = round(skill_match_score, 4)
        rounded_region_match_score = round(region_match_score, 4)
        score_breakdown = _build_compare_score_breakdown(
            profile=profile,
            activities=activities,
            skill_match_score=rounded_skill_match_score,
            region_match_score=rounded_region_match_score,
            has_profile_region=bool(profile_region or profile_region_detail),
        )
        relevance_reasons = _build_relevance_reasons(
            matched_skills=normalized_matched_skills,
            matched_regions=matched_regions,
            score_breakdown=score_breakdown,
        )
        score_percent = _score_to_percent(rounded_relevance_score)
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
                region_match_score=rounded_region_match_score,
                matched_skills=normalized_matched_skills,
                matched_regions=matched_regions,
                relevance_reasons=relevance_reasons,
                score_breakdown=score_breakdown,
                relevance_grade=_relevance_grade(score_percent),
                relevance_badge=_relevance_badge(score_percent),
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
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = Query(default=None),
    sources: list[str] | None = Query(default=None),
    teaching_methods: list[str] | None = Query(default=None),
    cost_types: list[str] | None = Query(default=None),
    participation_times: list[str] | None = Query(default=None),
    targets: list[str] | None = Query(default=None),
    selection_processes: list[str] | None = Query(default=None),
    employment_links: list[str] | None = Query(default=None),
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
    sort: str = Query(default="default"),
    limit: int = Query(default=20, ge=1),
    offset: int = Query(default=0, ge=0),
    cursor: str | None = Query(default=None),
) -> Any:
    if _can_use_program_list_read_model(selection_processes=selection_processes, employment_links=employment_links) and offset == 0:
        try:
            page = await _fetch_program_list_read_model_rows(
                category=category,
                category_detail=category_detail,
                scope=scope,
                region_detail=region_detail,
                q=q,
                regions=regions,
                sources=sources,
                teaching_methods=teaching_methods,
                cost_types=cost_types,
                participation_times=participation_times,
                targets=targets,
                recruiting_only=recruiting_only,
                include_closed_recent=include_closed_recent,
                sort=sort,
                limit=limit,
                cursor=cursor,
            )
            return [item.model_dump() for item in page.items]
        except Exception as exc:
            log_event(
                logger,
                logging.WARNING,
                "program_list_read_model_fallback",
                error=str(exc),
                offset=offset,
            )
    params = _build_program_query_params(
        select="*",
        category=category,
        category_detail=category_detail,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        sources=sources,
        teaching_methods=teaching_methods,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=sort,
    )
    rows = await _fetch_program_list_rows(params, q=q)
    prefer_work24_default_mix = sort == "default" and _should_apply_work24_default_mix(
        category=category,
        category_detail=category_detail,
        q=q,
        sources=sources,
        targets=targets,
    )
    return _postprocess_program_list_rows(
        rows,
        category_detail=category_detail,
        q=q,
        cost_types=cost_types,
        participation_times=participation_times,
        targets=targets,
        selection_processes=selection_processes,
        employment_links=employment_links,
        recruiting_only=recruiting_only,
        sort=sort,
        include_closed_recent=include_closed_recent,
        limit=limit,
        offset=offset,
        prefer_work24_default_mix=prefer_work24_default_mix,
    )


@programs_router.get("/list", response_model=ProgramListPageResponse)
async def list_programs_page(
    category: str | None = None,
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = Query(default=None),
    sources: list[str] | None = Query(default=None),
    teaching_methods: list[str] | None = Query(default=None),
    cost_types: list[str] | None = Query(default=None),
    participation_times: list[str] | None = Query(default=None),
    targets: list[str] | None = Query(default=None),
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
    sort: str = Query(default="default"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = 0,
    cursor: str | None = None,
) -> ProgramListPageResponse:
    if _program_list_read_model_enabled():
        try:
            response = await _fetch_program_list_read_model_rows(
                category=category,
                category_detail=category_detail,
                scope=scope,
                region_detail=region_detail,
                q=q,
                regions=regions,
                sources=sources,
                teaching_methods=teaching_methods,
                cost_types=cost_types,
                participation_times=participation_times,
                targets=targets,
                recruiting_only=recruiting_only,
                include_closed_recent=include_closed_recent,
                sort=sort,
                limit=limit,
                offset=offset,
                cursor=cursor,
            )
            response.count = await _count_program_read_model_rows(
                category=category,
                category_detail=category_detail,
                scope=scope,
                region_detail=region_detail,
                q=q,
                regions=regions,
                sources=sources,
                teaching_methods=teaching_methods,
                cost_types=cost_types,
                participation_times=participation_times,
                targets=targets,
                recruiting_only=recruiting_only,
                include_closed_recent=include_closed_recent,
                sort=sort,
            )
            return response
        except Exception as exc:
            log_event(logger, logging.WARNING, "program_list_page_read_model_fallback", error=str(exc))

    rows = await list_programs(
        category=category,
        category_detail=category_detail,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        sources=sources,
        teaching_methods=teaching_methods,
        cost_types=cost_types,
        participation_times=participation_times,
        targets=targets,
        selection_processes=None,
        employment_links=None,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=sort,
        limit=limit,
        offset=offset,
        cursor=None,
    )
    return ProgramListPageResponse(
        items=[ProgramListItem.model_validate(row) for row in rows],
        count=len(rows),
        mode=_program_list_mode(q=q, scope=scope, include_closed_recent=include_closed_recent),
        source="legacy",
    )


def _build_facet_snapshot(raw_facets: Mapping[str, Any] | None) -> ProgramFacetSnapshot:
    raw_facets = raw_facets or {}

    def buckets(key: str) -> list[ProgramFacetBucket]:
        values = raw_facets.get(key)
        if not isinstance(values, list):
            return []
        result: list[ProgramFacetBucket] = []
        for item in values:
            if not isinstance(item, Mapping):
                continue
            value = str(item.get("value") or "").strip()
            count = _int_or_none(item.get("count")) or 0
            if value:
                result.append(ProgramFacetBucket(value=value, count=count))
        return result

    return ProgramFacetSnapshot(
        category=buckets("category"),
        region=buckets("region"),
        teaching_method=buckets("teaching_method"),
        cost_type=buckets("cost_type"),
        participation_time=buckets("participation_time"),
        source=buckets("source"),
    )


async def _load_program_facet_snapshot(
    *,
    mode: Literal["browse", "search", "archive"],
) -> tuple[ProgramFacetSnapshot, str | None]:
    rows = await request_supabase(
        method="GET",
        path=f"/rest/v1/{PROGRAM_LIST_FACET_TABLE}",
        params={
            "select": "facets,generated_at",
            "scope": f"eq.{mode}",
            "pool_limit": f"eq.{_program_browse_pool_limit()}",
            "order": "generated_at.desc",
            "limit": "1",
        },
    )
    row = rows[0] if isinstance(rows, list) and rows else {}
    return (
        _build_facet_snapshot(row.get("facets") if isinstance(row, Mapping) else None),
        str(row.get("generated_at")) if isinstance(row, Mapping) and row.get("generated_at") else None,
    )


@programs_router.get("/facets", response_model=ProgramFacetSnapshotResponse)
async def get_program_facets(
    scope: str | None = None,
    include_closed_recent: bool = False,
    q: str | None = None,
) -> ProgramFacetSnapshotResponse:
    mode = _program_list_mode(q=q, scope=scope, include_closed_recent=include_closed_recent)
    if not _program_list_read_model_enabled():
        return ProgramFacetSnapshotResponse(scope=mode, pool_limit=_program_browse_pool_limit())
    try:
        facets, generated_at = await _load_program_facet_snapshot(mode=mode)
    except Exception as exc:
        log_event(logger, logging.WARNING, "program_facets_read_model_fallback", error=str(exc))
        facets = ProgramFacetSnapshot()
        generated_at = None
    return ProgramFacetSnapshotResponse(
        scope=mode,
        pool_limit=_program_browse_pool_limit(),
        generated_at=generated_at,
        facets=facets,
    )


@programs_router.get("/count", response_model=ProgramCountResponse)
async def count_programs(
    category: str | None = None,
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = Query(default=None),
    sources: list[str] | None = Query(default=None),
    teaching_methods: list[str] | None = Query(default=None),
    cost_types: list[str] | None = Query(default=None),
    participation_times: list[str] | None = Query(default=None),
    targets: list[str] | None = Query(default=None),
    selection_processes: list[str] | None = Query(default=None),
    employment_links: list[str] | None = Query(default=None),
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
) -> ProgramCountResponse:
    if _can_use_program_list_read_model(selection_processes=selection_processes, employment_links=employment_links):
        try:
            return ProgramCountResponse(
                count=await _count_program_read_model_rows(
                    category=category,
                    category_detail=category_detail,
                    scope=scope,
                    region_detail=region_detail,
                    q=q,
                    regions=regions,
                    sources=sources,
                    teaching_methods=teaching_methods,
                    cost_types=cost_types,
                    participation_times=participation_times,
                    targets=targets,
                    recruiting_only=recruiting_only,
                    include_closed_recent=include_closed_recent,
                )
            )
        except Exception as exc:
            log_event(logger, logging.WARNING, "program_count_read_model_fallback", error=str(exc))
    count = await _count_program_rows(
        category=category,
        category_detail=category_detail,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        sources=sources,
        teaching_methods=teaching_methods,
        cost_types=cost_types,
        participation_times=participation_times,
        targets=targets,
        selection_processes=selection_processes,
        employment_links=employment_links,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
    )
    return ProgramCountResponse(count=count)


@programs_router.get("/filter-options", response_model=ProgramFilterOptionsResponse)
async def get_program_filter_options(
    category: str | None = None,
    category_detail: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    q: str | None = None,
    regions: list[str] | None = Query(default=None),
    teaching_methods: list[str] | None = Query(default=None),
    recruiting_only: bool = False,
    include_closed_recent: bool = False,
) -> ProgramFilterOptionsResponse:
    mode = _program_list_mode(q=q, scope=scope, include_closed_recent=include_closed_recent)
    if _program_list_read_model_enabled() and mode == "browse":
        try:
            facets, _ = await _load_program_facet_snapshot(mode=mode)
            return _filter_options_from_facet_snapshot(facets)
        except Exception as exc:
            log_event(logger, logging.WARNING, "program_filter_options_facet_fallback", error=str(exc))

    select_fields = "source,target,title,provider,summary,description,support_type,teaching_method,tags,skills,compare_meta,deadline,end_date,is_active,created_at"
    params = _build_program_query_params(
        select=select_fields,
        category=category,
        category_detail=category_detail,
        scope=scope,
        region_detail=region_detail,
        q=q,
        regions=regions,
        teaching_methods=teaching_methods,
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort="deadline",
    )
    try:
        rows = await _fetch_program_list_rows(params, q=q)
    except Exception:
        fallback_params = dict(params)
        fallback_params["select"] = select_fields.replace("target,", "")
        rows = await _fetch_program_list_rows(fallback_params, q=q)
    return _extract_program_filter_options(
        _filter_program_rows_by_deadline_window(
            _filter_program_rows_by_category_detail(
                _filter_program_rows_by_query([_serialize_program_list_row(row) for row in rows], q),
                category_detail,
            ),
            recruiting_only=recruiting_only,
            include_closed_recent=include_closed_recent,
            sort="deadline",
        )
    )


@programs_router.get("/popular")
async def list_popular_programs() -> Any:
    if _program_list_read_model_enabled():
        try:
            page = await _fetch_program_list_read_model_rows(
                recruiting_only=True,
                include_closed_recent=False,
                sort="popular",
                limit=10,
            )
            return [item.model_dump() for item in page.items]
        except Exception as exc:
            log_event(logger, logging.WARNING, "program_popular_read_model_fallback", error=str(exc))

    params = _build_program_query_params(
        select="*",
        recruiting_only=True,
        include_closed_recent=False,
        sort="popular",
    )
    rows = await _fetch_program_list_rows(params, q=None)
    return _postprocess_program_list_rows(
        rows if isinstance(rows, list) else [],
        recruiting_only=True,
        sort="popular",
        include_closed_recent=False,
        limit=10,
        offset=0,
        prefer_work24_default_mix=False,
    )


@programs_router.post("/details/batch", response_model=ProgramDetailBatchResponse)
async def get_program_details_batch(payload: ProgramDetailBatchRequest) -> ProgramDetailBatchResponse:
    deduped_program_ids: list[str] = []
    seen_program_ids: set[str] = set()
    for program_id in payload.program_ids:
        normalized = str(program_id or "").strip()
        if not normalized or normalized in seen_program_ids:
            continue
        seen_program_ids.add(normalized)
        deduped_program_ids.append(normalized)

    programs_by_id = await _fetch_programs_by_ids(deduped_program_ids)
    return ProgramDetailBatchResponse(
        items=[
            _build_program_detail_response(programs_by_id[program_id])
            for program_id in deduped_program_ids
            if program_id in programs_by_id
        ]
    )


@programs_router.post("/batch", response_model=ProgramBatchResponse)
async def get_programs_batch(payload: ProgramDetailBatchRequest) -> ProgramBatchResponse:
    deduped_program_ids: list[str] = []
    seen_program_ids: set[str] = set()
    for program_id in payload.program_ids:
        normalized = str(program_id or "").strip()
        if not normalized or normalized in seen_program_ids:
            continue
        seen_program_ids.add(normalized)
        deduped_program_ids.append(normalized)

    programs_by_id = await _fetch_programs_by_ids(deduped_program_ids)
    return ProgramBatchResponse(
        items=[
            ProgramListItem.model_validate(_serialize_program_list_row(programs_by_id[program_id]))
            for program_id in deduped_program_ids
            if program_id in programs_by_id
        ]
    )


@programs_router.get("/{program_id}/detail", response_model=ProgramDetailResponse)
async def get_program_detail(program_id: str) -> ProgramDetailResponse:
    try:
        UUID(program_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Program not found") from exc

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


@programs_router.post("/{program_id}/detail-view")
async def record_program_detail_view(program_id: str) -> dict[str, bool]:
    try:
        UUID(program_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Program not found") from exc

    await _record_program_detail_view(program_id)
    return {"ok": True}


@programs_router.get("/{program_id}")
async def get_program(program_id: str) -> Any:
    try:
        UUID(program_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Program not found") from exc

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
    prefer_work24_default_mix = _should_apply_work24_default_mix(category=payload.category)
    raw_programs = await _fetch_program_rows(
        limit=PROGRAM_SEARCH_SCAN_LIMIT,
        category=payload.category,
        region=payload.region,
    )
    programs = _postprocess_program_list_rows(
        raw_programs,
        recruiting_only=True,
        sort="deadline",
        include_closed_recent=False,
        limit=PROGRAM_SEARCH_SCAN_LIMIT,
        offset=0,
        prefer_work24_default_mix=prefer_work24_default_mix,
    )
    if not programs:
        return ProgramRecommendResponse(items=[])

    if not authorization:
        return ProgramRecommendResponse(
            items=_build_default_recommendation_items(
                programs,
                top_k=payload.top_k,
                reason="최근 마감 일정과 공개 정보 기준으로 우선 노출한 프로그램입니다.",
                prefer_work24_default_mix=prefer_work24_default_mix,
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
                prefer_work24_default_mix=prefer_work24_default_mix,
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
                prefer_work24_default_mix=prefer_work24_default_mix,
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
    prefer_work24_default_mix = _should_apply_work24_default_mix(category=category)
    raw_programs = await _fetch_program_rows(
        limit=PROGRAM_SEARCH_SCAN_LIMIT,
        category=category,
        region=region,
    )
    programs = _postprocess_program_list_rows(
        raw_programs,
        recruiting_only=True,
        sort="deadline",
        include_closed_recent=False,
        limit=PROGRAM_SEARCH_SCAN_LIMIT,
        offset=0,
        prefer_work24_default_mix=prefer_work24_default_mix,
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
