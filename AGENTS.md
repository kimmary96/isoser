# Repository Agent Rules

## First Read
- Start with [docs/agent-playbook.md](./docs/agent-playbook.md) for the repository-wide read order and document map.
- Use this file as the top-level rule source, then follow the playbook's priority order for packet, folder, and runtime documents.

## Core behavior
- Always inspect the current repository state before making changes.
- Never assume the task packet matches the current codebase.
- Compare task assumptions with the actual code before coding.
- Treat already implemented or partially implemented behavior as a valid finding, not a failure.
- Prefer minimal safe changes that preserve existing behavior.
- Suggest local refactoring when it reduces complexity in touched areas.
- Avoid broad rewrites unless the task explicitly asks for them.

## Work entrypoints
- There are two valid work entrypoints:
  - Queued task packet work: a task file in `tasks/inbox/`, `tasks/remote/`, or an approved/pending packet in `cowork/packets/`.
  - Direct Codex conversation work: the user asks for code, docs, diagnosis, or commands directly in the active chat session.
- Keep queued task packets and direct Codex conversation work separate.
- Do not create, move, or promote files into `tasks/inbox/`, `tasks/remote/`, `tasks/running/`, `tasks/done/`, or `cowork/packets/` for direct conversation work unless the user explicitly asks to use the execution queue.
- If the user provides task-like frontmatter inside a direct conversation, treat it as session metadata only unless they explicitly ask to enqueue or promote it.

## Task packet requirements
- Apply task packet frontmatter requirements only to queued task packet work.
- Require these frontmatter fields before queued implementation:
  - `id`
  - `status`
  - `type`
  - `title`
  - `planned_at`
  - `planned_against_commit`
- If required fields are missing from queued task packet work, write a short blocked report to `reports/<task-id>-blocked.md` and stop.
- If `planned_against_commit` is materially out of date for the touched area in queued task packet work, write `reports/<task-id>-drift.md` and stop before risky edits.
- For direct Codex conversation work, do not block on missing task packet frontmatter. Inspect the repository state, preserve existing behavior, and proceed with the requested change directly.

## Duplicate task detection
- Before implementation, search the touched area for existing behavior that already satisfies the task fully or partially.
- Review `reports/`, `docs/current-state.md`, and `docs/refactoring-log.md` for similar completed, in-progress, or previously drifted work.
- If the requested behavior already exists with no material gap, do not re-implement it.
- For queued task packet work, write `reports/<task-id>-duplicate.md` when the task is materially duplicated and include:
  - evidence of the existing implementation
  - files inspected
  - why the task is duplicate or partially duplicate
  - whether a follow-up fix or documentation update is still needed
- If the task is only partially duplicated, convert the task scope to the smallest required fix/update against the existing implementation instead of rebuilding it.

## Queued task processing
When given a task file from the execution queue:
1. Read the task file completely.
2. Inspect the current repository and the files relevant to the task.
3. Compare `planned_against_commit` and task assumptions with the current codebase.
4. Search for existing implementation and related reports/docs before starting new code.
5. If drift is significant, write `reports/<task-id>-drift.md` and stop.
6. If the task is materially duplicated, write `reports/<task-id>-duplicate.md` and stop unless a fix/update is still required.
7. If drift is acceptable, implement the task with minimal safe changes.
8. Run relevant checks for the touched area.
9. Write `reports/<task-id>-result.md`.
10. Update `docs/current-state.md` if structure or behavior changed.
11. Append key changes to `docs/refactoring-log.md`.

## Direct conversation processing
When the user asks for work directly in the Codex chat session:
1. Inspect the current repository state before making changes.
2. Read `docs/current-state.md` and touched files relevant to the request.
3. Search the touched area and recent reports/logs for existing or partially duplicated behavior.
4. Implement the smallest safe change that satisfies the direct request without creating execution queue files.
5. Run relevant checks for the touched area when feasible.
6. If the change affects user-visible behavior, workflow rules, structure, or operations, update `docs/current-state.md` and append key changes to `docs/refactoring-log.md`.
7. Write a result report only when the work is non-trivial, user requested one, or the change needs durable audit context. Use a session-scoped filename such as `reports/session/YYYY-MM/SESSION-YYYY-MM-DD-brief-topic-result.md` for direct conversation work.

## Rule precedence
- `AGENTS.md` is the top-level development rule source.
- Folder-scoped instructions apply next inside their own directories.
- The current task packet defines scope, acceptance, and constraints for the task.
- `docs/current-state.md` is the runtime truth for current behavior.
- `reports/` and `docs/refactoring-log.md` are supporting history and decision records.

## Git completion workflow
- After any code, document, or workflow-state change, re-check the repository with `git status --short --branch` before closing the task.
- Inspect branch sync state against `origin/develop` before pushing, and do not push blindly.
- Group commits by same-kind work only, such as feature code, docs, watcher workflow state, and log checkpoints.
- Before pushing, verify whether new files or edits were created during verification, watcher runs, or follow-up automation, and commit them separately when they belong to the same workstream.
- Before pushing, confirm the worktree is clean for the intended push scope.
- Unless the user explicitly asks for a different target, push completed work to `develop`.
- If the branch is behind `origin/develop` or a merge/rebase is in progress, resolve that state first and only then push.

## Review handling
- During review, check whether the requested task has already been implemented in full or in part before suggesting new work.
- If review finds that the task intent is already present but incomplete, inconsistent, or outdated, classify the outcome as `fix/update`, not as a new implementation.
- Prefer pointing to the existing implementation and patching the gap over duplicating logic, files, or UI.
- When a duplicated task is converted into `fix/update`, document the reused implementation and the exact remaining gap in the result report.

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
