---
id: TASK-2026-04-24-0106-benchmark-queue-smoke
status: queued
type: fix/update
title: Queue benchmark smoke task for review approval timing
priority: low
planned_by: codex
planned_at: 2026-04-24T01:06:39+09:00
planned_against_commit: 85ba05f5a5dc4437d59ec2fe5231250109a918b6
planned_files: reports/benchmark-queue-baseline-note-2026-04-24.md, reports/TASK-2026-04-24-0106-benchmark-queue-smoke-result.md
---

# Goal

Review -> approval -> local execution queue -> done 흐름의 기준 시간을 재기 위한 작은 smoke task를 실행한다.
이 benchmark는 현재 실제 운영 queue 상태를 반영한 end-to-end 시간을 본다.

# User Flow

- reviewer는 cowork review를 확인한다.
- 사람이 Slack 승인 버튼으로 packet을 승인한다.
- local watcher가 packet을 실행한다.
- implementer는 `reports/benchmark-queue-baseline-note-2026-04-24.md`에 간단한 benchmark note를 만든다.
- watcher는 result report를 남기고 packet을 `tasks/done`으로 이동한다.

# Acceptance Criteria

1. 승인 전에는 `cowork/reviews/TASK-2026-04-24-0106-benchmark-queue-smoke-review.md`와 `cowork/dispatch/TASK-2026-04-24-0106-benchmark-queue-smoke-review-ready.md`가 생성된다.
2. 승인 후에는 `cowork/dispatch/TASK-2026-04-24-0106-benchmark-queue-smoke-promoted.md`와 `tasks/inbox/TASK-2026-04-24-0106-benchmark-queue-smoke.md` 또는 `tasks/running/TASK-2026-04-24-0106-benchmark-queue-smoke.md`가 생성된다.
3. 완료 후에는 `tasks/done/TASK-2026-04-24-0106-benchmark-queue-smoke.md`, `reports/benchmark-queue-baseline-note-2026-04-24.md`, `reports/TASK-2026-04-24-0106-benchmark-queue-smoke-result.md`가 남는다.
4. 구현자가 직접 만드는 변경은 `reports/benchmark-queue-baseline-note-2026-04-24.md` 생성으로 제한된다.
5. benchmark 기록 기준 시점은 아래로 고정한다.
   - review stage start: `cowork/dispatch/TASK-2026-04-24-0106-benchmark-queue-smoke-review-ready.md`의 `created_at`
   - promotion stage start: `cowork/dispatch/TASK-2026-04-24-0106-benchmark-queue-smoke-promoted.md`의 `created_at`
   - execution complete: `tasks/done/TASK-2026-04-24-0106-benchmark-queue-smoke.md`의 최종 생성 시각과 result report 시각
6. 현재 다른 task가 이미 `tasks/running`에 있어 생기는 backlog 대기시간도 실제 end-to-end total에 포함한다. 다만 후속 분석에서는 `review -> approval`, `approval -> promoted`, `promoted -> done` 구간을 분리해 별도 산정할 수 있어야 한다.

# Constraints

- 기존 코드 동작은 바꾸지 않는다.
- 구현자가 직접 만드는 source/content 변경은 `reports/` 밖으로 넓히지 않는다.
- `cowork/dispatch`, `tasks/*`, watcher ledger/log, approval marker 같은 watcher-managed workflow artifact는 이 제한에서 제외한다.
- 작은 smoke task이므로 broad refactor나 runtime behavior 변경은 금지한다.
- 이 smoke는 조용한 idle baseline이 아니라 현재 queue 상태를 포함한 운영 baseline 측정이다.

# Non-goals

- watcher 로직 수정
- Slack approval workflow 구조 변경
- product/backend/frontend behavior 변경

# Edge Cases

- approval 지연으로 review-ready 이후 대기 시간이 길어질 수 있다.
- watcher가 이미 dirty worktree 상태여도 packet 자체는 review/approval 가능해야 한다.

# Open Questions

- 없음.
