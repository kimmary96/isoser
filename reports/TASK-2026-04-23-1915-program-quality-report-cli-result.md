# TASK-2026-04-23-1915-program-quality-report-cli Result

## Changed Files

- `scripts/program_quality_report.py`
- `backend/tests/test_program_quality_report_cli.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made

The first validation step added report-only collector quality checks to scheduler dry-run output. This follow-up makes the same validator usable against stored `programs` rows, so operators can inspect production-like data quality without running collectors or mutating Supabase.

## What Changed

- Added `scripts/program_quality_report.py`.
- The script loads backend `.env`, reads `programs` rows via Supabase REST `GET`, builds a quality summary, and writes JSON output.
- Added CLI filters:
  - `--limit`
  - `--source-query`
  - `--sample-limit`
  - `--output`
- Added tests for summary generation, read-only Supabase query parameters, and JSON file writing.

## Preserved Behaviors

- No DB mutation path was added.
- No collector, scheduler upsert, public API, or frontend behavior changed.
- Existing validator severity and Work24 deadline policy are reused rather than duplicated.

## Verification

- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_program_quality_report_cli.py backend/tests/test_collector_quality_validator.py backend/tests/test_scheduler_collectors.py -q`
  - Result: `25 passed`

## Risks / Possible Regressions

- The script requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` when run against a real environment.
- Large `--limit` values can produce large JSON reports; default remains 100 rows.
- The `--source-query` filter is a simple `source ilike` helper, not a full query language.

## Follow-Up Refactoring Candidates

- Add checked-in golden fixture snapshots for Work24, K-Startup, SeSAC, and district HTML sources.
- Add a scheduled or watcher-triggered quality report mode after collector dry-runs.
- Add source-specific issue thresholds once enough historical reports exist.
