# Automation Overview

## Purpose
- 로컬 Codex 자동화와 remote Claude fallback을 분리한다.
- task packet이 어떤 경로로 이동하는지 빠르게 파악할 수 있게 한다.
- `cowork/packets`, `cowork/reviews`, `tasks/inbox`의 역할 차이를 혼동하지 않도록 한다.

## Roles
- Claude: 기획, 명세, task packet 작성
- Codex: 로컬 저장소 검사, 구현, 검증, 보고서 작성
- `cowork_watcher.py`: cowork scratch packet review와 promotion 자동화
- `watcher.py`: `tasks/inbox/` 기반 구현 자동화
- `scripts/watcher_shared.py`: watcher 두 종류가 공유하는 lock, frontmatter, file-io, retry 유틸
- Claude Code GitHub Action: 로컬 머신이 없을 때 remote fallback

## Main paths
- Cowork review path
  - `cowork/packets/*.md`는 기획 원본이자 review 대상 packet이다
  - `cowork_watcher.py`가 현재 저장소 기준으로 review를 만들고 `cowork/reviews/<task-id>-review.md`에 기록한다
  - review 결과를 보고 사람이 `cowork/packets/<task-id>.md` 원본을 수정한다
  - review 문서는 실행 큐로 가지 않는다
  - approval marker: `cowork/approvals/<task-id>.ok`
  - 승인되면 `cowork/packets/<task-id>.md`의 최신본이 `tasks/inbox/` 또는 `tasks/remote/`로 복사되어 execution packet이 된다
- Local execution path
  - `tasks/inbox/*.md` -> `tasks/running/` -> `tasks/done/|tasks/drifted/|tasks/blocked/|tasks/review-required/`
  - `tasks/drifted/*.md|tasks/blocked/*.md` -> auto recovery -> `tasks/inbox/` (가능할 때만)
  - `tasks/review-required/*.md` -> manual review / cowork approval path
  - reviewed-and-closed `tasks/review-required/*.md` -> `tasks/archive/*.md`
  - reports: `reports/*.md`
  - terminal alerts: `dispatch/alerts/*.md`
  - LangGraph spec/review: `docs/automation/watcher-langgraph.md`, `scripts/watcher_langgraph.py`
- Remote fallback path
  - `tasks/remote/*.md` push -> `.github/workflows/claude-dev.yml`

## Current behavior summary
- task execution 규칙의 source of truth는 `AGENTS.md`
- `cowork/packets`는 draft/review workspace이고 `tasks/`만 execution queue다
- `cowork/reviews`는 review 산출물 저장소이며, 승인 후에도 그대로 남는다
- `tasks/inbox`에는 review markdown이 아니라 승인된 최신 packet 사본이 들어간다
- `tasks/review-required`에는 아직 사람이 판단해야 하는 살아 있는 packet만 남기고, 검토가 끝난 stale/closed packet은 `tasks/archive`로 이동한다
- `reports/*`의 verification/result/needs-review 문서는 packet archive 이후에도 audit trail로 유지한다
- 성공 task는 watcher가 task-scoped git automation을 시도한다
- drift와 blocked는 terminal alert와 report를 둘 다 남긴다
- drifted와 blocked task는 watcher가 recovery report를 바탕으로 자동 재큐잉을 한 번 더 시도할 수 있다
- 자동 재큐잉이 불가능한 drifted/blocked task는 `cowork/packets/`으로 에스컬레이션되어 기존 Slack approval 흐름에서 사람 피드백을 받을 수 있다
- Slack은 `SLACK_WEBHOOK_URL`이 있을 때만 mirror channel로 동작한다
