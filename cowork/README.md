# Cowork Workspace

This folder is a local cowork scratch workspace for planning artifacts that are not yet part of the execution queue.

## Use this folder for
- `drafts/`: planning drafts and rough writing
- `packets/`: Task Packet drafts before approval
- `notes/`: meeting notes and raw working notes
- `reviews/`: review notes, change proposals, and promotion notes

## Promotion flow
- Local execution: move an approved packet from `cowork/packets/` to `tasks/inbox/`
- Remote fallback: move an approved packet from `cowork/packets/` to `tasks/remote/`

## Guardrails
- Do not directly edit `CLAUDE.md`, `AGENTS.md`, `README.md`, or `docs/*.md` from cowork output.
- Treat files here as drafts until a human reviews and promotes them.
- `tasks/` is the only execution queue in this repository.

See `cowork/FOLDER_INSTRUCTIONS.md` for the fixed rules.
