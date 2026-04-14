from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

try:
    from rag.collector.scheduler import run_all_collectors
    from rag.programs_rag import ProgramRecommendation, ProgramsRAG
except ImportError:
    from backend.rag.collector.scheduler import run_all_collectors
    from backend.rag.programs_rag import ProgramRecommendation, ProgramsRAG

from utils.supabase_admin import get_current_user_from_authorization, request_supabase

programs_router = APIRouter(prefix="/programs", tags=["programs"])
router = programs_router
programs_rag = ProgramsRAG()


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
    is_active: bool | None = None
    is_ad: bool | None = None
    final_score: float | None = None
    urgency_score: float | None = None
    days_left: int | None = None


class ProgramRecommendRequest(BaseModel):
    top_k: int = Field(default=9, ge=1, le=20)


class ProgramRecommendItem(BaseModel):
    program_id: str
    score: float | None = None
    reason: str
    fit_keywords: list[str] = Field(default_factory=list)
    program: ProgramListItem


class ProgramRecommendResponse(BaseModel):
    items: list[ProgramRecommendItem] = Field(default_factory=list)


def _serialize_program_recommendation(item: ProgramRecommendation) -> ProgramRecommendItem:
    return ProgramRecommendItem(
        program_id=item.program_id,
        score=item.score,
        reason=item.reason,
        fit_keywords=item.fit_keywords,
        program=ProgramListItem.model_validate(item.program),
    )


async def _fetch_program_rows(limit: int = 200) -> list[dict[str, Any]]:
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": "*",
            "is_active": "eq.true",
            "order": "deadline.asc.nullslast",
            "limit": str(limit),
        },
    )
    return rows if isinstance(rows, list) else []


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


@programs_router.get("/")
async def list_programs(
    category: str | None = None,
    scope: str | None = None,
    region_detail: str | None = None,
    limit: int = Query(default=20, ge=1),
    offset: int = Query(default=0, ge=0),
) -> Any:
    params: dict[str, Any] = {
        "select": "*",
        "limit": limit,
        "offset": offset,
        "order": "deadline.asc.nullslast",
    }
    if category:
        params["category"] = f"eq.{category}"
    if scope:
        params["scope"] = f"eq.{scope}"
    if region_detail:
        params["region_detail"] = f"eq.{region_detail}"

    return await request_supabase(method="GET", path="/rest/v1/programs", params=params)


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
    programs = await _fetch_program_rows(limit=max(payload.top_k * 10, 50))
    if not programs:
        return ProgramRecommendResponse(items=[])

    if not authorization:
        return ProgramRecommendResponse(
            items=[
                ProgramRecommendItem(
                    program_id=str(program.get("id") or ""),
                    score=program.get("final_score"),
                    reason="최근 마감 일정과 공개 정보 기준으로 우선 노출한 프로그램입니다.",
                    fit_keywords=[],
                    program=ProgramListItem.model_validate(program),
                )
                for program in programs[: payload.top_k]
                if str(program.get("id") or "").strip()
            ]
        )

    current_user = await get_current_user_from_authorization(authorization)
    profile = await _fetch_profile_row(current_user.id)
    activities = await _fetch_activity_rows(current_user.id)
    recommendations = await programs_rag.recommend(
        profile=profile,
        activities=activities,
        programs=programs,
        top_k=payload.top_k,
    )

    if not recommendations:
        return ProgramRecommendResponse(
            items=[
                ProgramRecommendItem(
                    program_id=str(program.get("id") or ""),
                    score=program.get("final_score"),
                    reason="프로필 기반 추천 데이터가 충분하지 않아 기본 프로그램 목록을 보여줍니다.",
                    fit_keywords=[],
                    program=ProgramListItem.model_validate(program),
                )
                for program in programs[: payload.top_k]
                if str(program.get("id") or "").strip()
            ]
        )

    return ProgramRecommendResponse(
        items=[_serialize_program_recommendation(item) for item in recommendations]
    )


@programs_router.post("/sync")
async def sync_programs(background_tasks: BackgroundTasks) -> dict[str, str]:
    background_tasks.add_task(run_all_collectors)
    return {"message": "동기화 시작됨", "status": "running"}
