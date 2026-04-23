# SESSION-2026-04-24 HTML diagnostic signal hardening result

## changed files

- `backend/rag/collector/base_html_collector.py`
- `backend/rag/collector/regional_html_collectors.py`
- `backend/rag/collector/tier3_collectors.py`
- `backend/rag/collector/tier4_collectors.py`
- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `backend/tests/test_tier4_collectors.py`
- `docs/schemas/html-collector-scheduler-summary.schema.json`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/html-collector-diagnostic-2026-04-24.json`
- `reports/html-collector-dynamic-retrieve-diagnostic-2026-04-24.md`
- `reports/html-collector-ocr-diagnostic-2026-04-24.json`
- `reports/html-collector-ocr-diagnostic-2026-04-24.md`
- `reports/html-collector-snapshots-2026-04-24/*`

## why changes were made

- parse-empty snapshot에 selector match count를 추가해 selector drift와 JS 의존을 더 빨리 구분하려고 했다.
- OCR preflight 후보 source에 대해 attachment/image URL sample을 함께 남겨 OCR opt-in 근거를 더 직접적으로 보이게 했다.
- scheduler quality summary 포맷을 별도 schema 파일과 schema id로 고정해 downstream 자동화가 문자열 기반 추정 없이 소비할 수 있게 했다.

## preserved behaviors

- collector 수집/정규화/ingest 경로는 바꾸지 않았다.
- Playwright runtime과 OCR runtime은 여전히 도입하지 않았다.
- diagnostic CLI는 read-only 성격을 유지한다.

## risks / possible regressions

- live OCR preflight는 외부 사이트 응답 상태에 따라 timeout이 발생할 수 있다.
- snapshot selector probe는 collector별 휴리스틱이므로, 새 구조 변경 시 probe selector 자체도 함께 갱신해야 한다.
- source별 attachment/image URL sample은 evidence 품질은 높이지만 리포트 크기를 다소 늘린다.

## follow-up refactoring candidates

- selector match count와 parse_empty 추세를 source별 시계열로 누적하는 report-only CLI 추가
- scheduler summary schema를 사용하는 downstream validator/consumer smoke test 추가
- OCR preflight sample URL을 source별 field gap audit과 연결해 "OCR 필요 필드" 검증을 자동화
