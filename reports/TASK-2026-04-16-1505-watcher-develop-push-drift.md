# TASK-2026-04-16-1505-watcher-develop-push Drift Report

## Why work stopped
- The task packet's implementation assumptions are materially out of date for the touched area in `watcher.py`.
- Per `AGENTS.md`, risky edits must stop when `planned_against_commit` or task assumptions drift significantly from the current codebase.

## Verified current state
- `planned_against_commit` in the packet is `1a9bf74d7fcce8932e6146982b571da2ca8ab7b6`.
- Current `HEAD` is also `1a9bf74d7fcce8932e6146982b571da2ca8ab7b6`.
- The live implementation file is `watcher.py`, and the relevant git automation logic already behaves differently from the packet's described bug state.

## Drift details
- In the current `watcher.py` push flow, a successful `git push origin {branch}` is already treated as the primary success condition.
- For `branch != "main"`, `origin/main` promotion is already best-effort:
  - `git fetch origin main` failure sets a promotion note and still falls through to final `status="pushed"`.
  - `merge-base --is-ancestor origin/main {commit}` failure sets a promotion note and still falls through to final `status="pushed"`.
  - `git push origin {commit}:refs/heads/main` failure sets a promotion note and still falls through to final `status="pushed"`.
  - Successful promotion still returns `status="merged-main"`.
- In the current alert classification logic, only these git states are escalated as push failures:
  - `push-failed`
  - `commit-failed`
  - `watcher-sync-failed`
  - `main-fetch-failed`
  - `main-push-failed`
- `main-promotion-skipped` is not in the current error classification set.

## Conclusion
- The packet describes a bug state that is not present in the current `watcher.py`.
- No safe implementation change was made.
- No checks were run because no code changes were warranted after drift verification.
