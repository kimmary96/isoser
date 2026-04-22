# Recovery Report: TASK-2026-04-23-0557-programs-listing-page-restructure

## Summary

Automatic recovery was not safe, so `tasks/drifted/TASK-2026-04-23-0557-programs-listing-page-restructure.md` was not modified.

The previous drift failure was not caused by an outdated `planned_against_commit`. The packet already points at the current `HEAD`:

- packet `planned_against_commit`: `7609401e9dc6eca716ca6fc3ea313e03eea0a357`
- current `HEAD`: `7609401e9dc6eca716ca6fc3ea313e03eea0a357`

The blocking issue is still the dirty worktree in the task's direct execution scope. Retrying this packet by only setting `status: queued` and refreshing `planned_against_commit` would not create a reliable implementation baseline.

## Evidence Checked

- `AGENTS.md`
- `docs/agent-playbook.md`
- `tasks/drifted/TASK-2026-04-23-0557-programs-listing-page-restructure.md`
- `reports/TASK-2026-04-23-0557-programs-listing-page-restructure-drift.md`
- `docs/current-state.md` entries for the programs listing behavior
- Current git state for the files named by the packet and drift report

The current worktree still has substantial uncommitted changes in the task's direct scope:

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`

`git diff --stat` for those files reports:

```text
7 files changed, 772 insertions(+), 265 deletions(-)
```

The drift report also identifies a new directly relevant file:

- `frontend/app/(landing)/programs/program-card.tsx`

## Why the Packet Was Not Refreshed

The packet does not currently include optional `planned_files` or `planned_worktree_fingerprint` fields. Because those fields are absent, there is no packet-level snapshot that can safely identify the current dirty worktree as the intended retry baseline.

`docs/current-state.md` now describes the target programs listing behavior as already present: personalized recommendations, closing-soon, and all-programs sections; blurred unauthenticated recommendation cards with login CTA; required display fields; and URL/backend-connected filters. That strongly suggests the worktree contains implementation or overlapping implementation output that needs verification, review, commit isolation, or an explicit re-plan before a watcher should retry this packet.

## Required External Prerequisite

Before this packet can be automatically retried safely, the current dirty worktree state in the programs listing area must be resolved through one of these workflow decisions:

1. Treat the existing uncommitted changes as intentional implementation output and move to verifier/review flow.
2. Commit or otherwise isolate the current implementation changes, then refresh the task packet against that committed baseline.
3. If the changes are accidental or unrelated, resolve them outside this recovery step before re-queueing the task.

Until that baseline decision is made, automatic recovery would risk re-running the watcher against an ambiguous and already-modified execution surface.


## Run Metadata

- generated_at: `2026-04-23T06:39:44`
- watcher_exit_code: `0`
- codex_tokens_used: `21,065`
