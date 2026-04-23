# TASK-2026-04-23-html-collector-dynamic-retrieve-diagnostic blocked

## Summary

HTML collector dynamic retrieve 진단/구현 요청은 현재 대화에서 직접 요청되었지만, 저장소 규칙상 구현 전 task packet frontmatter가 필요해 진행을 중단한다.

## Blocker

현재 요청에는 다음 필수 frontmatter가 없다.

- `id`
- `status`
- `type`
- `title`
- `planned_at`
- `planned_against_commit`

## Requested Work

- Playwright fallback을 바로 도입하기 전에 HTML collector별 `last_collect_status`, `last_collect_message`, parse-empty 이력을 점검한다.
- 동적 페이지 retrieve가 필요한 source 후보를 읽기 전용 진단 리포트로 분류한다.
- 사용자가 후속으로 "여기서 바로 구현"을 요청했지만, task packet 요건이 충족되지 않았다.

## Repository State Checked

- Current HEAD: `40cd69c`
- Branch state from `git status --short --branch`: `develop...origin/develop`
- Worktree has pre-existing uncommitted changes across backend, frontend, docs, reports, scripts, watcher/cowork dispatch files.

## Why No Code Was Changed

`AGENTS.md`의 task packet requirements에 따라 필수 frontmatter가 없으면 `reports/<task-id>-blocked.md`를 작성하고 멈춰야 한다. 기존 미커밋 변경은 이번 요청과 무관할 수 있으므로 stage/revert 하지 않았다.

## Next Step

위 필수 frontmatter를 가진 task packet을 `tasks/inbox/` 또는 적절한 실행 위치에 추가한 뒤, HTML collector 진단 리포트부터 진행한다.
