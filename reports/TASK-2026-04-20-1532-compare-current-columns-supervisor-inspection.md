# Supervisor Inspection: TASK-2026-04-20-1532-compare-current-columns

## Task Summary

- Packet frontmatter is present and valid: `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`.
- Current `HEAD` is `c297240c32b48f454167b8628ddccd6e5841145b`, while the task was planned against `b994efe8e9ba084b7a73e601bec0a3e7a8b7872f`.
- Drift since the planned commit was checked first in the directly relevant area.
- `frontend/app/(landing)/compare/page.tsx` and `frontend/app/(landing)/compare/programs-compare-client.tsx` have no committed drift relative to the planned commit.
- Committed drift in the task-adjacent area is limited to `backend/routers/programs.py` and `frontend/lib/types/index.ts`, and the changes are calendar recommendation additions rather than compare-page contract changes.
- The packet's current-reality assumptions still hold at current `HEAD`:
  - compare route is `/compare`
  - compare implementation is centered in `frontend/app/(landing)/compare/page.tsx` and `frontend/app/(landing)/compare/programs-compare-client.tsx`
  - backend program fetch still uses `select="*"` in `backend/routers/programs.py`
  - current collector/normalizer path still writes a limited operational field set and does not populate `compare_meta` as a reliable default compare source
- Optional metadata such as `planned_files` or `planned_worktree_fingerprint` is not present in the packet, so there was nothing extra to verify.
- There is unrelated local worktree activity, including an unstaged change in `backend/rag/collector/scheduler.py`, but it does not materially invalidate this task's compare-page assumptions.

## Touched files

- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `frontend/lib/types/index.ts`
- `frontend/app/(landing)/compare/page.tsx`

## Implementation outline

- Replace the compare table's default dependency on `compare_meta` rows with rows sourced from current `Program` fields that are already returned by the backend.
- Keep the current slot handling, URL `ids` normalization, recommendation cards, and compare relevance flow intact.
- Simplify the card header chips to currently reliable fields only: deadline/D-day, source, optional `teaching_method`, optional `support_type`.
- Rebuild the table sections around current operational fields:
  - basic information
  - operational information
  - program overview
- Introduce targeted formatters for:
  - `"정보 없음"` on genuinely empty current fields
  - `"데이터 미수집"` on source-dependent operational metadata such as period/support/teaching/certification where absence likely means not collected
  - boolean display for `is_certified` and `is_active`
  - support link fallback summary from `application_url` -> `source_url` -> `link`
- Remove the current default rendering dependence on `compare_meta` recruitment-target and hurdle sections without deleting the type or column itself.

## Verification plan

- Run `git diff --check -- "frontend/app/(landing)/compare/programs-compare-client.tsx" "frontend/lib/types/index.ts"` after implementation.
- Type-check the touched frontend area if feasible.
- Manually verify `/compare` behavior for:
  - unchanged slot add/remove and URL sync
  - reduced mass exposure of `"정보 없음"` caused by missing `compare_meta`
  - correct use of `"데이터 미수집"` on source-variant operational fields
  - intact recommendation/relevance sections

## Preserved behaviors

- `/compare` route stays unchanged.
- Slot count, slot replacement/removal behavior, and URL `ids` state stay unchanged.
- Existing recommendation card flow stays unchanged.
- Existing compare relevance API flow stays unchanged.
- Backend fetch model remains the same in this step; no API or collector edits are required for inspection.

## Risks

- `Program` field optionality is high, so formatter boundaries between `"정보 없음"` and `"데이터 미수집"` need to be applied consistently to avoid new ambiguity.
- `is_certified = false` may mean explicit negative data for some sources and unknown data for others; the implementation should not silently reinterpret `false` as missing.
- `application_url` fallback behavior must stay consistent with the existing CTA expectations so compare rows and CTA actions do not diverge.
- The dirty local worktree in unrelated areas means implementation should stay narrowly scoped and avoid incidental edits.
