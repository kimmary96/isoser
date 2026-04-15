# Current State

현재 운영 구조의 짧은 요약입니다. 세부 운영 문서는 `docs/automation/` 아래로 분리했습니다.

## Summary
- 로컬 구현 자동화는 `watcher.py`가 담당한다.
- cowork scratch review와 promotion은 `cowork_watcher.py`가 담당한다.
- watcher 공통 파일 처리, lock, frontmatter 파싱, CLI 해석은 `scripts/watcher_shared.py`로 분리되어 있다.
- local terminal outcome은 `dispatch/alerts/`에 기록된다.
- 성공 task는 watcher가 task-scoped git automation을 시도한다.
- remote fallback은 `tasks/remote/` + GitHub Action 경로를 사용한다.
- cowork review-ready는 Slack 버튼과 slash command 양쪽으로 approval을 받을 수 있다.
- `frontend/app/programs/page.tsx`는 URL query 기반 검색, 카테고리/지역 필터, 모집중 토글, 정렬, 페이지네이션을 지원한다.
- `backend/routers/programs.py`는 `/programs/count`와 확장된 목록 query(`q`, `regions`, `recruiting_only`, `sort`)를 지원한다.

## Key references
- automation index: [automation/README.md](./automation/README.md)
- automation overview: [automation/overview.md](./automation/overview.md)
- local flow: [automation/local-flow.md](./automation/local-flow.md)
- task packet contract: [automation/task-packets.md](./automation/task-packets.md)
- dispatch split: [automation/dispatch-channels.md](./automation/dispatch-channels.md)
- operations: [automation/operations.md](./automation/operations.md)
- Slack approval setup: [automation/slack-approval-setup.md](./automation/slack-approval-setup.md)

## Project structure highlights
- `frontend/`: Next.js application
- `backend/`: FastAPI application
- `tasks/`: local task queue state
- `dispatch/alerts/`: local watcher terminal alerts
- `reports/`: implementation, drift, blocked reports
- `docs/`: reference docs and operational docs
- `scripts/`: watcher 실행 스크립트와 watcher 공통 유틸
  - `docs/automation/`: watcher, dispatch, task packet, 운영 흐름
  - `docs/rules/`: 규칙 문서와 템플릿
  - `docs/specs/`: PRD, API 계약, 출력 스펙
  - `docs/data/`: CSV, SQL, http 샘플
  - `docs/research/`: 조사와 매핑 문서
  - `docs/worklogs/`: 날짜별 작업 기록
