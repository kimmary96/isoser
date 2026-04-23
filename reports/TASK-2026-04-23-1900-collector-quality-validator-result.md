# TASK-2026-04-23-1900-collector-quality-validator Result

## Committed / Push Scope

- `backend/rag/collector/quality_validator.py`
- `backend/rag/collector/scheduler.py`
- `backend/tests/test_collector_quality_validator.py`
- `backend/tests/test_scheduler_collectors.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-23-1900-collector-quality-validator-result.md`

## Local Workflow Artifacts

These were created by the ad-hoc packet/review flow during the session and were not part of the code push scope:

- `cowork/packets/TASK-2026-04-23-1900-collector-quality-validator.md`
- `cowork/reviews/TASK-2026-04-23-1900-collector-quality-validator-review.md`
- `cowork/dispatch/TASK-2026-04-23-1900-collector-quality-validator-review-failed.md`
- `cowork/dispatch/TASK-2026-04-23-1900-collector-quality-validator-review-ready.md`
- cowork watcher ledger/log updates

## Why Changes Were Made

The AWS Boottent pipeline's Validation Agent pattern was useful, but Bedrock, Step Functions, OCR, and Playwright would be too broad as a first adoption step. This task added a deterministic report-only validator around existing normalized program rows so collector quality can be measured before any ingestion-blocking or AI-based workflow is introduced.

## What Changed

- Added `validate_program_row()` and `summarize_program_quality()` for normalized collector rows.
- Added checks for stable identity and traceability:
  - `title`
  - `source`
  - `source_unique_key`
  - `source_url` / `link`
  - `provider`
  - `location` / `region`
  - `start_date` / `end_date`
  - integer cost fields
- Added Work24-specific deadline risk detection:
  - `deadline=end_date` without trusted source is a warning.
  - `deadline_source=traStartDate` is informational because Work24 list data lacks a separate application deadline.
- Added dry-run quality summaries to `run_all_collectors(upsert=False)` source results.

## Preserved Behaviors

- No public `/programs` API behavior changed.
- No frontend behavior changed.
- `run_all_collectors(upsert=True)` still upserts the same normalized rows and does not receive a quality gate.
- Existing Work24/K-Startup mapping behavior remains unchanged.
- The generated cowork review was addressed by converting the packet to `fix/update`, adding `planned_files`, adding `planned_worktree_fingerprint`, and referencing the predecessor blocked report.

## Verification

- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_collector_quality_validator.py backend/tests/test_work24_kstartup_field_mapping.py`
  - Result: `16 passed`
- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_collector_quality_validator.py backend/tests/test_work24_kstartup_field_mapping.py backend/tests/test_scheduler_collectors.py`
  - Result: `32 passed`

Initial attempts with root `python` and `py -3.10` did not run tests because root `python` is 3.13 and global Python 3.10 did not have pytest installed. The backend venv Python 3.10.8 path passed.

## Risks / Possible Regressions

- Dry-run source result objects now include an additional `quality` key. Existing tests tolerate this, but any external consumer expecting an exact dry-run schema may need to ignore or display the new key.
- The validator is intentionally conservative and report-only; it can surface warnings that are not true data defects.
- Work24 `traStartDate` is informational, not a guaranteed application deadline. It is kept as a known fallback rather than treated as a validation failure.

## Follow-Up Refactoring Candidates

- Add a golden dataset for representative Work24, K-Startup, SeSAC, and district HTML rows.
- Add an optional CLI/report command that runs quality validation against live DB rows without mutating data.
- Add source evidence fields for high-risk mapped values where current `compare_meta` is still sparse.
- Consider selective Playwright retrieve fallback only for HTML collectors with repeated empty/parse-failed diagnostics.
