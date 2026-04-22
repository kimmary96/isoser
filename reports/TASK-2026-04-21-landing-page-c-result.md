# Result: TASK-2026-04-21-landing-page-c

## Changed files

- `frontend/app/(landing)/landing-c/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-21-landing-page-c-result.md`

## Why changes were made

- Added `/landing-c` from the provided `c:\Users\User\Downloads\Isoser\이소서 Landing.html` reference.
- Converted the static landing reference into a Next.js route connected to live program data and real product routes.
- Excluded the standalone edit-mode tweak panel because it is a design-authoring control, not a user-facing product feature.

## Preserved behaviors

- Existing `/landing-a`, `/landing-b`, `/programs`, `/compare`, and dashboard routes were not changed.
- Root redirect behavior to `/landing-a` remains unchanged.
- Program data still uses the existing `listPrograms` and `getProgramCount` backend helpers.

## Connected functionality

- Primary exploration CTA links to `/programs`.
- AI recommendation and free-start CTAs link to `/login`.
- Dashboard preview CTA links to `/dashboard#recommend-calendar`.
- Program detail buttons link to `/programs/[id]`.
- Compare buttons link to `/compare?ids=<program-id>`.
- Search and chip filters reload `/landing-c` with query params and backend-backed filtering.

## Risks / possible regressions

- Browser visual verification was limited because `agent-browser` is not installed on PATH in this environment.
- The page depends on the backend program API at render time; backend failures render an inline error state.
- The source HTML used static demo program data, while `/landing-c` intentionally uses live program data, so exact card content can differ from the reference.

## Verification

- `npm run lint -- --file app/(landing)/landing-c/page.tsx`
- `npx tsc -p tsconfig.codex-check.json --noEmit`
- `Invoke-WebRequest http://localhost:3000/landing-c` returned HTTP 200 against the already-running local Next server.

## Follow-up refactoring candidates

- Extract landing C sections into `_components.tsx` if more variants are added.
- Share chip-filter mapping between `landing-a` and `landing-c` to avoid drift.
- Add browser screenshot regression once `agent-browser` or Playwright is available.

