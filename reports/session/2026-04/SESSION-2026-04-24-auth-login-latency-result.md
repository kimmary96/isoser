# SESSION-2026-04-24 auth login latency result

## changed files

- `frontend/middleware.ts`
- `frontend/app/auth/callback/route.ts`
- `frontend/app/(auth)/login/page.tsx`
- `docs/current-state.md`

## why changes were made

- 로그인 지연 원인을 코드와 실제 로컬 응답 시간 기준으로 분리 확인했다.
- 같은 워크스페이스에서 `http://localhost:3000/login`은 약 `714ms`, `http://localhost:3000/api/auth/google?next=%2Fdashboard`는 약 `594ms`였다.
- 반면 `http://localhost:3001/login`, `http://localhost:3001/api/auth/google?next=%2Fdashboard`는 둘 다 `30s timeout`으로 실패했다.
- 따라서 현재 체감 지연의 1차 원인은 Supabase OAuth 자체보다 `3001`에 떠 있는 stale Next 서버일 가능성이 높다.
- 추가로 healthy 서버 기준에서도 로그인 흐름에 불필요한 Supabase auth round trip이 있어 이를 줄였다.

## preserved behaviors

- `/programs/compare -> /compare` redirect 유지
- 루트 `/?code=...` OAuth 유입을 `/auth/callback`으로 정규화하는 동작 유지
- 기존 사용자 로그인 후 `redirectedFrom` 또는 기본 `/landing-c`로 복귀하는 동작 유지
- 신규 사용자 로그인 후 `/onboarding`으로 보내는 분기 유지
- `/dashboard*`, `/onboarding` 인증 보호 유지

## risks / possible regressions

- `/login` signed-in redirect를 이제 middleware에만 의존하므로, middleware가 비활성화된 특수 실행 경로가 있다면 같은 방어가 줄어든다.
- callback route는 `exchangeCodeForSession()` 반환 `user`를 신뢰하므로, 라이브러리 계약이 바뀌면 재검토가 필요하다.
- `3001` 서버 hang는 코드 수정만으로 해결되지 않으며, stale dev server 재시작 또는 포트 단일화가 필요하다.

## follow-up refactoring candidates

- auth route에 단계별 timing log를 추가해 `oauth start`, `code exchange`, `profile lookup`을 서버 로그에서 바로 구분할 수 있게 만들기
- middleware `matcher`에서 `/api/*`를 아예 제외해 현재처럼 내부 early return에 의존하지 않도록 정리하기
- 로컬 실행 포트를 `3000` 하나로 고정하고, stale server 감지 체크를 launch/smoke 문서나 스크립트에 추가하기
