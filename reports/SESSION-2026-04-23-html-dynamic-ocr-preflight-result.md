# SESSION 2026-04-23 HTML Dynamic Retrieve / OCR Preflight Result

## Changed files

- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `reports/html-collector-diagnostic-2026-04-23.json`
- `reports/html-collector-dynamic-retrieve-diagnostic-2026-04-23.md`
- `reports/html-collector-ocr-diagnostic-2026-04-23.json`
- `reports/html-collector-ocr-diagnostic-2026-04-23.md`
- `reports/aws-boottent-adoption-performance-report-2026-04-23.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 4번 dynamic retrieve 작업이 Playwright 도입이 아니라 source별 opt-in 근거 분리까지 완료됐는지 재검증했다.
- 5번 이미지/OCR은 OCR 런타임을 붙이지 않고, HTML detail page의 visible text, image count, attachment link count를 읽기 전용으로 샘플링하는 preflight로 제한했다.
- 첨부가 있어도 detail HTML 본문이 충분하면 OCR runtime 후보로 올리지 않도록 분류를 보수적으로 유지했다.

## Preserved behaviors

- 기존 collector 수집/upsert 경로는 변경하지 않았다.
- 기본 `scripts/html_collector_diagnostic.py` 실행 결과와 dynamic retrieve 분류는 기존처럼 Playwright 후보 판정만 수행한다.
- Playwright, OCR, 이미지 다운로드, LLM dependency는 추가하지 않았다.
- `tasks/` queue 파일은 만들지 않았다.

## Live diagnostic result

- HTML collector 수: 14
- Dynamic retrieve 진단: `healthy_static_html` 12개, `partial_parse_empty_monitor` 2개, 즉시 Playwright 후보 0개
- OCR preflight: OCR runtime opt-in 후보 0개, poster/attachment 검토 후보 7개, detail/parser 보강 우선 3개, text sufficient/no OCR 4개

## Risks / possible regressions

- `--include-ocr-probe`는 detail page를 source별 소량 fetch하므로 기본 진단보다 실행 시간이 길다.
- attachment link count는 OCR 필요성의 직접 증거가 아니라 검토 신호다. 실제 OCR opt-in 전에는 필드 누락률 샘플링이 필요하다.
- 일부 source의 detail page는 로그인/동적 렌더링/selector 문제로 `detail_probe_inconclusive`가 될 수 있다.

## Follow-up refactoring candidates

- detail HTML snapshot 저장을 opt-in read-only mode로 분리해 `detail_probe_inconclusive` source의 원인을 더 빠르게 확인한다.
- poster/attachment 후보 source에서 실제 필드 누락률을 샘플링하는 별도 report-only helper를 추가한다.
- scheduler dry-run quality summary와 HTML dynamic/OCR preflight summary를 한 운영 리포트로 묶는다.
