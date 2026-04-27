# SESSION 2026-04-23 HTML Snapshot / Scheduler Integration Result

## Changed files

- `backend/rag/collector/base_html_collector.py`
- `backend/tests/test_tier4_collectors.py`
- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `reports\diagnostics\html-collector\2026-04-23\html-collector-diagnostic-2026-04-23.json`
- `reports\diagnostics\html-collector\2026-04-23\html-collector-dynamic-retrieve-diagnostic-2026-04-23.md`
- `reports\diagnostics\html-collector\2026-04-23\html-collector-ocr-diagnostic-2026-04-23.json`
- `reports\diagnostics\html-collector\2026-04-23\html-collector-ocr-diagnostic-2026-04-23.md`
- `reports/diagnostics/html-collector/2026-04-23/snapshots/dobong_district_jobs-list-1-parse_empty.html`
- `reports/diagnostics/html-collector/2026-04-23/snapshots/seongdong_youth_center-list-2-parse_empty.html`
- `reports\diagnostics\html-collector\summary\aws-boottent-adoption-performance-report-2026-04-23.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- partial parse-empty source의 원인을 문자열 메시지 수준이 아니라 URL별 structured diagnostics와 HTML snapshot으로 확인할 수 있게 했다.
- HTML diagnostic CLI에서 quality와 dynamic retrieve/OCR 후보를 한 리포트로 보고 싶다는 후속 요구를 반영해 scheduler-style dry-run summary를 같은 출력에 통합했다.
- OCR/image preflight는 기존 분류를 유지하되 sample detail evidence를 Markdown에서 바로 읽을 수 있게 보강했다.

## Preserved behaviors

- collector 수집/upsert 경로는 바꾸지 않았다.
- Playwright fallback, OCR runtime, 이미지 다운로드/LLM dependency는 추가하지 않았다.
- 기본 `scripts/html_collector_diagnostic.py` 실행도 계속 read-only다.
- snapshot 저장은 `--snapshot-output-dir` opt-in일 때만 수행한다.

## Live diagnostic result

- Dynamic retrieve diagnostic
  - HTML collectors: 14
  - Duration: 14,513.11 ms
  - `healthy_static_html`: 12
  - `partial_parse_empty_monitor`: 2
  - Playwright opt-in candidates: 0
  - Saved HTML snapshots: 2
  - HTML source dry-run quality checked rows: 190

- OCR/image preflight diagnostic
  - Duration: 21,086.47 ms
  - OCR runtime opt-in candidates: 0
  - poster/attachment review candidates: 7
  - detail/parser follow-up candidates: 3
  - text sufficient/no OCR: 4

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_html_collector_diagnostic_cli.py -q`
  - Result: `10 passed, 6 warnings`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_tier2_collectors.py backend/tests/test_tier3_collectors.py backend/tests/test_tier4_collectors.py backend/tests/test_scheduler_collectors.py backend/tests/test_html_collector_diagnostic_cli.py -q`
  - Result: `47 passed, 8 warnings`
- `backend\venv\Scripts\python.exe scripts\html_collector_diagnostic.py --include-scheduler-summary --snapshot-output-dir reports\html-collector-snapshots-2026-04-23 --output reports\html-collector-diagnostic-2026-04-23.json --markdown-output reports\html-collector-dynamic-retrieve-diagnostic-2026-04-23.md`
- `backend\venv\Scripts\python.exe scripts\html_collector_diagnostic.py --include-ocr-probe --ocr-sample-limit 2 --include-scheduler-summary --snapshot-output-dir reports\html-collector-snapshots-2026-04-23 --output reports\html-collector-ocr-diagnostic-2026-04-23.json --markdown-output reports\html-collector-ocr-diagnostic-2026-04-23.md`

## Risks / possible regressions

- URL diagnostics와 snapshot metadata가 collector instance에 추가돼, 외부 코드가 collector 객체를 직접 직렬화한다면 payload가 커질 수 있다.
- scheduler summary는 HTML diagnostic에서 생성한 normalized rows를 기준으로 계산하므로, 전체 scheduler dry-run 전체 source 결과와는 범위가 다르다.
- 저장된 snapshot은 bounded HTML preview이므로, selector drift 원인에 따라 full response가 필요한 경우가 남을 수 있다.

## Follow-up refactoring candidates

- `detail_probe_inconclusive` source에 대해 detail HTML snapshot도 opt-in 저장 모드로 확장한다.
- poster/attachment 후보 source에서 실제 필드 누락률을 샘플링하는 report-only helper를 추가한다.
- scheduler 전체 source dry-run JSON과 HTML diagnostic JSON을 같은 날짜 기준 아카이브로 묶는 wrapper CLI를 추가한다.

