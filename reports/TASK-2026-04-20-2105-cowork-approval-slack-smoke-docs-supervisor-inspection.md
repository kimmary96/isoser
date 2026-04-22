# Supervisor Inspection: TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs

## Task Summary
- 목표는 `docs/automation/task-packets.md`에 cowork approval Slack smoke 검증 메모를 1개 추가할 수 있는지 구현 전 상태를 점검하는 것이다.
- task packet의 필수 frontmatter와 Supervisor spec 필드는 모두 존재한다.
- `planned_against_commit`은 현재 `HEAD`와 일치하고, `planned_worktree_fingerprint`도 현재 `docs/automation/task-packets.md` 상태와 일치한다.
- 현재 대상 문서에는 packet lifecycle과 promotion semantics는 이미 정리되어 있지만, `cowork/packets -> cowork/reviews -> Slack review-ready -> approval -> tasks/inbox` smoke 검증 메모는 명시적으로 없다.

## Touched files
- `tasks/running/TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs.md`
- `cowork/reviews/TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs-review.md`
- `docs/automation/task-packets.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Implementation outline
- `docs/automation/task-packets.md`의 기존 구조를 유지한 채, packet lifecycle 또는 rules 인접 구간에 approval smoke 검증 메모를 짧게 추가한다.
- 메모는 실제 운영 경로를 현재 문서 용어와 맞춰 `cowork/packets`, `cowork/reviews`, Slack review-ready, approval 후 `tasks/inbox` 승격 순서로만 요약한다.
- 문구는 contract 문서를 setup/runbook로 확장하지 않도록 짧게 제한하고, watcher 규칙이나 Slack setup 절차 자체를 다시 설명하지 않는다.

## Verification plan
- 대상 diff가 `docs/automation/task-packets.md` 한 파일에만 머무는지 확인한다.
- 추가 문구가 현재 `docs/current-state.md`의 cowork approval 흐름 설명과 충돌하지 않는지 확인한다.
- 추가 문구가 이미 존재하는 lifecycle bullet과 중복 구현이 되지 않고, smoke 검증 메모로만 좁게 남는지 확인한다.
- 구현 후 `git diff -- docs/automation/task-packets.md`로 최소 docs-only 변경인지 다시 확인한다.

## Preserved behaviors
- 기존 packet lifecycle 설명, required frontmatter 규칙, Supervisor spec 규칙, scaffold command 예시는 유지한다.
- `cowork/reviews`가 review 산출물이고 `tasks/inbox`가 승인된 최신 packet 사본이라는 현재 의미 체계는 유지한다.
- watcher runtime, cowork approval 구현, Slack interactivity 동작, local watcher supervisor 흐름은 이번 단계 범위 밖으로 유지한다.

## Risks
- approval smoke 메모를 너무 길게 쓰면 contract 문서 책임이 setup/operations 문서와 섞일 수 있다.
- `docs/automation/task-packets.md`가 이미 현재 worktree에서 수정 중이므로, 새 메모 위치가 기존 미커밋 문구와 충돌하지 않게 최소 범위로 넣어야 한다.
- smoke 검증 메모가 절차 설명으로 과장되면 운영자가 이 문서를 실행 runbook처럼 오해할 수 있다.
