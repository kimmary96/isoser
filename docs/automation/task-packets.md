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
- 파일명과 id는 가능하면 `TASK-YYYY-MM-DD-HHMM-short-slug` 형식을 쓴다

## References
- template: [../rules/task-packet-template.md](../rules/task-packet-template.md)
- examples: [../rules/task-packet-examples.md](../rules/task-packet-examples.md)
