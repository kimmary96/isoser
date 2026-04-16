# TASK-2026-04-16-1600-prototype-qa-fixes result

## changed files
- `frontend/app/(landing)/landing-a/page.tsx`
- `frontend/app/(landing)/landing-a/_components.tsx`
- `frontend/app/(landing)/landing-b/_components.tsx`
- `frontend/app/(landing)/programs/page.tsx`

## why changes were made
- `landing-a` was switched from local placeholder state to backend-driven program rendering so the search field and filter chips now change the actual displayed program list.
- `landing-a` placeholder buttons without behavior were replaced with safe navigation targets for program detail, external apply links, compare entry, and the deadline-focused browse action.
- `/programs` cards now expose a working "비교에 추가" path into `/compare?ids=...`, covering the previously missing compare action.
- `landing-b` received the missing explicit input labeling and progressbar semantics so the remaining QA acceptance items are covered without changing the quiz flow.

## preserved behaviors
- Existing landing layout, visual hierarchy, and navigation structure were kept intact.
- `/programs` server-side filtering, sorting, pagination, and active filter chip behavior were preserved.
- Compare-page URL-based slot handling and login-gated resume CTA behavior were not changed.

## risks / possible regressions
- `landing-a` chip mapping still relies on coarse mappings (`경영 -> 경영·마케팅`, `국비100% -> keyword search`) because the backend does not expose dedicated filter params for every prototype chip.
- `landing-a` hero and card counts now depend on backend availability; when the backend is unavailable the section shows an error/empty state instead of static mock data.
- Non-interactive verification required a temporary TypeScript config because the repo's default `tsconfig.json` includes stale `.next/types` entries, and `next lint` still prompts for initial ESLint setup.

## follow-up refactoring candidates
- Extract the repeated program-card formatting helpers used across `landing-a` and `/programs` into a shared presenter/helper module.
- Add first-class backend filters for subsidy rate and richer landing chip semantics instead of using keyword fallback.
- Initialize a committed ESLint config so `npm run lint` can be used in CI and task verification without interactive prompts.

## verification
- `npm run lint` could not be completed because `next lint` opened the interactive ESLint setup prompt.
- `npx tsc --noEmit` with the repo default config failed on stale `.next/types/app/programs/[id]/page.ts` references unrelated to these edits.
- Targeted check passed with a temporary config excluding `.next`: `npx tsc --noEmit -p tsconfig.codex-check.json`

## Run Metadata

- generated_at: `2026-04-16T14:37:49`
- watcher_exit_code: `0`
- codex_tokens_used: `215,589`
