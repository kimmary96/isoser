# SESSION-2026-05-13 Program Read Model Refresh Result

## Changed files

- `backend/routers/admin.py`
- `backend/tests/test_admin_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/ops/work24/work24-partition-sync-20260513.json`
- `reports/ops/work24/work24-seoul-preview-20260513.json`
- `reports/ops/work24/work24-seoul-sync-20260513.json`
- `reports/ops/work24/work24-seoul-sync-20260513-retry.json`
- `reports/ops/work24/work24-seoul-sync-20260513-batch10-smoke.json`
- `reports/ops/work24/work24-seoul-sync-20260513-batch25-smoke.json`
- `reports/ops/work24/work24-seoul-sync-20260513-batch50-smoke.json`

## Why changes were made

- Local public program/homepage data appeared stuck around 2026-04-28.
- DB inspection showed `program_list_index` browse rows had stale operational metadata while `programs` already contained many 2026-05-13+ Work24 rows.
- A 2026-05-13 Work24 partition sync attempt failed before upsert because sparse optional fields in a bulk PostgREST payload triggered `All object keys must match`.
- The first Seoul-only retry showed that filling missing keys with `null` is unsafe because it can overwrite PostgreSQL defaults / not-null columns such as `programs.certifications`.

## What changed

- Program admin bulk upsert now splits sparse payloads by identical key set before sending them to Supabase, preserving omitted optional fields instead of sending `null`.
- Program admin bulk upsert batch size can now be lowered with `PROGRAM_UPSERT_BATCH_SIZE`; the default remains 100.
- Added a regression test for sparse Work24/admin payload batches.
- Ran `scripts/refresh_program_list_index.py --browse-only --pool-limit 300 --browse-candidate-limit 2400` with `SUPABASE_TIMEOUT_SECONDS=120`.

## Preserved behaviors

- Existing `source_unique_key` / `hrd_id` / `title,source` conflict fallback logic is unchanged.
- Missing-column schema fallback still removes unsupported columns and retries.
- Existing table defaults and not-null column defaults are preserved for omitted fields.
- Program card, listing, detail, and landing page contracts are unchanged.

## Verification

- Related pytest selection passed: 4 tests.
- Frontend production build passed: `npm run build` in `frontend`.
- Backend `GET /programs/list?scope=default&recruiting_only=true&sort=default&limit=10&offset=0` returned top rows with deadlines/start dates on or after 2026-05-13.
- DB `program_list_index` browse pool has 300 open rows and 0 rows with `browse_rank <= 300` and `days_left < 0`.
- Local `http://127.0.0.1:3000/programs` returned 200 and did not include visible 2026-04-28 date text.
- Local `http://127.0.0.1:3000/landing-c` returned 200. A raw `2026-04-28` match remains in RSC payload as `last_detail_viewed_at`, not as a displayed training deadline.
- Seoul-only smoke applies with `PROGRAM_UPSERT_BATCH_SIZE=10`, `25`, and `50` each fetched/upserted 100 rows successfully.

## Risks / possible regressions

- Full nationwide Work24 source re-sync was intentionally narrowed to Seoul first after the user request. The failed nationwide attempt is recorded in `reports/ops/work24/work24-partition-sync-20260513.json`.
- The first Seoul-only apply run fetched 5,874 Work24 rows but failed before upsert with a `programs.certifications` not-null violation caused by the intermediate `null`-filling approach. The failure is recorded in `reports/ops/work24/work24-seoul-sync-20260513.json`.
- The second Seoul-only apply run fetched 5,883 Work24 rows but failed with Supabase statement timeout during upsert. The failure is recorded in `reports/ops/work24/work24-seoul-sync-20260513-retry.json`.
- A full Seoul batch50 retry was started after smoke success, then stopped at the user's request before completion; no final batch50-full JSON report was created.
- `refresh_program_landing_chip_snapshots` still times out at the DB statement level. The landing page has read-model/legacy fallback, but the snapshot RPC needs separate optimization.
- Rows outside the refreshed browse pool can still have stale `is_open=true` and negative `days_left`; default public browse no longer uses those rows, but non-default queries should continue relying on existing runtime filtering.

## Follow-up refactoring candidates

- Stream Work24 partition sync page-by-page or partition-by-partition with smaller upsert batches so slow API pages do not block all progress.
- Add an operator command that refreshes stale `program_list_index.days_left/is_open` globally without requiring a full source reindex.
- Optimize or bound `refresh_program_landing_chip_snapshots` to avoid statement timeout.
