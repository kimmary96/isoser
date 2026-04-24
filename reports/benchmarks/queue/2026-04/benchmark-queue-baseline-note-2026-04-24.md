# Benchmark Queue Baseline Note

## Scope

- Task: `TASK-2026-04-24-0106-benchmark-queue-smoke`
- Purpose: capture the operational baseline for the review -> approval -> local execution queue -> done flow without changing watcher behavior

## Timing Anchors

- Review stage start: `cowork/dispatch/TASK-2026-04-24-0106-benchmark-queue-smoke-review-ready.md`
  - `created_at: 2026-04-24T01:09:31`
- Promotion stage anchor: `cowork/dispatch/TASK-2026-04-24-0106-benchmark-queue-smoke-promoted.md`
  - current dispatch artifact records `approved_at: 2026-04-24T01:11:20`
  - this note treats that watcher-written promoted record timestamp as the promotion-stage anchor and does not redefine watcher semantics
- Execution complete anchor:
  - final `tasks/done/TASK-2026-04-24-0106-benchmark-queue-smoke.md` creation time
  - `reports/TASK-2026-04-24-0106-benchmark-queue-smoke-result.md` timestamp

## Operational Baseline Notes

- This smoke measures the live operational queue, not an idle-path benchmark.
- Backlog wait is intentionally part of the baseline. Stage splits should be read as:
  - `review-ready -> approval`
  - `approval/promoted anchor -> done`
- Concurrent watcher-managed activity is present in the repository during this smoke, including another packet in `tasks/running/`, so any queue delay observed here should be treated as part of the real end-to-end baseline.
- Implementer-authored content changes for this task remain limited to `reports/`.
