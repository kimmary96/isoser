# TASK-2026-04-16-1100-tier4-district-crawl Drift Report

## Summary

- task packet baseline `planned_against_commit` is `b994efe8e9ba084b7a73e601bec0a3e7a8b7872f`
- current `HEAD` is `c297240c32b48f454167b8628ddccd6e5841145b`
- the touched collector area is no longer in the pre-execution state assumed by the packet
- this task should be treated as a review/reconciliation item, not a clean implementation packet

## Drift basis

- `backend/rag/collector/tier4_collectors.py` already exists as a new implementation file in the worktree.
- `backend/rag/collector/scheduler.py` already includes Tier 4 imports and registrations.
- `reports/TASK-2026-04-16-1100-tier4-district-crawl-result.md` already claims implementation and live verification were completed.
- `reports/TASK-2026-04-16-1100-tier4-district-crawl-supervisor-verification.md` ended with `verdict: review-required`, so this packet is already in a post-implementation review phase.
- the packet still describes open execution choices that are no longer open in the codebase, especially the file-placement question for Tier 4 collectors.

## Current problems

1. Workflow traceability is weak.
   The packet assumes pending work, but the repository already contains implementation, result, and verification artifacts for the same task. Re-running from the packet would duplicate or blur ownership.

2. Tier 4 regression coverage is missing.
   `backend/tests/test_scheduler_collectors.py:126` still stops at Tier 3 dry-run coverage, and there is no Tier 4 parser or scheduler registration regression test.

3. Shared documentation diffs are mixed.
   The earlier verification already flagged `docs/current-state.md` and `docs/refactoring-log.md` as containing unrelated concurrent edits, which makes this task’s report-to-diff mapping unreliable.

4. Some collector heuristics remain brittle.
   `backend/rag/collector/tier4_collectors.py:549` defaults `NowonCollector` category resolution to `취업`, which can hide classification mistakes instead of surfacing ambiguous cases for review.

## Recommended next step

- do not treat this packet as executable implementation work
- keep the task in review/reconciliation status
- create a follow-up packet that does only these scoped actions:
  - add Tier 4 scheduler dry-run regression coverage
  - add fixture-based parser tests for the six district collectors
  - reconcile result report wording with the actual mixed doc diffs
  - review permissive category/default heuristics in Tier 4 collectors

## Safety note

- no code changes were applied as part of this drift handling
- this report records current state so the next task can start from the real repository condition
