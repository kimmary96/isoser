# Program List Refresh Operation Hardening Result

## Changed files
- `scripts/refresh_program_list_index.py`
- `backend/tests/test_program_list_refresh_fallback.py`

## Why changes were made
- After the browse fallback migration was applied, live smoke testing showed the full refresh RPC still timed out.
- The bounded browse refresh RPC can also hit transient timeout or lock/deadlock errors, especially if refresh calls overlap.
- The refresh script needed stage-level timing and retry behavior so operators can distinguish full-refresh failure from fallback recovery.

## What changed
- Refactored the refresh script into explicit full-refresh and browse-refresh stages.
- Added retryable browse fallback attempts for statement timeout, deadlock, and lock contention errors.
- Added JSON stage telemetry including RPC name, attempt number, elapsed milliseconds, status code, and error detail.
- Added CLI options:
  - `--fallback-attempts`
  - `--retry-delay-seconds`
- Kept existing statuses for successful flows:
  - `full_refresh`
  - `browse_fallback`
  - `browse_fallback_only`

## Preserved behaviors
- The script still tries `refresh_program_list_index(pool_limit)` first by default.
- `--browse-only` still skips the full refresh and only refreshes the bounded browse pool.
- `--no-fallback` still prevents fallback execution after full-refresh failure.
- The public program list API behavior was not changed.

## Risks / possible regressions
- Retry attempts can make a failed operation take longer before returning.
- The full refresh RPC still needs a separate SQL-level split or optimization; this change makes the existing fallback operationally reliable but does not remove the full-refresh timeout.
- Parallel write smoke tests can still contend at the database level; refresh RPCs should be run sequentially unless a SQL advisory lock is added later.

## Follow-up refactoring candidates
- Add a SQL advisory lock to `refresh_program_list_index` and `refresh_program_list_browse_pool` so overlapping refreshes fail fast or serialize explicitly.
- Split the full read-model refresh into incremental source sync plus bounded browse/facet refresh.
- Add a dirty-row queue so new or recently updated programs enter the read model without recomputing the full source table.

## Verification
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_program_list_refresh_fallback.py -q`
- Passed: `backend\venv\Scripts\python.exe -m py_compile scripts\refresh_program_list_index.py`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_program_list_refresh_fallback.py backend\tests\test_programs_router.py -q`
- Passed: live `--browse-only --pool-limit 300 --fallback-attempts 3 --retry-delay-seconds 2`
  - first attempt timed out, second attempt succeeded with 300 affected rows
- Passed: live default `--pool-limit 300 --fallback-attempts 3 --retry-delay-seconds 2`
  - full refresh timed out, browse fallback succeeded with 300 affected rows
- Passed: read-only live check
  - `program_list_index` browse pool returned 300 open rows
  - latest browse facet snapshot for pool 300 exists
  - participation display was empty on 162 rows, but those rows had no `training_time`, `day_night`, `weekend`, or `participation_time` signal and are consistent with the conservative display policy
