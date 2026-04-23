# TASK-2026-04-23-1945-program-field-source-evidence Result

## Changed Files

- `backend/rag/collector/program_field_mapping.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made

The third AWS pipeline borrowing candidate was source evidence preservation. The collector already preserved raw payloads and selected trace metadata, but the normalized fields did not consistently say which raw field produced each value. This change adds field-level evidence inside existing `compare_meta` JSON without changing DB schema or public API contracts.

## What Changed

- Added `compare_meta.field_sources` for Work24 mapping.
- Added `compare_meta.field_sources` for K-Startup mapping.
- Covered core normalized fields such as:
  - provider
  - location / region / region_detail
  - description
  - deadline / start_date / end_date
  - cost / subsidy_amount
  - source_url
  - source_unique_key
  - application_url
- Extended Work24/K-Startup field mapping tests to assert source evidence.

## Preserved Behaviors

- No collector fetch behavior changed.
- No public `/programs` response shape changed directly.
- No DB migration was required because evidence is stored in existing `compare_meta` JSON.
- Existing normalized values remain the same.

## Verification

- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_work24_kstartup_field_mapping.py backend/tests/test_program_quality_golden.py backend/tests/test_program_quality_report_cli.py -q`
  - Result: `18 passed`

## Risks / Possible Regressions

- New rows and future backfills will carry larger `compare_meta` payloads.
- Existing rows will not gain `field_sources` until they are re-collected or backfilled.
- `field_sources` records raw field names, not the raw values; raw values remain in `raw_data` where available.

## Follow-Up Refactoring Candidates

- Add source evidence to SeSAC and district HTML collector mappings after deciding field naming conventions for parsed HTML labels.
- Surface missing `field_sources` as an optional quality report signal after existing DB rows have had a chance to backfill.
- Use `field_sources` in program quality reports to show why a field was trusted or downgraded.
