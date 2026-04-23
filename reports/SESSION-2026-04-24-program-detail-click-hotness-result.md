# SESSION-2026-04-24 program detail click hotness result

## changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/api/programs/[programId]/detail-view/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `supabase/migrations/20260424110000_add_program_detail_click_hotness.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 프로그램 상세 진입 수를 read model에 반영해 `/programs/popular`이 실제 클릭 신호를 기준으로 정렬할 수 있게 하려 했다.
- 상세 진입 기록은 브라우저에서 직접 backend를 치지 않고 기존 Next.js BFF 경유 패턴으로 맞췄다.
- 테스트에서 endpoint 함수를 직접 호출할 때 `sort`가 FastAPI `Query` 객체로 들어와 promoted/default browse 로직이 비정상적으로 건너뛰는 회귀를 함께 막았다.

## preserved behaviors

- 기본 browse/read-model 정렬과 promoted layer는 `sort=default`일 때 기존처럼 유지된다.
- `popular` 외 browse mode는 계속 `browse_rank <= 300` curated pool을 사용한다.
- legacy fallback 경로는 read model 실패 시 그대로 남아 있다.

## risks / possible regressions

- detail-view RPC를 호출하는 프론트 경로가 늘면서 상세 페이지 진입 시 네트워크 실패 로그가 더 자주 보일 수 있다.
- click hotness는 일별 집계와 read-model refresh 주기에 의존하므로, refresh가 지연되면 인기 정렬 반영도 늦어진다.
- `popular` 정렬은 browse pool을 건너뛰므로, 운영 데이터 편향이 크면 특정 source가 더 자주 노출될 수 있다.

## follow-up refactoring candidates

- 상세 페이지 렌더 경로에 `trackProgramDetailView()` 호출 위치를 고정하고 중복 호출 방지 전략을 명시화
- click hotness와 recommendation score 가중치를 pure helper로 분리해 SQL/Python 정렬 계약을 더 쉽게 비교
- 인기 정렬 노출 품질을 검증하는 API/BFF 통합 테스트 추가
