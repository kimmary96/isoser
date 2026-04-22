---
id: TASK-2026-04-22-1915-work24-deadline-source-separation
status: queued
type: feature
title: 고용24 훈련 종료일 deadline 저장 차단 및 진단
priority: medium
planned_by: claude
planned_at: 2026-04-22T17:41:56+09:00
planned_against_commit: eb7a6d7e2828c76abf682fe0f478c538d3cd397e
auto_recovery_attempts: 1
planned_files: backend/rag/collector/program_field_mapping.py, backend/routers/admin.py, scripts/program_backfill.py, backend/tests/test_work24_kstartup_field_mapping.py, backend/tests/test_admin_router.py, backend/tests/test_program_backfill.py, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-22-1915-work24-deadline-source-separation-result.md
planned_worktree_fingerprint: a8d6fd0be8b8b5ccdf7551e6fda879d61817bea09523b73a8122d880f2be4c56
---
# Goal

고용24 훈련과정 수집/관리자 동기화 경로에서 훈련 종료일(`traEndDate`/`end_date`)을 모집 마감일(`deadline`)로 저장하지 않도록 분리한다.
기존 운영 DB에 이미 저장된 `source=고용24` + `deadline=end_date` 의심 row는 바로 수정하지 않고 dry-run 리포트로 식별한다.

# Constraints

- Prefer minimal safe changes.
- Reuse existing patterns before introducing new ones.
- 기존 dirty worktree 변경을 되돌리지 않는다.
- 운영 DB 값을 직접 수정하는 apply 작업은 이번 scope에서 제외한다.
- K-Startup 및 지역 HTML collector의 `raw_deadline` 의미는 변경하지 않는다.
- 자동 복구 기준 snapshot에는 현재 `docs/current-state.md`, `docs/refactoring-log.md`, 기존 result report 상태가 포함된다. 재실행 시 이 baseline을 되돌리지 않는다.

# Acceptance Criteria

1. 고용24 Tier 1 mapping은 `traEndDate`를 `end_date`로만 보존하고 `raw_deadline`으로 넘기지 않는다.
2. 관리자 sync normalization은 별도 모집 마감일이 없는 고용24 row에 `deadline=end_date`를 저장하지 않는다.
3. 기존 DB 의심 row를 찾는 dry-run 진단 함수/CLI 경로가 추가된다.
4. 관련 테스트가 고용24 deadline 미저장과 K-Startup deadline 유지 동작을 함께 고정한다.

# Edge Cases

- 고용24 row에 `deadline` 또는 `close_date`가 별도 값으로 들어온 경우
- 고용24 `deadline`과 `end_date`가 같은 경우
- K-Startup처럼 신청 종료일과 `end_date`가 같은 source
- Supabase 환경변수가 없어 CLI를 실제 운영 DB에 연결할 수 없는 로컬 환경

# Open Questions

- None.
