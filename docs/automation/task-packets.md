# Task Packet Contract

## Required frontmatter
- `id`
- `status`
- `type`
- `title`
- `planned_at`
- `planned_against_commit`

## Rules
- task packet은 YAML-style frontmatter를 사용한다
- 필수 필드가 빠지면 watcher가 blocked 처리한다
- `planned_against_commit`이 현재 `HEAD`와 달라도 watcher는 실행할 수 있지만, Codex는 drift를 먼저 판단해야 한다
- `planned_files`와 `planned_worktree_fingerprint`는 optional field다
- 이 optional field가 같이 있으면 watcher와 cowork review는 `planned_files` 기준 현재 worktree hash도 검증한다
- dirty worktree나 좁은 검증 영역이 중요한 task에서는 이 optional field 사용을 권장한다
- helper command:
  - `python scripts/compute_task_fingerprint.py --frontmatter <repo-path> [<repo-path> ...]`
- scaffold command:
  - `python scripts/create_task_packet.py --task-id TASK-YYYY-MM-DD-HHMM-slug --title "Short title" --output tasks/inbox/TASK-YYYY-MM-DD-HHMM-slug.md --files <repo-path> [<repo-path> ...]`
- 파일명과 id는 가능하면 `TASK-YYYY-MM-DD-HHMM-short-slug` 형식을 쓴다

## References
- template: [../rules/task-packet-template.md](../rules/task-packet-template.md)
- examples: [../rules/task-packet-examples.md](../rules/task-packet-examples.md)
