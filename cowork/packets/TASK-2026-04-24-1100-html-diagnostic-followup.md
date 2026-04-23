---
id: TASK-2026-04-24-1100-html-diagnostic-followup
status: queued
type: fix/update
title: HTML collector diagnostic follow-up for repeated parse-empty rule and report fields
priority: high
planned_by: codex
planned_at: 2026-04-24T11:00:00+09:00
planned_against_commit: 98bb49a274faa13d2606a7a2fc6914987aab0cb5
planned_files: backend/rag/collector/base_html_collector.py, scripts/html_collector_diagnostic.py, backend/tests/test_html_collector_diagnostic_cli.py, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-24-1100-html-diagnostic-followup-result.md
planned_worktree_fingerprint: 707caa4567391257309d622678fcd8c74b30bd2ca8ce02df464d65afdcd8c0b4
---

# Goal

이미 도입된 HTML collector 진단 체계에서 아직 모호한 "repeated parse-empty" 판단 규칙과 리포트 필드를 명확히 한다.
즉시 Playwright를 도입하지 않고도, 운영자가 같은 진단 결과를 보고 follow-up 필요 source를 일관되게 해석할 수 있게 한다.

# Current References

- `reports/TASK-2026-04-23-html-collector-dynamic-retrieve-diagnostic-result.md`
- `reports/SESSION-2026-04-23-html-snapshot-and-scheduler-integration-result.md`
- `reports/SESSION-2026-04-24-ocr-field-gap-audit-result.md`
- `docs/current-state.md`의 2026-04-23, 2026-04-24 HTML diagnostic / OCR preflight 항목

# Scope

- `scripts/html_collector_diagnostic.py`에서 "repeated parse-empty"를 정확한 판정 규칙으로 정의한다.
- JSON/Markdown 리포트에 그 규칙을 해석할 수 있는 명시적 필드 또는 bucket을 추가한다.
- `partial_parse_empty_monitor`와 새 규칙의 차이를 테스트와 문서로 고정한다.
- 관련 결과를 current-state, refactoring-log, result report에 남긴다.

# Acceptance Criteria

1. packet 본문에 정의된 operational rule 하나로 "repeated parse-empty"를 판정할 수 있다.
2. diagnostic JSON/Markdown 리포트가 아래 중 최소 하나를 명시적으로 포함한다.
   - repeated 여부 boolean
   - repeated parse-empty 전용 classification bucket
   - repeated 판정 근거 count field
3. `backend/tests/test_html_collector_diagnostic_cli.py`가 새 규칙과 리포트 필드를 검증한다.
4. DB write/upsert 경로와 public API 동작은 바뀌지 않는다.

# Constraints

- Playwright, OCR, LLM 의존성은 이 task에서 도입하지 않는다.
- 진단은 read-only 원칙을 유지한다.
- 기존 collector parse contract는 유지한다.

# Non-goals

- 전체 source에 대한 browser fallback 구현
- OCR 런타임 도입
- scheduler 구조 전면 개편
- 이미 추가된 selector match, snapshot, OCR field gap audit 기능 재구현

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
