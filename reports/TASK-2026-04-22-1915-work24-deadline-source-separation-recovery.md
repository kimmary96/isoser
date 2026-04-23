# Recovery: TASK-2026-04-22-1915-work24-deadline-source-separation

## 판단
- 자동 복구 가능.
- drift 원인은 외부 승인, credential, 제품 결정 누락이 아니라 optional `planned_worktree_fingerprint`가 현재 planned files snapshot과 맞지 않은 deterministic metadata mismatch였다.

## 확인한 파일
- `AGENTS.md`
- `docs/agent-playbook.md`
- `docs/current-state.md`
- `docs/automation/task-packets.md`
- `tasks/drifted/TASK-2026-04-22-1915-work24-deadline-source-separation.md`
- `reports/TASK-2026-04-22-1915-work24-deadline-source-separation-drift.md`
- `reports/TASK-2026-04-22-1915-work24-deadline-source-separation-result.md`

## Packet 변경
- `status`는 `queued`로 유지했다.
- `planned_against_commit`을 현재 HEAD `eb7a6d7e2828c76abf682fe0f478c538d3cd397e`로 갱신했다.
- `auto_recovery_attempts: 1`을 추가했다.
- 기존 `planned_files` 목록의 모든 경로가 현재 worktree에 존재함을 확인했다.
- `planned_worktree_fingerprint`를 현재 planned files 기준 `a8d6fd0be8b8b5ccdf7551e6fda879d61817bea09523b73a8122d880f2be4c56`로 갱신했다.
- 재실행 중 현재 문서/result baseline을 되돌리지 않도록 constraint를 좁혀 명시했다.

## Retry가 안전한 이유
- drift report의 실제 fingerprint 값과 `scripts/compute_task_fingerprint.py --frontmatter ...` 재계산 결과가 동일하다.
- planned files는 모두 존재한다.
- 실패 원인이 task 의도나 acceptance의 모호성이 아니라 stale fingerprint metadata로 한정된다.
- 운영 DB 직접 수정은 여전히 non-goal이며, Supabase credential이 없어도 dry-run/테스트 경로를 기준으로 재실행 판단이 가능하다.

## 남은 리스크
- worktree에는 unrelated frontend/profile 변경과 watcher/cowork ledger 변경이 남아 있다. 이번 recovery는 해당 파일들을 건드리지 않았고, watcher 재실행 시에도 task의 `planned_files` 범위 밖 변경은 되돌리면 안 된다.

## Run Metadata

- generated_at: `2026-04-23T06:05:10`
- watcher_exit_code: `0`
- codex_tokens_used: `80,879`
