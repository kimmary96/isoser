---
id: TASK-2026-04-24-1130-collector-quality-phase2
status: queued
type: improvement
title: Collector quality phase 2 for OCR preflight and evidence coverage
priority: medium
planned_by: codex
planned_at: 2026-04-24T11:30:00+09:00
planned_against_commit: 3d973498973065c2427585631e836ee33fad5954
planned_files: backend/rag/collector/quality_validator.py, backend/rag/collector/program_field_mapping.py, scripts/program_quality_report.py, backend/tests/test_collector_quality_validator.py, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-24-1130-collector-quality-phase2-result.md
---

# Goal

AWS Boottent 차용의 다음 단계로, 현재 report-only validator와 OCR preflight 판단 근거를 더 구조화한다.
무거운 런타임 도입 전에 source evidence와 후속 판단 기준을 더 안정적으로 만든다.

# Scope

- quality validator 또는 quality report에서 source evidence를 더 명확히 남길 수 있는지 보강한다.
- OCR preflight 후속 판단에 필요한 필드 근거를 구조적으로 남긴다.
- validator는 계속 report-only로 유지한다.
- 결과를 current-state, refactoring-log, result report에 반영한다.

# Acceptance Criteria

1. quality validator 또는 report CLI가 현재보다 더 명확한 source evidence를 제공한다.
2. OCR preflight 후속 판단에 필요한 필드 근거가 구조적으로 남는다.
3. validator는 여전히 report-only다.
4. 기존 API/frontend 동작은 변하지 않는다.

# Constraints

- ingestion blocking gate는 도입하지 않는다.
- OCR runtime, Playwright runtime은 이번 task 범위에서 제외한다.
- 기존 normalizer/field mapping 패턴을 재사용한다.

# Non-goals

- Bedrock/Step Functions류 오케스트레이션 도입
- OCR 실제 실행
- DB schema 대개편

# Test Points

- validator issue code 회귀
- field source evidence 보강 테스트
- quality report CLI 출력 검증
- representative fixture 기반 golden 성격 테스트

# Risks

- evidence 필드가 늘면 dry-run schema consumer가 영향받을 수 있다.
- 규칙이 너무 보수적이면 false warning이 증가할 수 있다.

# Follow-up Refactoring Candidates

- source별 KPI 누적 리포트
- golden fixture 확장
- OCR opt-in 판단 임계값 문서화
