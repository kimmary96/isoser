# SESSION-2026-04-24 OCR field gap audit result

## changed files

- `backend/rag/collector/quality_validator.py`
- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_collector_quality_validator.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/html-collector-ocr-diagnostic-2026-04-24.json`
- `reports/html-collector-ocr-diagnostic-2026-04-24.md`

## why changes were made

- poster/attachment 후보가 보여도, 실제로 OCR이 채워줄 필드 결손이 있는지 바로 판단할 근거가 부족했다.
- 기존 quality validator는 row 단위 판단은 가능했지만, source 단위 OCR preflight 보고서와 직접 연결되지는 않았다.
- 그래서 OCR preflight 리포트에 field gap audit을 연결해 image evidence와 품질 결손을 한 번에 보도록 정리했다.

## preserved behaviors

- collector 수집/정규화/ingest 경로는 바꾸지 않았다.
- OCR runtime과 Playwright runtime은 여전히 도입하지 않았다.
- diagnostic CLI는 read-only 동작을 유지한다.

## risks / possible regressions

- field gap audit은 현재 validator policy에 종속되므로, validator severity/code가 바뀌면 OCR 리포트 요약도 함께 달라진다.
- live OCR preflight는 외부 사이트 응답 속도에 따라 `detail_probe_inconclusive` 수치가 달라질 수 있다.
- 현재 live 결과의 주요 gap은 `missing_provider` info 수준이라, OCR 필요성을 과대해석하면 안 된다.

## follow-up refactoring candidates

- OCR sample URL과 field gap audit을 source별 시계열로 누적해 실제 drift/OCR 필요성 추세를 보는 report-only 경로 추가
- field gap severity가 warning/error인 source만 별도 bucket으로 분리해 OCR opt-in 검토 우선순위를 더 명확히 만들기
- scheduler summary consumer가 schema와 OCR field gap 요약을 함께 검증하는 smoke test 추가
