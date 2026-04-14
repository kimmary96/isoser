# Cowork Workspace

This folder is a local cowork scratch workspace for planning artifacts that are not yet part of the execution queue.

## Use this folder for
- `drafts/`: planning drafts and rough writing
- `packets/`: Task Packet drafts before approval
- `notes/`: meeting notes and raw working notes
- `reviews/`: review notes, change proposals, and promotion notes
- `approvals/`: human approval markers such as `<task-id>.ok`
- `dispatch/`: cowork watcher status notes for review-ready, approval-blocked, promoted, or rejected cowork packets

## Not in this folder
- local implementation watcher terminal alerts do not go to `cowork/dispatch/`
- those alerts go to root `dispatch/alerts/` and cover `completed`, `drift`, `blocked`, and `push-failed`

## Promotion flow
- Review automation: `cowork_watcher.py` reviews new packets and writes `cowork/reviews/<task-id>-review.md`
- Approval step: create `cowork/approvals/<task-id>.ok`
- Local execution: default approval target promotes the packet to `tasks/inbox/`
- Remote fallback: put `target: remote` inside the approval file to promote to `tasks/remote/`

## Guardrails
- Do not directly edit `CLAUDE.md`, `AGENTS.md`, `README.md`, or `docs/*.md` from cowork output.
- Treat files here as drafts until a human reviews and promotes them.
- `tasks/` is the only execution queue in this repository.

See `cowork/FOLDER_INSTRUCTIONS.md` for the fixed rules.
