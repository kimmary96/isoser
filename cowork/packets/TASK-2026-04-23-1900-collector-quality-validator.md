---
id: TASK-2026-04-23-1900-collector-quality-validator
status: queued
type: fix/update
title: Add report-only collector quality validator
planned_at: 2026-04-23T19:00:00+09:00
planned_against_commit: 38f2c85bd3f739e87de0bb203439e50262f0ab78
planned_files: backend/rag/collector/quality_validator.py, backend/rag/collector/scheduler.py, backend/tests/test_collector_quality_validator.py, backend/tests/test_scheduler_collectors.py, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-23-1900-collector-quality-validator-result.md
planned_worktree_fingerprint: 5416d7698776705e29c7dcac531c8d41547b6b029bf253ae38bea24510d6d926
auto_recovery_attempts: 2
---

# Task

AWS Boottent course-registration automation article에서 차용 가능한 품질 검증 패턴 중 첫 번째 단계로, 기존 collector/normalizer 결과에 report-only validation helper를 추가한다.

Predecessor: `reports/TASK-2026-04-23-1857-aws-pipeline-validation-adoption-blocked.md`

이 packet은 현재 `planned_files` 범위에 존재하는 validator 구현 파일을 채택해 검증과 보고서까지 마무리하는 `fix/update` 성격이다.

Recovery baseline note: prior drift was limited to stale optional `planned_worktree_fingerprint` metadata for the existing `planned_files` snapshot. The retry baseline is now `HEAD` `38f2c85bd3f739e87de0bb203439e50262f0ab78` and planned-file fingerprint `5416d7698776705e29c7dcac531c8d41547b6b029bf253ae38bea24510d6d926`; keep the task scoped to the listed planned files and preserve unrelated dirty program-router/workflow artifacts.

## Scope

- Add deterministic validation helpers for normalized program rows.
- Keep validation report-only; do not block ingestion or alter scheduler behavior.
- Add focused unit tests using Work24/K-Startup style rows.
- Avoid editing currently dirty program router or migration files.

## Acceptance

1. Validator classifies collector row risks without mutating input rows.
2. Required identity fields and high-risk fields are checked:
   - `title`
   - `source`
   - `source_unique_key`
   - `deadline`
   - `start_date`
   - `end_date`
   - `provider`
   - `location` or `region`
   - `source_url` or `link`
   - `cost` sanity when present
3. Work24 rows with `deadline=end_date` and no trusted `deadline_source` are flagged as deadline risk.
4. Work24 rows with `deadline_source=traStartDate` are treated as informational rather than invalid.
5. K-Startup rows with expected identity and date fields pass without blocking errors.

## Constraints

- Do not introduce LLM, OCR, Playwright, or external network dependency in this task.
- Do not change ingestion, API response, or frontend behavior.
- Do not modify unrelated dirty files.

## Verification

- Run the new unit tests.
- Run existing Work24/K-Startup field mapping tests.

## Reporting

- Write `reports/TASK-2026-04-23-1900-collector-quality-validator-result.md`.
- Mention preserved behavior, risks, and follow-up refactoring candidates.

## Auto Recovery Context

- source_task: `tasks/drifted/TASK-2026-04-23-1900-collector-quality-validator.md`
- failure_stage: `drift`
- failure_report: `reports/TASK-2026-04-23-1900-collector-quality-validator-drift.md`
- recovery_report: `reports/TASK-2026-04-23-1900-collector-quality-validator-recovery.md`
- reviewer_action: update the packet or provide approval/feedback before requeueing
