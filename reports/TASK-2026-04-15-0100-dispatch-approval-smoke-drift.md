# Drift Report

- task: `TASK-2026-04-15-0100-dispatch-approval-smoke`
- planned_against_commit: `af8aa5bef4d3c249ae0187c23fbc0837373c7589`
- current_head: `a57775b99414d39586e180e8d0bf1aca5c3831a7`
- status: stopped due to significant drift

## Why This Stopped

The packet was planned against a commit that predates the current cowork approval-flow documentation now present in the repository.

At `af8aa5bef4d3c249ae0187c23fbc0837373c7589`, `docs/current-state.md` did not yet describe the cowork review path. In the current repository state, `docs/current-state.md` explicitly documents:

- `cowork/packets/*.md` -> `cowork_watcher.py` -> `cowork/reviews/*.md`
- approval markers in `cowork/approvals/<task-id>.ok`
- dispatch notes in `cowork/dispatch/*.md`
- promotion to `tasks/inbox/` by default or `tasks/remote/` with `target: remote`

This is a material change in the exact workflow area the smoke packet is meant to validate.

## Evidence Checked

- `tasks/running/TASK-2026-04-15-0100-dispatch-approval-smoke.md`
- `docs/current-state.md`
- `cowork/README.md`
- `cowork/FOLDER_INSTRUCTIONS.md`
- `cowork/dispatch/DISPATCH_PROMPT.md`
- `cowork/dispatch/DISPATCH_MANUAL_REVIEW_PROMPT.md`
- `cowork/reviews/TASK-2026-04-15-0100-dispatch-approval-smoke-review.md`

The existing review file already flags this packet as materially stale for the same reason.

## Result

No docs were edited. No queue files were moved. No commit or push was performed.

## Run Metadata

- generated_at: `2026-04-15T01:20:51`
- watcher_exit_code: `0`
- codex_tokens_used: `44,865`
