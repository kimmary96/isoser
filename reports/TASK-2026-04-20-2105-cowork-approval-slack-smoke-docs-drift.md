# Drift Report: TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs

## Summary
- 최종 검증 단계에서 `docs/automation/task-packets.md`의 대상 구간을 확인한 결과, task가 허용한 "approval smoke 검증 메모 1개 추가" 외 변경이 이미 함께 반영돼 있어 drift로 판정했다.
- 지시사항에 따라 `reports/TASK-2026-04-20-2105-cowork-approval-slack-smoke-docs-supervisor-verification.md`는 생성하지 않는다.

## Evidence
- task packet `scope_in`은 `docs/automation/task-packets.md`에 approval smoke 검증 메모 1개 추가로 제한돼 있다.
- 현재 문서에는 smoke 메모 외에도 아래 변경이 함께 존재한다.
- `Rules` 섹션에 `spec_version` 기반 Supervisor 표준 packet 추가 필드/`allowed_paths` vs `blocked_paths` 차단 규칙 문구가 추가돼 있다.
- `scaffold command` 섹션이 legacy/일반 packet과 Supervisor 표준 packet 예시로 확장돼 있다.
- `git show 93590a8 -- docs/automation/task-packets.md` 기준으로 해당 커밋은 1줄 메모 추가만이 아니라 총 6 insertions, 1 deletion으로 위 추가 문구까지 함께 반영했다.

## Impact
- 결과 보고서의 "smoke 검증 메모 1줄 추가" 요약만으로는 실제 문서 변경 범위를 설명하지 못한다.
- 현재 상태에서 최종 pass/review-required 판정을 내리면 task scope와 실제 변경 범위의 불일치를 놓치게 된다.

## Next Action
- task 범위를 실제 반영된 문서 변경에 맞게 재계획하거나,
- 범위를 벗어난 문서 변경을 분리한 뒤 다시 supervisor verification을 수행해야 한다.
