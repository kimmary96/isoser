# Result: landing-c-component-refactor

## Changed files
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/landing-c/_content.ts`
- `frontend/app/(landing)/landing-c/_hero.tsx`
- `frontend/app/(landing)/landing-c/_program-feed.tsx`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/landing-c/_search.ts`
- `frontend/app/(landing)/landing-c/_styles.ts`
- `frontend/app/(landing)/landing-c/_support-sections.tsx`
- `frontend/app/(landing)/landing-c/_types.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- landing-c was implemented as one large page file, while landing-a already uses section-level files.
- The refactor keeps the public landing behavior intact but reduces the risk of future edits by separating data fetching, static content, display helpers, and section components.

## Preserved behaviors
- `/landing-c` remains the default landing route target described in current state.
- The page still uses the same metadata, `LandingHeader`, program list fetch, Live Board fetch, search query/chip handling, Opportunity feed ordering, CTA routes, detail links, compare links, and empty/error states.
- Program card labels, tag logic, D-day source selection, Live Board source selection, workflow sections, circular flow, final CTA, and footer copy were moved without intentional behavior changes.

## Risks / possible regressions
- This is a mechanical component split, so the main risk is accidental markup drift between moved JSX and the original page.
- `_support-sections.tsx` is still relatively large because it holds several static lower-page sections; this is acceptable for this step but remains a refactoring candidate.
- Browser smoke passed on a local dev server, but it used the current local data/API environment, so production data differences should still be checked during launch rehearsal.

- `npm run lint -- --file "app/(landing)/landing-c/page.tsx" --file "app/(landing)/landing-c/_hero.tsx" --file "app/(landing)/landing-c/_program-feed.tsx" --file "app/(landing)/landing-c/_support-sections.tsx" --file "app/(landing)/landing-c/_program-utils.ts" --file "app/(landing)/landing-c/_content.ts" --file "app/(landing)/landing-c/_search.ts" --file "app/(landing)/landing-c/_styles.ts" --file "app/(landing)/landing-c/_types.ts"`
- `npx tsc --noEmit -p tsconfig.codex-check.json`
- `docs/launch-smoke-test.md` now includes `/landing-c` public-entry render checks for root redirect, header links, Live Board, search/chip filter, Opportunity feed cards, and card actions.
- Local dev server smoke on `http://localhost:3031/landing-c` returned HTTP 200 and contained the hero and Opportunity feed text.
- `curl.exe -I -s http://localhost:3031/` returned `307 Temporary Redirect` with `location: /landing-c`.
- `agent-browser open http://localhost:3031/landing-c`, `wait --load networkidle`, error-overlay check, nonblank body check, interactive snapshot, and annotated screenshot passed. Key elements rendered: `프로그램 상세`, `비교`, `대시보드`, hero heading, Live Board links, search/chip controls, `과정 보기`, lower workflow/circular-flow/CTA sections.
- Annotated screenshot was saved locally at `C:\Users\User\.agent-browser\tmp\screenshots\screenshot-1776906264988.png`.

## Follow-up refactoring candidates
- Split `_support-sections.tsx` again into workflow, circular flow, CTA, and footer files if those sections start changing independently.
- Extract shared landing-a/c program display helpers for provider, location, period, and tag normalization once both variants stabilize.
- Keep `/landing-c` in the launch smoke checklist while it remains the default public landing entry.
