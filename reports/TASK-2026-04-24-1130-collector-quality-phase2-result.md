# TASK-2026-04-24-1130-collector-quality-phase2 Result

## Changed Files

- `backend/rag/collector/quality_validator.py`
- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_collector_quality_validator.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-24-1130-collector-quality-phase2-result.md`

## Why Changes Were Made

기존 OCR preflight `field_gap_audit`는 source별 issue code/field와 `rows_with_info_only`까지만 보여줘서, 운영자가 warning/error 후속 조치 대상인지 직접 다시 해석해야 했다. 이번 변경은 validator를 report-only로 유지한 채, source-level warning/error follow-up 필요 여부를 명시 필드로 고정해 info-only gap과 실제 follow-up 대상을 구분하는 목적이다.

## What Changed

- `summarize_program_field_gaps()`가 source별 `rows_with_warning_or_error`, `warning_or_error_follow_up_needed`, `field_gap_follow_up_bucket`을 함께 계산하도록 보강했다.
- `field_gap_follow_up_bucket`은 warning/error가 하나라도 있으면 `warning_or_error_follow_up_needed`, issue가 모두 info면 `info_only`, issue가 없으면 `none`으로 고정했다.
- OCR preflight 집계 `field_gap_summary`에 `source_count_with_warning_or_error_follow_up`를 추가했다.
- Markdown OCR preflight 요약과 source table/sample highlight가 새 follow-up bucket을 그대로 노출하도록 맞췄다.
- 테스트는 info-only source와 warning/error follow-up bucket semantics를 각각 회귀로 고정했다.

## Preserved Behaviors

- `validate_program_row()`의 severity 판정이 계속 source of truth다.
- collector quality validator는 여전히 report-only이며 ingestion blocking gate를 도입하지 않았다.
- 기존 `field_gap_summary` / `field_gap_audit` 구조와 issue code/field/sample payload는 유지하고, 새 필드만 추가했다.
- `missing_provider` 같은 info-level gap은 warning/error follow-up 대상으로 승격되지 않는다.

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_collector_quality_validator.py -q`
  - Result: `7 passed, 6 warnings`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_html_collector_diagnostic_cli.py -q`
  - Result: Windows shared temp directory 정리 충돌로 실패 (`.pytest_tmp` permission denied)
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_html_collector_diagnostic_cli.py -q --basetemp .pytest_tmp_collector_quality_phase2`
  - Result: `12 passed, 6 warnings`

## Risks / Possible Regressions

- OCR diagnostic JSON consumer가 field set을 strict equality로 가정하면 새 follow-up 필드 추가에 맞춰 조정이 필요할 수 있다.
- 현재 집계는 validator severity를 그대로 재사용하므로, 향후 severity 정책이 바뀌면 follow-up bucket 의미도 같이 바뀐다.
- Markdown table에 follow-up column이 추가돼 열 개수를 고정 가정한 downstream parser가 있다면 영향이 있을 수 있다.

## Follow-Up Refactoring Candidates

- `field_gap_follow_up_bucket` 값을 별도 schema 문서로 고정해 downstream consumer drift를 줄일 수 있다.
- OCR preflight와 scheduler quality summary가 공통 follow-up semantics를 공유하도록 helper를 더 분리할 수 있다.
- Windows pytest temp 경로 충돌이 반복되면 touched-area 테스트 실행 wrapper에서 고유 `--basetemp`를 표준화하는 편이 안전하다.
