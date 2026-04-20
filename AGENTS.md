# Repository Agent Rules

## First Read
- Start with [docs/agent-playbook.md](./docs/agent-playbook.md) for the repository-wide read order and document map.
- Use this file as the top-level rule source, then follow the playbook's priority order for packet, folder, and runtime documents.

## Core behavior
- Always inspect the current repository state before making changes.
- Never assume the task packet matches the current codebase.
- Compare task assumptions with the actual code before coding.
- Prefer minimal safe changes that preserve existing behavior.
- Suggest local refactoring when it reduces complexity in touched areas.
- Avoid broad rewrites unless the task explicitly asks for them.

## Task packet requirements
- Treat every task as a structured task packet, not a casual prompt.
- Require these frontmatter fields before implementation:
  - `id`
  - `status`
  - `type`
  - `title`
  - `planned_at`
  - `planned_against_commit`
- If required fields are missing, write a short blocked report to `reports/<task-id>-blocked.md` and stop.
- If `planned_against_commit` is materially out of date for the touched area, write `reports/<task-id>-drift.md` and stop before risky edits.

## Task processing
When given a task file:
1. Read the task file completely.
2. Inspect the current repository and the files relevant to the task.
3. Compare `planned_against_commit` and task assumptions with the current codebase.
4. If drift is significant, write `reports/<task-id>-drift.md` and stop.
5. If drift is acceptable, implement the task with minimal safe changes.
6. Run relevant checks for the touched area.
7. Write `reports/<task-id>-result.md`.
8. Update `docs/current-state.md` if structure or behavior changed.
9. Append key changes to `docs/refactoring-log.md`.

## Rule precedence
- `AGENTS.md` is the top-level development rule source.
- Folder-scoped instructions apply next inside their own directories.
- The current task packet defines scope, acceptance, and constraints for the task.
- `docs/current-state.md` is the runtime truth for current behavior.
- `reports/*.md` and `docs/refactoring-log.md` are supporting history and decision records.

## Git completion workflow
- After any code, document, or workflow-state change, re-check the repository with `git status --short --branch` before closing the task.
- Inspect branch sync state against `origin/develop` before pushing, and do not push blindly.
- Group commits by same-kind work only, such as feature code, docs, watcher workflow state, and log checkpoints.
- Before pushing, verify whether new files or edits were created during verification, watcher runs, or follow-up automation, and commit them separately when they belong to the same workstream.
- Before pushing, confirm the worktree is clean for the intended push scope.
- Unless the user explicitly asks for a different target, push completed work to `develop`.
- If the branch is behind `origin/develop` or a merge/rebase is in progress, resolve that state first and only then push.

## Tech stack
- Frontend: Next.js 15, TypeScript, Tailwind CSS, Pretendard
- Backend: FastAPI, Python 3.10
- DB: Supabase (PostgreSQL)
- AI: Gemini 2.5 Flash

## Coding standards
- Keep TypeScript strict and avoid `any` unless justified.
- Prefer readable, maintainable code over clever abstractions.
- Reuse existing patterns before introducing new ones.
- Flag duplicated logic and oversized components.

## Reporting
Every result report must include:
- changed files
- why changes were made
- preserved behaviors
- risks / possible regressions
- follow-up refactoring candidates
