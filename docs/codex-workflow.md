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
10. On success, Codex is expected to commit and push with:
   - `[codex] <task-id> 구현 완료`
11. The watcher moves the packet to `tasks/done/`.
12. If the task is invalid, blocked, or fails, the watcher moves it to `tasks/blocked/`.

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
