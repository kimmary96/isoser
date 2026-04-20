from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Header
from pydantic import BaseModel, ConfigDict, Field

from routers.coach import CoachFeedbackApiResponse, CoachMessage, CoachRequest, get_coach_feedback
from routers.programs import (
    CalendarRecommendResponse,
    ProgramRecommendRequest,
    ProgramRecommendResponse,
    recommend_programs,
    recommend_programs_calendar,
)

router = APIRouter(prefix="/assistant", tags=["assistant"])

AssistantIntent = Literal["coach", "recommend", "recommend_calendar", "clarify"]
PreferredAssistantIntent = Literal["coach", "recommend", "recommend_calendar"]

COACH_KEYWORDS = (
    "coach",
    "feedback",
    "rewrite",
    "revise",
    "improve",
    "edit",
    "polish",
    "resume",
    "cover letter",
    "activity",
    "\ucf54\uce58",
    "\ucf54\uce6d",
    "\ud53c\ub4dc\ubc31",
    "\ucca8\uc0ad",
    "\uc790\uc18c\uc11c",
    "\ud65c\ub3d9",
    "\ub9ac\ub77c\uc774\ud2b8",
    "\ub2e4\ub4ec",
    "\uace0\uccd0",
    "\ubb38\uc7a5",
)

RECOMMEND_KEYWORDS = (
    "recommend",
    "suggest",
    "program",
    "course",
    "bootcamp",
    "training",
    "calendar",
    "deadline",
    "\ucd94\ucc9c",
    "\ud504\ub85c\uadf8\ub7a8",
    "\uac15\uc758",
    "\uce98\ub9b0\ub354",
    "\uc77c\uc815",
    "\ub9c8\uac10",
    "\uc9c0\uc6d0\uc0ac\uc5c5",
    "\ud6c8\ub828",
    "\ubd80\ud2b8\ucea0\ud504",
)

CALENDAR_KEYWORDS = (
    "calendar",
    "deadline",
    "schedule",
    "due",
    "d-day",
    "\uce98\ub9b0\ub354",
    "\uc77c\uc815",
    "\ub9c8\uac10",
    "\ub370\ub4dc\ub77c\uc778",
    "\ub9c8\uac10\uc77c",
)

COACH_STRONG_PATTERNS = (
    "rewrite",
    "improve this",
    "feedback on",
    "edit this",
    "cover letter",
    "resume",
    "\ucf54\uce58",
    "\ucf54\uce6d",
    "\ud53c\ub4dc\ubc31",
    "\ucca8\uc0ad",
    "\uc790\uc18c\uc11c",
    "\ubb38\uc7a5",
    "\ub2e4\ub4ec",
)

RECOMMEND_STRONG_PATTERNS = (
    "recommend",
    "suggest programs",
    "which program",
    "program recommendation",
    "\ucd94\ucc9c",
    "\ud504\ub85c\uadf8\ub7a8",
    "\uc9c0\uc6d0\uc0ac\uc5c5",
    "\ud6c8\ub828",
)


class AssistantMessageRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1)
    session_id: str | None = None
    user_id: str | None = None
    history: list[CoachMessage] = Field(default_factory=list)
    activity_description: str | None = None
    job_title: str = "General"
    section_type: str = "\ud504\ub85c\uc81d\ud2b8"
    category: str | None = None
    region: str | None = None
    top_k: int = Field(default=5, ge=1, le=20)
    force_refresh: bool = False
    include_calendar: bool = False
    preferred_intent: PreferredAssistantIntent | None = None


class AssistantToolCall(BaseModel):
    name: Literal["coach_feedback", "recommend_programs", "recommend_calendar", "clarify"]
    summary: str


class AssistantMessageResponse(BaseModel):
    intent: AssistantIntent
    reply: str
    tool_call: AssistantToolCall
    coach_result: CoachFeedbackApiResponse | None = None
    recommendation_result: ProgramRecommendResponse | None = None
    calendar_result: CalendarRecommendResponse | None = None


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.casefold()).strip()


def _count_keyword_hits(message: str, keywords: tuple[str, ...]) -> int:
    normalized = _normalize_text(message)
    return sum(1 for keyword in keywords if _normalize_text(keyword) in normalized)


def _contains_any(message: str, phrases: tuple[str, ...]) -> bool:
    normalized = _normalize_text(message)
    return any(_normalize_text(phrase) in normalized for phrase in phrases)


def _detect_intent(payload: AssistantMessageRequest) -> AssistantIntent:
    if payload.preferred_intent is not None:
        return payload.preferred_intent

    coach_hits = _count_keyword_hits(payload.message, COACH_KEYWORDS)
    recommend_hits = _count_keyword_hits(payload.message, RECOMMEND_KEYWORDS)
    calendar_hits = _count_keyword_hits(payload.message, CALENDAR_KEYWORDS)

    coach_pattern = _contains_any(payload.message, COACH_STRONG_PATTERNS)
    recommend_pattern = _contains_any(payload.message, RECOMMEND_STRONG_PATTERNS)
    has_history = len(payload.history) > 0
    has_recommend_filters = any(
        (
            bool(payload.category),
            bool(payload.region),
            payload.force_refresh,
            payload.top_k != 5,
        )
    )

    if payload.include_calendar or calendar_hits > 0:
        return "recommend_calendar"
    if coach_pattern and not recommend_pattern:
        return "coach"
    if recommend_pattern and not coach_pattern:
        return "recommend"
    if coach_hits > 0 and recommend_hits > 0:
        if has_history and not has_recommend_filters:
            return "coach"
        if has_recommend_filters and not has_history:
            return "recommend"
        if coach_hits >= recommend_hits + 2:
            return "coach"
        if recommend_hits >= coach_hits + 2:
            return "recommend"
        return "clarify"
    if coach_hits > 0:
        return "coach"
    if recommend_hits > 0 or has_recommend_filters:
        return "recommend"
    if has_history:
        return "coach"
    return "clarify"


def _build_recommendation_reply(data: ProgramRecommendResponse) -> str:
    if not data.items:
        return "No recommendations were available for the current request."

    lines = ["Top recommendations:"]
    for index, item in enumerate(data.items[:3], start=1):
        title = str(item.program.title or item.program_id)
        reason = item.reason.strip() if item.reason else "No reason available."
        lines.append(f"{index}. {title} - {reason}")
    return "\n".join(lines)


def _build_calendar_reply(data: CalendarRecommendResponse) -> str:
    if not data.items:
        return "No calendar-ready recommendations were available."

    lines = ["Upcoming recommendation deadlines:"]
    for index, item in enumerate(data.items[:3], start=1):
        title = str(item.program.title or item.program_id)
        deadline = item.deadline or item.d_day_label
        lines.append(f"{index}. {title} - {deadline} - {item.reason}")
    return "\n".join(lines)


@router.post("/message", response_model=AssistantMessageResponse)
async def assistant_message(
    payload: AssistantMessageRequest,
    authorization: str | None = Header(default=None),
) -> AssistantMessageResponse:
    intent = _detect_intent(payload)

    if intent == "coach":
        history = [*payload.history, CoachMessage(role="user", content=payload.message)]
        coach_result = await get_coach_feedback(
            CoachRequest(
                session_id=payload.session_id,
                user_id=payload.user_id,
                activity_description=payload.activity_description or payload.message,
                job_title=payload.job_title,
                section_type=payload.section_type,
                history=history,
            )
        )
        return AssistantMessageResponse(
            intent="coach",
            reply=coach_result.feedback,
            tool_call=AssistantToolCall(
                name="coach_feedback",
                summary="Used the existing coach feedback flow.",
            ),
            coach_result=coach_result,
        )

    if intent == "recommend_calendar":
        calendar_result = await recommend_programs_calendar(
            authorization=authorization,
            top_k=payload.top_k,
            category=payload.category,
            region=payload.region,
            force_refresh=payload.force_refresh,
        )
        return AssistantMessageResponse(
            intent="recommend_calendar",
            reply=_build_calendar_reply(calendar_result),
            tool_call=AssistantToolCall(
                name="recommend_calendar",
                summary="Used the existing calendar recommendation flow.",
            ),
            calendar_result=calendar_result,
        )

    if intent == "recommend":
        recommendation_result = await recommend_programs(
            ProgramRecommendRequest(
                top_k=payload.top_k,
                category=payload.category,
                region=payload.region,
                force_refresh=payload.force_refresh,
            ),
            authorization=authorization,
        )
        return AssistantMessageResponse(
            intent="recommend",
            reply=_build_recommendation_reply(recommendation_result),
            tool_call=AssistantToolCall(
                name="recommend_programs",
                summary="Used the existing recommendation flow.",
            ),
            recommendation_result=recommendation_result,
        )

    return AssistantMessageResponse(
        intent="clarify",
        reply=(
            "I can help with two paths: coaching an activity or cover-letter draft, "
            "or recommending programs. Mention coaching or recommendation explicitly, "
            "or provide a clearer request."
        ),
        tool_call=AssistantToolCall(
            name="clarify",
            summary="No clear tool was selected from the message.",
        ),
    )
