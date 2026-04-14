# Codex Workflow

## Purpose
- Keep local Codex automation and remote Claude fallback clearly separated.
- Standardize how task packets move through the repository.

## Roles
- Claude: planning, specification, task packet generation
- Codex: local repository inspection, implementation, checks, reporting
- Claude Code GitHub Action: remote fallback when the local machine is unavailable

## Local flow
1. Claude produces a task packet under `cowork/packets/<task-id>.md`.
2. Start the cowork watcher with:
   - `powershell -ExecutionPolicy Bypass -File scripts/run_cowork_watcher.ps1`
3. Read the generated review in `cowork/reviews/<task-id>-review.md`.
4. Approve by creating `cowork/approvals/<task-id>.ok`.
5. The cowork watcher promotes the packet to `tasks/inbox/<task-id>.md` by default.
6. Start the implementation watcher with:
   - `powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1`
7. The watcher moves the packet to `tasks/running/`.
8. Codex reads `AGENTS.md`, inspects the repository, evaluates drift, and implements if safe.
9. Codex writes reports to `reports/`.
10. The watcher writes a human-visible alert note to `dispatch/alerts/<task-id>-<stage>.md` for terminal states such as `completed`, `drift`, `blocked`, and `push-failed`.
11. If `SLACK_WEBHOOK_URL` is set in the watcher process environment, the same terminal-state alert is also posted to Slack.
12. On success, the watcher appends run metadata, moves the packet to `tasks/done/`, and then attempts task-scoped git automation:
   - stage the task packet move, the result report, and paths listed in the result report's `Changed files`
   - commit with `[codex] <task-id> 구현 완료`
   - push to `origin/<current-branch>`
13. Git automation status is appended to the result report under `## Git Automation`.
14. If Codex writes a drift report, the watcher moves the packet to `tasks/drifted/`.
15. If the task is invalid, blocked, or fails for a non-drift reason, the watcher moves it to `tasks/blocked/`.

## Dispatch channel split
- `cowork/dispatch/`
  - owner: `cowork_watcher.py`
  - purpose: packet review and promotion workflow
  - typical stages: `review-ready`, `approval-blocked-stale-review`, `promoted`
- `dispatch/alerts/`
  - owner: `watcher.py`
  - purpose: local execution terminal outcomes
  - standard stages: `completed`, `drift`, `blocked`, `push-failed`
  - format reference: `dispatch/alerts/README.md`

## Remote fallback flow
1. Save a task packet to `tasks/remote/<task-id>.md`.
2. Push the branch.
3. `.github/workflows/claude-dev.yml` runs on pushes affecting `tasks/remote/*.md`.
4. The workflow uses Claude Code as the remote fallback executor.
5. The current stable operating path uses `ANTHROPIC_API_KEY`, not OAuth.

## Task packet requirements
- Use YAML-style frontmatter.
- Required fields:
  - `id`
  - `status`
  - `type`
  - `title`
  - `planned_at`
  - `planned_against_commit`
- Use `docs/task-packet-template.md` as the base template.
- Use `tasks/remote/manual-task.md` as the manual remote fallback template when needed.
- Prefer task ids and filenames in `TASK-YYYY-MM-DD-HHMM-short-slug` format so same-day packets sort cleanly.

## Guardrails
- `AGENTS.md` is the source of truth for Codex behavior.
- The watcher blocks tasks with missing required frontmatter.
- Commit mismatch does not automatically block local execution, but Codex must evaluate drift before risky edits.
- `[codex]` commit messages are reserved for local Codex automation and should not retrigger the remote fallback workflow.
- The watcher stages only task-scoped paths for auto-commit instead of sweeping the whole worktree.
- Human-visible terminal alerts are written to `dispatch/alerts/` so drift and blocked outcomes are visible without opening `reports/` first.
- Cowork-style scratch space is optional and should only be created on explicit user request.
- Scratch output should never directly modify `CLAUDE.md`, `AGENTS.md`, `README.md`, or core `docs/*.md` files.
- Approval markers should stay in `cowork/approvals/` and should not be replaced by ad hoc root files.

## Current limitations
- The remote fallback path currently uses Claude Code, not Codex GitHub Action.
- OAuth smoke testing exists only as a retained experiment and is not part of the active operating path.
- There is no automatic bridge from external planning tools directly into `tasks/inbox/` or `tasks/remote/`.
- Manual `workflow_dispatch` fallback assumes `tasks/remote/manual-task.md` or another remote task file has been prepared intentionally.

## Report retention
- `tasks/done/` and `reports/` can keep accumulating small markdown files during normal operation.
- This does not materially bloat the repository in the short to medium term, but it does increase browsing noise.
- Prefer periodic archive moves over deletion:
  - `tasks/archive/<YYYY-MM>/`
  - `reports/archive/<YYYY-MM>/`
- Keep recent active history in place, and archive older low-signal task packets or reports when the folders become cluttered.
