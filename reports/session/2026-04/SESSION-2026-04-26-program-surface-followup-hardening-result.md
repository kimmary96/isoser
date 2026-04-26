# SESSION-2026-04-26 Program Surface Follow-up Hardening

## Changed files
- `supabase/migrations/20260426170000_add_verified_self_pay_surface_and_restore_landing_snapshot_rpc.sql`
- `supabase/migrations/20260426171000_fix_landing_snapshot_conflict_target.sql`
- `backend/routers/programs.py`
- `backend/schemas/programs.py`
- `scripts/backfill_work24_browse_pool_self_pay.py`
- `backend/tests/test_program_list_refresh_fallback.py`
- `backend/tests/test_programs_router.py`
- `backend/tests/test_work24_browse_pool_self_pay_backfill_script.py`
- `frontend/lib/types/index.ts`
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-card-summary.test.ts`
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `frontend/app/dashboard/_hooks/recommend-calendar-cache.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- `program_list_index`에는 지금까지 검증 자부담 전용 컬럼이 없어, canonical `support_amount`와 legacy `subsidy_amount` 의미가 다시 섞일 여지가 있었다. 이를 줄이기 위해 additive `verified_self_pay_amount` 컬럼과 계산 helper를 넣고, trigger가 read-model row마다 검증 자부담을 명시적으로 승격하도록 보강했다.
- landing snapshot RPC drift 때문에 live에서 `refresh_program_landing_chip_snapshots(...)`가 빠진 상태였고, snapshot payload도 explicit self-pay를 따로 갖지 않았다. corrective migration이 snapshot table/policy/function을 idempotent하게 다시 만들고, snapshot item에 `support_amount`, `verified_self_pay_amount`, legacy `subsidy_amount` bridge를 함께 싣도록 정리했다.
- Work24 전체를 무차별 재수집하지 않고도 표면 영향이 큰 후보부터 보강할 수 있도록, top browse pool 300건 기준 bounded detail backfill 스크립트를 추가했다.

## Preserved behaviors
- 기존 카드/helper의 소비 계약은 유지했다. backend serializer, frontend summary loader, dashboard cache normalizer가 모두 `verified_self_pay_amount`를 내부적으로 `support_amount/subsidy_amount`로 bridge하므로, 기존 컴포넌트를 대거 바꾸지 않고도 새 read-model 컬럼을 사용할 수 있다.
- 고용24 비용 표시는 계속 보수적으로 유지된다. explicit self-pay 증거가 없으면 총 훈련비로 fallback 하지 않고 `자부담 정보 확인 필요`를 유지한다.
- non-Work24 일정 우선순위, 공통 D-day badge, landing snapshot 성능 최적화 경로는 이번 변경에서 그대로 유지했다.

## Risks / possible regressions
- live apply 중 기존 함수 파라미터명 drift(`p_surface`) 충돌이 확인돼 migration은 기존 snapshot 함수를 먼저 `drop` 후 recreate 하도록 보강했다.
- timeout 위험을 줄이기 위해 full `program_list_index` touch update와 immediate snapshot backfill 호출은 migration에서 제거했고, apply 후 별도 refresh 단계로 분리했다.
- 이어서 runtime `column reference "surface" is ambiguous`가 한 번 더 확인돼, function-only follow-up migration으로 conflict target을 `program_landing_chip_snapshots_pkey` 기준으로 고정했다.
- `verified_self_pay_amount`는 conservative 계산이라, 일부 legacy row는 이전처럼 금액을 억지로 보여주지 않고 계속 `확인 필요`로 남을 수 있다.

## Verification
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_dual_write.py backend/tests/test_program_backfill.py backend/tests/test_program_list_refresh_fallback.py backend/tests/test_programs_router.py backend/tests/test_work24_browse_pool_self_pay_backfill_script.py`
- `npm test -- lib/program-display.test.ts lib/server/program-card-summary.test.ts 'app/(landing)/landing-c/_program-utils.test.ts'`
- `npx tsc --noEmit --pretty false`
- live SQL Editor: `select public.refresh_program_list_browse_pool_resilient(300, 1200);`, `select public.refresh_program_landing_chip_snapshots('landing-c', 24);`
- `backend\venv\Scripts\python.exe scripts\backfill_work24_browse_pool_self_pay.py --help`

## Follow-up candidates
- `scripts/backfill_work24_browse_pool_self_pay.py --apply --refresh-after-apply`를 운영 runbook에 추가해 browse pool 상위 Work24 detail 보강을 반복 작업으로 정착
- landing snapshot SQL에서 `verified_self_pay_amount` 계산식을 helper CTE로 한 번 더 정리해 중복 expression을 줄이기
