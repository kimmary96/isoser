# camps-list-read-model-refactor blocked

## Reason

The requested work is a production-level implementation task, but it was provided as a conversational prompt rather than a repository task packet.

`AGENTS.md` requires every implementation task to include these frontmatter fields before code changes:

- `id`
- `status`
- `type`
- `title`
- `planned_at`
- `planned_against_commit`

Because those required fields are missing, repository rules require this blocked report and stopping before implementation.

## Requested scope summary

- Refactor camps/programs listing performance with a list read model.
- Split default browsing, full search, and archive/recent closed behavior.
- Add cursor pagination, recommended sorting, browse pool limits, facet snapshots/cache, summary-only list responses, frontend URL query synchronization, migrations, backfill, tests, and performance validation.

## Initial repository facts checked

- `docs/rules/session-start-template.md` exists and defines the session start response format.
- `docs/agent-playbook.md` confirms `AGENTS.md` and the current task packet are required early reads.
- `docs/current-state.md` already documents the current `/programs` URL-query filter flow, backend `/programs` API usage, recent search/filter migrations, and known deadline handling constraints.
- Current worktree is not clean; unrelated existing edits/untracked files are present and were not modified.

## Required unblock

Create or provide a task packet with the required frontmatter, preferably under `cowork/packets/` or `tasks/inbox/`, using the current `HEAD` as `planned_against_commit`.

Suggested task id:

`TASK-2026-04-23-camps-list-read-model-refactor`

## No code changes made

No implementation, migration, API, frontend, or test files were changed.
