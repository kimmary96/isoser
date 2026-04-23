# Drift: TASK-2026-04-23-camps-list-read-model-refactor

## Reason

Supervisor inspection stopped before implementation because the optional planned-file worktree fingerprint no longer matches the current worktree.

## Fingerprint Check

- packet `planned_against_commit`: `b16f55cd6a4fd2131446f69921227870675926b8`
- current `HEAD`: `b16f55cd6a4fd2131446f69921227870675926b8`
- packet `planned_worktree_fingerprint`: `165f707f60ef2a59c4068fd42c902d873570e13f2c713fe2a6491f5da412d010`
- current planned-files fingerprint: `414908aded8ecf74de2d5e2388f3bf374d8e5aaf802c9302203e4670a59bb934`

The commit baseline still matches, but the planned-file snapshot does not. Because this packet explicitly uses `planned_files` and `planned_worktree_fingerprint` to define the accepted dirty-worktree baseline, the mismatch is material drift for the supervisor preflight.

## Additional Evidence

The task is at the supervisor-inspection stage and requested that the final result report not be written in this step, but `reports/TASK-2026-04-23-camps-list-read-model-refactor-result.md` already exists as an untracked file in the planned file set.

The directly planned files also contain staged implementation changes:

- `backend/routers/programs.py`
- `backend/services/program_list_scoring.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/program-utils.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`
- `scripts/refresh_program_list_index.py`
- `supabase/migrations/20260423170000_add_program_list_read_model.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

`git diff --cached --stat` for those planned files reports 11 files changed with 1,492 insertions and 19 deletions. The current unstaged diff additionally includes `docs/current-state.md` and `docs/refactoring-log.md`.

## Action Required

Reconcile the current worktree before implementation continues. Either:

- accept the current planned-file state as the new baseline and refresh `planned_worktree_fingerprint`, or
- move/clear the premature result report and any unintended staged changes, then regenerate the packet fingerprint.

No supervisor inspection report was created, and no source files were edited in this step.
