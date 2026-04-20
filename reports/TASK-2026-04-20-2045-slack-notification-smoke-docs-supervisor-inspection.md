# Supervisor Inspection: TASK-2026-04-20-2045-slack-notification-smoke-docs

## Task Summary
- 목표는 `docs/automation/slack-approval-setup.md`에 direct watcher Slack notification smoke check 메모를 짧게 추가할 수 있는지 구현 전 상태를 점검하는 것이다.
- task packet frontmatter 필수 필드(`id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`)는 모두 존재한다.
- 현재 문서에는 Slack approval setup, 버튼/slash command smoke test 체크리스트는 있으나 direct watcher notification 전용 안전 확인 메모는 명시적으로 보이지 않는다.
- `planned_against_commit` 기준으로 대상 문서는 현재 materially changed 상태가 아니어서 drift 보고로 중단할 사유는 확인되지 않았다.

## Touched files
- `tasks/running/TASK-2026-04-20-2045-slack-notification-smoke-docs.md`
- `docs/automation/slack-approval-setup.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Implementation outline
- `docs/automation/slack-approval-setup.md`의 기존 구조를 유지한 채 smoke test 인접 구간에 direct watcher notification 확인 메모를 짧게 추가한다.
- 메모는 이미 문서화된 `SLACK_WEBHOOK_URL`과 watcher alert 전송 맥락을 재사용해, 안전한 반복 확인 방법만 설명하고 setup flow는 바꾸지 않는다.
- wording은 현재 운영 문서와 일치하게 한국어 중심으로 유지하고, 버튼/approval/slash command 절차와 혼동되지 않도록 범위를 direct watcher alert smoke check로 제한한다.

## Verification plan
- 대상 diff가 `docs/automation/slack-approval-setup.md` 한 파일에만 머무는지 확인한다.
- 추가 문구가 기존 setup 순서, approval flow, slash command 설명을 변경하지 않는지 확인한다.
- 문구가 이미 `docs/current-state.md`와 `docs/refactoring-log.md`에 남아 있는 Slack webhook/direct alert 맥락과 충돌하지 않는지 확인한다.
- 구현 후 `git diff -- docs/automation/slack-approval-setup.md`로 docs-only 최소 변경인지 다시 본다.

## Preserved behaviors
- Slack App setup 절차, signing secret 설정, approver ID 설정은 유지한다.
- `review-ready` 버튼과 `/isoser-approve` smoke test 체크리스트의 기존 순서는 유지한다.
- watcher runtime, backend Slack approval logic, GitHub workflow 동작은 이번 단계 범위 밖으로 유지한다.

## Risks
- direct watcher notification과 cowork approval notification을 같은 섹션에서 섞어 쓰면 운영자가 어떤 smoke check를 실행해야 하는지 혼동할 수 있다.
- 이미 존재하는 일반 smoke test 체크리스트를 다시 설명하는 식으로 문구를 늘리면 minimal-safe-change 원칙에서 벗어날 수 있다.
- 현재 동작을 넘어서 실제 runtime 보장을 암시하는 표현을 쓰면 문서와 운영 사이에 오해가 생길 수 있다.
