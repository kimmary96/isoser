# TASK-2026-04-16-1800-fix-commit-stamp-on-promote 결과

- changed files
  - `cowork_watcher.py`
  - `reports/TASK-2026-04-16-1800-fix-commit-stamp-on-promote-result.md`
- why changes were made
  - 승격 시 `tasks/inbox/` 또는 `tasks/remote/`로 복사된 packet 안의 `planned_against_commit: TODO_CURRENT_HEAD`를 실제 `git rev-parse HEAD` 값으로 치환하도록 보강했다.
  - 승격 dispatch에 stamp 여부와 실제 SHA를 남겨 후속 확인이 가능하도록 했다.
- preserved behaviors
  - `cowork/packets/` 원본 packet은 수정하지 않는다.
  - 이미 실제 SHA가 들어 있는 packet은 stamp 없이 그대로 복사된다.
  - review 단계의 기존 drift 경고/차단 로직은 변경하지 않았다.
- risks / possible regressions
  - `current_head()`가 빈 값을 반환하거나 promoted copy 쓰기에 실패하면 stamp는 건너뛰고 기존 copy 동작만 유지한다.
  - dispatch 메시지의 `commit_stamped` 항목은 실제 stamp가 일어난 경우에만 추가된다.
- follow-up refactoring candidates
  - packet stamping과 promote dispatch 구성 로직을 작은 helper로 분리하면 승격 경로 검증이 더 쉬워질 수 있다.

## 검증

- `cowork_watcher.py` 문법 컴파일 확인
- workspace probe 파일에 `TODO_CURRENT_HEAD`를 넣고 `stamp_commit_placeholder()` 실행
- probe 결과가 현재 HEAD `961b30d1383a6f4c69e4d608a55fb4268ed49d99`로 치환되는 것 확인

## Run Metadata

- generated_at: `2026-04-16T17:48:03`
- watcher_exit_code: `0`
- codex_tokens_used: `53,601`
