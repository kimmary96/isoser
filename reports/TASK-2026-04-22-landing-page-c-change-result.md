# Result: TASK-2026-04-22-landing-page-c-change

## Changed files

- `frontend/app/page.tsx`
- `frontend/middleware.ts`
- `frontend/lib/routes.ts`
- `frontend/lib/routes.test.ts`
- `frontend/lib/program-filters.ts`
- `frontend/lib/program-filters.test.ts`
- `frontend/components/landing/LandingHeader.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/app/(landing)/compare/page.tsx`
- `frontend/app/(landing)/landing-b/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/components/landing/program-card-helpers.ts`
- `frontend/package.json`
- `frontend/package-lock.json`
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
- Follow-up implementation moved the common landing header and program card helpers into `frontend/components/landing/` and added Vitest unit coverage for route/filter helpers.
- Risk-management follow-up upgraded Next.js and `eslint-config-next` from the vulnerable 15.1.x line to 15.5.15.
- Landing C program cards were simplified into information-first cards without image slots, summary fallback text, generic tags, compare CTA, or Isoser relevance score.
- Landing C Live Board now labels the section as recommended postings and selects one active deadline-sorted posting each from 고용24, 창업진흥원/K-Startup, and 새싹/SeSAC independently of the Opportunity feed.
- Landing C Opportunity feed cards now use title, provider, and training period as the main body; fee, location, 내배카 필수, and satisfaction are rendered as tags, with detail and compare actions at the bottom.
- Landing C hero now includes a `내 이력 등록` CTA next to the programs CTA and routes unauthenticated users through login back to `/onboarding` for PDF resume parsing.
- Landing C now includes the landing-A-style six-step circular flow section between Opportunity feed and Career Asset Workspace, restyled to match landing C.
- Landing C removed the separate Journey section and moved Circular flow into that former position after the feature preview section.
- The landing C common header is now applied to programs, program detail, compare, landing B, and dashboard layout pages.

## Preserved behaviors

- `/landing-a` and `/landing-b` remain accessible as preserved landing variants.
- `/programs`, `/compare`, `/programs/[id]`, and `/dashboard#recommend-calendar` route contracts were reused.
- Unauthenticated users who enter protected dashboard routes still go through `/login?redirectedFrom=...`.
- New users without a profile still go to `/onboarding` after OAuth callback.
- Landing A keeps its section order and program feed behavior while using the shared chip filter helper.
- Landing A/C now share the same public landing header implementation and program card helper functions.
- Production dependency audit now reports 0 vulnerabilities after the Next.js 15.5.15 upgrade.
- Landing C program cards now emphasize title, provider, deadline, support/subsidy signal, operating method/location, and a single `과정 보기` action.
- Landing C Live Board excludes expired postings through the recruiting-only deadline list, so each source slot advances to the next upcoming posting after deadlines pass.
- Opportunity feed compare actions link to `/compare?ids=<programId>` so the selected program is preloaded on the compare page.
- The new hero resume CTA uses the shared login redirect helper, so the `/onboarding` target is encoded instead of hardcoded into auth pages.
- The new circular flow section is static content only and does not change program fetching, filtering, comparison, or onboarding routing behavior.
- Removing Journey only changes landing page section order/content density; CTA links and card actions are preserved.

## Risks / possible regressions

- A browser-typed `/dashboard#recommend-calendar` direct request cannot expose the hash to middleware because URL fragments are not sent to servers; CTA links preserve the hash by putting the encoded target in `redirectedFrom`.
- Dashboard layout now uses the shared landing header; its sidebar offset assumes the current shared header height, so future header height changes should update the layout offset together.
- `next lint` is deprecated in Next.js 15.5.15 and prints a migration notice toward the ESLint CLI; the command still passes and remains the current repo script.
- `npm install` reported a Windows cleanup warning for an old SWC binary temp folder, but install completed and all subsequent checks passed.

## Verification

- `npm run lint -- --file "app/page.tsx" --file "middleware.ts" --file "app/api/auth/google/route.ts" --file "app/auth/callback/route.ts" --file "app/(auth)/login/page.tsx" --file "app/(landing)/landing-c/page.tsx"`
- `npm run lint -- --file "app/page.tsx" --file "middleware.ts" --file "app/api/auth/google/route.ts" --file "app/auth/callback/route.ts" --file "app/(auth)/login/page.tsx" --file "app/(landing)/landing-a/page.tsx" --file "app/(landing)/landing-a/_content.ts" --file "app/(landing)/landing-a/_navigation.tsx" --file "app/(landing)/landing-c/page.tsx" --file "lib/routes.ts" --file "lib/program-filters.ts"`
- `npm --prefix frontend run lint`
- `npm --prefix frontend test` passed 2 files / 7 tests.
- `npm audit --omit=dev` returned `found 0 vulnerabilities`.
- `./node_modules/.bin/tsc --noEmit`
- `npm --prefix frontend run build`
- `npm run lint -- --file "components/landing/LandingHeader.tsx" --file "components/landing/program-card-helpers.ts" --file "app/(landing)/landing-a/_navigation.tsx" --file "app/(landing)/landing-a/_program-feed.tsx" --file "app/(landing)/landing-a/_shared.ts" --file "app/(landing)/landing-c/page.tsx" --file "lib/routes.ts" --file "lib/program-filters.ts" --file "lib/routes.test.ts" --file "lib/program-filters.test.ts"`
- `npx tsc -p tsconfig.codex-check.json --noEmit`
- `npm run lint` passed after the Next.js 15.5.15 upgrade.
- `npm run build` passed on Next.js 15.5.15.
- `npm run lint -- --file "app/(landing)/landing-c/page.tsx"` passed after the card redesign.
- `npx tsc -p tsconfig.codex-check.json --noEmit` passed after the card redesign.
- `npm run build` passed after the card redesign.
- Fresh dev server on `http://localhost:3025/landing-c` returned `200`; agent-browser reported no Next.js error overlay and rendered the redesigned `과정 보기` card actions.
- `Invoke-WebRequest http://localhost:3000/ -MaximumRedirection 0` returned `307` with `Location: /landing-c`.
- `Invoke-WebRequest http://localhost:3000/landing-c` returned `200`.
- `Invoke-WebRequest "http://localhost:3000/login?redirectedFrom=%2Fdashboard%23recommend-calendar"` rendered a Google OAuth href containing `/api/auth/google?next=%2Fdashboard%23recommend-calendar`.
- `npm run lint -- --file "app/(landing)/landing-c/page.tsx" --file "lib/routes.ts" --file "lib/routes.test.ts"` passed after adding the onboarding resume CTA.
- `npm test -- --run lib/routes.test.ts` passed after adding the onboarding redirect expectation.
- `npm run lint -- --file "app/(landing)/landing-c/page.tsx"` passed after adding the circular flow section.
- `npm run lint -- --file "app/(landing)/landing-c/page.tsx"` passed after moving Circular flow and removing Journey.
- `npm run lint -- --file "components/landing/LandingHeader.tsx" --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/[id]/page.tsx" --file "app/(landing)/compare/page.tsx" --file "app/(landing)/landing-b/page.tsx" --file "app/dashboard/layout.tsx"` passed after applying the shared header.
- `npx tsc -p tsconfig.codex-check.json --noEmit` passed after applying the shared header.

## Follow-up refactoring candidates

- Consider moving landing footer into `frontend/components/landing/` if more landing variants keep sharing footer structure.
- Consider adding render tests for `LandingHeader` once a React component test environment is configured.
