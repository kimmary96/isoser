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

## Optional Supervisor Spec Frontmatter

아래 필드는 `spec_version`을 선언한 Supervisor 표준 packet에서 함께 사용한다.

```md
spec_version: 2.0
request_id: TASK-YYYY-MM-DD-HHMM-short-slug
created_by: claude
goal: Short task title
background: Why this task exists
scope_in: touched area only
scope_out: excluded area
constraints: minimal-safe-change-only
non_goals: broad rewrite
acceptance_criteria: see-body
risk_level: medium
execution_path: local
allowed_paths: frontend/app/example/page.tsx, backend/routers/example.py
blocked_paths: backend/.env, frontend/.env.local, supabase/migrations
prechecks: read-current-state, inspect-touched-area
implementation_steps: inspect, implement, verify
tests: targeted-tests
artifacts: reports/<task-id>-result.md
fallback_plan: stop-and-report
rollback_plan: revert-last-task-scope
dedupe_key: TASK-YYYY-MM-DD-HHMM-short-slug
report_format: planner-supervisor-implementer-qa
```

- `execution_path` 허용값: `local`, `github`, `manual-blocked`
- `risk_level` 허용값: `low`, `medium`, `high`, `critical`
- `allowed_paths`와 `blocked_paths`가 겹치면 watcher가 실행 전에 차단한다.

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
  - `python scripts/create_task_packet.py --supervisor-spec --task-id TASK-YYYY-MM-DD-HHMM-slug --title "Short title" --output tasks/inbox/TASK-YYYY-MM-DD-HHMM-slug.md --files backend/routers/programs.py`
