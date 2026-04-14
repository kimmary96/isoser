# Current State

## Repository workflow
- Planning and specification are expected to happen outside the implementation loop, then arrive as markdown task packets.
- Local Codex automation polls `tasks/inbox/` every 10 seconds and moves tasks through `tasks/running/`, `tasks/done/`, `tasks/drifted/`, or `tasks/blocked/`.
- Remote fallback automation uses `tasks/remote/` and a GitHub Action path.
- Task execution is governed by `AGENTS.md`.
- Codex outputs reports into `reports/`.
- The watcher writes terminal-state alert notes into `dispatch/alerts/` so drift and blocked outcomes are visible without opening reports first.
- Successful local Codex runs are auto-synced by `watcher.py`, which attempts a task-scoped `[codex]` commit and push after writing the success report and moving the packet to `tasks/done/`.

## Task packet contract
- Task packets must be markdown files with YAML-style frontmatter.
- Required frontmatter fields:
  - `id`
  - `status`
  - `type`
  - `title`
  - `planned_at`
  - `planned_against_commit`
- If required fields are missing, the task is blocked before Codex runs.
- If `planned_against_commit` differs from the current `HEAD`, the watcher still runs Codex, but Codex is expected to evaluate drift before risky edits.
- Recommended task id and filename convention is `TASK-YYYY-MM-DD-HHMM-short-slug` for same-day chronological sorting.

## Current automation split
- Cowork review path:
  - `cowork/packets/*.md` -> `cowork_watcher.py` -> `cowork/reviews/*.md`
  - approval marker: `cowork/approvals/<task-id>.ok`
  - dispatch notes: `cowork/dispatch/*.md`
  - approved packets are promoted to `tasks/inbox/` by default or `tasks/remote/` when approval says `target: remote`
- Local automation path:
  - `tasks/inbox/*.md` -> watcher -> Codex CLI
  - Recommended watcher launch: `powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1`
  - Watcher uses a token-efficient prompt and should inspect only task-relevant files first
  - Docs tasks use a short inline rules summary instead of reading full `AGENTS.md`
  - Code tasks still read `AGENTS.md`
- Existing remote automation path:
  - `tasks/remote/*.md` push -> `.github/workflows/claude-dev.yml`
  - `workflow_dispatch` can still be used for manual fallback runs
- Primary day-to-day flow is local-first through `tasks/inbox`.
- Claude cowork scratch output, if used at all, should stay outside the default execution flow and should not be auto-created on editor start.

## Project structure notes
- `frontend/`: Next.js application
- `frontend/app/landing-a/page.tsx`: separate information-hub landing A experiment route that does not replace the existing `/` page
- `backend/`: FastAPI application with its own virtual environment under `backend/.venv`
- `docs/`: project documents, current-state, refactoring log, contracts, PRD
- `tasks/`: local task queue state
- `dispatch/alerts/`: human-visible terminal-state alerts for completed, drifted, blocked, or push-failed local runs
- `tasks/remote/`: remote-only task packets for GitHub Action execution
- `reports/`: implementation, drift, and blocked reports
- `tasks/archive/` and `reports/archive/`: optional monthly archive locations for older task and report history

## Known gaps
- There is still no fully automatic task creation bridge from external planning tools, but cowork packet review and promotion can now be automated locally.
- The remote fallback workflow currently delegates implementation to Claude Code using `ANTHROPIC_API_KEY`.
- OAuth smoke testing is retained as a reference check only, not an active operating path.
- Stale tasks in `tasks/running` are now auto-moved to `tasks/blocked` after 20 minutes, which is a safety rule rather than a true semantic failure detector.

## Operational intent
- Claude should produce task packets, not implementation prompts.
- Codex should inspect the live repository before making changes.
- Drift detection and reporting must happen before risky edits.
- `CLAUDE.md`, `AGENTS.md`, `README.md`, and core `docs/*.md` files are reference documents and should not be directly edited by cowork-style scratch output.
- Any cowork-style scratch files should be created only on explicit user request and reviewed before promotion into `tasks/inbox/` or `tasks/remote/`.
- Local watcher execution should avoid writing Python bytecode on this machine because `__pycache__` rename/delete operations are intermittently denied by Windows.
- `[codex]` commit messages are reserved for local Codex automation and should not retrigger remote automation.
- `tasks/done/` and `reports/` are expected to accumulate small markdown files; that is acceptable for normal use.
- When history becomes noisy, prefer moving older files into `tasks/archive/<YYYY-MM>/` and `reports/archive/<YYYY-MM>/` instead of deleting them immediately.
- Keep recent operational history in the active folders and archive older low-value task/report files periodically.
