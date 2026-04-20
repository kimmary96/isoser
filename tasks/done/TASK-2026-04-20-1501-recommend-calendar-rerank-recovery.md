---
id: TASK-2026-04-20-1501-recommend-calendar-rerank-recovery
status: queued
type: "fix/update"
title: 추천 하이브리드 리랭킹 복구 + 캘린더 전용 추천 BFF/API 재도입
priority: high
planned_by: codex
planned_at: 2026-04-20T15:35:00+09:00
planned_against_commit: b994efe8e9ba084b7a73e601bec0a3e7a8b7872f
planned_files:
  - backend/rag/programs_rag.py
  - backend/routers/programs.py
  - backend/tests/test_programs_router.py
  - frontend/app/api/dashboard/recommend-calendar/route.ts
  - frontend/lib/api/app.ts
  - frontend/lib/types/index.ts
  - docs/current-state.md
  - docs/refactoring-log.md
---

# Goal

현재 남아 있는 추천 시스템을 기준으로, 캘린더 UI 복구 전에 필요한 **하이브리드 리랭킹 규칙**과 **캘린더 전용 추천 API/BFF**를 다시 맞춘다.

현재 기준 실제 상태:

- `POST /programs/recommend`와 `frontend/app/api/dashboard/recommended-programs/route.ts`는 이미 동작한다.
- `backend/rag/programs_rag.py`는 이미 `relevance_score`, `urgency_score`, `final_score`를 계산해 반환한다.
- 다만 현재 가중치는 `relevance 0.8 / urgency 0.2`로 구현되어 있고, 복구 대상 기획은 `relevance 0.6 / urgency 0.4`를 전제로 한다.
- 캘린더 전용 BFF인 `GET /api/dashboard/recommend-calendar`는 현재 저장소에 존재하지 않는다.
- 프론트 타입에는 추천 점수 필드가 일부 남아 있지만, 캘린더 소비자용 응답 계약은 없다.

이 task는 완전 신규 추천 시스템을 만드는 것이 아니라, **이미 존재하는 추천 엔진을 현재 코드 기준으로 재조정**하고, 다음 task인 대시보드 AI 캘린더 뷰가 소비할 전용 엔드포인트를 복구하는 작업이다.

# Why Now

- 복구 우선순위상 `캘린더 추천 하이브리드 리랭크`가 첫 단계다.
- 이후 `대시보드 AI 캘린더 뷰`와 `캘린더 기반 이력서 프리필`은 이 데이터 계약을 전제로 한다.
- 현재 추천 카드 영역은 유지하되, 캘린더 전용 정렬/필드 계약을 분리하지 않으면 후속 UI task에서 API를 다시 뜯어야 한다.

# Scope

## In scope

1. 추천 점수 가중치를 현재 코드 기준에서 `0.6 / 0.4`로 재조정
2. backend 캘린더 전용 엔드포인트 추가
   - canonical backend path: `GET /programs/recommend/calendar`
3. frontend BFF 추가
   - canonical BFF path: `GET /api/dashboard/recommend-calendar`
4. 프론트에서 사용할 최소 타입/helper 보강
5. 테스트 추가 또는 기존 테스트 보강
6. `docs/current-state.md`, `docs/refactoring-log.md` 업데이트

## Out of scope

- 대시보드 캘린더 UI 자체 구현
- 캘린더 결과를 실제 월간 캘린더 컴포넌트로 렌더링하는 작업
- 이력서 프리필 UX/DB migration
- 추천 알고리즘의 전면 교체
- Chroma/vector retrieval 구조 변경
- `docs/specs/` 계약 문서 신규 작성 또는 대규모 정리

# Current Implementation Notes

- 점수 계산 핵심 책임은 `backend/rag/programs_rag.py`
- transport, cache I/O, compare relevance endpoint는 `backend/routers/programs.py`
- 기존 대시보드 추천 BFF는 `frontend/app/api/dashboard/recommended-programs/route.ts`
- 새 캘린더 BFF는 이 task에서 별도 route로 추가

# User Flow

이 task는 UI가 아니라 API/BFF 복구가 중심이다. 소비자 관점 흐름은 아래와 같다.

1. 캘린더 UI 또는 이후 대시보드 훅이 `GET /api/dashboard/recommend-calendar`를 호출한다.
2. BFF는 backend의 `GET /programs/recommend/calendar`를 호출한다.
3. 로그인 사용자면 개인화 추천을, 비로그인 사용자면 공개 추천을 반환한다.
4. backend와 BFF의 top-level 응답 shape는 둘 다 `{ items: CalendarRecommendItem[] }`로 고정한다.
5. 각 item에는 최소 `program_id`, `deadline`, `d_day_label`, `relevance_score`, `urgency_score`, `final_score`, `reason`, `program` 카드 필드가 포함된다.
6. 결과 정렬은 **캘린더 endpoint에서만** `final_score desc`를 기본으로 하고, 동점이면 `deadline asc`를 사용한다.

# Acceptance Criteria

1. `GET /programs/recommend/calendar`가 추가되고 200 응답을 반환한다.
2. `GET /api/dashboard/recommend-calendar`가 추가되고 backend 응답을 `{ items: [...] }` shape 그대로 중계한다.
3. 추천 계산은 현재 코드의 `0.8 / 0.2`가 아니라 `relevance_score * 0.6 + urgency_score * 0.4`를 사용한다.
4. 기존 `POST /programs/recommend`도 동일한 최종 점수 공식을 사용한다.
5. 캘린더 endpoint의 backend 응답 shape는 아래와 같다.
   - top-level: `{ items: CalendarRecommendItem[] }`
   - 각 item 필드:
     - `program_id`
     - `relevance_score`
     - `urgency_score`
     - `final_score`
     - `deadline`
     - `d_day_label`
     - `reason`
     - `program`
6. 캘린더 BFF 응답 shape도 backend와 동일하게 `{ items: CalendarRecommendItem[] }`를 사용한다.
7. 비로그인 호출도 200을 반환한다.
   - 비로그인일 때 `relevance_score`는 `0`으로 고정 반환하고, 응답 shape를 바꾸지 않는다.
8. 마감 지난 프로그램은 **캘린더 endpoint에서만 완전히 제외**한다.
   - 기존 `POST /programs/recommend`의 동작은 이 task에서 필수 변경 대상으로 보지 않는다.
9. `d_day_label`은 기존 프론트 포맷과 동일하게 `마감` / `D-Day` / `D-{n}` 규칙으로 고정한다.
10. 기존 recommendation cache row를 읽을 때 저장된 `final_score`를 그대로 신뢰하지 않는다.
   - `relevance_score`와 `urgency_score`가 모두 있으면 read 시점에 `0.6 / 0.4`로 `final_score`를 재계산한다.
   - 둘 중 하나라도 없으면 해당 row는 stale로 보고 fresh recommendation path로 우회한다.
11. 캘린더 endpoint의 정렬 규칙 `final_score desc, deadline asc`는 `GET /programs/recommend/calendar`와 그 BFF에만 적용한다.
   - 기존 `POST /programs/recommend`의 정렬 순서는 이 task에서 유지해도 된다.
12. `frontend/lib/types/index.ts`와 `frontend/lib/api/app.ts`에 캘린더 응답용 타입/헬퍼가 추가된다.
13. `backend/tests/test_programs_router.py` 또는 관련 테스트에 점수 가중치/응답 계약 회귀가 추가된다.
14. `docs/current-state.md`와 `docs/refactoring-log.md`가 현재 동작 기준으로 업데이트된다.

# Constraints

- 현재 동작 중인 `POST /programs/recommend`의 응답 shape를 breaking change로 바꾸지 않는다.
- backend canonical path는 `/programs/recommend/calendar`로 고정한다. `/recommend/calendar` 같은 별도 루트는 만들지 않는다.
- BFF canonical path는 `/api/dashboard/recommend-calendar`로 고정한다.
- 새 캘린더 endpoint와 BFF의 top-level 응답 shape는 `{ items: [...] }`로 고정한다.
- 기존 `frontend/app/api/dashboard/recommended-programs/route.ts`의 `{ programs: [...] }` 계약은 유지한다.
- 추천 계산 책임은 가능한 한 `backend/rag/programs_rag.py`에 두고, router는 transport/cache 조합에 집중한다.
- 캐시가 이미 존재하더라도 read 시점에는 `final_score`를 재계산하거나 stale row를 우회해야 하며, 저장된 과거 `final_score`를 그대로 노출하지 않는다.
- `docs/specs/` 문서는 이 task의 필수 수정 대상이 아니다.
- 기존 추천 카드(`recommended-programs`) 동작을 망가뜨리지 않는다.

# Duplicate / Reuse Notes

- 과거 `TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar`와 intent는 유사하지만, 현재는 저장소 기준점이 바뀌었고 추천 API 일부가 이미 살아 있으므로 **완전 신규 구현이 아니라 fix/update**로 수행한다.
- `backend/rag/programs_rag.py`의 기존 `urgency_score` 계산과 `final_score` 필드는 최대한 재사용한다.
- `frontend/app/api/dashboard/recommended-programs/route.ts`의 인증/BFF 패턴을 새 캘린더 BFF에서 재사용한다.

# Edge Cases

- `deadline`이 없는 프로그램은 `urgency_score = 0`으로 처리하되 응답 shape는 유지한다.
- 비로그인 호출은 인증 오류로 실패시키지 않는다.
- 캘린더 endpoint는 만료 프로그램을 응답에 포함하지 않는다.
- cache row에 `relevance_score` 또는 `urgency_score`가 누락돼 새 공식을 복원할 수 없으면 해당 row를 stale로 간주하고 recompute path를 사용한다.
- 추천 결과가 0건이어도 엔드포인트는 200 + 빈 배열을 반환해야 한다.

# Open Questions

없음. 구현 시 위 acceptance/constraints를 기준으로 고정한다.

# Verification

- backend test: 추천 점수 가중치, 비로그인 경로, 캘린더 응답 shape 검증
- backend test: stale cache row에서 `final_score` 재계산 또는 fresh recompute fallback 검증
- backend test: 만료 프로그램 제외 및 캘린더 전용 정렬(`final_score desc`, tie-break `deadline asc`) 검증
- frontend build/typecheck: 새 BFF와 타입 추가 후 `frontend` 빌드가 통과해야 함

# Transport Notes

- 원본 packet: `cowork/packets/TASK-2026-04-20-1501-recommend-calendar-rerank-recovery.md`
- 승인 후 local 실행 사본: `tasks/inbox/TASK-2026-04-20-1501-recommend-calendar-rerank-recovery.md`
