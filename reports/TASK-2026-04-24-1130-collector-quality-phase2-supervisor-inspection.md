# Supervisor Inspection: TASK-2026-04-24-1130-collector-quality-phase2

## Task Summary

- Packet frontmatter is present and usable for queued execution.
- Current `HEAD` matches `planned_against_commit`: `85ba05f5a5dc4437d59ec2fe5231250109a918b6`.
- Optional `planned_worktree_fingerprint` matches the current `planned_files` snapshot: `cf21670043a74676f65efc57301c74ddc65138a907f1626f29bcedba9e4a8711`.
- Directly relevant implementation already exists in the touched area:
  - `backend/rag/collector/quality_validator.py` already distinguishes `info` vs `warning`/`error` severities and exposes `rows_with_info_only`.
  - `scripts/html_collector_diagnostic.py` already emits `field_gap_audit` per source and aggregated `field_gap_summary`.
- Remaining gap is narrow: the current OCR preflight/report flow can count info-only gaps, but it does not yet expose an explicit source-level warning/error follow-up bucket/field that operators can use without reinterpreting the raw audit counters.
- No significant drift or block was found in the touched implementation area, so execution can proceed within the packet scope.

## Touched files

- `backend/rag/collector/quality_validator.py`
- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_collector_quality_validator.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-24-1130-collector-quality-phase2-result.md`

## Implementation outline

- Reuse the existing validator severity model instead of introducing a new validation path.
- Add the smallest possible helper or derived field that makes source-level warning/error follow-up intent explicit.
- Keep `missing_provider` and other `info` issues outside the new follow-up-needed bucket.
- Surface the new semantics in the OCR preflight JSON and Markdown output where operators already read `field_gap_summary` / `field_gap_audit`.
- Extend tests around:
  - validator field-gap summary semantics
  - HTML diagnostic OCR report JSON fields
  - Markdown rendering of the new bucket/field semantics
- Update `docs/current-state.md` and append a concise entry to `docs/refactoring-log.md` after implementation.

## Verification plan

- Run `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_collector_quality_validator.py -q`
- Run `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_html_collector_diagnostic_cli.py -q`
- Confirm the validator remains report-only and does not introduce ingestion blocking behavior.
- Confirm the OCR preflight output distinguishes:
  - info-only field gaps
  - warning/error follow-up-needed gaps
- Confirm existing scheduler/dry-run quality summary fields are not regressed unintentionally.

## Preserved behaviors

- `validate_program_row()` severity assignments remain the source of truth.
- Collector quality validation remains report-only.
- Existing public API/frontend behavior stays unchanged.
- Existing `field_gap_summary` / `field_gap_audit` payloads are reused rather than redesigned from scratch.
- Existing `repeated_parse_empty_in_run` and HTML diagnostic classification semantics remain untouched.

## Risks

- Adding a new report field can affect downstream consumers that assume the current OCR diagnostic schema is fixed.
- If the follow-up bucket is derived too broadly, info-only gaps may be escalated incorrectly and increase false warning interpretation.
- If the new semantics are only documented in Markdown and not mirrored clearly in JSON, operator interpretation drift may remain.
