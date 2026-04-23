---
id: TASK-2026-04-24-1130-collector-quality-phase2
status: queued
type: fix/update
title: Collector quality phase 2 for OCR warning buckets and report references
priority: medium
planned_by: codex
planned_at: 2026-04-24T11:30:00+09:00
planned_against_commit: 98bb49a274faa13d2606a7a2fc6914987aab0cb5
planned_files: backend/rag/collector/quality_validator.py, scripts/html_collector_diagnostic.py, backend/tests/test_collector_quality_validator.py, backend/tests/test_html_collector_diagnostic_cli.py, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-24-1130-collector-quality-phase2-result.md
planned_worktree_fingerprint: 3359b7347b00db204ea6589d80e922f3aa3c7b84d73965dd04ca73b2d2e6300f
---

# Goal

이미 연결된 OCR preflight field-gap audit 위에, 실제 후속 조치에 쓰일 warning-priority bucket과 참조 문서를 더 명확히 고정한다.
새 기능을 넓게 추가하는 것이 아니라, 현재 report-only 흐름에서 남아 있는 해석 모호성을 줄이는 것이 목적이다.

# Current References

- `reports/TASK-2026-04-23-1900-collector-quality-validator-result.md`
- `reports/TASK-2026-04-23-1945-program-field-source-evidence-result.md`
- `reports/SESSION-2026-04-24-ocr-field-gap-audit-result.md`
- `docs/current-state.md`의 OCR preflight `field_gap_summary` / `field_gap_audit` 기록

# Scope

- existing `field_gap_summary` / `field_gap_audit`를 재사용한다.
- info 중심 gap과 실제 follow-up 우선순위가 필요한 warning/error gap을 분리하는 source-level bucket을 추가하거나 명시한다.
- 그 bucket이 어디에 기록되는지 리포트와 문서에서 명확히 고정한다.
- validator는 계속 report-only로 유지한다.
- 결과를 current-state, refactoring-log, result report에 반영한다.

# Acceptance Criteria

1. OCR preflight 결과에서 source별로 "warning/error gap follow-up needed" 여부를 일관되게 해석할 수 있는 bucket 또는 field가 추가된다.
2. `missing_provider` 같은 info-only gap이 warning/error follow-up bucket과 구분된다.
3. 관련 테스트가 새 bucket 또는 field semantics를 검증한다.
4. validator는 여전히 report-only고 기존 API/frontend 동작은 변하지 않는다.

# Constraints

- ingestion blocking gate는 도입하지 않는다.
- OCR runtime, Playwright runtime은 이번 task 범위에서 제외한다.
- 기존 validator 및 OCR preflight 결과를 재사용한다.

# Non-goals

- Bedrock/Step Functions류 오케스트레이션 도입
- OCR 실제 실행
- DB schema 대개편
- 이미 추가된 field-gap audit 자체를 다시 설계하는 작업

# Test Points

- validator issue severity 회귀
- OCR preflight CLI/source summary bucket 검증
- `backend/tests/test_collector_quality_validator.py`
- `backend/tests/test_html_collector_diagnostic_cli.py`

# Risks

- evidence 필드가 늘면 dry-run schema consumer가 영향받을 수 있다.
- 규칙이 너무 보수적이면 false warning이 증가할 수 있다.

# Follow-up Refactoring Candidates

- source별 KPI 누적 리포트
- golden fixture 확장
- OCR opt-in 판단 임계값 문서화
