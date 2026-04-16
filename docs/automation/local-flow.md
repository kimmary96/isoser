# Local Flow

## Standard local execution flow
1. Claude가 `cowork/packets/<task-id>.md`를 만든다.
2. `cowork_watcher.py`가 현재 저장소 기준으로 `cowork/reviews/<task-id>-review.md`를 생성한다.
3. 사람은 review를 보고 필요하면 `cowork/packets/<task-id>.md` 원본을 수정한다.
4. packet이 수정되면 cowork watcher가 최신 packet 기준으로 review를 다시 맞춘다.
5. 사람이 승인하면 `cowork/approvals/<task-id>.ok`를 만든다.
6. cowork watcher가 `cowork/packets/<task-id>.md` 최신본을 `tasks/inbox/` 또는 `tasks/remote/`로 복사해 execution queue로 승격한다.
7. 이때 `cowork/reviews/*.md`는 참고 이력으로 남고 실행 큐로 이동하지 않는다.
8. `watcher.py`가 `tasks/inbox/`를 감시한다.
9. watcher가 task를 `tasks/running/`으로 이동한다.
10. Codex가 저장소를 검사하고 구현, 검증, 보고서를 작성한다.
11. watcher가 결과에 따라 task를 `done`, `drifted`, `blocked`로 이동한다.
12. watcher는 `tasks/drifted/`와 `tasks/blocked/`도 감시하며, 자동 복구 가능한 packet이면 현재 HEAD 기준으로 packet을 보정한 뒤 `tasks/inbox/`로 재투입한다.

## Queue semantics
- `cowork/packets/`: review 대상이 되는 원본 packet
- `cowork/reviews/`: 원본 packet에 대한 review 결과 문서
- `tasks/inbox/`: 승인된 최신 packet 사본이 들어가는 실제 실행 대기열
- `tasks/done/|tasks/blocked/|tasks/drifted/`: 실행 결과 상태 큐
- 따라서 "review 결과 문서가 inbox로 들어간다"가 아니라 "review를 반영해 최신화된 packet이 inbox로 들어간다"가 정확한 표현이다

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
