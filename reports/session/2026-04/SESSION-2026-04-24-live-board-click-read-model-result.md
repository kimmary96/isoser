# SESSION-2026-04-24 live board click read model result

## changed files

- `supabase/migrations/20260424110000_add_program_detail_click_hotness.sql`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/api/programs/[programId]/detail-view/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/landing-c/_program-utils.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 랜딩 `Live Board`가 proxy hotness 대신 실제 프로그램 상세 진입 수를 우선 반영하도록 최소 안전 범위의 클릭 집계 경로를 추가했다.
- read-model `program_list_index`에 클릭 기반 정렬 근거를 넣어 `GET /programs/popular`와 `GET /programs/list?sort=popular`가 같은 기준을 공유하게 했다.
- 상세 페이지 진입 추적은 hydration 이후 BFF 1회 호출로 제한해 SSR/metadata/prefetch 과대 집계를 피하면서 기존 상세 응답 latency에 직접 부담을 주지 않도록 했다.

## impact scope

- DB: `program_detail_daily_stats` 일별 집계, `program_list_index` 클릭 메타 컬럼, `record_program_detail_view` RPC, delta/browse refresh 보강
- Backend: `popular` 정렬 read-model 경로, detail-view 기록 endpoint, popular fallback 정렬, 관련 router 회귀 테스트
- Frontend: 상세 페이지 진입 추적, `/programs` 정렬 타입 계약, 랜딩 C `Live Board` 클릭 우선 정렬 및 fallback 규칙
- Docs: 현재 동작 문서와 세션 리팩토링 로그 갱신

## preserved behaviors

- 클릭 데이터가 없는 기존 row는 `recommended_score`, 만족도, 리뷰 수 기반 기존 proxy hotness로 안전하게 fallback한다.
- `sort=default` browse/read-model 경로와 promoted layer 병합 동작은 그대로 유지된다.
- `popular` 외 browse 정렬은 기존 curated browse pool(`browse_rank <= 300`) 규칙을 유지한다.
- `Opportunity feed`와 북마크 동작, 프로그램 상세 본문 렌더링은 변경하지 않았다.

## risks / possible regressions

- read-model refresh 주기 전까지는 새 상세 클릭이 `Live Board`와 `popular` 응답에 즉시 반영되지 않을 수 있다.
- 클라이언트 추적 호출이 실패하면 해당 진입은 집계되지 않으며, 네트워크 상태에 따라 클릭 데이터가 과소 집계될 수 있다.
- `popular` 정렬은 browse curated pool을 건너뛰므로, 실제 운영 데이터 편향이 크면 특정 source 노출 비율이 달라질 수 있다.
- 추정: 현재는 사용자/세션 단위 dedupe를 넣지 않았기 때문에 같은 사용자의 반복 진입도 상세 클릭으로 누적된다. 이번 범위에서는 과대 집계보다 구현 단순성과 안정성을 우선했다.

## test points

- `backend\\venv\\Scripts\\python.exe -m pytest backend\\tests\\test_programs_router.py -q`
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit`
- `npx --prefix frontend vitest run "app/(landing)/landing-c/_program-utils.test.ts"`

## follow-up refactoring candidates

- 상세 진입 집계를 공용 analytics helper로 끌어올려 랜딩 외 다른 인기 지표와 수집 경로를 통합
- `click_hotness_score` 계산식과 Python fallback 정렬 기준을 shared spec 문서나 helper로 모아 drift 위험 축소
- `popular` 정렬에 source diversity guard나 minimum-signal threshold를 추가해 편향 노출 완화
- read-model refresh 지연이 길어질 경우 클릭 집계용 경량 증분 refresh job을 별도로 분리
