---
id: TASK-2026-04-15-1710-recommend-api-enhance
status: queued
type: feature
title: 추천 API 고도화 — 카테고리/지역 필터 파라미터 추가 + recommendations 캐싱 레이어
priority: high
planned_by: claude
planned_at: 2026-04-15T17:10:00+09:00
planned_against_commit: 750fba4f766f86739e94368afa8474e2edbdc6b4
---

# Goal

유저가 카테고리나 지역을 선택하면 그에 맞는 프로그램을 AI가 추천해주는 기능을 완성한다. 또한 매번 Chroma + Gemini를 호출하는 비효율을 없애기 위해 `recommendations` 테이블에 24시간 캐싱을 추가한다.

선결 조건: `TASK-2026-04-15-1700-recommend-data-pipeline` 완료 후 진행.

# User Flow

이 태스크는 백엔드 API 작업. 사용자 대면 흐름은 TASK-1720에서 처리.

1. `POST /programs/recommend` 호출 시 `category`, `region`, `force_refresh` 파라미터 포함 가능
2. 캐시가 있으면 `recommendations` 테이블에서 즉시 반환
3. 캐시 미스이거나 필터가 있으면 RAG 실행 후 결과 캐싱

# UI Requirements

해당 없음. 백엔드 API 작업.

# Acceptance Criteria

1. `POST /programs/recommend` 에 `{"top_k": 9, "category": "IT·컴퓨터"}` 전송 시 해당 카테고리 프로그램만 추천됨.
2. `POST /programs/recommend` 에 `{"top_k": 9, "region": "서울"}` 전송 시 서울 지역 프로그램 우선 추천됨.
3. 같은 유저가 2회 연속 호출 시 2번째는 `recommendations` 캐시에서 반환됨 (응답 속도가 현저히 빠름).
4. `force_refresh: true` 전달 시 캐시 무시하고 새로 추천 결과 생성됨.
5. 기존 카테고리/지역 필터 없는 기본 추천은 동작이 변하지 않음.

# Constraints

- `request_supabase` 호출 패턴은 기존 코드와 동일하게 유지.
- ChromaDB `where` 조건이 빈 컬렉션에서 실패할 경우 `where=None`으로 폴백.
- `_save_recommendations` 실패 시 예외를 삼키고 로그만 남김. 추천 결과 반환은 항상 성공.
- `programs_rag.recommend()` 호출 위치에서 `category`/`region` 인자 전달 잊지 말 것.

# Non-goals

- 추천 알고리즘 점수 공식 변경 (현재 semantic×0.8 + urgency×0.2 유지)
- 캐싱 TTL 설정을 동적으로 변경하는 기능
- 카테고리/지역 필터 UI (이 태스크는 백엔드만)

# Edge Cases

- `recommendations` 테이블이 없으면 캐시 저장 실패 → 로그 후 계속 진행
- ChromaDB에 해당 category/region 데이터가 없으면 `where` 조건 제거 후 전체 검색 폴백
- `program_ids` 캐시 조회 시 해당 program이 삭제된 경우 → 해당 아이템 스킵

# Open Questions

없음.

# Implementation Notes

## 변경 파일

- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `backend/rag/chroma_client.py`

## 1. `ProgramRecommendRequest` 파라미터 확장

파일: `backend/routers/programs.py`

```python
class ProgramRecommendRequest(BaseModel):
    top_k: int = Field(default=9, ge=1, le=20)
    category: str | None = Field(default=None, description="카테고리 필터. 예: 'IT·컴퓨터', '디자인'")
    region: str | None = Field(default=None, description="지역 필터. 예: '서울', '온라인'")
    job_title: str | None = Field(default=None, description="직무명. 프로필 보완용. 예: '백엔드 개발자'")
    force_refresh: bool = Field(default=False, description="캐시 무시하고 새로 추천")
```

## 2. `recommend_programs` 라우터에 캐싱 로직 추가

파일: `backend/routers/programs.py` — 기존 `import` 에 `datetime` 추가, 아래 헬퍼 3개 추가.

```python
from datetime import datetime, timezone, timedelta

RECOMMEND_CACHE_TTL_HOURS = 24


async def _load_cached_recommendations(user_id: str) -> list[dict] | None:
    """24시간 이내 캐시된 추천 결과를 Supabase recommendations 테이블에서 조회한다."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=RECOMMEND_CACHE_TTL_HOURS)).isoformat()
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/recommendations",
        params={
            "select": "program_id,similarity_score,urgency_score,final_score,generated_at",
            "user_id": f"eq.{user_id}",
            "generated_at": f"gte.{cutoff}",
            "order": "final_score.desc",
            "limit": "20",
        },
    )
    return rows if isinstance(rows, list) and rows else None


async def _save_recommendations(user_id: str, recommendations: list) -> None:
    """추천 결과를 Supabase recommendations 테이블에 upsert한다."""
    if not recommendations:
        return
    now = datetime.now(timezone.utc).isoformat()
    payload = [
        {
            "user_id": user_id,
            "program_id": item.program_id,
            "similarity_score": float(item.score or 0),
            "urgency_score": float(item.program.get("urgency_score") or 0),
            "final_score": float(item.score or 0),
            "generated_at": now,
        }
        for item in recommendations
        if item.program_id
    ]
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
    """유저의 기존 추천 캐시를 전부 삭제한다 (force_refresh 시 사용)."""
    try:
        await request_supabase(
            method="DELETE",
            path="/rest/v1/recommendations",
            params={"user_id": f"eq.{user_id}"},
        )
    except Exception as exc:
        log_event(logger, logging.WARNING, "recommend_cache_delete_failed", error=str(exc))
```

`recommend_programs` 라우터 함수 전체를 캐싱 로직 포함한 버전으로 교체한다. 핵심 흐름:

- 비로그인: 최신 목록 반환 (캐싱 없음)
- `force_refresh`가 아니고 필터도 없으면 캐시 조회 → 캐시 히트 시 program 상세 병합 후 반환
- 캐시 미스 또는 필터 있음: RAG 실행
- 필터 없는 기본 추천만 캐시 저장 (필터 있는 결과는 캐싱 안 함)

## 3. `_fetch_program_rows`에 category/region 필터 추가

파일: `backend/routers/programs.py`

```python
async def _fetch_program_rows(
    limit: int = 200,
    category: str | None = None,
    region: str | None = None,
) -> list[dict[str, Any]]:
    """활성 프로그램 목록을 마감일 순으로 조회한다. 카테고리/지역 필터 지원."""
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

    rows = await request_supabase(method="GET", path="/rest/v1/programs", params=params)
    return rows if isinstance(rows, list) else []
```

## 4. `_fetch_programs_by_ids` 헬퍼 추가

파일: `backend/routers/programs.py` — 캐시 히트 시 program 상세를 일괄 조회하는 헬퍼.

```python
async def _fetch_programs_by_ids(program_ids: list[str]) -> dict[str, dict[str, Any]]:
    """program_id 목록으로 programs 테이블에서 일괄 조회 후 id → row 맵 반환."""
    if not program_ids:
        return {}
    id_list = ",".join(f'"{pid}"' for pid in program_ids)
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={"select": "*", "id": f"in.({id_list})"},
    )
    if not isinstance(rows, list):
        return {}
    return {str(row.get("id")): row for row in rows if row.get("id")}
```

## 5. `ProgramsRAG.recommend()` — category/region 메타데이터 필터 반영

파일: `backend/rag/programs_rag.py`

`recommend()` 시그니처에 `category`, `region` 파라미터 추가:

```python
async def recommend(
    self,
    *,
    profile: Mapping[str, Any],
    activities: Sequence[Mapping[str, Any]],
    programs: Sequence[Mapping[str, Any]],
    top_k: int = 5,
    category: str | None = None,
    region: str | None = None,
) -> list[ProgramRecommendation]:
```

`self._manager.search()` 호출 시 `where` 조건 추가:

```python
chroma_where: dict[str, Any] | None = None
where_conditions = []
if category:
    where_conditions.append({"category": {"$contains": category}})
if region:
    where_conditions.append({"location": {"$contains": region}})
if len(where_conditions) == 1:
    chroma_where = where_conditions[0]
elif len(where_conditions) > 1:
    chroma_where = {"$and": where_conditions}

search_results = self._manager.search(
    self.collection_name, query, n_results=top_k, where=chroma_where,
)
```

파일: `backend/rag/chroma_client.py` — `search()` 시그니처에 `where` 파라미터 추가:

```python
def search(
    self,
    collection_name: str,
    query: str,
    n_results: int = 5,
    where: dict[str, Any] | None = None,
) -> list[SearchResult]:
    ...
    raw_results = collection.query(
        query_texts=[query],
        n_results=min(n_results, count),
        where=where,
        include=["documents", "metadatas", "distances"],
    )
```

# Transport Notes

- 로컬 실행 대상: `tasks/inbox/TASK-2026-04-15-1710-recommend-api-enhance.md`
- 선결 조건: `TASK-2026-04-15-1700-recommend-data-pipeline`
- 다음 태스크: `TASK-2026-04-15-1720-recommend-frontend`
