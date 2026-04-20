---
id: TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs
status: queued
type: docs
title: Cowork approval Slack smoke docs
priority: low
planned_by: codex
planned_at: 2026-04-20T21:00:00+09:00
planned_against_commit: 859a96cf41032d97bf6c9518a5e584bcdf9cca08
spec_version: 2.0
request_id: TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs
created_by: codex
goal: cowork approval Slack 요청과 승인 후 승격 흐름을 실제 packet으로 검증한다
background: 이전 검증은 tasks/inbox 직행이라 Slack 승인 요청이 생기지 않았다. 이번에는 cowork/packets 원경로로 실제 review-ready 알림이 오는지 확인해야 한다.
scope_in: docs/automation/task-packets.md에 approval smoke 검증 메모 1개 추가
scope_out: 제품 코드, API, DB, env, watcher 동작 규칙 변경
constraints: minimal-safe-change-only
non_goals: broad rewrite
acceptance_criteria: cowork review-ready Slack 요청이 도착하고 승인 후 packet이 tasks/inbox로 승격되며 문서 변경이 1개 파일 범위에서 완료된다
risk_level: low
execution_path: local
allowed_paths: docs/automation/task-packets.md
blocked_paths: backend/.env, frontend/.env.local, supabase/migrations
prechecks: read-current-state, inspect-touched-area
implementation_steps: inspect, implement, verify
tests: targeted-docs-smoke
artifacts: reports/TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs-result.md
fallback_plan: stop-and-report
rollback_plan: revert-last-task-scope
dedupe_key: TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs
report_format: planner-supervisor-implementer-qa
planned_files: docs/automation/task-packets.md
planned_worktree_fingerprint: ca3300129d2abb0da20c7ac2c799bbb64e8b864184d8acdd0de72f4b2ceef2dd
---
# Goal

`cowork/packets -> cowork/reviews -> Slack review-ready -> approval -> tasks/inbox` 경로가 실제로 동작하는지 검증한다.

# Constraints

- 제품 기능 코드는 수정하지 않는다.
- 문서 1파일만 허용한다.
- 변경은 approval smoke 검증 메모 수준으로 제한한다.

# Acceptance Criteria

1. cowork watcher가 review 문서를 생성한다.
2. Slack에 review-ready 승인 요청이 도착한다.
3. 승인 후 packet이 `tasks/inbox/`로 승격된다.
4. local watcher가 문서 1파일만 수정하고 완료 report를 남긴다.

# Edge Cases

- review는 생겼지만 Slack 전송이 실패하면 dispatch 파일을 근거로 중단한다.
- 승인 후 stale review면 승격이 차단돼야 한다.

# Open Questions

- None.
