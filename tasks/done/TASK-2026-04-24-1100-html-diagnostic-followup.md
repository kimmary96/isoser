---
id: TASK-2026-04-24-1100-html-diagnostic-followup
status: queued
type: fix/update
title: HTML collector diagnostic follow-up for repeated parse-empty rule and report fields
priority: high
planned_by: codex
planned_at: 2026-04-24T11:00:00+09:00
planned_against_commit: aa13b6799b72a6edcb51afca8cb6f20ccb275ffb
planned_files: backend/rag/collector/base_html_collector.py, scripts/html_collector_diagnostic.py, backend/tests/test_html_collector_diagnostic_cli.py, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-24-1100-html-diagnostic-followup-result.md
planned_worktree_fingerprint: 4572a3dfe8d50f5e68c616dda8d67f45684452a97f10ff05f10aaf2d3b315535
---

# Goal

이미 도입된 HTML collector 진단 체계에서 아직 모호한 "repeated parse-empty" 판단 규칙과 리포트 필드를 명확히 한다.
즉시 Playwright를 도입하지 않고도, 운영자가 같은 진단 결과를 보고 follow-up 필요 source를 일관되게 해석할 수 있게 한다.

Operational rule:
- 이 task에서 `repeated parse-empty`는 "한 번의 diagnostic CLI 실행 안에서 같은 source의 sampled/list URL 중 parse-empty 계열 URL이 2개 이상 관측된 상태"를 뜻한다.
- 이 task는 cross-run history를 다루지 않는다. prior report는 참고 문맥일 뿐, 판정 입력은 현재 단일 실행 결과만 사용한다.
- source of truth는 현재 실행의 source summary가 계산하는 `parse_empty` URL count다. `repeated_parse_empty_in_run`은 현재 run 기준 `parse_empty >= 2`일 때만 `true`다.
- 기존 `classification` 값은 유지한다. 새 신호는 classification 교체가 아니라 per-source report field 추가로 다룬다.

# Current References

- `reports/TASK-2026-04-23-html-collector-dynamic-retrieve-diagnostic-result.md`
- `reports\session\2026-04\SESSION-2026-04-23-html-snapshot-and-scheduler-integration-result.md`
- `reports\session\2026-04\SESSION-2026-04-24-ocr-field-gap-audit-result.md`
- `reports\session\2026-04\SESSION-2026-04-24-html-diagnostic-signal-hardening-result.md`
- `docs/current-state.md`의 2026-04-23, 2026-04-24 HTML diagnostic / OCR preflight 항목

# Scope

- `scripts/html_collector_diagnostic.py`에서 "repeated parse-empty"를 정확한 판정 규칙으로 정의한다.
- JSON/Markdown 리포트에 아래 출력 계약을 추가한다.
  - source summary JSON field: `repeated_parse_empty_in_run`
  - source summary Markdown field label: `repeated_parse_empty_in_run`
- `partial_parse_empty_monitor`와 새 규칙의 차이를 테스트와 문서로 고정한다.
- 관련 결과를 current-state, refactoring-log, result report에 남긴다.

# Acceptance Criteria

1. packet 본문에 정의된 operational rule 하나로 "repeated parse-empty"를 판정할 수 있다.
2. diagnostic JSON source summary가 `repeated_parse_empty_in_run: true|false`를 포함한다.
3. diagnostic Markdown source summary가 `repeated_parse_empty_in_run: true|false` field를 포함한다.
4. `backend/tests/test_html_collector_diagnostic_cli.py`가 JSON field semantics를 검증하고, Markdown output에 같은 field label이 노출되는지 확인한다.
5. DB write/upsert 경로와 public API 동작은 바뀌지 않는다.

# Constraints

- Playwright, OCR, LLM 의존성은 이 task에서 도입하지 않는다.
- 진단은 read-only 원칙을 유지한다.
- 기존 collector parse contract는 유지한다.

# Non-goals

- 전체 source에 대한 browser fallback 구현
- OCR 런타임 도입
- scheduler 구조 전면 개편
- 이미 추가된 selector match, snapshot, OCR field gap audit 기능 재구현
- 복수 날짜 report를 읽어 trend/history를 계산하는 누적 진단 기능

# Test Points

- diagnostic CLI 출력 schema
- repeated parse-empty classification rule
- existing `partial_parse_empty_monitor` regression
- 기존 tier2/tier3/tier4 collector 회귀 테스트

# Risks

- live source 상태는 시점에 따라 달라질 수 있다.
- 진단 메시지 형식 변경이 downstream 스크립트에 영향을 줄 수 있다.

# Follow-up Refactoring Candidates

- scheduler dry-run summary와 diagnostic report 완전 통합
- 반복 full parse-empty source 전용 Playwright opt-in packet 분리

