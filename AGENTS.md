# Repository Agent Rules

## Core behavior
- Always inspect the current repository state before making changes.
- Never assume the task packet matches the current codebase.
- Compare task assumptions with the actual code before coding.
- Treat "already implemented" or "partially implemented" as valid findings, not failures.
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

## Duplicate task detection
- Before implementation, search the touched area for existing behavior that already satisfies the task fully or partially.
- Review `reports/`, `docs/current-state.md`, and `docs/refactoring-log.md` for similar completed, in-progress, or previously drifted work.
- If the requested behavior already exists with no material gap, do not re-implement it.
- Write `reports/<task-id>-duplicate.md` when the task is materially duplicated and include:
  - evidence of the existing implementation
  - files inspected
  - why the task is duplicate or partially duplicate
  - whether a follow-up fix or documentation update is still needed
- If the task is only partially duplicated, convert the task scope to the smallest required fix/update against the existing implementation instead of rebuilding it.

## Task processing
When given a task file:
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
