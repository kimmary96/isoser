# Cowork Folder Instructions

`cowork/` is a local scratch workspace, not part of the default execution flow.

## Fixed rules

### 1. Reference documents are read-only here
- Do not directly edit `CLAUDE.md`, `AGENTS.md`, `README.md`, or `docs/*.md` from cowork output.
- If a reference document needs to change, write a proposal in `cowork/reviews/` or raise it in chat first.

### 2. Draft output locations
- Put planning or wording drafts in `cowork/drafts/`.
- Put Task Packet drafts in `cowork/packets/`.
- Put meeting notes or raw thinking in `cowork/notes/`.
- Put document reviews, change proposals, or promotion notes in `cowork/reviews/`.
- Put approval markers in `cowork/approvals/`.
- Put watcher-generated alert or status notes in `cowork/dispatch/`.

### 3. Task Packet draft rules
- Files in `cowork/packets/` are drafts only.
- Do not treat `cowork/packets/` as an execution queue.
- After human review, promote an approved packet to `tasks/inbox/` for local watcher execution.
- For remote fallback, promote an approved packet to `tasks/remote/` before push.
- Approval markers use `cowork/approvals/<task-id>.ok`.
- Default promotion target is `tasks/inbox/`; set `target: remote` in the approval file for remote fallback.

### 4. Creation and automation rules
- `cowork/` should exist only because a user explicitly wanted a scratch workspace.
- VS Code startup, watcher automation, and Codex execution should not assume `cowork/` exists.
- `tasks/` remains the only execution queue in this repository.

## Folder map
- `cowork/drafts/`
- `cowork/packets/`
- `cowork/notes/`
- `cowork/reviews/`
- `cowork/approvals/`
- `cowork/dispatch/`
