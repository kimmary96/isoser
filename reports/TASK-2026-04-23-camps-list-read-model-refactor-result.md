# Result: TASK-2026-04-23-camps-list-read-model-refactor

## Changed files

- `docs/camps-list-refactor.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `backend/routers/programs.py`
- `backend/services/program_list_scoring.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/program-utils.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`
- `scripts/refresh_program_list_index.py`
- `supabase/migrations/20260423170000_add_program_list_read_model.sql`

## Why changes were made

The existing list flow could request and post-process up to 10,000 source rows for page entry, filters, counts, and search fallback. That preserved legacy correctness but made default browsing and filter interactions scale with the source/detail table instead of a compact list surface.

## What changed

- Added `program_list_index` as a summary read model with browse rank, search text, filter columns, score components, deadline confidence, recommendation reasons, and summary-only list fields.
- Added `program_list_facet_snapshots` and `GET /programs/facets` for precomputed browse facets.
- Added `refresh_program_list_index(pool_limit)` SQL RPC plus `scripts/refresh_program_list_index.py` for idempotent backfill/refresh.
- Added backend mode split:
  - browse: default, bounded by `PROGRAM_BROWSE_POOL_LIMIT` (default 300)
  - search: `q` or `scope=all`
  - archive: closed/recent closed scope
- Added `GET /programs/list` with `items`, `next_cursor`, `count`, `mode`, `source`, and `cache_hit`.
- Kept `GET /programs` compatible by returning a plain array and falling back to legacy behavior if the read model fails.
- Added cursor pagination with stable sort value + id cursor.
- Added `backend/services/program_list_scoring.py` for null-safe recommended score calculation.
- Updated frontend `/programs` to call `listProgramsPage`, sync `scope`/`cursor` in URL query, and show recommendation reason badges.

## Preserved behaviors

- Existing detail APIs continue reading `programs`.
- Existing `/programs` array response remains available.
- Legacy offset fallback remains for unsupported filters and read-model failures.
- Existing filter bar query-string behavior is preserved and extended with `scope`/`cursor`.

## Risks / possible regressions

- The SQL migration should be applied to staging before production because this repo has known historical schema drift around optional `programs` columns.
- Read-model count currently uses REST rows rather than a PostgREST exact count header, so it is structurally faster than source scans but still not ideal for very large `scope=all` counts.
- Frontend cursor pagination is forward-first; deep numbered pagination remains a legacy/fallback concept.
- Promoted rows are represented separately with `promoted_rank`, but frontend ad inventory is still rendered by existing `AdSlot` until product slot rules are finalized.

## Follow-up refactoring candidates

- Move remaining selection process and employment link filters into explicit read-model columns.
- Add a dedicated promoted list endpoint/layer that renders `promoted_rank <= PROGRAM_PROMOTED_SLOT_LIMIT` separately from organic items.
- Use PostgREST count headers or a count snapshot table for exact large search counts.
- Add scheduled refresh wiring after the Supabase migration is applied.

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q` passed: `85 passed`.
- `npx tsc --noEmit --project tsconfig.codex-check.json` passed.
- `backend\venv\Scripts\python.exe -m py_compile backend\services\program_list_scoring.py scripts\refresh_program_list_index.py` passed.
- `git diff --check` on touched implementation files passed. Full-repo `git diff --check` is blocked by unrelated watcher log whitespace generated outside this change.

## Performance notes

- Before: default list/count/filter paths could fetch up to `PROGRAM_SEARCH_SCAN_LIMIT` source rows and run Python deadline resolution, filtering, sorting, and counting.
- After: default browse reads `program_list_index` with `browse_rank <= 300`, summary columns only, indexed by browse rank/recommended score/id.
- Added indexes:
  - `idx_program_list_index_browse`
  - `idx_program_list_index_promoted`
  - `idx_program_list_index_search_text`
  - `idx_program_list_index_filters`
  - `idx_program_list_index_deadline`
  - `idx_program_list_index_recommended`

No live Supabase `EXPLAIN` was run in this session because the migration has not been applied to the local/remote database from this shell.

## Run Metadata

- generated_at: `2026-04-23T17:41:52`
- watcher_exit_code: `0`
- codex_tokens_used: `101,675`

## Git Automation

- status: `merged-main`
- branch: `develop`
- commit: `89fb5382c7db174a6fce11d0659cd66aaa877c00`
- note: [codex] TASK-2026-04-23-camps-list-read-model-refactor 구현 완료. Auto-promoted to origin/main.
