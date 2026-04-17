---
id: TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar
status: queued
type: feature
title: "프로그램 추천 하이브리드 리랭킹 + 캘린더용 엔드포인트 — 관련도 60% / 마감 임박도 40%"
planned_at: 2026-04-17T15:00:00+09:00
planned_against_commit: 5206453
priority: P0
planned_by: claude-pm
---

# Goal

사업계획서 7-1항과 9-3항에서 명시한 **하이브리드 리랭킹**(관련도 60% + 마감 임박도 40%)과 **캘린더용 추천 엔드포인트**(`GET /recommend/calendar`)를 구현한다.

현재 상태:
- `recommendations` 테이블과 24시간 캐싱 로직은 `backend/routers/programs.py`에 이미 존재한다.
- 컬럼 `similarity_score`, `urgency_score`, `final_score`, `relevance_score`는 이미 마이그레이션되어 있다.
- 그러나 실제로 저장되는 값은 `urgency_score=0`으로 하드코딩되고 있고, `final_score`도 관련도 기반 단일 점수로 채워지고 있어 **리랭킹 자체가 무력화**된 상태다.
- 대시보드 홈의 추천 카드와 `/programs`의 맞춤 섹션 모두 동일한 엔드포인트(`POST /programs/recommend`)를 쓰고 있어, 캘린더 전용 정렬/필터를 섞을 수 없다.

이 Task는 다음 세 가지를 한 번에 정리한다:
1. `urgency_score` 실계산 로직 도입 (마감일 기반 감쇠 함수)
2. `final_score = relevance_score * 0.6 + urgency_score * 0.4` 합산
3. `GET /recommend/calendar` 신규 엔드포인트 — 캘린더 뷰가 필요한 필드(마감일, D-n, 관련도, 마감 임박도)를 정리해서 반환

메인프로젝트 2 순환 플로우의 "정보 → 마감 심리 → 서류 → 지원" 중 **마감 심리**를 작동시키는 핵심 엔진.

# User Flow

내부 API 계약 변경이므로 사용자 단의 시각 흐름보다는 소비자 관점에서 흐름을 기술한다.

1. 대시보드 홈 화면은 월 단위 맞춤 일정을 받기 위해 `GET /api/dashboard/recommend-calendar`를 호출한다
2. BFF는 FastAPI의 `GET /recommend/calendar`를 호출하고, 토큰이 있으면 로그인 사용자 개인화 결과를, 없으면 비개인화 기본 추천을 반환한다
3. 각 카드는 `relevance_score`, `urgency_score`, `final_score`, `deadline`, `d_day`(D-7 등 문자열)를 받아 렌더링한다
4. 카드 정렬 기본 키는 `final_score desc`, 동점일 때는 `deadline asc`
5. 추천 결과는 `recommendations` 테이블에 24시간 TTL로 캐싱되고, 만료 시 자동 재계산된다

# UI Requirements

이 Task는 백엔드/BFF 전용이며 UI 변경은 없다. 단, 캘린더 뷰 Task(TASK-2026-04-17-1510)에서 필요한 필드를 모두 응답에 포함해야 한다.

# Acceptance Criteria

1. `GET /recommend/calendar` 엔드포인트가 FastAPI에 추가되고 OpenAPI 문서에 노출된다
2. 응답은 최소 다음 필드를 포함한다: `program_id`, `relevance_score`, `urgency_score`, `final_score`, `deadline`, `d_day_label`, `reason`, `program`(목록 카드용 기본 필드)
3. `urgency_score`는 `deadline`과 오늘 날짜의 차이를 기반으로 0~1 범위에서 계산된다 (마감 임박일수록 높음, 마감 지난 프로그램은 0 또는 응답에서 제외)
4. `final_score = relevance_score * 0.6 + urgency_score * 0.4` 로 계산되어 테이블에 저장된다
5. 기존 `POST /programs/recommend`도 동일한 `final_score` 계산 로직을 사용해, 대시보드 홈/`/programs` 맞춤 섹션의 정렬 순서가 리랭킹 반영 후 바뀌어야 한다
6. 24시간 TTL 캐싱이 유지된다 (기존 `_load_cached_recommendations` / `_save_recommendations` 재사용 또는 동일한 TTL 적용)
7. 로그인하지 않은 호출도 200을 반환하고 비개인화 기본 추천을 `urgency_score`만 기반으로 정렬해서 반환한다
8. `recommendations` 테이블 신규 컬럼이 필요한 경우 `supabase/migrations/` 아래 새 SQL 파일로 추가하고 기존 마이그레이션 파일은 수정하지 않는다
9. `frontend/lib/types/index.ts`와 `docs/specs/api-contract.md`에 신규 엔드포인트 응답 형식이 반영된다 (api-contract.md는 본 task가 읽기 전용이므로 변경 필요 시 제안만 한다 — 실 수정은 후속 task)

# Constraints

- 기존 `POST /programs/recommend` 응답 형식은 breaking 하지 않는다. 신규 필드만 additive 하게 추가한다
- `ChromaDB` 의존성을 강제하지 않는다. 벡터 유사도가 실패하면 키워드 기반 관련도(기존 `_program_match_context`)로 자동 fallback
- `urgency_score` 계산은 서버측에서만 수행한다. 프론트에서는 숫자를 받아 표시만 한다
- 기본 리랭킹 가중치(0.6 / 0.4)는 상수로 분리해 추후 튜닝 가능하게 한다 (env 변수화까지는 not required)
- 기존 마이그레이션 파일 수정 금지. 컬럼 추가가 필요하면 새 SQL 파일
- 기준 문서(CLAUDE.md, AGENTS.md, docs/ 등) 직접 수정 금지
- 실행 전 `planned_against_commit` 최신 HEAD로 교체

# Non-goals

- Sparse + Dense **벡터 기반 하이브리드 리트리버** 본격 구현은 이 task에 포함하지 않는다 (기존 키워드 기반 관련도 스코어 유지). 벡터 검색은 별도 task로 분리
- 프론트 UI 캘린더 뷰 (별도 task: TASK-2026-04-17-1510)
- 캘린더 → 이력서 프리필 흐름 (별도 task: TASK-2026-04-17-1520)
- 가중치 A/B 테스트 또는 관리자 튜닝 UI
- 추천 결과의 개인정보 마스킹 / RLS 재설계

# Edge Cases

- `deadline`이 `null`인 프로그램: `urgency_score = 0`, 정렬에서 뒤로 밀리되 응답에는 포함
- `deadline`이 이미 지난 프로그램: 응답에서 제외. 단, 캐시에 남아 있다면 필터링 후 반환
- 로그인 사용자지만 `profiles`에 아직 데이터가 거의 없는 경우: `relevance_score` 대부분 0 → `urgency_score` 중심 정렬이 되어야 한다 (잘못된 빈 응답 방지)
- `recommendations` 캐시와 현재 계산 로직이 불일치(예: 구버전 `urgency_score=0`이 저장된 상태)할 때: TTL 내라도 마감 지난 항목은 제외하고 반환
- 동시 요청에서 recommendations upsert 충돌: 기존 `on_conflict=user_id,program_id` 머지 전략 유지
- 비로그인: `recommendations` 테이블에 저장하지 않는다 (user_id가 없음)

# Open Questions

1. `urgency_score` 감쇠 함수: 단순 선형 (D-30일에 0, D-0일에 1) vs 지수형 (D-7 이하에 급격히 상승). 구현 러너가 코드 간결성 우선으로 선택하되 주석으로 근거 남길 것
2. `GET /recommend/calendar`에 `month`/`window_days` 쿼리 파라미터를 받을지 아니면 서버가 D-60 일괄 반환할지 — 기본은 "D-60 이내" 서버 결정, 클라이언트 필터링 권장
3. 마감 지난 프로그램을 응답에서 제외하는 로직 위치: FastAPI 레이어 vs `programs_rag` 유틸 — 재사용성을 고려해 유틸 레이어 권장

# Transport Notes

- 로컬 실행: `tasks/inbox/TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar.md`
- 원격 실행: `tasks/remote/TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar.md`
- 이 패킷은 `cowork/packets/` 초안이며, 사람 검토(`cowork/reviews/`) 후 실행 큐로 사본 복사
