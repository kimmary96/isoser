# Program List Delta Refresh Result

## Changed files
- `scripts/refresh_program_list_index.py`
- `backend/tests/test_program_list_refresh_fallback.py`
- `supabase/migrations/20260423205500_add_program_list_delta_refresh.sql`

## Why changes were made
- The legacy `refresh_program_list_index(300)` RPC still exceeded the operating Supabase statement timeout.
- The read-model maintenance path needed to stop depending on a single full-table recompute RPC.
- The default refresh flow now syncs changed or missing `programs` rows in bounded batches, then refreshes the browse pool and facet snapshot.

## What changed
- Added `refresh_program_list_delta(batch_limit)` as a corrective migration.
- Added delta candidate indexes on `programs` and `program_list_index`.
- Added an advisory transaction lock to the delta RPC so overlapping delta refreshes fail fast instead of competing inside the same write path.
- Updated `scripts/refresh_program_list_index.py` default flow:
  - run one or more delta batches,
  - then run `refresh_program_list_browse_pool`,
  - fall back to browse refresh if delta is unavailable or fails.
- Kept the legacy single full refresh available behind `--legacy-full-refresh`.

## Preserved behaviors
- Public `/programs` read-model API behavior is unchanged.
- `--browse-only` still refreshes only the browse pool.
- Existing legacy full refresh is still callable explicitly with `--legacy-full-refresh`.
- Existing browse fallback behavior is preserved when the new delta RPC has not been applied yet.

## Risks / possible regressions
- The new delta RPC must be applied to the operating DB before the default script can perform true incremental sync.
- Very large accumulated drift can require multiple runs or higher `--max-delta-batches`.
- The legacy full refresh RPC may still timeout if called explicitly; it is no longer the default operational path.

## Follow-up refactoring candidates
- Add a matching advisory lock to `refresh_program_list_browse_pool` in a follow-up migration.
- Split the repeated SQL projection used by full and delta refresh into a shared database helper when the function surface stabilizes.
- Add scheduled refresh wiring that uses the default delta path.

## Verification
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_program_list_refresh_fallback.py -q`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_program_list_refresh_fallback.py backend\tests\test_programs_router.py -q`
- Passed: `backend\venv\Scripts\python.exe -m py_compile scripts\refresh_program_list_index.py`
- Passed: `git diff --check -- scripts/refresh_program_list_index.py backend/tests/test_program_list_refresh_fallback.py supabase/migrations/20260423205500_add_program_list_delta_refresh.sql`
- Live compatibility smoke before applying the new migration passed:
  - default script reported missing `refresh_program_list_delta`,
  - then recovered through `refresh_program_list_browse_pool`,
  - `affected_rows` was `300`.
