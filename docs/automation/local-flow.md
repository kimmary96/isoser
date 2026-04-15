# Local Flow

## Standard local execution flow
1. Claude가 `cowork/packets/<task-id>.md`를 만든다.
2. `cowork_watcher.py`가 review를 생성한다.
3. 사람이 `cowork/approvals/<task-id>.ok`를 만든다.
4. cowork watcher가 packet을 `tasks/inbox/` 또는 `tasks/remote/`로 승격한다.
5. `watcher.py`가 `tasks/inbox/`를 감시한다.
6. watcher가 task를 `tasks/running/`으로 이동한다.
7. Codex가 저장소를 검사하고 구현, 검증, 보고서를 작성한다.
8. watcher가 결과에 따라 task를 `done`, `drifted`, `blocked`로 이동한다.
9. watcher는 `tasks/drifted/`와 `tasks/blocked/`도 감시하며, 자동 복구 가능한 packet이면 현재 HEAD 기준으로 packet을 보정한 뒤 `tasks/inbox/`로 재투입한다.

## Success path
- result report: `reports/<task-id>-result.md`
- task destination: `tasks/done/<task-id>.md`
- alert: `dispatch/alerts/<task-id>-completed.md`
- git automation:
  - result report의 `Changed files` 목록과 task/report 이동 파일만 stage
  - commit: `[codex] <task-id> 구현 완료`
  - push: `origin/<current-branch>`

## Drift path
- drift report: `reports/<task-id>-drift.md`
- task destination: `tasks/drifted/<task-id>.md`
- alert: `dispatch/alerts/<task-id>-drift.md`
- 자동 복구 성공 시 recovery report: `reports/<task-id>-recovery.md`
- 자동 복구 성공 시 재큐잉 alert: `dispatch/alerts/<task-id>-recovered.md`
- 자동 복구 불가 시 task는 `tasks/drifted/`에 유지되고, `cowork/packets/<task-id>.md` 초안과 `dispatch/alerts/<task-id>-needs-review.md` alert로 수동 검토 흐름에 에스컬레이션된다

## Blocked path
- blocked report: `reports/<task-id>-blocked.md`
- task destination: `tasks/blocked/<task-id>.md`
- alert: `dispatch/alerts/<task-id>-blocked.md`
- 자동 복구 성공 시 recovery report: `reports/<task-id>-recovery.md`
- 외부 자격증명이나 승인 누락처럼 자동 복구 불가한 경우 task는 `tasks/blocked/`에 유지되고, `cowork/packets/<task-id>.md` 초안과 `dispatch/alerts/<task-id>-needs-review.md` alert로 수동 검토 흐름에 에스컬레이션된다

## Push-failed path
- task 자체는 성공 완료일 수 있다
- result report의 `## Git Automation`에 실패 내용이 남는다
- alert: `dispatch/alerts/<task-id>-push-failed.md`
