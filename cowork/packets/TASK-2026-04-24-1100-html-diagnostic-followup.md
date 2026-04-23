---
id: TASK-2026-04-24-1100-html-diagnostic-followup
status: queued
type: fix/update
title: HTML collector diagnostic follow-up for repeated parse-empty sources
priority: high
planned_by: codex
planned_at: 2026-04-24T11:00:00+09:00
planned_against_commit: 3d973498973065c2427585631e836ee33fad5954
planned_files: backend/rag/collector/base_html_collector.py, scripts/html_collector_diagnostic.py, backend/tests/test_html_collector_diagnostic_cli.py, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-24-1100-html-diagnostic-followup-result.md
---

# Goal

이미 도입된 HTML collector 진단 체계를 운영 친화적으로 한 단계 더 보강한다.
즉시 Playwright를 도입하지 않고도 반복 parse-empty source를 더 명확히 추적할 수 있게 한다.

# Scope

- partial parse-empty source 분류 기준을 현재 진단 결과 기준으로 재정리한다.
- snapshot 또는 진단 근거를 운영자가 해석하기 쉬운 방향으로 보강한다.
- CLI/리포트 계약을 테스트로 고정한다.
- 관련 결과를 current-state, refactoring-log, result report에 남긴다.

# Acceptance Criteria

1. partial parse-empty source를 더 구체적으로 분류할 수 있다.
2. snapshot 또는 진단 근거가 현재보다 운영자가 해석하기 쉬운 형태로 남는다.
3. CLI/리포트 계약은 테스트로 고정된다.
4. DB write/upsert 경로와 public API 동작은 바뀌지 않는다.

# Constraints

- Playwright, OCR, LLM 의존성은 이 task에서 도입하지 않는다.
- 진단은 read-only 원칙을 유지한다.
- 기존 collector parse contract는 유지한다.

# Non-goals

- 전체 source에 대한 browser fallback 구현
- OCR 런타임 도입
- scheduler 구조 전면 개편

# Test Points

- diagnostic CLI 출력 schema
- partial parse-empty classification
- snapshot 메타 포함 여부
- 기존 tier2/tier3/tier4 collector 회귀 테스트

# Risks

- live source 상태는 시점에 따라 달라질 수 있다.
- 진단 메시지 형식 변경이 downstream 스크립트에 영향을 줄 수 있다.

# Follow-up Refactoring Candidates

- scheduler dry-run summary와 diagnostic report 완전 통합
- 반복 full parse-empty source 전용 Playwright opt-in packet 분리
