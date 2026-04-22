# Result: TASK-2026-04-22-landing-page-c-change

## Changed files

- `frontend/app/page.tsx`
- `frontend/middleware.ts`
- `frontend/lib/routes.ts`
- `frontend/lib/program-filters.ts`
- `frontend/app/api/auth/google/route.ts`
- `frontend/app/auth/callback/route.ts`
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(landing)/landing-a/page.tsx`
- `frontend/app/(landing)/landing-a/_content.ts`
- `frontend/app/(landing)/landing-a/_navigation.tsx`
- `frontend/app/(landing)/landing-c/page.tsx`
- `docs/current-state.md`
- `docs/auth/supabase-auth-local.md`
- `docs/auth/supabase-auth-production.md`
- `docs/refactoring-log.md`

## Why changes were made

- The user clarified that the intended change was to make landing C the main landing page.
- Root, OAuth, auth callback, and login fallback defaults still pointed to landing A.
- Landing C had CTA destinations that were technically routable but not always aligned with their labels or the intended dashboard continuation flow.
- Landing C chip category values for `AI·데이터`, `IT·개발`, and `경영` did not match the backend category values used by the current program API.
- Follow-up refactoring requested shared defaults, shared chip mappings, hash-preserving login redirects, and common header UI.

## Preserved behaviors

- `/landing-a` and `/landing-b` remain accessible as preserved landing variants.
- `/programs`, `/compare`, `/programs/[id]`, and `/dashboard#recommend-calendar` route contracts were reused.
- Unauthenticated users who enter protected dashboard routes still go through `/login?redirectedFrom=...`.
- New users without a profile still go to `/onboarding` after OAuth callback.
- Landing A keeps its section order and program feed behavior while using the shared chip filter helper.

## Risks / possible regressions

- A browser-typed `/dashboard#recommend-calendar` direct request cannot expose the hash to middleware because URL fragments are not sent to servers; CTA links preserve the hash by putting the encoded target in `redirectedFrom`.
- `frontend/app/dashboard/layout.tsx` still uses the dashboard shell plus landing-style header pattern; this task only unified public landing headers.

## Verification

- `npm run lint -- --file "app/page.tsx" --file "middleware.ts" --file "app/api/auth/google/route.ts" --file "app/auth/callback/route.ts" --file "app/(auth)/login/page.tsx" --file "app/(landing)/landing-c/page.tsx"`
- `npm run lint -- --file "app/page.tsx" --file "middleware.ts" --file "app/api/auth/google/route.ts" --file "app/auth/callback/route.ts" --file "app/(auth)/login/page.tsx" --file "app/(landing)/landing-a/page.tsx" --file "app/(landing)/landing-a/_content.ts" --file "app/(landing)/landing-a/_navigation.tsx" --file "app/(landing)/landing-c/page.tsx" --file "lib/routes.ts" --file "lib/program-filters.ts"`
- `npx tsc -p tsconfig.codex-check.json --noEmit`
- `Invoke-WebRequest http://localhost:3000/ -MaximumRedirection 0` returned `307` with `Location: /landing-c`.
- `Invoke-WebRequest http://localhost:3000/landing-c` returned `200`.
- `Invoke-WebRequest "http://localhost:3000/login?redirectedFrom=%2Fdashboard%23recommend-calendar"` rendered a Google OAuth href containing `/api/auth/google?next=%2Fdashboard%23recommend-calendar`.

## Follow-up refactoring candidates

- Consider moving landing footer and program card helpers into explicit shared landing modules if more landing variants are kept.
- Add unit tests for `resolveInternalPath`, `getLoginHref`, and `buildProgramFilterParams`.
