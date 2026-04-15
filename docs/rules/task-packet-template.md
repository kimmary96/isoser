---
id: TASK-YYYY-MM-DD-HHMM-short-slug
status: queued
type: feature
title: Short task title
priority: medium
planned_by: claude
planned_at: 2026-04-14T18:30:00+09:00
planned_against_commit: <git-sha>
planned_files: path/to/touched-area-a, path/to/touched-area-b
planned_worktree_fingerprint: <optional-sha256>
---
# Goal

Describe the user-visible outcome.

# User Flow

- Entry point
- Main interaction
- Save or confirm step
- Success and failure handling

# UI Requirements

- Required UI sections
- Loading state
- Error state
- Responsive constraints

# Acceptance Criteria

1. Behavior matches the intended user flow.
2. Existing layout or surrounding behavior is not broken without reason.
3. Success and failure feedback are visible where relevant.
4. Mobile and desktop layouts remain usable.

# Constraints

- Reuse existing patterns first.
- Keep changes local unless the task explicitly allows broader restructuring.
- Prefer minimal safe edits.

# Non-goals

- List what is intentionally out of scope.

# Edge Cases

- Initial load failure
- Empty state
- Permission/auth failure
- Duplicate action or repeated submission

# Open Questions

- Note unresolved product decisions if any remain.

# Transport Notes

- Local execution target: `tasks/inbox/<task-id>.md`
- Remote fallback target: `tasks/remote/<task-id>.md`
- Keep the same packet format for both paths.
- Prefer task ids and filenames that include local time for same-day sorting.
- Recommended pattern: `TASK-YYYY-MM-DD-HHMM-short-slug`
- `planned_files` / `planned_worktree_fingerprint` are optional but recommended when the task depends on a narrow touched area or verification against a nontrivial dirty worktree.
- Helper command:
  - `python scripts/compute_task_fingerprint.py --frontmatter backend/routers/programs.py backend/rag/programs_rag.py`
- Full packet scaffold helper:
  - `python scripts/create_task_packet.py --task-id TASK-YYYY-MM-DD-HHMM-slug --title "Short title" --output tasks/inbox/TASK-YYYY-MM-DD-HHMM-slug.md --files backend/routers/programs.py`
