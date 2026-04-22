# Supervisor Inspection: TASK-2026-04-23-0557-programs-listing-page-restructure

## Task Summary

- Packet frontmatter has required fields: `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`.
- Current `HEAD` is `7609401e9dc6eca716ca6fc3ea313e03eea0a357`, matching `planned_against_commit`.
- No optional `planned_files` or `planned_worktree_fingerprint` metadata exists in the packet, so there is no additional fingerprint to verify.
- The worktree is dirty in the relevant area, but the dirty state matches the packet's stated baseline: Task 0555 and Task 0556 changes are already present and documented in `reports/`, `docs/current-state.md`, and `docs/refactoring-log.md`.
- No significant drift requiring a drift report was found before implementation. This task should proceed as a narrow verification/fix pass over the current `/programs` implementation, not a rebuild.

## Touched files

Expected implementation touch area:

- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- `frontend/app/(landing)/programs/bookmark-state-provider.tsx`
- `frontend/lib/types/index.ts`
- `frontend/lib/api/backend.ts`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`

Expected documentation/report touch area after implementation:

- `reports/TASK-2026-04-23-0557-programs-listing-page-restructure-result.md`
- `docs/current-state.md`, only if behavior or structure changes
- `docs/refactoring-log.md`, if any implementation change is made

## Implementation outline

- Preserve the existing three-section `/programs` structure: personalized recommendations, closing soon, and all programs.
- Verify and minimally patch URL state handling for `q`, `category_detail`, `regions`, `teaching_methods`, `cost_types`, `participation_times`, `sources`, `targets`, `selection_processes`, `employment_links`, `closed`, `sort`, and `page`.
- Keep `ProgramSort` restricted to `deadline | latest`; current frontend and backend fallback already route unknown sort values to `deadline`.
- Keep closing-soon data independent from the current all-programs page result. Current page fetches a separate `deadline` sorted `listPrograms` request with `limit: 12`, then filters D-7 in the frontend.
- Preserve required display filtering through `isDisplayableProgram`, which currently requires title, source, and deadline.
- Confirm count/list query parity for the newly connected filters across `frontend/lib/api/backend.ts` and `backend/routers/programs.py`.
- If a fix is needed, keep it local to the touched files above and avoid redesigning card UI or recommendation scoring.

## Verification plan

- `frontend`: `npx tsc --noEmit --project tsconfig.json`
- `frontend`: `npm run lint`
- `backend`: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`, or report the Python/runtime blocker if unavailable.
- `git diff --check` for touched files.
- Manual/static verification points:
  - `/programs?sort=recommended` and `/programs?sort=popular` normalize to `deadline` behavior.
  - Filter form submission resets pagination by not preserving `page`.
  - Pagination links preserve the current filters and sort.
  - Active filter chip removal preserves unrelated active filters.
  - Anonymous recommendation CTA preserves current `/programs` path and query in `redirectedFrom`.
  - Closing-soon section hides when no displayable D-7 recruiting programs exist.

## Preserved behaviors

- Existing search, category, teaching method, region, cost, participation time, recruiting-only/recent-closed, sort, count, and pagination behavior should remain intact.
- Existing Task 0555 card behavior should remain intact: card body links to detail, star button uses bookmark BFF, list cards do not reintroduce old action buttons.
- Existing Task 0556 region matching changes in `backend/routers/programs.py` should not be overwritten.
- `recommended` sort should not be reintroduced.
- `popular` sort should not be added.
- `end_date` alone should not be treated as a recruitment deadline.

## Risks

- The worktree is not a clean diff from `HEAD`; Task 0555 and Task 0556 changes are present as uncommitted work. Implementer must avoid reverting or overwriting those changes.
- `renderActiveFilters` should be checked carefully. Some chip builders may omit unrelated filters when constructing removal URLs, which can cause filter state loss even if the main form and pagination links are correct.
- Closing-soon uses a separate limited fetch and frontend D-7 filtering. This satisfies the packet's allowed approach, but sparse filtered datasets may hide the section if the first 12 deadline-sorted candidates do not include displayable D-7 rows.
- Backend tests may remain blocked in this shell if the Python 3.10 environment or dependencies are unavailable; report exact blocker rather than broadening the task.
