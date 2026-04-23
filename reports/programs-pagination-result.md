# Result: programs-pagination

## Changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/lib/api/backend.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

The programs page showed `1 / 15` while the table contents changed after clicking `다음`. The read-model transition left the page in a cursor-only navigation branch, so `cursor` changed the rows but the `page` query and numbered controls did not advance.

## What changed

- `GET /programs/list` now accepts `offset` on the read-model path.
- The frontend `listProgramsPage` helper forwards `offset`.
- The `/programs` page now requests read-model rows by `page`-derived offset and renders numbered pagination (`이전 1 2 3 다음`) instead of the cursor-only `처음/다음` controls.
- Existing filters, sort, category, recruiting, and closed/recent scope query state are preserved in pagination links.

## Preserved behaviors

- Cursor support remains available in the backend API for direct callers.
- The legacy list fallback still uses offset pagination.
- Count display and total page calculation remain based on the API count.

## Risks / possible regressions

- Deep numbered pages use PostgREST offset on `program_list_index`. This is acceptable for the current browse pool of 300, but cursor pagination may still be preferable if the browse pool grows substantially.
- If the requested `page` is larger than the current total page count after filters change, the label clamps to the last page while the first request may have used the stale larger offset.

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`: `91 passed`
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit`: passed
- `npm --prefix frontend run lint`: passed
- Live Supabase read-model check: `offset=0` and `offset=20` both returned `20` items, `count=300`, `source=read_model`, with different first item ids.

## Follow-up refactoring candidates

- Clamp out-of-range page query values with a redirect after count is known.
- Extract the repeated pagination link parameter construction into a small local helper to reduce JSX duplication.
