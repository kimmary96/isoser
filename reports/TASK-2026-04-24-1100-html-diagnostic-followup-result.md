# TASK-2026-04-24-1100-html-diagnostic-followup Result

## Changed Files

- `scripts/html_collector_diagnostic.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-24-1100-html-diagnostic-followup-result.md`

## Why Changes Were Made

기존 HTML diagnostic 리포트는 `partial_parse_empty_monitor`와 `playwright_probe_candidate` 분류는 제공했지만, 같은 source 안에서 현재 단일 실행 기준 parse-empty 계열 URL이 2개 이상이었는지 명시적으로 드러내지 않았다. 이번 변경은 기존 `classification`을 유지한 채, 운영자가 같은 결과를 더 일관되게 해석할 수 있도록 per-source boolean 신호를 추가하는 목적이다.

## What Changed

- `scripts/html_collector_diagnostic.py`에서 source별 현재 run 집계를 위한 `summarize_source_run_counts()`를 추가했다.
- `repeated_parse_empty_in_run`는 structured `url_diagnostics`가 있으면 그 값을 우선 사용하고, 없을 때만 기존 `last_collect_message`의 `parse_empty=`/`request_failed=` 숫자로 fallback 하도록 했다.
- `repeated_parse_empty_in_run`는 `parse_empty >= 2`일 때만 `true`가 되도록 source summary JSON에 추가했다.
- Markdown source summary에도 literal label `repeated_parse_empty_in_run`를 표와 source detail bullet에 함께 노출했다.
- 기존 `classification`과 `partial_parse_empty_monitor` 의미는 바꾸지 않았다.
- 테스트에 JSON field semantics와 Markdown label 노출 회귀를 추가했다.

## Preserved Behaviors

- `BaseHtmlCollector.collect_url_items()`의 fetch/parse/diagnostic 계약은 변경하지 않았다.
- DB write/upsert 경로와 public API 동작은 변경하지 않았다.
- 기존 `classification` 값과 추천 문구 흐름은 유지했다.
- `partial_parse_empty_monitor`는 여전히 raw item 수집이 있으면서 parse-empty 계열 URL이 관측된 source를 뜻한다.

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_html_collector_diagnostic_cli.py -q`
  - Result: `12 passed, 6 warnings`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_tier2_collectors.py backend/tests/test_tier3_collectors.py backend/tests/test_tier4_collectors.py backend/tests/test_scheduler_collectors.py -q`
  - Result: `37 passed, 8 warnings`

## Risks / Possible Regressions

- structured `url_diagnostics`가 없는 오래된 collector 진단 경로는 여전히 `last_collect_message` 숫자 포맷에 fallback 하므로, 메시지 규약이 바뀌면 count 추론이 흔들릴 수 있다.
- Markdown source table에 column이 하나 추가돼, 열 개수를 고정 가정한 downstream parser가 있다면 조정이 필요할 수 있다.
- live source 상태는 시간에 따라 달라지므로 `repeated_parse_empty_in_run=true`는 trend가 아니라 단일 실행 신호로만 해석해야 한다.

## Follow-Up Refactoring Candidates

- source summary에 `parse_empty` count 자체도 명시 필드로 노출해 message fallback 의존을 더 줄인다.
- HTML diagnostic JSON/Markdown consumer가 있다면 source summary schema를 별도 문서화해 table column drift를 줄인다.
- repeated parse-empty와 snapshot evidence를 묶는 source별 follow-up 우선순위 helper를 별도 함수로 분리할 수 있다.

## Run Metadata

- generated_at: `2026-04-24T00:55:19`
- watcher_exit_code: `0`
- codex_tokens_used: `286,670`
