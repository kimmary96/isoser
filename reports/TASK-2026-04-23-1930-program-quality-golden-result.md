# TASK-2026-04-23-1930-program-quality-golden Result

## Changed Files

- `backend/tests/fixtures/program_quality_golden.json`
- `backend/tests/test_program_quality_golden.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made

The previous collector quality validator and read-only report CLI made quality issues visible, but they did not yet define stable expected outcomes for representative source rows. This adds a small golden dataset so source mapping or validator policy changes can be checked against known Work24, K-Startup, and SeSAC cases.

## What Changed

- Added four golden quality cases:
  - Work24 `traStartDate` deadline fallback is informational.
  - Work24 `deadline=end_date` without trusted source is a warning.
  - K-Startup traceable announcement has no quality issues.
  - SeSAC missing provider remains display-fallback info only.
- Added tests that compare expected issue codes by severity.
- Added a summary stability test for the full fixture set.

## Preserved Behaviors

- No runtime collector, scheduler, API, DB, or frontend behavior changed.
- No new network access is used in the tests.
- Existing validator semantics are reused rather than reimplemented.

## Verification

- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_program_quality_golden.py backend/tests/test_collector_quality_validator.py backend/tests/test_program_quality_report_cli.py -q`
  - Result: `14 passed`

## Risks / Possible Regressions

- The fixture set is intentionally small. It catches policy drift for representative cases but does not yet cover every source family.
- Future legitimate policy changes will need fixture updates, which is expected for golden tests.

## Follow-Up Refactoring Candidates

- Add source-mapping golden rows for district HTML collectors once parse-empty/repeated failure patterns are identified.
- Add threshold-based reporting after several real quality reports establish expected baseline rates.
- Keep Playwright/OCR work behind source-specific evidence rather than enabling it broadly.
