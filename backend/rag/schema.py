"""ChromaDB Coach AI  Seed & Response Schemas (6단계 포트폴리오 구조 반영)"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

SeedSource = Literal["ncs", "real_posting"]
PatternType = Literal[
    "result_statement",
    "problem_statement",
    "decision_statement",
    "implementation_statement",
]
JobPostingSource = Literal["saramin", "jobkorea", "wanted"]
JobPostingSectionType = Literal["자격요건", "우대사항", "주요업무"]
SuggestionFocus = Literal[
    "star_gap",
    "quantification",
    "verb_strength",
    "job_fit",
    "tech_decision",
    "problem_definition",
]


class JobKeywordPatternSeed(BaseModel):
    """`job_keyword_patterns` 컬렉션 적재용 직무 키워드 패턴 시드."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str
    job_title: str
    job_family: str
    job_bucket: str
    section_types: list[str]
    keywords: list[str]
    source: SeedSource
    pattern_type: PatternType
    lang: str = "ko"
    version: str = "v1"
    is_active: bool = True
    document: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith("jk:"):
            raise ValueError("id must start with 'jk:'")
        return value

    @field_validator("job_bucket")
    @classmethod
    def validate_job_bucket(cls, value: str) -> str:
        if not value:
            raise ValueError("job_bucket must not be empty")
        return value

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, value: list[str]) -> list[str]:
        if len(value) < 2:
            raise ValueError("keywords must contain at least 2 items")
        return value

    @field_validator("document")
    @classmethod
    def validate_document(cls, value: str) -> str:
        if len(value) < 10:
            raise ValueError("document must be at least 10 characters long")
        return value


class StarExampleSeed(BaseModel):
    """`star_examples` 컬렉션 적재용 STAR 예시 시드."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str
    activity_type: SuggestionFocus
    section_type: str
    job_family: str
    original_text: str
    missing_before: list[str]
    rewrite_focus: str
    lang: str = "ko"
    version: str = "v1"
    is_active: bool = True
    document: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith("se:"):
            raise ValueError("id must start with 'se:'")
        return value

    @field_validator("original_text", "document")
    @classmethod
    def validate_text_length(cls, value: str) -> str:
        if len(value) < 10:
            raise ValueError("text fields must be at least 10 characters long")
        return value

    @field_validator("missing_before")
    @classmethod
    def validate_missing_before(cls, value: list[str]) -> list[str]:
        if len(value) < 1:
            raise ValueError("missing_before must contain at least 1 item")
        return value


class JobPostingSnippetSeed(BaseModel):
    """`job_posting_snippets` 컬렉션 적재용 채용 공고 표현 시드."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str
    job_slug: str
    job_family: str
    job_bucket: str
    source: JobPostingSource
    section_type: JobPostingSectionType
    lang: str = "ko"
    version: str = "v1"
    is_active: bool = True
    document: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not value.startswith("jp:"):
            raise ValueError("id must start with 'jp:'")
        return value

    @field_validator("job_slug", "job_bucket")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("field must not be empty")
        return value

    @field_validator("document")
    @classmethod
    def validate_document(cls, value: str) -> str:
        if len(value) < 10:
            raise ValueError("document must be at least 10 characters long")
        return value


class StructureDiagnosis(BaseModel):
    """6단계 포트폴리오 구조 기준 진단 결과."""

    model_config = ConfigDict(str_strip_whitespace=True)

    has_problem_definition: bool
    has_tech_decision: bool
    has_quantified_result: bool
    has_role_clarification: bool
    has_implementation_detail: bool
    missing_elements: list[str]
    priority_focus: str


class RewriteSuggestion(BaseModel):
    """Coach AI가 반환하는 단일 문장 개선 제안."""

    model_config = ConfigDict(str_strip_whitespace=True)

    text: str
    focus: SuggestionFocus
    section: str
    rationale: str
    reference_pattern: str | None = None


class CoachResponse(BaseModel):
    """Coach AI 전체 응답 스키마."""

    model_config = ConfigDict(str_strip_whitespace=True)

    feedback: str
    structure_diagnosis: StructureDiagnosis
    rewrite_suggestions: list[RewriteSuggestion]
    missing_elements: list[str]
    iteration_count: int

    @field_validator("rewrite_suggestions")
    @classmethod
    def validate_rewrite_suggestions(
        cls,
        value: list[RewriteSuggestion],
    ) -> list[RewriteSuggestion]:
        if not 1 <= len(value) <= 3:
            raise ValueError("rewrite_suggestions must contain between 1 and 3 items")
        return value


__all__ = [
    "CoachResponse",
    "JobPostingSectionType",
    "JobPostingSnippetSeed",
    "JobPostingSource",
    "JobKeywordPatternSeed",
    "PatternType",
    "RewriteSuggestion",
    "SeedSource",
    "StarExampleSeed",
    "StructureDiagnosis",
    "SuggestionFocus",
]
