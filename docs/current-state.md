# Current State

현재 운영 구조의 짧은 요약입니다. 세부 운영 문서는 `docs/automation/` 아래로 분리했습니다.

## Summary
- 로컬 구현 자동화는 `watcher.py`가 담당한다.
- cowork scratch review와 promotion은 `cowork_watcher.py`가 담당한다.
- watcher 공통 파일 처리, lock, frontmatter 파싱, CLI 해석은 `scripts/watcher_shared.py`로 분리되어 있다.
- local terminal outcome은 `dispatch/alerts/`에 기록된다.
- 성공 task는 watcher가 task-scoped git automation을 시도한다.
- `tasks/done`으로 완료된 task는 watcher가 task-scoped commit/push를 수행하고, fast-forward 가능하면 같은 commit을 `origin/main`에도 자동 반영한다.
- `origin/main` 자동 반영까지 성공한 완료 task는 watcher completed Slack 알림 요약에 main push 결과가 함께 기록된다.
- watcher는 `tasks/drifted/`와 `tasks/blocked/`를 다시 검사해 자동 복구 가능한 packet은 `tasks/inbox/`로 재투입한다.
- 자동 복구가 막힌 task는 `cowork/packets/`으로 에스컬레이션되어 Slack approval/feedback 흐름으로 넘겨진다.
- remote fallback은 `tasks/remote/` + GitHub Action 경로를 사용한다.
- cowork review-ready는 Slack 버튼과 slash command 양쪽으로 approval을 받을 수 있다.
- Slack 버튼 승인/거절의 최종 결과 메시지는 채널 공용(`in_channel`)으로 반환되고, 초기 처리중 ack만 클릭 사용자에게 보인다.
- cowork packet이 같은 `task_id`로 다시 review-ready가 되면 예전 approval marker와 promoted dispatch를 정리한 뒤 재승인 흐름을 연다.
- cowork Slack review-ready 알림은 같은 `task_id` 재발행 시 이전 알림을 대체한다는 표식을 포함하고, review snapshot 문구는 한국어 중심의 번호형 `판정`/`핵심 확인사항` 포맷으로 정규화한다.
- review-ready Slack 메시지는 패킷/리뷰 경로와 승인 방법 안내를 숨기고, `판정`과 번호형 `핵심 확인사항` 중심으로 압축해서 보여준다.
- Slack approval은 로컬 파일 marker 대신 Supabase `cowork_approvals` 공유 큐에 기록되고, 로컬 `cowork_watcher.py`가 이를 poll해서 `tasks/inbox|remote` 승격과 consumed 처리를 수행한다.
- `frontend/app/slack/interactivity/cowork-review/route.ts`는 Vercel 프론트 도메인으로 들어온 Slack 버튼 요청을 FastAPI backend의 `/slack/interactivity/cowork-review`로 프록시한다.
- `frontend/app/(landing)/programs/page.tsx`는 URL query 기반 검색, 카테고리/지역 필터, 모집중 토글, 정렬, 페이지네이션을 지원한다.
- `frontend/app/(landing)/compare/page.tsx`는 공개 비교 페이지로 동작하며 `?ids=` URL state, 최대 3개 슬롯, 추천 프로그램 추가/제거를 지원한다.
- `frontend/app/page.tsx`는 루트 접근을 `/landing-a`로 리다이렉트해서 landing-a를 메인 랜딩 허브로 고정한다.
- `frontend/middleware.ts`는 루트 `/?code=...` OAuth 유입을 `/auth/callback?next=/landing-a`로 정규화해서 로그인 후 landing-a 주소를 깨끗하게 유지한다.
- `frontend/middleware.ts`는 레거시 `/programs/compare` 접근을 `/compare`로 리다이렉트해서 새 랜딩 축 라우트 구조로 정리한다.
- `frontend/app/auth/callback/route.ts`는 기존 사용자 로그인 완료 후 기본 진입점을 `/landing-a`로 돌리고, 신규 사용자는 계속 `/onboarding`으로 보낸다.
- `frontend/app/(landing)/landing-a/_components.tsx`의 상단 헤더는 `Programs`, `Compare`, `내 프로필` 링크와 로그인 사용자 표시를 공통 네비게이션으로 사용한다.
- `frontend/app/(landing)` 아래에는 `landing-a`, `landing-b`, `programs`, `compare`가 함께 정리되어 랜딩 축 라우트를 한 그룹으로 관리한다.
- `frontend/app/dashboard/layout.tsx`는 landing-a 헤더를 유지한 채 대시보드 사이드바와 본문을 렌더링한다.
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
