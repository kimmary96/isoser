# Supervisor Inspection: TASK-2026-04-24-1030-program-list-followup-hardening

## Task Summary

- Packet type: `fix/update`
- Goal: harden the existing `/programs` read-model list contract around promoted layer handling and query/filter/cursor combinations without changing visible user behavior.
- Planned against commit: `3d973498973065c2427585631e836ee33fad5954`
- Current HEAD inspected: `da5f2996fca12b230a0bd11b6d4b5e6ce765c6af`
- Drift assessment: acceptable for implementation start.
  - The directly relevant planned files do not show `planned_against_commit..HEAD` changes.
  - Current worktree has unrelated changes, but not in the task's directly touched implementation area.
  - `planned_worktree_fingerprint` is not present in the packet, so only `planned_files` and direct worktree state were verified.

## Touched files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/lib/types/index.ts`
- `frontend/app/(landing)/programs/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-24-1030-program-list-followup-hardening-result.md`

## Implementation outline

1. Inspect the existing promoted/organic split in `backend/routers/programs.py`, especially first-page browse behavior, `is_ad` handling, promoted fallback provider matching, and dedupe between `promoted_items` and organic `items`.
2. Tighten read-model query contract coverage in `backend/tests/test_programs_router.py` for query/filter/cursor combinations that can regress silently.
3. Confirm backend response contract still matches frontend expectations in `frontend/lib/types/index.ts` and `frontend/app/(landing)/programs/page.tsx`, limiting any type change to contract clarification only.
4. If behavior or contract wording changes materially, update `docs/current-state.md` and append a concise entry to `docs/refactoring-log.md`.
5. Write the final implementation result report after code and verification are complete.

## Verification plan

- Run targeted backend tests centered on `backend/tests/test_programs_router.py`.
- Verify promoted/organic dedupe remains enforced when sponsored fallback rows overlap with organic results.
- Verify browse first page still exposes the promoted layer separately from organic items.
- Verify read-model query parameter construction still preserves expected behavior for `q`, filters, `scope`, `offset`, and `cursor` combinations.
- Run frontend type check only if backend contract changes require TypeScript confirmation.

## Preserved behaviors

- `/programs` visible UX remains offset/page-based for the main table.
- `GET /programs/list` keeps returning `promoted_items` separately from organic `items`.
- Browse-mode organic read-model queries keep promoted rows out of the organic result set.
- Search/filter flows should continue to use the current read-model contract where already supported, with legacy fallback behavior preserved where applicable.

## Risks

- Query-condition hardening in `backend/routers/programs.py` can regress PostgREST boolean-expression composition, especially when cursor and region/query filters combine.
- Promoted fallback logic currently depends on provider-match assumptions rather than a dedicated ad model, so small contract changes can affect which rows are treated as sponsored.
- Test additions may expose already latent ambiguity around when promoted rows should appear outside first-page browse mode; if found, that should be treated as a scope clarification, not a broad redesign.
