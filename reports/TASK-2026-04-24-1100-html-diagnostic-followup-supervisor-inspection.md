# Supervisor Inspection: TASK-2026-04-24-1100-html-diagnostic-followup

## Task Summary

- Packet goal: define `repeated parse-empty` strictly as `parse_empty >= 2` within a single diagnostic CLI run for the same source, and expose that signal as a per-source report field without changing existing `classification`.
- Current `HEAD`: `2b846c14fac3b981cecb37235903d25631f88f93`
- Packet `planned_against_commit`: `aa13b6799b72a6edcb51afca8cb6f20ccb275ffb`
- Inspection result: no significant drift in the directly relevant implementation area. `backend/rag/collector/base_html_collector.py`, `scripts/html_collector_diagnostic.py`, `backend/tests/test_html_collector_diagnostic_cli.py`, `docs/current-state.md`, and `docs/refactoring-log.md` match the packet fingerprint. `planned_worktree_fingerprint` matches the current worktree: `4572a3dfe8d50f5e68c616dda8d67f45684452a97f10ff05f10aaf2d3b315535`.
- Relevant prior work already exists in the same area: HTML diagnostic classification, snapshot evidence, OCR preflight, and scheduler summary schema hardening are implemented, but the packet-specific `repeated_parse_empty_in_run` field is not yet present.

## Touched files

- `backend/rag/collector/base_html_collector.py`
- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-24-1100-html-diagnostic-followup-result.md`

## Implementation outline

1. Keep `BaseHtmlCollector.collect_url_items()` as the source of truth for per-run `parse_empty` counts via `last_collect_message` and structured `last_collect_url_diagnostics`; do not change collector parse/write contracts.
2. In `scripts/html_collector_diagnostic.py`, derive a new per-source boolean `repeated_parse_empty_in_run` from the current run only, using the source summary `parse_empty` count with rule `parse_empty >= 2`.
3. Add the new field to JSON source summaries and expose the same label in Markdown source output without replacing or reinterpreting the existing `classification`.
4. Extend `backend/tests/test_html_collector_diagnostic_cli.py` to lock the new JSON semantics and Markdown field label, while preserving current `partial_parse_empty_monitor` behavior.
5. If implementation changes user-visible diagnostic behavior, append concise runtime notes to `docs/current-state.md` and `docs/refactoring-log.md`.

## Verification plan

- Run targeted pytest for `backend/tests/test_html_collector_diagnostic_cli.py`.
- Re-run adjacent collector regression tests if the diagnostic helper or shared HTML collector messaging changes:
  - `backend/tests/test_tier2_collectors.py`
  - `backend/tests/test_tier3_collectors.py`
  - `backend/tests/test_tier4_collectors.py`
  - `backend/tests/test_scheduler_collectors.py`
- Confirm JSON output includes `sources[*].repeated_parse_empty_in_run: true|false`.
- Confirm Markdown source summary exposes the literal field label `repeated_parse_empty_in_run`.

## Preserved behaviors

- Existing collector fetch/parse/normalize/upsert paths remain unchanged.
- Existing `classification` values and current `partial_parse_empty_monitor` meaning remain intact.
- Diagnostic CLI remains read-only and does not introduce Playwright, OCR runtime, or cross-run history logic.
- DB write/upsert paths and public API behavior remain out of scope.

## Risks

- The current diagnostic code parses `parse_empty` from the run message/evidence path, so adding the new field must avoid introducing message-format coupling beyond the already established contract.
- Markdown output currently emphasizes recommendations and tables; adding a new field needs to avoid breaking downstream consumers that scrape labels or sections.
- Live source variability can still change observed counts across runs; the new field should document single-run semantics clearly to avoid over-reading it as a trend signal.
