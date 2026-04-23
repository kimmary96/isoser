# Recovery Report: TASK-2026-04-23-camps-list-read-model-refactor

## Summary

Automatic recovery was safe because the previous drift was a deterministic packet baseline problem, not a missing credential, approval, product decision, or other external prerequisite.

The task packet was updated in place at `tasks/drifted/TASK-2026-04-23-camps-list-read-model-refactor.md` so another watcher run can retry against the current validated worktree snapshot.

## What changed in the packet

- Set `status` from `in_progress` to `queued`.
- Kept `planned_against_commit` at the current `HEAD`: `b16f55cd6a4fd2131446f69921227870675926b8`.
- Added `auto_recovery_attempts: 1`.
- Added `planned_files` for the directly relevant read-model implementation, refresh script, Supabase migration, frontend list surface/API/types/score utility, tests, runtime docs, refactoring log, and expected result report.
- Added `planned_worktree_fingerprint: 165f707f60ef2a59c4068fd42c902d873570e13f2c713fe2a6491f5da412d010`.
- Added a recovery baseline note clarifying that the current partial `/programs` implementation should be treated as the retry baseline and reused or revised rather than duplicated.

## Why retry is now safe

The drift report showed that `planned_against_commit` already matched `HEAD`, but the relevant worktree was dirty and the packet had no fingerprint metadata acknowledging that state. I inspected only the directly relevant dirty implementation area:

- `backend/routers/programs.py`
- `backend/services/program_list_scoring.py`
- `scripts/refresh_program_list_index.py`
- `supabase/migrations/20260423170000_add_program_list_read_model.sql`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/program-utils.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`

Those files confirm partial implementation for the same original intent: list read-model helpers, recommended scoring, new list/facet response models, cursor support, fallback behavior, a refresh RPC script, a Supabase read-model migration, frontend API and response types, score display support, backend tests, and a small table rendering adjustment. No evidence in the inspected files indicated that retry depends on new human input.

The new planned-file fingerprint gives the watcher a concrete snapshot to compare before implementation, so the same dirty-worktree condition should be evaluated as an intentional baseline rather than untracked drift.

## Preserved behaviors

- No source files were modified by this recovery step.
- The original task intent and constraints were preserved.
- Existing partial implementation was not accepted as complete; the packet still requires normal duplicate detection, implementation validation, tests, result reporting, and docs updates during the watcher run.

## Risks / possible regressions

- The partial implementation may still be incomplete or incorrect. The retry should inspect and test it before adding more code.
- The planned-file list intentionally includes the expected result report path even though it does not exist yet, matching the implementation workflow.
- Unrelated dirty worktree files remain outside this recovery scope and were not touched.

## Follow-up refactoring candidates

- Keep read-model query construction and cursor handling small enough to test independently.
- Add focused tests for recommended score calculation and read-model fallback behavior.
- Recheck whether frontend callers should migrate to `/programs/list` or preserve the existing `/programs` array response path for compatibility.

## Run Metadata

- generated_at: `2026-04-23T17:39:38`
- watcher_exit_code: `0`
- codex_tokens_used: `139,936`
