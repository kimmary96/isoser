# Supervisor Inspection: TASK-2026-04-21-0649-landing-a-visual-revamp

## Task Summary
- Task packet: `tasks/running/TASK-2026-04-21-0649-landing-a-visual-revamp.md`
- Required frontmatter fields are present: `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`.
- `planned_against_commit` is `336e800`; current `HEAD` is `c588d46`.
- `336e800` is an ancestor of current `HEAD`.
- No diff exists between `336e800..HEAD` for the directly allowed implementation paths:
  - `frontend/app/(landing)/landing-a`
  - `frontend/public/landing-a`
- No optional `planned_files` or `planned_worktree_fingerprint` metadata is present in the packet, so there is no packet fingerprint to verify.
- The current worktree has unrelated watcher/dispatch/docs/generated state changes, but no local modifications under the directly relevant landing-a source or allowed placeholder asset path.
- Significant drift was not found for the touched area. Blocked conditions were not found.

## Touched files
- Inspect first / implementation target:
  - `frontend/app/(landing)/landing-a/page.tsx`
  - `frontend/app/(landing)/landing-a/_components.tsx`
  - `frontend/app/(landing)/landing-a/_content.ts`
  - `frontend/app/(landing)/landing-a/_styles.ts`
- Optional asset target:
  - `frontend/public/landing-a/` does not currently exist.
- Supporting documents inspected:
  - `AGENTS.md`
  - `docs/agent-playbook.md`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
  - related `reports/` entries found by narrow landing-a/task search

## Implementation outline
- Keep existing `LandingATickerBar`, `LandingANavBar`, `LandingAFilterBar`, `LandingAProgramsSection`, and `LandingAFooter` behavior intact.
- Update `LandingAHeroSection` copy and CTA labels/targets to the packet framing while preserving the current server data inputs: `featuredPrograms` and `totalCount`.
- Treat the existing hero live board as the D-Day/deadline summary strip immediately after the hero unless implementer chooses a minimal extraction/reposition inside the same landing-a component set.
- Replace or repurpose the current `LandingATrustSection`, `LandingAWorkspaceSection`, `LandingAComparisonSection`, and `LandingAJourneySection` into the requested comparison, six-step circular flow, feature preview card grid, recommendation-accuracy explanation, and KPI skeleton sections.
- Add static placeholder preview assets only under `frontend/public/landing-a/` if real dashboard captures are not available. Use stable filenames so later replacement does not require code changes.
- Keep all data fetching in `page.tsx` limited to the current `listPrograms` and `getProgramCount` calls. Do not add backend/API calls for preview cards or KPI values.
- Keep `page.tsx` section assembly within `frontend/app/(landing)/landing-a/` and avoid edits to landing-b, dashboard, API, backend, or shared docs.

## Verification plan
- Run `npm --prefix frontend run lint`.
- Run `npm --prefix frontend run build`.
- Verify `/landing-a` renders the requested 11-section order:
  1. ticker/navbar
  2. hero
  3. D-Day/deadline summary
  4. search/chip filter bar
  5. program card grid
  6. comparison section
  7. six-step circular flow
  8. four feature preview cards
  9. recommendation accuracy explanation
  10. five-item KPI skeleton
  11. bottom CTA/footer
- Verify the four feature preview cards are ordered as: program recommendation calendar, STAR coach, resume/portfolio PDF, matching score.
- Verify preview card image slots use local static paths under `/landing-a/...` and meaningful `alt` text.
- Verify the five KPI items display skeleton values such as `집계 준비 중` and do not trigger API calls.
- Verify the five requested copy edits are reflected and the four requested explanatory meta strings no longer render.
- Verify existing search input, chip filter submit behavior, program card links, compare links, navbar auth display, ticker, and footer remain usable.
- Check 375px mobile layout for vertical stacking and no horizontal overflow.

## Preserved behaviors
- `/landing-a` remains the main public landing route according to `docs/current-state.md`.
- Existing landing-a server data flow remains based on `listPrograms(programParams)` and `getProgramCount(...)`.
- Existing chip/keyword normalization in `page.tsx` should remain unchanged unless a minimal local adjustment is required.
- Existing public route structure (`landing-a`, `landing-b`, `programs`, `compare`) should remain unchanged.
- Existing login state check in `LandingANavBar` should remain unchanged.
- Existing program empty/error fallback behavior should remain unchanged.
- Existing AdSlot placement may remain between bottom CTA and footer unless the implementer confirms it conflicts with the packet's final section composition.

## Risks
- The packet asks for visual replacement of multiple landing sections, so accidental removal of current search/program card behavior is the main regression risk.
- The current code still contains requested removal strings in `LandingAProgramsSection`, `LandingAJourneySection`, and `LandingACtaSection`; implementer must remove or replace them without changing data contracts.
- `frontend/public/landing-a/` does not exist yet, so placeholder asset creation must stay within the explicitly allowed exception path.
- Current components are concentrated in one large client component file. Adding five new visual sections there may increase file size; minimal local extraction into `_content.ts` constants and small section components is preferable to a broad shared abstraction.
- `AdSlot` is currently part of the rendered page after CTA. The packet does not mention ad behavior, so preserve it unless product review says the final CTA/footer section must be uninterrupted.
