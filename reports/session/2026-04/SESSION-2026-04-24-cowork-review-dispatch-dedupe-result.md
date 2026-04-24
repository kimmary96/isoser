# SESSION-2026-04-24-cowork-review-dispatch-dedupe-result

## changed files

- `cowork_watcher.py`
- `tests/test_cowork_watcher.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 같은 `task_id`에 대해 의미가 같은 `review-failed`가 반복 발행되면 dispatch와 Slack 알림이 누적되어, stale 실패가 현재 상태처럼 보이는 문제가 있었다.
- `review-ready`로 상태가 바뀐 뒤에도 이전 실패 dispatch 파일이 남아 있어 최신 상태 해석이 헷갈릴 수 있었다.

## preserved behaviors

- `review-failed` 자체를 차단하지는 않는다. 내용이 달라진 새 실패는 계속 기록하고 알린다.
- `review-ready`의 기존 supersede 표식과 승인 요청 흐름은 유지한다.
- cowork watcher의 ledger 기록과 Slack dispatch 경로는 그대로 유지한다.

## risks / possible regressions

- `created_at`만 달라지고 본문이 같은 실패는 새 이벤트로 보지 않기 때문에, 의도적으로 같은 실패를 다시 알리고 싶을 때는 note/status 등 본문 차이가 있어야 한다.
- 이미 Slack에 전송된 과거 실패 메시지를 수정하거나 삭제하지는 않는다. 이번 수정은 이후 중복 발행 억제와 최신 상태 표시 보강에 집중한다.

## tests

- `PYTHONPATH=D:\02_2025_AI_Lab\isoser python -m pytest tests/test_cowork_watcher.py -q`
- 결과: `26 passed`

## follow-up refactoring candidates

- Slack thread update API를 사용해 이전 `review-failed` 메시지 본문에도 stale 표식을 직접 반영하는 후속 개선
- dispatch stage별 공통 supersede/dedupe 규칙을 helper로 분리해 local watcher 쪽과 재사용 가능한 구조로 정리
