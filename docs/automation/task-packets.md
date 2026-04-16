# Task Packet Contract

## Packet lifecycle
- `cowork/packets/<task-id>.md`는 기획 원본이자 review 대상 packet이다
- review 결과는 `cowork/reviews/<task-id>-review.md`에 별도 문서로 남는다
- review에서 수정 의견이 나오면 `cowork/packets/<task-id>.md` 원본을 업데이트한다
- 승인 후 `tasks/inbox/<task-id>.md` 또는 `tasks/remote/<task-id>.md`로 들어가는 것은 review 문서가 아니라 최신 packet 사본이다
- 따라서 packet은 일회용 초안이 아니라 review를 거치며 정제되는 living document로 다룬다

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
- cowork review 단계에서도 packet 원본을 수정한 뒤에는 최신 내용 기준으로 review를 다시 맞춘 다음 승인해야 한다
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
- execution flow: [./local-flow.md](./local-flow.md)
