"""`/match/rewrite` 요청/응답 스키마 정의."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MatchRewriteSectionType = Literal["회사경력", "프로젝트", "대외활동", "학생활동", "요약"]
RewriteSuggestionFocus = Literal[
    "star_gap",
    "quantification",
    "verb_strength",
    "job_fit",
    "tech_decision",
    "problem_definition",
]
RewriteSuggestionSection = Literal[
    "프로젝트 개요",
    "문제 정의",
    "기술적 의사결정",
    "구현",
    "성과",
    "트러블슈팅",
]

ALLOWED_SECTION_TYPES: tuple[str, ...] = ("회사경력", "프로젝트", "대외활동", "학생활동", "요약")


class RewriteSuggestion(BaseModel):
    """공고 기반 리라이팅에서 반환하는 단일 제안 문장."""

    model_config = ConfigDict(str_strip_whitespace=True)

    text: str
    focus: RewriteSuggestionFocus
    section: RewriteSuggestionSection
    rationale: str
    reference_pattern: str


class ActivityRewrite(BaseModel):
    """단일 활동에 대한 리라이팅 후보 묶음."""

    model_config = ConfigDict(str_strip_whitespace=True)

    activity_id: str
    original_text: str
    suggestions: list[RewriteSuggestion] = Field(min_length=1, max_length=3)

    @field_validator("activity_id", "original_text")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("필수 텍스트 값이 비어 있습니다.")
        return value


class MatchRewriteRequest(BaseModel):
    """`/match/rewrite` 요청 본문 스키마."""

    model_config = ConfigDict(str_strip_whitespace=True)

    job_posting_text: str
    job_title: str
    activity_ids: list[str] = Field(default_factory=list)
    section_type: str = "회사경력"

    @field_validator("job_posting_text")
    @classmethod
    def validate_job_posting_text(cls, value: str) -> str:
        if len(value.strip()) < 50:
            raise ValueError("공고 텍스트가 너무 짧습니다. 최소 50자 이상 입력해주세요.")
        return value

    @field_validator("job_title")
    @classmethod
    def validate_job_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("직무명을 입력해주세요.")
        return value

    @field_validator("section_type")
    @classmethod
    def validate_section_type(cls, value: str) -> str:
        if value not in ALLOWED_SECTION_TYPES:
            allowed = ", ".join(ALLOWED_SECTION_TYPES)
            raise ValueError(f"section_type은 다음 값만 허용됩니다: {allowed}")
        return value

    @field_validator("activity_ids")
    @classmethod
    def validate_activity_ids(cls, value: list[str]) -> list[str]:
        for activity_id in value:
            if not activity_id.strip():
                raise ValueError("activity_ids에는 빈 문자열을 포함할 수 없습니다.")
        return value


class MatchRewriteResponse(BaseModel):
    """`/match/rewrite` 응답 본문 스키마."""

    model_config = ConfigDict(str_strip_whitespace=True)

    activity_rewrites: list[ActivityRewrite]
    job_analysis_summary: str
    fallback_used: bool = False


__all__ = [
    "ActivityRewrite",
    "MatchRewriteRequest",
    "MatchRewriteResponse",
    "MatchRewriteSectionType",
    "RewriteSuggestion",
    "RewriteSuggestionFocus",
    "RewriteSuggestionSection",
]
