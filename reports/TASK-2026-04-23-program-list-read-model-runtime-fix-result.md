# Result: TASK-2026-04-23-program-list-read-model-runtime-fix

## Changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/landing-a/page.tsx`
- `frontend/app/(landing)/landing-c/page.tsx`
- `supabase/migrations/20260423191000_program_list_read_model_runtime_indexes.sql`
- `supabase/migrations/20260423192000_optimize_program_list_refresh.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

After the read model was registered in Supabase, runtime testing showed two user-visible issues:

- `/programs` could show 0 rows because the API selected columns (`rating_raw`, `review_count`) that did not exist in `program_list_index`, causing read-model fallback behavior.
- Landing/program page entry remained slow because default filter options still used the legacy source-row scan before rendering.

## Core diff summary

- Removed non-read-model/detail-heavy fields from `PROGRAM_LIST_SUMMARY_SELECT`, including `compare_meta` and missing rating fields.
- Added a facet snapshot fast path for `GET /programs/filter-options` in default browse mode.
- Reused the same facet snapshot helper in `GET /programs/facets`.
- Fixed legacy fallback call from `GET /programs/list` so direct calls do not inherit FastAPI `Query(None)` defaults for unsupported filters.
- Updated landing-a and landing-c to use `listProgramsPage` instead of separate list/count or large list calls.
- Added runtime indexes for browse, deadline, and latest facet snapshot queries.
- Added an optimized refresh function migration that uses an explicit-column source projection and builds read-model search text from allowlisted summary fields rather than carrying raw source/detail payloads or `compare_meta::text` through refresh CTEs.

## Preserved behaviors

- Detail pages still read heavy fields from `programs`.
- Search mode and unsupported legacy-only filters can still fall back to existing logic.
- Existing `/programs` array response remains compatible.

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`: `87 passed`
- `npx tsc --noEmit --project tsconfig.codex-check.json`: passed
- `npm run lint`: passed
- touched-file `git diff --check`: passed

## Runtime check against Supabase

- `list_programs_page(limit=20)` returned `items=20`, `count=300`, `mode=browse`, `source=read_model`.
- Runtime was about `2.44s` from this local shell to Supabase.
- `get_program_filter_options()` returned from facet snapshot in about `0.3s`.
- `scripts/refresh_program_list_index.py --pool-limit 300` reproduced the current live RPC statement timeout before the corrective migration is applied.

## Remaining risk

- The new runtime index and refresh-function corrective migrations still need to be applied in Supabase.
- The optimized refresh function could not be live-tested from this shell because service-role REST can call existing RPCs but cannot apply DDL migrations.
- Network distance from this local shell to Supabase dominates part of the measured latency; server-side deployment should be retested after migration.
