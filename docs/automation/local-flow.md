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
10. watcher supervisor inspector가 먼저 현재 저장소와 packet을 점검하고 `reports/<task-id>-supervisor-inspection.md` handoff를 만든다.
11. watcher supervisor implementer가 inspection handoff를 읽고 구현과 result report 초안을 만든다.
12. watcher supervisor verifier가 inspection/result artifact를 읽고 최종 검증을 수행하며, 통과 시 `pass`, 수동 검토 필요 시 `review-required` verdict를 `reports/<task-id>-supervisor-verification.md`에 남긴다.
13. watcher가 결과에 따라 task를 `done`, `drifted`, `blocked`, `review-required`로 이동한다.
14. watcher는 `tasks/drifted/`와 `tasks/blocked/`도 감시하며, 자동 복구 가능한 packet이면 현재 HEAD 기준으로 packet을 보정한 뒤 `tasks/inbox/`로 재투입한다. `tasks/review-required/`는 자동 복구 대상이 아니라 수동 검토 대기 큐다.
15. 사람이 `review-required` packet을 검토해 재실행이 아니라 종결/보류/대체로 처리하기로 판단하면 원본 packet은 `tasks/archive/`로 이동한다. 이때 `reports/<task-id>-supervisor-verification.md`, `reports/<task-id>-result.md`, `dispatch/alerts/<task-id>-needs-review.md` 같은 판단 근거는 지우지 않는다.

## Queue semantics
- `cowork/packets/`: review 대상이 되는 원본 packet
- `cowork/reviews/`: 원본 packet에 대한 review 결과 문서
- `tasks/inbox/`: 승인된 최신 packet 사본이 들어가는 실제 실행 대기열
- `tasks/done/|tasks/blocked/|tasks/drifted/|tasks/review-required/`: 실행 결과 상태 큐
- `tasks/archive/`: review 처리 완료 packet, duplicate packet, stale packet 보관소
- 따라서 "review 결과 문서가 inbox로 들어간다"가 아니라 "review를 반영해 최신화된 packet이 inbox로 들어간다"가 정확한 표현이다

## Success path
- supervisor handoff: `reports/<task-id>-supervisor-inspection.md`
- supervisor verification: `reports/<task-id>-supervisor-verification.md`
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

## Verification review path
- verification report: `reports/<task-id>-supervisor-verification.md`
- verifier verdict가 `review-required`이면 task는 `tasks/review-required/<task-id>.md`로 이동하고, 공식 사용자 알림은 `dispatch/alerts/<task-id>-needs-review.md`로 보낸다
- cowork packet: `cowork/packets/<task-id>.md`
- 이 경로는 일반 구현 실패 blocked와 달리 reviewer가 verification findings를 보고 packet 범위나 수용 기준을 조정하는 데 초점을 둔다
- 수동 검토 후 packet이 더 이상 살아 있는 execution 대기 건이 아니라고 판단되면 `tasks/review-required/`에서 제거하고 `tasks/archive/`로 이동한다

## Push-failed path
- task 자체는 성공 완료일 수 있다
- result report의 `## Git Automation`에 실패 내용이 남는다
- alert: `dispatch/alerts/<task-id>-push-failed.md`
