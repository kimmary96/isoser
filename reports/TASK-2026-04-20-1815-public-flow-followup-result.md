# Result: TASK-2026-04-20-1815-public-flow-followup

## Changed files

- `frontend/app/(landing)/landing-b/page.tsx`
- `frontend/app/(landing)/landing-b/_components.tsx`
- `frontend/app/(landing)/landing-b/_content.ts`
- `frontend/app/(landing)/landing-b/_styles.ts`
- `README.md`
- `docs/current-state.md`
- `docs/specs/api-contract.md`
- `docs/auth/supabase-auth-local.md`
- `docs/auth/supabase-auth-production.md`
- `docs/refactoring-log.md`

## Why changes were made

- `frontend/app/(landing)/landing-b/page.tsx`와 그 하위 모듈은 코드 검색 기준 자기 자신 외부에서 참조되지 않았고, 루트/로그인/OAuth/공개 링크 어디에서도 진입되지 않아 실사용 라우트가 아니라고 판단해 제거했다.
- 로그인 후 기본 진입점, OAuth callback 경로, Supabase env 요구사항을 현재 구현 함수 기준으로 문서화하기 위해 인증 문서를 로컬/운영으로 분리했다.
- `README.md`, `docs/current-state.md`, `docs/specs/api-contract.md`의 일부 설명이 현재 코드와 어긋나 있어 `/landing-a`, `/onboarding`, `/auth/callback` 기준으로 맞췄다.

## Preserved behaviors

- 공개 메인 랜딩은 계속 `frontend/app/page.tsx`의 `HomePage()`에서 `/landing-a`로 리다이렉트된다.
- Google OAuth 시작은 계속 `frontend/app/api/auth/google/route.ts`의 `GET()`가 처리하고, callback 완료는 `frontend/app/auth/callback/route.ts`의 `GET()`가 처리한다.
- 로그인 보호 범위는 계속 `frontend/middleware.ts`의 `middleware()`에서 `/dashboard*`, `/onboarding`만 적용한다.

## Risks / possible regressions

- `/landing-b`를 외부 광고나 수동 북마크로 직접 쓰던 트래픽이 있었다면 이제 404가 된다. 현재 코드 안에서는 해당 경로를 참조하지 않지만 외부 유입 로그는 별도로 확인해야 한다.
- 운영 `https://isoser.vercel.app/landing-a`, `/compare`는 이 작업 중 네트워크 검증에서 60초 timeout이 발생해, 배포 환경의 헤더 클릭 동작을 브라우저 수준으로 최종 확증하지는 못했다.
- 배포 환경의 Supabase Redirect URLs가 문서와 다르면 로그인은 여전히 실패할 수 있으므로 Supabase Dashboard 설정 확인이 필요하다.

## Follow-up refactoring candidates

- `LandingANavBar()`와 `DashboardLayout`이 공유하는 상단/인증 표시 로직을 작은 공용 presenter로 추출할 수 있다.
- `/landing-a`와 `/compare`의 서버 데이터 fetch가 배포 환경에서 느린 원인을 `listPrograms()`, `getProgramCount()`, `getProgram()` 호출 경로 기준으로 별도 점검할 필요가 있다.

## Checks run

- `frontend`: `npm run build`
- 운영 응답 점검:
  - `curl.exe -I --max-time 20 https://isoser.vercel.app/login`
  - `Invoke-WebRequest -Uri 'https://isoser.vercel.app/landing-a' -TimeoutSec 60`
  - `Invoke-WebRequest -Uri 'https://isoser.vercel.app/compare' -TimeoutSec 60`
