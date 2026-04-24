from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


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


class ProgramSurfaceContextModel(BaseModel):
    surface: str | None = None
    promoted_rank: int | None = None


class ProgramListRowItem(BaseModel):
    program: ProgramListItem
    context: ProgramSurfaceContextModel | None = None


class ProgramListPageResponse(BaseModel):
    promoted_items: list[ProgramListRowItem] = Field(default_factory=list)
    items: list[ProgramListRowItem] = Field(default_factory=list)
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


__all__ = [
    "CalendarRecommendItem",
    "CalendarRecommendResponse",
    "ProgramBatchResponse",
    "ProgramCompareRelevanceRequest",
    "ProgramCompareRelevanceResponse",
    "ProgramCountResponse",
    "ProgramDetailBatchRequest",
    "ProgramDetailBatchResponse",
    "ProgramDetailResponse",
    "ProgramFacetBucket",
    "ProgramFacetSnapshot",
    "ProgramFacetSnapshotResponse",
    "ProgramFilterOption",
    "ProgramFilterOptionsResponse",
    "ProgramListItem",
    "ProgramListPageResponse",
    "ProgramListRowItem",
    "ProgramRecommendItem",
    "ProgramRecommendRequest",
    "ProgramRecommendResponse",
    "ProgramRelevanceItem",
    "ProgramSurfaceContextModel",
]
