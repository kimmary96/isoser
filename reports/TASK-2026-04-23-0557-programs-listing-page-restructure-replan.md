# TASK-2026-04-23-0557 Replan

## Reason

`TASK-2026-04-23-0557-programs-listing-page-restructure` drifted because Task 1 changed the
`/programs` area before Task 3 started. The original packet still required `recommended` sorting
and a stricter D-7 backend query contract, but the current accepted direction keeps only
`deadline` and `latest` sorting for this phase.

## Decision

The task was converted from a greenfield feature packet into a fix/update packet against the
current dirty worktree.

## Dependency Handling

- Task 1 is treated as completed and is the baseline for card/recommendation UI.
- Task 2 remains a dependency because it may still touch program API, type, or filter files.
- Task 3 must re-check current files after Task 2 finishes before making changes.

## Scope Correction

- Removed `recommended` sorting from required behavior.
- Kept `deadline` and `latest` as the only active sort values.
- Marked `recommended` and `popular` sorting as non-goals.
- Allowed the current independent D-7 urgent-program flow if it does not depend on paginated full-list results.
- Preserved required verification for TypeScript, lint, backend router behavior, and `git diff --check`.

## Files Updated

- `tasks/drifted/TASK-2026-04-23-0557-programs-listing-page-restructure.md`
- `cowork/packets/TASK-2026-04-23-0557-programs-listing-page-restructure.md`

## Follow-up Risk

If Task 2 changes the same `/programs` API or UI files before Task 3 starts, Task 3 may need a
fresh drift check. The packet now explicitly instructs the implementer to stop and update the
drift report rather than overwrite Task 2 changes.
