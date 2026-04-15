# Dispatch Channels

## `cowork/dispatch/`
- owner: `cowork_watcher.py`
- purpose: cowork packet review/promotion workflow
- examples:
  - `review-ready`
  - `approval-blocked-stale-review`
  - `promoted`
  - optional `rejected`

이 채널은 아직 실행되지 않은 packet의 review 상태를 다룬다.

## `dispatch/alerts/`
- owner: `watcher.py`
- purpose: local execution terminal outcomes
- standard stages:
  - `completed`
  - `needs-review`
  - `drift`
  - `blocked`
  - `push-failed`

이 채널은 실행이 끝난 뒤 사람에게 바로 보여야 하는 상태를 다룬다.

## Standard alert format
- `type: watcher-alert`
- `stage: <completed|needs-review|drift|blocked|push-failed>`
- `status: <done|action-required>`
- `severity: <info|warning|error>`
- `packet: <tasks/... path>`
- `created_at: <ISO timestamp>`
- `report: <reports/... path>` if available
- `summary: <one-line human summary>`
- `next_action: <single next step>`

Detailed format reference: [../../dispatch/alerts/README.md](../../dispatch/alerts/README.md)
