# TASK-2026-04-23-html-collector-dynamic-retrieve-diagnostic Result

## Changed Files

- `backend/rag/collector/base_html_collector.py`
- `backend/rag/collector/regional_html_collectors.py`
- `backend/rag/collector/tier3_collectors.py`
- `backend/rag/collector/tier4_collectors.py`
- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/aws-boottent-adoption-performance-report-2026-04-23.md`
- `reports/html-collector-diagnostic-2026-04-23.json`
- `reports/html-collector-dynamic-retrieve-diagnostic-2026-04-23.md`

## Why Changes Were Made

AWS/Bedrock 파이프라인 차용 후보 4번인 dynamic retrieve는 Playwright를 넓게 붙이기 전에 반복 parse-empty, request failure, selector drift, JS 렌더링 의존 source를 분리해야 한다. 이전 live 진단에서 즉시 Playwright 후보가 없었으므로, 이번 변경은 source별 opt-in 근거를 반복 생성할 수 있는 read-only 진단 체계까지 구현했다.

## What Changed

- `BaseHtmlCollector.collect_url_items()`를 추가해 HTML collector 공통 URL 진단 메시지를 만들었다.
- Tier 2/3 HTML collector와 Tier 4 district collector가 같은 helper를 사용하도록 정리했다.
- `scripts/html_collector_diagnostic.py`를 추가해 HTML collector만 read-only live collect하고, raw/normalized count와 `last_collect_message`를 기준으로 dynamic retrieve 후보를 분류한다.
- 전체 및 source별 `duration_ms`를 기록해 dynamic retrieve 후보 판정과 함께 source latency를 성능 리포트에 반영할 수 있게 했다.
- JSON/Markdown 리포트 출력을 지원한다.
- 분류 로직과 리포트 렌더링을 네트워크 없이 테스트로 고정했다.

## Preserved Behaviors

- Playwright, OCR, LLM 의존성은 추가하지 않았다.
- DB write/upsert 경로는 변경하지 않았다.
- collector의 `parse_html()` 계약과 raw item 형태는 유지했다.
- scheduler dry-run/upsert의 기존 source ordering과 normalizer 흐름은 유지했다.

## Live Diagnostic Result

- HTML collectors checked: 14
- Total diagnostic duration: 12,630.91 ms
- `healthy_static_html`: 12
- `partial_parse_empty_monitor`: 2
- Immediate Playwright probe candidates: 0
- Monitoring targets:
  - `DobongCollector` / 도봉구청 일자리경제과
  - `SeongdongCollector` / 서울청년센터 성동

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_html_collector_diagnostic_cli.py -q`
  - Result: `4 passed, 6 warnings`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_tier2_collectors.py backend/tests/test_tier3_collectors.py backend/tests/test_tier4_collectors.py backend/tests/test_scheduler_collectors.py -q`
  - Result: `37 passed, 6 warnings`
- `backend\venv\Scripts\python.exe scripts\html_collector_diagnostic.py --output reports\html-collector-diagnostic-2026-04-23.json --markdown-output reports\html-collector-dynamic-retrieve-diagnostic-2026-04-23.md`
  - Result summary: `{"healthy_static_html": 12, "partial_parse_empty_monitor": 2}`

## Risks / Possible Regressions

- `last_collect_message` 문자열이 더 일관되고 길어졌으므로, 외부에서 정확한 문자열 일치를 기대하는 운영 스크립트가 있으면 조정이 필요할 수 있다.
- Live source 상태는 시간에 따라 바뀔 수 있다.
- `collect_url_items()`는 parser exception도 parse-empty 계열 진단에 포함하므로, 후속 운영에서 parse failure를 별도 severity로 볼 필요가 생길 수 있다.

## Follow-Up Refactoring Candidates

- partial parse-empty URL의 HTML snapshot을 선택적으로 저장하는 smoke를 추가한다.
- 반복 full parse-empty source가 생기면 해당 source만 Playwright fallback opt-in packet으로 분리한다.
- CLI 결과를 scheduler dry-run summary와 연결해 운영자가 한 리포트에서 quality와 dynamic retrieve 후보를 함께 볼 수 있게 한다.
