# Codex Workflow

## Purpose
- Keep local Codex automation and remote Claude fallback clearly separated.
- Standardize how task packets move through the repository.

## Roles
- Claude: planning, specification, task packet generation
- Codex: local repository inspection, implementation, checks, reporting
- Claude Code GitHub Action: remote fallback when the local machine is unavailable

## Local flow
1. Claude produces a task packet.
2. Save it to `tasks/inbox/<task-id>.md`.
3. Start the watcher with:
   - `powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1`
4. The watcher moves the packet to `tasks/running/`.
5. Codex reads `AGENTS.md`, inspects the repository, evaluates drift, and implements if safe.
6. Codex writes reports to `reports/`.
7. On success, Codex is expected to commit and push with:
   - `[codex] <task-id> 구현 완료`
8. The watcher moves the packet to `tasks/done/`.
9. If the task is invalid, blocked, or fails, the watcher moves it to `tasks/blocked/`.

## Remote fallback flow
1. Save a task packet to `tasks/remote/<task-id>.md`.
2. Push the branch.
3. `.github/workflows/claude-dev.yml` runs on pushes affecting `tasks/remote/*.md`.
4. The workflow uses Claude Code as the remote fallback executor.

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

## Guardrails
- `AGENTS.md` is the source of truth for Codex behavior.
- The watcher blocks tasks with missing required frontmatter.
- Commit mismatch does not automatically block local execution, but Codex must evaluate drift before risky edits.
- `[codex]` commit messages are reserved for local Codex automation and should not retrigger the remote fallback workflow.

## Current limitations
- The remote fallback path currently uses Claude Code, not Codex GitHub Action.
- There is no automatic bridge from external planning tools directly into `tasks/inbox/` or `tasks/remote/`.
- Manual `workflow_dispatch` fallback assumes `tasks/remote/manual-task.md` or another remote task file has been prepared intentionally.
