# Supervisor Inspection: TASK-2026-04-22-1618-program-detail-page

## Task Summary

- Task packet: `tasks/running/TASK-2026-04-22-1618-program-detail-page.md`
- Required frontmatter is present: `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`.
- Current `HEAD` matches `planned_against_commit`: `26572fc6e9ca08d65d9151711e426bc53cd28051`.
- Optional `planned_files` all exist.
- Optional `planned_worktree_fingerprint` matches the current planned-file snapshot: `8a5967cf38374a474d9df7fdb5202e4370acbb88e6007c856c8cabb6109e28cf`.
- The referenced HTML mockup exists locally at `C:\Users\User\Downloads\isoser-program-detail.html`.
- No significant drift was found in the directly relevant implementation area. Dirty changes exist in planned backend/docs files, but they are covered by the matching planned fingerprint and should be treated as the packet baseline.

## Touched files

Expected implementation touch set from the packet:

- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/components/landing/program-card-helpers.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

Current local diff in this planned set:

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

The frontend route, API helper, and type files in the planned set have no current diff against `HEAD`.

## Implementation outline

1. Preserve the existing `/programs` to `/programs/[id]` route contract. The list page currently links detail actions with `href={`/programs/${program.id}`}`.
2. Preserve the existing detail API contract. `frontend/lib/api/backend.ts` currently calls `GET /programs/{programId}/detail` through `getProgramDetail()`, and `frontend/app/(landing)/programs/[id]/page.tsx` already uses that helper.
3. Build the detail page around the existing `ProgramDetail` view model instead of introducing fake UI-only data.
4. Derive a frontend section model before rendering:
   - hero facts from title, provider, organizer, location, dates, teaching method, fee/support amount, status/category/source where available
   - summary/institution/schedule/eligibility/fee/contact sections from existing detail fields
   - optional sections from `curriculum`, `faq`, `reviews`, `recommended_for`, `learning_outcomes`, `career_support`, `tech_stack`, `certifications`
5. Render only sections with real values. Hide fake-review, fake-FAQ, fake-weekly-curriculum, and fake-related-program content when data is absent.
6. Add client-side interaction only where needed for tabs, active table of contents, accordions, and bookmark UI state. Keep the server data fetch and `notFound()` behavior intact.
7. Prefer component extraction for the detail page if the implementation grows: hero, tabs/TOC, sidebar, section card, and accordion are the likely split points.

## Verification plan

- `npm --prefix frontend run lint`
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit`
- If backend response mapping changes: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
- Manually verify `/programs` detail links still navigate to `/programs/[id]`.
- Manually verify a detail page with sparse data does not repeat per-field `정보 없음` and does not render fake review/FAQ/curriculum/related sections.
- Manually verify tab and TOC clicks scroll to existing sections, active TOC state updates, bookmark UI toggles, and mobile layout collapses to one column without horizontal overflow.

## Preserved behaviors

- `/programs` remains the public program listing route.
- Detail navigation remains `/programs/[id]`.
- Detail data fetch remains `getProgramDetail(id)` using `GET /programs/{program_id}/detail`.
- Existing 404 behavior should continue through `notFound()`.
- Existing landing ticker/nav usage can be preserved unless the implementer makes a scoped UI consistency decision.
- Existing `/programs`, `/compare`, landing-a/c, recommendation, and compare API behavior should remain outside the implementation blast radius.

## Risks

- The detail page is currently a server component; tabs, active TOC, accordions, and bookmark state will require a client component boundary. The implementer should keep that boundary small so data fetching stays server-side.
- The `ProgramDetail` type already includes optional arrays for curriculum, FAQ, reviews, and related-like UI needs, but real backend data may often be empty. The implementation must not compensate with hardcoded content.
- The source mockup is outside the repository. It exists on this machine, but the design reference is not portable to another worker unless copied or summarized.
- Existing dirty backend/docs changes are part of the planned fingerprint baseline. The implementer should avoid reverting them and should re-check `git status --short --branch` before closing.
