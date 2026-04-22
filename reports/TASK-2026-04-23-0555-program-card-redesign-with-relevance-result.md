# Result: TASK-2026-04-23-0555-program-card-redesign-with-relevance

## Changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- `frontend/app/api/dashboard/bookmarks/[programId]/route.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`

## Why changes were made

- Program list cards now use a shared `ProgramCard` that removes the old `상세 보기`, `비교에 추가`, and `지원 링크` action buttons from in-scope list cards.
- Card body navigation and bookmark mutation are separated: the card body links to `/programs/{id}`, while the star button stops event propagation and uses the frontend dashboard bookmark BFF route.
- `compare-relevance` and `/programs/recommend` response models now include `relevance_reasons`, `score_breakdown`, `relevance_grade`, and `relevance_badge` while retaining existing compatibility fields.
- Recommendation cards filter out relevance scores below 40% and list cards filter out programs missing title, deadline, or source.
- The in-flight implementation had two concrete safety gaps: backend list/count source filtering was not fully wired through `_count_program_rows`, and `recommended` sort was exposed despite being a packet non-goal. These were corrected with minimal edits.

## Preserved behaviors

- Existing response fields such as `relevance_score`, `matched_skills`, `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`, `region_match_score`, and `matched_regions` remain present.
- Existing list search, category, region, teaching method, cost, participation time, recruiting-only, recent-closed, and pagination flows remain in place.
- Dashboard calendar recommendation cards and program detail page cards were not intentionally redesigned for this task.
- Region/address-adjacent fields already present in the worktree were preserved for the follow-up address/region task.

## Risks / possible regressions

- The worktree already contained broad in-flight changes before this implementer step, including adjacent region matching and listing filter work. This report documents the final task area, but it is not a clean single-author diff from `HEAD`.
- Backend pytest could not run in this shell because the repository guard requires Python 3.10.x and the available `python` is 3.13.2.
- Bookmark button initial state is local `false`; existing bookmarked state display may need a later read-side wiring pass if the product requires prefilled bookmark status.
- The BFF bookmark route maps upstream mutation failures to a generic `400` except unauthenticated `401`, which is acceptable for this minimal pass but loses exact upstream status detail.

## Verification

- Passed: `python -m py_compile backend/routers/programs.py`
- Passed: `npm run lint` in `frontend`
- Passed after manual follow-up: `npx tsc --noEmit --project tsconfig.json` in `frontend`
- Passed: `git diff --check` for the relevant touched files
- Not run: `python -m pytest backend/tests/test_programs_router.py` because Python 3.10.x is not available in the current shell.

Manual follow-up note:

- The initial verifier found stale `recommended` sort UI/type entries that were outside Task 0555 scope.
- Those entries were removed from the programs page/filter bar and `ProgramSort`, then `tsc`, lint, and diff whitespace checks passed.

## Follow-up refactoring candidates

- Move relevance grade, badge, and reason construction into a small backend relevance helper module once Task 2 settles region policy.
- Add read-side bookmark state to `ProgramCard` callers so the star reflects existing saved bookmarks on first render.
- Split listing filters from card redesign work if the source/target filter additions remain part of Task 3 rather than this packet.
