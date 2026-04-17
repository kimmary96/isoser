# TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar result

## Changed files
- `backend/rag/programs_rag.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 추천 엔진의 `final_score` 계산을 `relevance_score * 0.6 + urgency_score * 0.4`로 통일했다.
- 기존 `POST /programs/recommend`가 저장/반환하는 점수와 캐시 조회 시 재구성되는 점수를 모두 동일한 하이브리드 로직으로 맞췄다.
- 캐시된 추천을 읽을 때 현재 `deadline` 기준으로 `urgency_score`, `final_score`, `days_left`를 다시 계산하도록 바꿔, 구버전 `urgency_score=0` 캐시가 남아 있어도 응답 정렬이 무력화되지 않게 했다.
- 마감 지난 프로그램은 추천/캘린더 응답에서 제외하고, 캘린더 전용 `GET /recommend/calendar`와 BFF `GET /api/dashboard/recommend-calendar`를 추가했다.
- 프론트 타입에 `ProgramCalendarRecommendResponse`를 추가해 `deadline`, `d_day_label`, `relevance_score`, `urgency_score`, `final_score` 계약을 반영했다.

## Preserved behaviors
- 기존 `POST /programs/recommend`의 응답 shape는 유지했고, 기존 소비자에게 breaking change를 주지 않았다.
- 추천 캐시 TTL 24시간과 `recommendations` upsert 전략(`on_conflict=user_id,program_id`)은 그대로 유지했다.
- 비로그인 추천 호출은 계속 `200`을 반환하며, 비개인화 기본 추천으로 fallback 한다.
- 기존 마이그레이션 파일은 수정하지 않았고 신규 migration도 추가하지 않았다. 현재 스키마 컬럼으로 요구사항을 충족한다.

## Risks / possible regressions
- `GET /recommend/calendar`는 현재 `programs` 목록에서 최대 200건을 읽고 60일 이내 일정만 반환하므로, 향후 활성 프로그램 수가 크게 늘면 fetch limit 조정이 필요할 수 있다.
- 캘린더 응답은 `deadline`이 없는 프로그램도 포함하되 뒤로 밀기 때문에, 실제 UI가 상시 모집 카드를 어떻게 배치할지는 후속 캘린더 화면 task에서 확인이 필요하다.
- `docs/specs/api-contract.md`는 task packet 지시에 따라 수정하지 않았다. 후속 task에서 신규 엔드포인트 계약을 문서에 반영해야 한다.

## Follow-up refactoring candidates
- 추천/캘린더 공통 점수 계산을 `ProgramsRAG` 외부의 명시적 scorer 유틸로 분리해 router 내부 helper 의존을 줄일 수 있다.
- `GET /recommend/calendar`의 조회 범위(`window_days`, fetch limit)를 상수 분리 이상으로 명시적 설정값으로 승격할 수 있다.
- 캘린더 endpoint용 BFF route에 대한 Next API 테스트를 추가하면 회귀 방지에 더 유리하다.

## Verification
- `python` AST parse: `backend/routers/programs.py`, `backend/rag/programs_rag.py` 성공
- `python -m pytest backend/tests/test_programs_router.py`: 실패, 현재 환경에 `pytest` 미설치
- `python` import smoke: 실패, 현재 환경에 `bs4` 미설치로 `rag.collector.scheduler` import 중단
- `npm exec next lint ...`: 실패, 저장소에 ESLint 초기 설정이 없어 Next가 interactive setup prompt로 진입
- `npm exec tsc --noEmit --pretty false`: 기존 `.next/types/app/programs/[id]/page.ts`의 pre-existing module resolution 오류로 실패

## Run Metadata

- generated_at: `2026-04-17T12:40:36`
- watcher_exit_code: `0`
- codex_tokens_used: `219,966`
