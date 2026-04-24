# Rules Docs

규칙, 템플릿, 체크리스트 문서를 둡니다.

- [task-packet-template.md](./task-packet-template.md)
- [task-packet-examples.md](./task-packet-examples.md)
- [watcher-restart-checklist.md](./watcher-restart-checklist.md)
- [long-refactor-handoff-template.md](./long-refactor-handoff-template.md)
- [claude-project-instructions.md](./claude-project-instructions.md)
- [claude-oauth-smoke-test.md](./claude-oauth-smoke-test.md)
- fingerprint helper: `python scripts/compute_task_fingerprint.py --frontmatter <repo-path> [<repo-path> ...]`
- packet scaffold helper: `python scripts/create_task_packet.py --task-id TASK-... --title "..." --output tasks/inbox/TASK-....md --files <repo-path> [<repo-path> ...]`
