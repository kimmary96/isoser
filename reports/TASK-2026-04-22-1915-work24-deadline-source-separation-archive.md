# Archive Disposition: TASK-2026-04-22-1915-work24-deadline-source-separation

## Decision

- disposition: archive

## Why this packet is being archived

- `tasks/drifted/` is an active retry/recovery queue, and this packet should no longer be retried by the watcher.
- The latest drift report stopped on `planned_worktree_fingerprint` mismatch, not on an unresolved product decision or missing credential.
- The drift report also confirmed the requested Work24 deadline separation behavior is already present in the current implementation:
  - Work24 `traEndDate` is preserved as `end_date` / `compare_meta.training_end_date`.
  - Work24 `traEndDate` is not emitted as `raw_deadline`.
  - Admin normalization drops untrusted Work24 `deadline == end_date` values.
  - The dry-run audit path exists in `scripts/program_backfill.py`.
- Therefore this packet is stale workflow state rather than a live implementation request.

## Evidence kept as audit trail

- `reports/TASK-2026-04-22-1915-work24-deadline-source-separation-drift.md`
- `reports/TASK-2026-04-22-1915-work24-deadline-source-separation-recovery.md`
- `dispatch/alerts/TASK-2026-04-22-1915-work24-deadline-source-separation-drift.md`
- `dispatch/alerts/TASK-2026-04-22-1915-work24-deadline-source-separation-recovered.md`
- `cowork/reviews/TASK-2026-04-22-1915-work24-deadline-source-separation-review.md`

## Next action

- Move `tasks/drifted/TASK-2026-04-22-1915-work24-deadline-source-separation.md` to `tasks/archive/`.
- Do not requeue this packet.
- If another Work24 deadline follow-up is needed, create a new packet against the current `HEAD`.
