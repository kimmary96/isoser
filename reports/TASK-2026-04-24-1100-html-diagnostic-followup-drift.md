# Drift Report: TASK-2026-04-24-1100-html-diagnostic-followup

## Summary

최종 검증 단계에서 task packet, supervisor inspection handoff, 실제 구현을 대조한 결과 의미 있는 드리프트가 확인됐다. 따라서 `reports/TASK-2026-04-24-1100-html-diagnostic-followup-supervisor-verification.md`는 작성하지 않고 여기서 중단한다.

## Drift Findings

1. `repeated_parse_empty_in_run` 판정 규칙이 packet 정의와 다르다.
   - packet은 현재 단일 실행의 source summary `parse_empty` URL count만 source of truth로 사용하고, `repeated_parse_empty_in_run`은 `parse_empty >= 2`일 때만 `true`여야 한다고 명시한다.
   - 그러나 [scripts/html_collector_diagnostic.py](/D:/02_2025_AI_Lab/isoser/scripts/html_collector_diagnostic.py:871) 의 `summarize_source_run_counts()`는 structured `url_diagnostics`가 있을 때 `parse_status in {"parse_empty", "parse_failed"}`를 모두 `parse_empty` count로 합산한다.
   - 이 구현은 `parse_failed`를 `parse_empty`로 승격 계산하므로 packet의 operational rule과 불일치한다.

2. 회귀 테스트도 같은 잘못된 의미를 고정하고 있다.
   - [backend/tests/test_html_collector_diagnostic_cli.py](/D:/02_2025_AI_Lab/isoser/backend/tests/test_html_collector_diagnostic_cli.py:212) 의 `test_build_html_collector_report_marks_repeated_parse_empty_in_run_for_current_run()`는 `parse_empty=1` + `parse_failed=1`인 `url_diagnostics` 조합에서 `repeated_parse_empty_in_run is True`를 기대한다.
   - 이는 packet 본문의 "현재 실행의 source summary가 계산하는 `parse_empty` URL count" 규칙과 정면으로 충돌한다.

3. result report가 실제 작업 범위와 계약 반영 상태를 완전히 설명하지 못한다.
   - [reports/TASK-2026-04-24-1100-html-diagnostic-followup-result.md](/D:/02_2025_AI_Lab/isoser/reports/TASK-2026-04-24-1100-html-diagnostic-followup-result.md:1) 는 새 신호가 packet 의미대로 추가됐다고 서술하지만, 실제 구현은 `parse_failed`까지 합산하는 다른 규칙을 사용한다.
   - 또한 user-visible diagnostic behavior 변경 task인데 [docs/current-state.md](/D:/02_2025_AI_Lab/isoser/docs/current-state.md:1) 에 이 task의 새 field/의미에 대한 상태 갱신이 없다.

## Checks Reviewed

- 문서 대조
  - `AGENTS.md`
  - `tasks/running/TASK-2026-04-24-1100-html-diagnostic-followup.md`
  - `reports/TASK-2026-04-24-1100-html-diagnostic-followup-supervisor-inspection.md`
  - `reports/TASK-2026-04-24-1100-html-diagnostic-followup-result.md`
- 구현 대조
  - [scripts/html_collector_diagnostic.py](/D:/02_2025_AI_Lab/isoser/scripts/html_collector_diagnostic.py:281)
  - [backend/tests/test_html_collector_diagnostic_cli.py](/D:/02_2025_AI_Lab/isoser/backend/tests/test_html_collector_diagnostic_cli.py:203)
  - [docs/refactoring-log.md](/D:/02_2025_AI_Lab/isoser/docs/refactoring-log.md:1)
  - [docs/current-state.md](/D:/02_2025_AI_Lab/isoser/docs/current-state.md:1)
- 작업트리 확인
  - `git status --short --branch`
  - `git diff -- scripts/html_collector_diagnostic.py backend/tests/test_html_collector_diagnostic_cli.py docs/refactoring-log.md docs/current-state.md`

## Decision

이 task는 packet/inspection handoff 기준으로 아직 검증 통과 상태가 아니다. 구현 규칙과 테스트 기대값을 packet 정의에 맞게 정렬한 뒤 다시 verifier 단계로 보내야 한다.
