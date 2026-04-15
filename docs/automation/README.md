# Automation Docs

운영 자동화 문서를 역할별로 나눈 인덱스입니다.

## Documents
- [overview.md](./overview.md)
  - 현재 로컬 watcher, cowork watcher, remote fallback의 전체 구조 요약
- [local-flow.md](./local-flow.md)
  - 로컬 구현 watcher의 실행 흐름과 종료 상태
- [task-packets.md](./task-packets.md)
  - task packet 필수 규칙과 frontmatter 계약
  - optional `planned_files` / `planned_worktree_fingerprint`와 fingerprint helper 사용법 포함
- [dispatch-channels.md](./dispatch-channels.md)
  - `cowork/dispatch`와 `dispatch/alerts`의 역할 분리
- [operations.md](./operations.md)
  - 실행, 재시작, Slack alert, 보존 정책 같은 운영 메모
  - actionable triage 명령과 run ledger 요약 명령 포함
- [slack-approval-setup.md](./slack-approval-setup.md)
  - Slack webhook 알림과 `/isoser-approve` slash command 운영 설정 체크리스트
- [watcher-shared.md](./watcher-shared.md)
  - `watcher.py`와 `cowork_watcher.py`가 공유하는 공통 유틸 경계와 유지 규칙
