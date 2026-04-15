# TASK-2026-04-15-1700-recommend-data-pipeline Recovery Report

- task id: `TASK-2026-04-15-1700-recommend-data-pipeline`
- recovery action: `automatic packet refresh not applied`
- current HEAD: `33e49ae3d87fe9d20f60c1aee08a5389c67a0ba5`

## Why automatic recovery was not safe

The prior drift failure is still caused by material, uncommitted changes inside the exact runtime path this task must validate:

- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `backend/rag/chroma_client.py`
- `backend/rag/collector/scheduler.py`

Those changes alter the recommendation verification target in meaningful ways:

- request shape now includes `category`, `region`, `job_title`, and `force_refresh`
- recommendation reads can now use the `recommendations` cache table
- Chroma search behavior now includes metadata filtering and fallback behavior
- scheduler import fallback behavior changed

Refreshing the packet in place would still leave `planned_against_commit` pointing at the same `HEAD`, while the touched implementation remains materially different in the working tree. That means a watcher rerun could hit the same drift condition again without any real recovery.

## Why the task file was left unchanged

Updating `tasks/drifted/TASK-2026-04-15-1700-recommend-data-pipeline.md` would imply the packet is safely anchored to the current implementation state. It is not: the relevant implementation is currently represented by uncommitted local edits, not by a commit the packet can reliably target.

## Safe next step

Commit or intentionally revert the recommendation-path working tree changes first, then re-plan this task against that resulting repository state. After that, setting `status: queued` and updating `planned_against_commit` will be meaningful and a watcher retry can proceed without repeating the same drift failure.

## Changed files

- `reports/TASK-2026-04-15-1700-recommend-data-pipeline-recovery.md`

## Risks / possible regressions

- If the task is retried before the touched recommendation-path edits are committed or reverted, it may stop for drift again.

## Follow-up refactoring candidates

- Consider teaching the watcher/task format to distinguish committed baseline drift from intentional dirty-worktree re-plans, if dirty-worktree execution is expected in this repo workflow.

## Run Metadata

- generated_at: `2026-04-15T20:20:14`
- watcher_exit_code: `0`
- codex_tokens_used: `92,987`
