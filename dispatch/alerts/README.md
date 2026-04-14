# Watcher Alerts

`dispatch/alerts/` is the root-level terminal alert channel for the local implementation watcher.

It is not part of `cowork/`.

## Purpose

- make `completed`, `drift`, `blocked`, and `push-failed` states visible without opening `reports/`
- keep a repository-local alert trail even if Slack delivery fails
- separate execution outcomes from cowork packet review/promotion notes

## Ownership

- producer: `watcher.py`
- optional mirror channel: Slack via `SLACK_WEBHOOK_URL`
- consumer: human maintainer or Dispatch-style review workflow

## File naming standard

- `dispatch/alerts/<task-id>-completed.md`
- `dispatch/alerts/<task-id>-drift.md`
- `dispatch/alerts/<task-id>-blocked.md`
- `dispatch/alerts/<task-id>-push-failed.md`

## Body format standard

Every alert file uses this flat frontmatter-like structure:

```text
# Alert: <task-id>

type: watcher-alert
stage: <completed|drift|blocked|push-failed>
status: <done|action-required>
severity: <info|warning|error>
packet: `<tasks/... path>`
created_at: `<ISO timestamp>`
report: `<reports/... path>`          # optional when no report exists
summary: <one-line human summary>
next_action: <single concrete next step>
```

## Stage rules

### `completed`
- status: `done`
- severity: `info`
- packet path should point to `tasks/done/...`
- summary should say whether the task was pushed or completed without a new commit
- next action is usually informational

### `drift`
- status: `action-required`
- severity: `warning`
- packet path should point to `tasks/drifted/...`
- report path should point to `reports/<task-id>-drift.md`
- next action should tell the maintainer to regenerate or revise the task packet against current `HEAD`

### `blocked`
- status: `action-required`
- severity: `error`
- packet path should point to `tasks/blocked/...` unless the task never entered running
- report path should point to `reports/<task-id>-blocked.md` when present
- next action should describe the exact unblock step

### `push-failed`
- status: `action-required`
- severity: `error`
- packet path should usually point to `tasks/done/...`
- report path should point to `reports/<task-id>-result.md`
- summary should include the failing git phase when possible
- next action should tell the maintainer to inspect `## Git Automation` and push manually if needed
