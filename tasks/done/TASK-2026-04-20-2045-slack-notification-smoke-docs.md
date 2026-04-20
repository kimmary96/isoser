---
id: TASK-2026-04-20-2045-slack-notification-smoke-docs
status: queued
type: docs
title: Document direct Slack notification smoke checks for watcher alerts
priority: low
planned_by: claude
planned_at: 2026-04-20T20:45:00+09:00
planned_against_commit: e91c440087b32fdd19cb0629ee777c0830e53372
spec_version: 2.0
request_id: TASK-2026-04-20-2045-slack-notification-smoke-docs
created_by: claude
goal: Add a small docs-only note that explains how to smoke test direct watcher Slack notifications safely.
background: Slack webhook delivery was manually verified and the operations doc should retain a minimal repeatable check.
scope_in: docs/automation/slack-approval-setup.md
scope_out: watcher runtime logic, backend Slack approval logic, product code, GitHub workflows
constraints: docs-only minimal-safe-change-only
non_goals: changing Slack app setup, changing runtime behavior, editing unrelated docs
acceptance_criteria: the slack approval setup doc includes a short direct watcher notification smoke-test note without changing the existing setup flow
risk_level: low
execution_path: local
allowed_paths: docs/automation/slack-approval-setup.md
blocked_paths: backend/.env, frontend/.env.local, supabase/migrations
prechecks: inspect-current-doc, confirm-note-is-not-already-documented
implementation_steps: inspect, update-doc, verify-doc-only-diff
tests: targeted-doc-review
artifacts: reports/TASK-2026-04-20-2045-slack-notification-smoke-docs-result.md
fallback_plan: stop-and-report
rollback_plan: revert-this-docs-task-only
dedupe_key: TASK-2026-04-20-2045-slack-notification-smoke-docs
report_format: planner-supervisor-implementer-qa
planned_files: docs/automation/slack-approval-setup.md
planned_worktree_fingerprint: 2ddbc9821769577477dee2b2cf743b603fc4a2471fd274d8146dcda0766049da
---
# Goal

Record a short repeatable smoke check for direct watcher Slack notifications in the existing Slack setup doc.

# User Flow

- Open the Slack approval setup doc
- Find the smoke test section
- See a short note for direct watcher alert smoke checks

# Acceptance Criteria

1. Only `docs/automation/slack-approval-setup.md` changes unless verification requires a scoped docs update.
2. The note reflects current behavior already verified in the repository.
3. Existing setup, approval, and slash-command instructions remain unchanged.

# Constraints

- Keep the diff small and docs-only.
- Reuse the current doc structure instead of reorganizing the page.

# Non-goals

- Changing Slack runtime logic
- Changing approval flow
- Editing watcher code

# Edge Cases

- If the doc already contains an equivalent smoke-test note, stop as duplicate instead of rewriting it.

# Open Questions

- None.
