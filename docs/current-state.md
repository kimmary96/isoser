# Current State

현재 운영 구조의 짧은 요약입니다. 세부 운영 문서는 `docs/automation/` 아래로 분리했습니다.

## Summary
- 로컬 구현 자동화는 `watcher.py`가 담당한다.
- cowork scratch review와 promotion은 `cowork_watcher.py`가 담당한다.
- watcher 공통 파일 처리, lock, frontmatter 파싱, CLI 해석은 `scripts/watcher_shared.py`로 분리되어 있다.
- local terminal outcome은 `dispatch/alerts/`에 기록된다.
- 성공 task는 watcher가 task-scoped git automation을 시도한다.
- watcher는 `tasks/drifted/`와 `tasks/blocked/`를 다시 검사해 자동 복구 가능한 packet은 `tasks/inbox/`로 재투입한다.
- 자동 복구가 막힌 task는 `cowork/packets/`으로 에스컬레이션되어 Slack approval/feedback 흐름으로 넘겨진다.
- remote fallback은 `tasks/remote/` + GitHub Action 경로를 사용한다.
- cowork review-ready는 Slack 버튼과 slash command 양쪽으로 approval을 받을 수 있다.
- `frontend/app/programs/page.tsx`는 URL query 기반 검색, 카테고리/지역 필터, 모집중 토글, 정렬, 페이지네이션을 지원한다.
- `frontend/app/programs/compare/page.tsx`는 공개 비교 페이지로 동작하며 `?ids=` URL state, 최대 3개 슬롯, 추천 프로그램 추가/제거를 지원한다.
- `frontend/middleware.ts`는 루트 `/?code=...` OAuth 유입을 `/auth/callback?next=/`로 정규화해서 로그인 후 랜딩페이지 주소를 깨끗하게 유지한다.
- `frontend/app/auth/callback/route.ts`는 기존 사용자 로그인 완료 후 기본 진입점을 `/dashboard`가 아니라 `/`로 돌려 랜딩에 머문 상태에서 세션만 유지한다.
- `frontend/app/page.tsx`는 서버에서 로그인 상태와 프로필을 읽어, 랜딩 상단에서 로그인 버튼 대신 프로필 진입 버튼을 노출한다.
- `backend/routers/programs.py`는 `/programs/count`와 확장된 목록 query(`q`, `regions`, `recruiting_only`, `sort`)를 지원한다.
- `programs.compare_meta` JSONB 컬럼이 migration으로 추가되어 비교 화면의 대상/허들/커리큘럼 메타데이터를 저장할 수 있다.

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
