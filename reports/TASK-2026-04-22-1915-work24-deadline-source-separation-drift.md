# Drift: TASK-2026-04-22-1915-work24-deadline-source-separation

## Summary
- Supervisor inspection stopped before implementation because the optional `planned_worktree_fingerprint` no longer matches the current worktree.
- `planned_against_commit` matches current `HEAD`, so this is not commit drift.
- The directly relevant source/test implementation area already contains the Work24 deadline separation behavior, but the packet's planned-files snapshot is no longer the same as the current worktree.

## Packet metadata
- `planned_against_commit`: `eb7a6d7e2828c76abf682fe0f478c538d3cd397e`
- current `HEAD`: `eb7a6d7e2828c76abf682fe0f478c538d3cd397e`
- packet `planned_worktree_fingerprint`: `a8d6fd0be8b8b5ccdf7551e6fda879d61817bea09523b73a8122d880f2be4c56`
- current planned-files fingerprint: `b089a6cd84d10afeccfa55c2d3c0cbc05b2a0d497f14d3d5c6f8b56bddd80eb1`

## Files inspected
- `AGENTS.md`
- `docs/agent-playbook.md`
- `tasks/running/TASK-2026-04-22-1915-work24-deadline-source-separation.md`
- `docs/current-state.md`
- `backend/rag/collector/program_field_mapping.py`
- `backend/routers/admin.py`
- `scripts/program_backfill.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`
- `backend/tests/test_admin_router.py`
- `backend/tests/test_program_backfill.py`
- `reports/TASK-2026-04-22-1915-work24-deadline-source-separation-recovery.md`
- `dispatch/alerts/TASK-2026-04-22-1915-work24-deadline-source-separation-drift.md`
- `dispatch/alerts/TASK-2026-04-22-1915-work24-deadline-source-separation-recovered.md`

## Drift evidence
- Current `git status --short --branch` shows unrelated dirty worktree changes in frontend profile files, watcher ledgers, and docs.
- The planned files themselves also differ from the packet fingerprint:
  - `docs/current-state.md` has an added profile address/region state note.
  - `docs/refactoring-log.md` has an added profile address/region refactoring entry.
  - `reports/TASK-2026-04-22-1915-work24-deadline-source-separation-result.md` is deleted in the worktree even though it is part of `planned_files`.
- `scripts/compute_task_fingerprint.py` over the packet `planned_files` returned `b089a6cd84d10afeccfa55c2d3c0cbc05b2a0d497f14d3d5c6f8b56bddd80eb1`, not the packet value.

## Relevant implementation observation
- `backend/rag/collector/program_field_mapping.py` maps Work24 `traEndDate` to `end_date` and `compare_meta.training_end_date`, and does not emit `raw_deadline` for Work24.
- `backend/routers/admin.py` normalizes Work24 rows so missing deadlines stay `None`, and `deadline == end_date` is dropped for Work24.
- `scripts/program_backfill.py` includes the `--work24-deadline-audit` dry-run path and suspect detection for Work24 `deadline == end_date`.
- The related tests cover Work24 no-deadline behavior, distinct Work24 deadline preservation, K-Startup deadline preservation, and dry-run audit reporting.

## Required next action
- Refresh or replan the task packet against the current worktree before implementation continues.
- Do not create `reports/TASK-2026-04-22-1915-work24-deadline-source-separation-supervisor-inspection.md` from this inspector run.

## Run Metadata

- generated_at: `2026-04-23T06:06:48`
- watcher_exit_code: `0`
- codex_tokens_used: `89,468`
