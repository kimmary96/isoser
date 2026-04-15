---
id: TASK-2026-04-14-2328-watcher-polling-note
status: queued
type: docs
title: Document watcher polling interval in current state
planned_by: codex
planned_at: 2026-04-14T23:28:03+09:00
planned_against_commit: cc03ef1e6e1917e85420cb8ddd337a1cf23ae5bc
---
# Goal

Clarify in project documentation that the local watcher polls `tasks/inbox/` on a 10 second loop instead of implying an unspecified watch mechanism.

# User Flow

- A maintainer reads `docs/current-state.md` to understand how local task execution works.
- The maintainer sees the practical watcher behavior, including the 10 second polling cadence.
- The maintainer can compare the documentation with `watcher.py` without ambiguity.

# UI Requirements

- None. Documentation-only task.

# Acceptance Criteria

1. `docs/current-state.md` explicitly mentions the 10 second polling loop for local watcher execution.
2. The wording stays aligned with the current `watcher.py` implementation.
3. No application code or runtime behavior changes.

# Constraints

- Keep the change docs-only.
- Use the smallest safe wording change.
- Do not broaden the task into a general documentation cleanup.

# Non-goals

- Changing the watcher interval.
- Editing unrelated workflow docs unless required for consistency.

# Edge Cases

- If `docs/current-state.md` already states the 10 second polling behavior clearly, write a drift report instead of making a redundant edit.

# Open Questions

- None.
