# Repository Agent Rules

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
