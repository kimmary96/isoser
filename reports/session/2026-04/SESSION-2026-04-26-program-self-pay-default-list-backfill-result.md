# SESSION-2026-04-26 program self-pay default list backfill result

## Changed files
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `scripts/backfill_work24_browse_pool_self_pay.py`
- `backend/tests/test_work24_browse_pool_self_pay_backfill_script.py`
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `frontend/lib/server/public-programs-fallback.ts`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/programs/programs-table.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why
- 기본 `/programs` 목록은 필터 적용 경로와 달리 read-model select가 검증 자부담 컬럼을 싣지 않아 `자부담 정보 확인 필요` 또는 훈련비성 fallback이 남았다.
- Work24의 `support_amount`/legacy `subsidy_amount`가 총 훈련비와 같은 경우 자부담금으로 오표기될 위험이 있었다.
- `landing-c` snapshot refresh가 timeout이면 오래된 snapshot payload가 최신 DB backfill 결과를 따라가지 못했다.

## What changed
- `/programs/list` read-model select에 `verified_self_pay_amount`를 추가하고 backend serializer의 기존 bridge를 그대로 사용하게 했다.
- 비용 표시 helper는 Work24에서 명시 자부담(`verified_self_pay_amount`, `self_payment`, `out_of_pocket`)을 우선하고, 총 훈련비로 보이는 값은 자부담금으로 쓰지 않게 했다.
- 검증 자부담이 없고 훈련비만 있는 경우 `훈련비 N원`으로 표시해 부정확한 자부담금 오표기를 피했다.
- 랜딩 snapshot row는 렌더링 전에 같은 id의 최신 `program_list_index` summary로 보강한다.
- 운영 DB에 Work24 browse pool self-pay backfill을 적용했다.

## Preserved behavior
- 기존 `ProgramListItem` 응답 모델의 `compare_meta` 비노출 계약은 유지했다.
- 자부담금이 검증된 row는 기존처럼 금액만 표시한다.
- snapshot 후보/정렬 자체는 유지하고 비용 등 표시 필드만 최신 read-model로 보강한다.

## Verification
- DB backfill apply: `candidate_rows_from_program_list_index=299`, `suspicious_count=14`, `patch_count=11`, `applied_count=11`.
- Browse refresh: `status=browse_fallback_only`, `browse_rows=300`, `mode=bounded_fallback`.
- Landing snapshot RPC: failed with DB statement timeout, so frontend read-model enrichment was added as runtime safeguard.
- Default list API on 8001: first 8 rows included verified self-pay bridge for 7 rows; one row with no self-pay evidence stayed as training-fee fallback.
- Filter API smoke on 8001:
  - default: `300`, read_model, ~1.2s
  - `category_detail=ncs-02`: `75`, legacy, ~2.2s
  - `teaching_methods=오프라인`: `51`, legacy, ~40.5s
  - `teaching_methods=온라인`: `72`, legacy, ~3.0s
  - `cost_types=free-no-card`: `1`, legacy, ~1.6s
  - `cost_types=paid`: `298`, legacy, ~1.0s
  - `participation_times=part-time`: `166`, legacy, ~1.1s
- Browser QA:
  - `/programs`: column header is `비용 정보`; verified rows show amounts, unverifiable rows show `훈련비 N원`.
  - `/landing-c`: stale snapshot rows are enriched to verified self-pay amounts such as `64,800원`, `828,000원`, `855,030원`.
- Automated checks:
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_work24_browse_pool_self_pay_backfill_script.py backend/tests/test_programs_router.py -q -k "work24_browse_pool_self_pay or read_model_summary_select_excludes_heavy_detail_fields or program_surface_serializer_bridges_verified_self_pay_amount"`
  - `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py scripts\backfill_work24_browse_pool_self_pay.py`
  - `npm --prefix frontend test -- lib/program-display.test.ts lib/server/program-card-summary.test.ts`
  - `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`

## Risks / possible regressions
- `teaching_methods=오프라인` still uses a legacy scan path and was slow in local QA. It returned correctly on 8001 but took about 40 seconds.
- `refresh_program_landing_chip_snapshots` still times out at DB statement level. Runtime enrichment fixes visible cost drift but does not replace the need to optimize that RPC.
- Local port 8000 showed a stale Windows listener PID that `tasklist` did not resolve during QA. Verification used a fresh 8001 backend for current-code API smoke.

## Follow-up refactoring candidates
- Materialize `teaching_method`, cost type, and participation time derivations into `program_list_index` so common filters avoid legacy scans.
- Optimize or split `refresh_program_landing_chip_snapshots` by chip to avoid statement timeout.
- Add a small API contract test that asserts default read-model rows include `verified_self_pay_amount` when the live column exists.
