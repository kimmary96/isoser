# 로컬 Supabase Auth 설정

이 문서는 현재 프론트 인증 코드 기준으로 로컬 개발에서 필요한 Supabase Auth 설정만 정리한다.

기준 파일:
- `frontend/app/api/auth/google/route.ts`
- `frontend/app/auth/callback/route.ts`
- `frontend/middleware.ts`
- `frontend/lib/supabase/server.ts`
- `frontend/lib/supabase/client.ts`

## 프론트 로컬 환경변수

`frontend/.env.local`에 아래 값을 둔다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

설명:
- `createServerSupabaseClient()`와 `createBrowserClient()`는 둘 다 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 사용한다.
- OAuth 시작 route `GET /api/auth/google`는 현재 요청 origin을 기준으로 `redirectTo=${origin}/auth/callback?next=...`를 만든다.

## Supabase Dashboard Auth 설정

Supabase Auth > URL Configuration에서 아래 값을 로컬 개발 기준으로 맞춘다.

- Site URL: `http://localhost:3000`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - 필요 시 query 포함 유입까지 허용되도록 `http://localhost:3000/auth/callback**`

주의:
- 현재 코드에서 콜백 경로는 `/auth/callback`이다. `/callback`이나 `/login/callback`로 등록하면 `frontend/app/auth/callback/route.ts`와 어긋난다.
- `frontend/middleware.ts`는 루트 `/?code=...` 유입도 `/auth/callback?next=/landing-a`로 다시 정규화한다.

## 로그인 후 이동 규칙

현재 코드 기준 기본 동작:
- `frontend/app/api/auth/google/route.ts`의 `GET()`:
  - `next` query가 없으면 `/landing-a`를 기본값으로 사용
- `frontend/app/auth/callback/route.ts`의 `GET()`:
  - 기존 사용자: `next` 또는 `/landing-a`
  - 신규 사용자: `/onboarding`
- `frontend/middleware.ts`의 `middleware()`:
  - 비로그인 사용자가 `/dashboard*` 또는 `/onboarding`에 접근하면 `/login?redirectedFrom=...`으로 보냄
  - 이미 로그인된 사용자가 `/login`에 접근하면 `redirectedFrom` 또는 `/landing-a`로 돌려보냄

## 로컬 점검 항목

1. `/login`에서 `Google로 계속하기` 클릭 시 `/api/auth/google?next=...`가 호출되는지 확인
2. Google 로그인 후 브라우저 주소가 `/auth/callback`을 거쳐 `/landing-a` 또는 `/onboarding`으로 정리되는지 확인
3. 비로그인 상태에서 `/dashboard` 접근 시 `/login?redirectedFrom=/dashboard`로 이동하는지 확인
4. 로그인 상태에서 `/login` 재접속 시 `/landing-a` 또는 `redirectedFrom`으로 복귀하는지 확인
