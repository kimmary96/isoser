# Supervisor Inspection: TASK-2026-04-23-0556-address-field-and-region-matching

## Task Summary

- Packet goal: treat the address/region work as a fix/update task, not a greenfield implementation.
- Required frontmatter is present: `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit`.
- Current `HEAD` is `7609401e9dc6eca716ca6fc3ea313e03eea0a357`, matching `planned_against_commit`.
- Optional `planned_files` and `planned_worktree_fingerprint` metadata are not present in the running packet, so there is no packet fingerprint to verify.
- Dependency `TASK-2026-04-23-0555-program-card-redesign-with-relevance` is now present under `tasks/done/`, and its supervisor verification report has been manually resolved to `accepted`.
- No significant packet drift was found. A previous recovery report recorded a dependency block, but the current repository state no longer matches that blocked condition.
- The current worktree is dirty. Relevant overlap exists in `backend/routers/programs.py`, `frontend/lib/types/index.ts`, `docs/current-state.md`, and `docs/refactoring-log.md`. The implementer should preserve those existing in-flight changes and only patch remaining gaps.

## Touched files

- `supabase/migrations/20260423100000_add_address_to_profiles.sql`
  - Already tracked at `HEAD`.
  - Adds nullable `profiles.address`, `profiles.region`, and `profiles.region_detail`, plus an index on `profiles.region`.
- `frontend/app/api/dashboard/profile/route.ts`
  - Already contains 17-region alias parsing.
  - `PUT` and `PATCH` normalize address input into `address`, `region`, and `region_detail`.
  - Missing optional profile columns fall back by dropping address/region fields, preserving older DB compatibility.
- `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx`
  - Already includes a free-text address input near basic profile information.
- `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
  - Already initializes address state, pre-fills it from `profile.address`, submits it in the profile `FormData`, and invalidates recommendation cache after save.
- `frontend/app/dashboard/profile/_components/profile-hero-section.tsx`
  - Already displays `profile.region` and optional `profile.region_detail`, not raw `profile.address`.
- `frontend/app/dashboard/profile/page.tsx`
  - Already wires the address input props through `ProfileEditModal`.
- `frontend/lib/types/index.ts`
  - Already includes profile address fields.
  - Worktree also adds Task 1 relevance response fields and listing filter params.
- `backend/routers/programs.py`
  - Worktree contains region matching helpers, adjacent region groups, online/hybrid keywords, `score_breakdown`, `relevance_reasons`, `relevance_grade`, and `relevance_badge`.
  - Current implementation appears to use 15% region contribution when profile region/address exists, and no-address fallback keeps the existing relevance score path.
- `backend/rag/programs_rag.py`
  - No direct worktree diff for this task area was observed.
- `backend/tests/test_programs_router.py`
  - Already includes tests for region signal, adjacent region, online program scoring, and sparse profile fallback.

## Implementation outline

- Start from the existing address/profile implementation. Do not add another migration or duplicate address state unless a concrete gap is found.
- Inspect `backend/routers/programs.py` first for remaining acceptance gaps:
  - Confirm final scoring weights match the packet: job 30, skills 25, experience 15, region 15, readiness 10, behavior 5.
  - Confirm no-address fallback uses the packet's temporary no-region weights: job 35, skills 30, experience 20, readiness 10, behavior 5.
  - Confirm online returns 12/15 region contribution and hybrid returns 10/15.
  - Confirm explicit `teaching_method` online/hybrid signals are handled before free-text fallback.
  - Confirm program region source priority is respected: `region`, display `location`, then `compare_meta.region`, `compare_meta.location`, `compare_meta.address`.
  - Confirm region reasons never expose raw address, district, road name, or lot-level detail.
- Inspect frontend profile flow only for gaps. It already supports address input, save, and normalized display.
- If edits are needed, keep them local to the directly touched profile API/UI, types, backend scoring helpers, and focused tests.

## Verification plan

- Run a focused TypeScript/lint check for the frontend if frontend files are touched:
  - `npm run lint` in `frontend`
  - `npx tsc --noEmit --project tsconfig.json` in `frontend`
- Run focused backend checks if backend files are touched:
  - `python -m py_compile backend/routers/programs.py`
  - `python -m pytest backend/tests/test_programs_router.py` if Python 3.10 is available
- Add or update focused tests for:
  - profile address parsing and normalized region display
  - no-address relevance fallback
  - exact 시/도 match = 15
  - adjacent 시/도 match = 10
  - online = 12
  - hybrid = 10
  - relevance reasons exposing only 시/도-level region text

## Preserved behaviors

- Existing nullable DB behavior for old profile rows must remain.
- Existing `@supabase/ssr` cookie session flow in the profile route must remain.
- Existing profile save fields, avatar upload validation, and profile write rate limiting must remain.
- Existing Task 1 relevance response contract must remain compatible.
- Existing program listing/filter changes in the dirty worktree should not be reverted as part of this task.
- Program region matching failure must not fail the full recommendation or compare relevance response.

## Risks

- The worktree is not clean and includes accepted Task 1 changes plus adjacent listing filter work. The implementer must avoid reverting or overwriting unrelated in-flight edits.
- `docs/current-state.md` and `docs/refactoring-log.md` already describe address/region behavior as current state, so this task may be mostly duplicate/fix-update. Re-implementing it would increase regression risk.
- The current backend scoring appears to add region by blending `relevance_score * 0.85 + region_match_score * 0.15`; that may not fully satisfy the packet's explicit integer breakdown and no-address reweighting requirements. This should be verified before coding.
- Existing region reason text appears to use normalized region labels, but the implementer must verify it cannot include `region_detail`, raw address, or detailed `location` text.
- Backend pytest may be blocked if the active shell still lacks the repository-required Python 3.10 runtime.
