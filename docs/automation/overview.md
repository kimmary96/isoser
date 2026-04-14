# Automation Overview

## Purpose
- 로컬 Codex 자동화와 remote Claude fallback을 분리한다.
- task packet이 어떤 경로로 이동하는지 빠르게 파악할 수 있게 한다.

## Roles
- Claude: 기획, 명세, task packet 작성
- Codex: 로컬 저장소 검사, 구현, 검증, 보고서 작성
- `cowork_watcher.py`: cowork scratch packet review와 promotion 자동화
- `watcher.py`: `tasks/inbox/` 기반 구현 자동화
- `scripts/watcher_shared.py`: watcher 두 종류가 공유하는 lock, frontmatter, file-io, retry 유틸
- Claude Code GitHub Action: 로컬 머신이 없을 때 remote fallback

## Main paths
- Cowork review path
  - `cowork/packets/*.md` -> `cowork_watcher.py` -> `cowork/reviews/*.md`
  - approval marker: `cowork/approvals/<task-id>.ok`
  - promoted target: `tasks/inbox/` or `tasks/remote/`
- Local execution path
  - `tasks/inbox/*.md` -> `tasks/running/` -> `tasks/done/|tasks/drifted/|tasks/blocked/`
  - reports: `reports/*.md`
  - terminal alerts: `dispatch/alerts/*.md`
- Remote fallback path
  - `tasks/remote/*.md` push -> `.github/workflows/claude-dev.yml`

## Current behavior summary
- task execution 규칙의 source of truth는 `AGENTS.md`
- 성공 task는 watcher가 task-scoped git automation을 시도한다
- drift와 blocked는 terminal alert와 report를 둘 다 남긴다
- Slack은 `SLACK_WEBHOOK_URL`이 있을 때만 mirror channel로 동작한다
