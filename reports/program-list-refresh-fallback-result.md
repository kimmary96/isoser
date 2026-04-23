# Program List Refresh Fallback Result

## Changed files
- `scripts/refresh_program_list_index.py`
- `supabase/migrations/20260423203000_conservative_program_participation_display.sql`
- `supabase/migrations/20260423204000_add_program_list_browse_refresh_fallback.sql`
- `backend/tests/test_program_list_refresh_fallback.py`

## Why changes were made
- The operating `refresh_program_list_index(300)` RPC failed with `canceling statement due to statement timeout`.
- The full refresh recomputes and upserts the whole `programs` surface, while the immediate user-visible recovery path only needs the default browse pool and facet snapshot.
- The previous participation-display migration ended by calling the full refresh, which could make applying the migration fail on the same timeout.

## What changed
- Removed the full refresh call from `20260423203000_conservative_program_participation_display.sql`.
- Added `refresh_program_list_browse_pool(pool_limit)` as a bounded fallback RPC.
- Added a partial index for the fallback candidate scan:
  `idx_program_list_index_browse_refresh_candidates`.
- Updated `scripts/refresh_program_list_index.py` so it:
  - tries the full refresh first,
  - falls back to `refresh_program_list_browse_pool` when the full refresh fails,
  - supports `--no-fallback`,
  - supports `--browse-only`.

## Preserved behaviors
- The canonical full refresh RPC remains `refresh_program_list_index(pool_limit)`.
- Search/archive read-model rows are not deleted or rebuilt by the fallback.
- Existing `/programs` list API behavior is unchanged.

## Risks / possible regressions
- The fallback refresh uses the existing `program_list_index` as its candidate surface, so brand-new `programs` rows that have never entered the read model still require a successful full refresh.
- The fallback is intended for default browse pool recovery and facet catch-up, not as a permanent replacement for full indexing.
- The SQL migration still needs to be applied to the operating Supabase DB before the fallback RPC can be used there.

## Follow-up refactoring candidates
- Split the full read-model refresh into chunked source sync and bounded browse/facet refresh stages.
- Add an operational `EXPLAIN`/timing report for the full refresh once direct SQL access is available.
- Consider maintaining a small dirty-row queue so new/updated programs can enter the read model without full-table recompute.

## Verification
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_program_list_refresh_fallback.py -q`
- Passed: `backend\venv\Scripts\python.exe -m py_compile scripts\refresh_program_list_index.py`
- Passed: `git diff --check` for touched fallback files.
