# 운영 Supabase Auth 설정

이 문서는 현재 배포 코드 기준으로 운영 환경에서 필요한 Supabase Auth 설정을 정리한다.

기준 파일:
- `frontend/app/api/auth/google/route.ts`
- `frontend/app/auth/callback/route.ts`
- `frontend/middleware.ts`
- `frontend/lib/seo.ts`
- `frontend/lib/supabase/server.ts`

## 프론트 운영 환경변수

Vercel `frontend` 프로젝트에 아래 값을 둔다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
NEXT_PUBLIC_BACKEND_URL=https://<your-backend>
NEXT_PUBLIC_SITE_URL=https://isoser.vercel.app
```

설명:
- `frontend/lib/seo.ts`는 `NEXT_PUBLIC_SITE_URL`이 없으면 기본값으로 `https://isoser.vercel.app`를 사용한다.
- OAuth redirect URL은 배포 origin 기준으로 `https://<current-origin>/auth/callback?next=...` 형태로 만들어진다.

## 백엔드 운영 환경변수

Render `backend` 서비스에 아래 값이 필요하다.

```bash
GOOGLE_API_KEY=<gemini-api-key>
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
CHROMA_PERSIST_DIR=./chroma_store_v2
```

설명:
- 공개 프로그램 페이지 자체의 OAuth 시작/콜백은 프론트에서 처리하지만, 프로필/추천/북마크/온보딩 저장과 admin sync는 backend Supabase 설정에도 의존한다.

## Supabase Dashboard Auth 설정

Supabase Auth > URL Configuration에서 운영 기준으로 아래 값을 맞춘다.

- Site URL: `https://isoser.vercel.app`
- Redirect URLs:
  - `https://isoser.vercel.app/auth/callback`
  - 커스텀 도메인이 있으면 해당 도메인의 `/auth/callback`도 추가

Google provider를 Supabase에서 사용하는 경우, provider 설정도 같은 배포 도메인 기준으로 일치해야 한다.

## 운영 로그인 후 이동 규칙

현재 코드 기준 기본 동작:
- 기본 진입점은 `/landing-a`
- `GET /api/auth/google`가 `next`를 받으면 해당 경로로 복귀
- `GET /auth/callback`은 기존 사용자만 `next` 또는 `/landing-a`로 보내고, `profiles` row가 없으면 `/onboarding`으로 보냄
- `middleware()`는 `/dashboard*`, `/onboarding`만 인증 보호 대상으로 취급

즉 현재 운영 정책은 "로그인 후 바로 대시보드 강제 진입"이 아니라 "공개 랜딩 흐름 유지 + 워크스페이스는 필요 시 진입"이다.

## 운영 점검 항목

1. `https://isoser.vercel.app/login`에서 Google 로그인 시작
2. 로그인 후 `/auth/callback`을 거쳐 `/landing-a` 또는 전달된 `next`로 복귀
3. 신규 사용자만 `/onboarding`으로 이동
4. 비로그인 상태 `/dashboard` 접근 시 `/login?redirectedFrom=/dashboard`로 이동
5. 로그인 상태 `/login` 재접속 시 `/landing-a` 또는 `redirectedFrom`으로 복귀
