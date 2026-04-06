"""Activity conversion API router."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from utils.activity_converter import activity_to_portfolio, activity_to_star

ActivityType = Literal["회사경력", "프로젝트", "대외활동", "학생활동"]
ConvertTarget = Literal["star", "portfolio", "both"]

router = APIRouter()


class ActivityPayload(BaseModel):
    """Subset of activity fields needed for deterministic conversion."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str | None = None
    type: ActivityType
    title: str
    organization: str | None = None
    team_size: int | None = None
    team_composition: str | None = None
    my_role: str | None = None
    contributions: list[str] = Field(default_factory=list)
    period: str | None = None
    role: str | None = None
    skills: list[str] = Field(default_factory=list)
    description: str | None = None
    star_situation: str | None = None
    star_task: str | None = None
    star_action: str | None = None
    star_result: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("activity.title을 입력해주세요.")
        return value

    @field_validator("team_size")
    @classmethod
    def validate_team_size(cls, value: int | None) -> int | None:
        if value is not None and value < 0:
            raise ValueError("activity.team_size는 0 이상이어야 합니다.")
        return value


class StarConversionResponse(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    activity_id: str | None = None
    title: str
    type: ActivityType
    star_situation: str
    star_task: str
    star_action: str
    star_result: str
    missing_fields: list[str] = Field(default_factory=list)
    review_tags: list[str] = Field(default_factory=list)


class PortfolioMetricResponse(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    value: str
    label: str


class PortfolioOverviewResponse(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str
    activity_type: ActivityType
    organization: str | None = None
    period: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    duration: str | None = None
    team_size: int | None = None
    team_composition: str | None = None
    role: str | None = None
    skills: list[str] = Field(default_factory=list)
    summary: str
    contributions: list[str] = Field(default_factory=list)


class PortfolioTextSectionResponse(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    label: str
    content: str


class PortfolioImplementationResponse(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    label: str
    summary: str
    highlights: list[str] = Field(default_factory=list)


class PortfolioResultResponse(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    label: str
    summary: str
    metrics: list[PortfolioMetricResponse] = Field(default_factory=list)


class PortfolioConversionResponse(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    activity_id: str | None = None
    project_overview: PortfolioOverviewResponse
    problem_definition: PortfolioTextSectionResponse
    tech_decision: PortfolioTextSectionResponse
    implementation_detail: PortfolioImplementationResponse
    quantified_result: PortfolioResultResponse
    role_clarification: PortfolioTextSectionResponse
    missing_elements: list[str] = Field(default_factory=list)
    review_tags: list[str] = Field(default_factory=list)


class ActivityConvertRequest(BaseModel):
    """Activity conversion request payload."""

    model_config = ConfigDict(str_strip_whitespace=True)

    activity: ActivityPayload
    target: ConvertTarget = "both"


class ActivityConvertResponse(BaseModel):
    """Converted STAR/portfolio payloads."""

    model_config = ConfigDict(str_strip_whitespace=True)

    target: ConvertTarget
    star: StarConversionResponse | None = None
    portfolio: PortfolioConversionResponse | None = None


@router.post("/convert", response_model=ActivityConvertResponse)
async def convert_activity(payload: ActivityConvertRequest) -> ActivityConvertResponse:
    """Convert a saved activity into STAR and/or portfolio-friendly payloads."""

    try:
        normalized_activity = payload.activity.model_dump()
        response_payload: dict[str, object] = {"target": payload.target}

        if payload.target in {"star", "both"}:
            response_payload["star"] = activity_to_star(normalized_activity)
        if payload.target in {"portfolio", "both"}:
            response_payload["portfolio"] = activity_to_portfolio(normalized_activity)

        return ActivityConvertResponse.model_validate(response_payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"활동 변환 실패: {str(exc)}") from exc
