# TASK-2026-04-15-1700-recommend-data-pipeline Drift Report

- task id: `TASK-2026-04-15-1700-recommend-data-pipeline`
- planned_against_commit: `33e49ae3d87fe9d20f60c1aee08a5389c67a0ba5`
- current HEAD: `33e49ae3d87fe9d20f60c1aee08a5389c67a0ba5`
- conclusion: stop due to material drift in the touched implementation area

## Why this is drift

The task packet requires validating the current recommendation data pipeline against the codebase state planned for this task. Although `HEAD` matches `planned_against_commit`, the current working tree contains uncommitted changes in the exact runtime path this task must verify:

- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `backend/rag/chroma_client.py`
- `backend/rag/collector/scheduler.py`

These changes materially affect the target flow:

- recommendation request shape now includes `category`, `region`, `job_title`, and `force_refresh`
- recommendation results can now be served from the `recommendations` cache table
- recommendation persistence and cache invalidation behavior was added
- Chroma query behavior now includes metadata filtering and fallback logic
- scheduler import behavior changed for backend fallback resolution

Because this task is an operational verification of `POST /admin/sync/programs` and `/programs/recommend`, validating against the current working tree would no longer be validating the code state the task was planned against.

## Required next step

Re-plan this task against the current working tree after the recommendation-path changes are either committed intentionally or reverted, then rerun the verification task.

## Run Metadata

- generated_at: `2026-04-15T20:18:13`
- watcher_exit_code: `0`
- codex_tokens_used: `54,948`

## Run Metadata

- generated_at: `2026-04-15T20:22:37`
- watcher_exit_code: `0`
- codex_tokens_used: `61,087`
