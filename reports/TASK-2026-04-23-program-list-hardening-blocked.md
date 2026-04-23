# Blocked: TASK-2026-04-23-program-list-hardening

## Reason

The requested work is an implementation task, but it was provided as a conversational prompt rather than a repository task packet.

`AGENTS.md` requires every implementation task to include these frontmatter fields before implementation:

- `id`
- `status`
- `type`
- `title`
- `planned_at`
- `planned_against_commit`

Because those required fields are missing, repository rules require this blocked report and stopping before code, migration, frontend, test, or benchmark changes.

## Requested Scope Summary

- Treat promoted/ad slots as if Fast Campus has an active sponsored placement.
- Implement the missing promoted/ad API/UI layer rather than only storing `is_ad` / `promoted_rank`.
- Fix the remaining read-model gaps identified in `reports/camps-list-refactor-current-state-audit-2026-04-23.md`, including:
  - `scope=all` read-model query behavior
  - cursor + filter condition composition
  - offset/cursor policy or better pagination path
  - recommended score consistency improvements where practical
  - facet/filter count limitations where practical
- Add or update tests for the above.
- Run relevant backend/frontend checks.
- Produce a systematic before/after performance comparison and final report.

## Initial Repository Facts Checked

- The current audit report exists at `reports/camps-list-refactor-current-state-audit-2026-04-23.md`.
- The prior read-model task was executed through a valid packet at `tasks/done/TASK-2026-04-23-camps-list-read-model-refactor.md`.
- Current worktree is already dirty with unrelated modified and untracked files. Those were not modified by this blocked report except this new file.

## Required Unblock

Create or provide a task packet with the required frontmatter, preferably under `cowork/packets/` or `tasks/inbox/`.

Suggested task id:

`TASK-2026-04-23-program-list-hardening`

Suggested title:

`Program list read-model hardening, promoted layer, and performance validation`

Use the current `HEAD` as `planned_against_commit`.

## No Implementation Changes Made

No API, frontend, migration, test, benchmark, or read-model code was changed.
