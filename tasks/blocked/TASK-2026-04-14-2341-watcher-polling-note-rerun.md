---
id: TASK-2026-04-14-2341-watcher-polling-note-rerun
status: queued
type: docs
title: Rerun watcher polling note smoke task after encoding fix
planned_by: codex
planned_at: 2026-04-14T23:41:00+09:00
planned_against_commit: cc03ef1e6e1917e85420cb8ddd337a1cf23ae5bc
---
# Goal

Rerun the watcher smoke-test path after the watcher logging fix and confirm the current docs state is still handled as a no-op drift decision.

# User Flow

- A maintainer places this task packet into `tasks/inbox/`.
- The watcher moves it into `tasks/running/`.
- Codex checks the current docs state and determines the request is already satisfied.
- The watcher writes a drift report and moves the task to `tasks/blocked/`.

# UI Requirements

- None. Documentation-only task.

# Acceptance Criteria

1. The watcher runs the task end-to-end without crashing.
2. A drift report is generated because the requested docs wording is already present.
3. No additional docs or app code edits are made.

# Constraints

- Keep the task docs-only.
- Do not expand scope beyond verifying the rerun path.

# Non-goals

- Further wording changes to `docs/current-state.md`.
- Any application feature work.

# Edge Cases

- If the watcher cannot move the task due to a local file lock, write a blocked report instead of crashing.

# Open Questions

- None.
