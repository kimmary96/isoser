# Supervisor Inspection: TASK-2026-04-20-1501-recommend-calendar-rerank-recovery

## Task Summary

- Packet frontmatter is present and valid for inspection.
- `planned_against_commit` is `b994efe8e9ba084b7a73e601bec0a3e7a8b7872f`, which matches current `HEAD`.
- No `planned_worktree_fingerprint` metadata is present in the packet.
- Directly relevant implementation area is consistent with the packet:
  - `backend/rag/programs_rag.py` currently computes `final_score` with `relevance * 0.8 + urgency * 0.2` in both fallback and main recommendation paths.
  - `backend/routers/programs.py` currently exposes `POST /programs/recommend`, but does not expose `GET /programs/recommend/calendar`.
  - cached recommendation reads currently reuse stored `final_score` and tolerate missing `relevance_score` by falling back to stored `final_score`, which does not satisfy the packet’s stale-cache recovery rule.
  - `frontend/app/api/dashboard/recommended-programs/route.ts` exists, but `frontend/app/api/dashboard/recommend-calendar/route.ts` does not.
  - `frontend/lib/types/index.ts` has generic recommendation types, but no calendar-specific response contract.
  - `backend/tests/test_programs_router.py` only covers query helpers today and does not cover recommendation score/cache/calendar behavior.
- Optional `planned_files` verification:
  - implementation files are clean in the worktree.
  - `docs/current-state.md` and `docs/refactoring-log.md` already have unrelated local modifications; this is not significant drift for the recommendation/calendar implementation area, but it is a merge-risk for the later documentation update step.

## Touched files

- `backend/rag/programs_rag.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/api/dashboard/recommend-calendar/route.ts` (new file expected)
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Implementation outline

1. Adjust recommendation scoring in `backend/rag/programs_rag.py` so both main and fallback paths use `relevance_score * 0.6 + urgency_score * 0.4`.
2. Add backend calendar-specific response models/helpers in `backend/routers/programs.py`, including:
   - cache-read validation/recompute logic for `final_score`
   - stale-cache fallback when either component score is missing
   - `GET /programs/recommend/calendar`
   - calendar-only filtering for expired programs and sorting by `final_score desc`, then `deadline asc`
   - non-authenticated response path with `relevance_score = 0`
   - `d_day_label` formatting contract
3. Add backend regression tests in `backend/tests/test_programs_router.py` for:
   - 0.6 / 0.4 final score computation
   - stale cache handling
   - non-authenticated calendar response contract
   - expired-program exclusion and calendar ordering
4. Add frontend BFF route at `frontend/app/api/dashboard/recommend-calendar/route.ts` mirroring the existing server-side auth forwarding pattern from `recommended-programs`.
5. Add calendar response types and client helper usage in `frontend/lib/types/index.ts` and `frontend/lib/api/app.ts`.
6. Update `docs/current-state.md` and `docs/refactoring-log.md` carefully without overwriting unrelated in-progress doc edits.

## Verification plan

- Run targeted backend tests for `backend/tests/test_programs_router.py`.
- If tests require narrower execution, run only the newly added recommendation/calendar cases first.
- Run frontend typecheck/build checks relevant to the new route and shared types.
- Manually verify the new BFF/backend contract shape remains `{ items: [...] }` for calendar and that existing `recommended-programs` stays on `{ programs: [...] }`.

## Preserved behaviors

- Existing `POST /programs/recommend` response shape should remain unchanged.
- Existing `frontend/app/api/dashboard/recommended-programs/route.ts` contract should remain unchanged.
- Existing recommendation engine structure should be reused rather than replaced.
- Existing query/list/count/program detail routes in `backend/routers/programs.py` are outside the requested change and should remain untouched.

## Risks

- `docs/current-state.md` and `docs/refactoring-log.md` already contain unrelated worktree edits, so doc updates require careful merge-aware editing.
- Cache recovery logic changes sit in the same router as the current recommendation endpoint; careless reuse could unintentionally alter existing `POST /programs/recommend` ordering or anonymous fallback behavior.
- Calendar sorting/filtering rules differ from the existing endpoint, so helper extraction must keep calendar-only logic isolated.
