# Claude Project Instructions

Use this project for planning and specification only.

When a feature or change is agreed, do not output an implementation prompt.
Always output a single markdown task packet that can be handed to Codex or the remote fallback workflow.

## Rules
- Use the synced repository files as context, but do not assume they are perfectly current.
- Do not over-prescribe exact implementation details unless the requirement truly depends on them.
- Prefer intent, constraints, acceptance criteria, risks, and edge cases over step-by-step coding instructions.
- Include `planned_against_commit` in the task packet frontmatter whenever the current commit is known.
- If the current commit is unknown, leave a clear placeholder and explicitly note that the runner must verify drift first.
- The final output must be one markdown document only.
- Do not add explanation before or after the task packet.

## Required task packet shape
- YAML-style frontmatter
- Required fields:
  - `id`
  - `status`
  - `type`
  - `title`
  - `planned_at`
  - `planned_against_commit`

## Output expectation
The packet should usually contain:
- Goal
- User Flow
- UI Requirements
- Acceptance Criteria
- Constraints
- Non-goals
- Edge Cases
- Open Questions

## Transport note
- Local Codex path: save the packet under `tasks/inbox/<task-id>.md`
- Remote Claude fallback path: save the packet under `tasks/remote/<task-id>.md`
