# TASK-2026-04-16-1535-seo-metadata-jsonld result

- changed files
  - `frontend/app/layout.tsx`
  - `frontend/app/(landing)/programs/page.tsx`
  - `frontend/app/(landing)/programs/[id]/page.tsx`
  - `frontend/app/(landing)/landing-a/page.tsx`
  - `frontend/app/(landing)/compare/page.tsx`
  - `frontend/lib/seo.ts`
- why changes were made
  - 루트 메타데이터를 v2 정체성인 취업 지원 정보 허브 기준으로 갱신했다.
  - `/programs`, `/landing-a`, `/compare`에 고유 metadata와 Open Graph 기본 필드를 추가했다.
  - `/programs/[id]`에 기존 `getProgram(id)` fetch 패턴을 재사용하는 `generateMetadata`와 JSON-LD `Course` 스키마 출력을 추가했다.
  - 절대 URL 생성을 일관되게 처리하기 위해 작은 SEO helper를 추가했다.
- preserved behaviors
  - 기존 GA 스크립트와 루트 `<head>` 동작은 유지했다.
  - `programs`, `landing-a`, `compare`의 현재 로컬 UI/검색/비교 로직은 건드리지 않고 metadata만 additive하게 추가했다.
  - 상세 페이지의 기존 서버 fetch 패턴은 유지했고, 데이터 표시 UI도 그대로 두었다.
- risks / possible regressions
  - `NEXT_PUBLIC_SITE_URL`이 없으면 기본 사이트 URL은 `https://isoser.vercel.app`를 사용한다. 실제 운영 도메인이 다르면 canonical/OG URL이 운영값과 어긋날 수 있다.
  - 상세 페이지의 404 판별은 백엔드 에러 메시지에 `404` 또는 `not found`가 포함된다는 가정에 의존한다.
  - 기본 OG 이미지는 저장소에 자산이 없어 추가하지 않았다.
  - Google Rich Results Test 실검증은 로컬 환경 제약으로 수행하지 못했다.
- follow-up refactoring candidates
  - Open Graph 이미지 자산과 운영 도메인 환경변수(`NEXT_PUBLIC_SITE_URL`)를 정식화하면 SEO 설정을 더 안정적으로 고정할 수 있다.
  - 프로그램 상세 페이지의 데이터 로드/에러 판별을 공용 SEO helper로 분리하면 metadata와 본문 간 중복 로직을 더 줄일 수 있다.
- checks
  - `npx tsc -p tsconfig.json --noEmit` failed because stale `.next/types/app/programs/[id]/page.ts` references a missing `app/programs/[id]/page.js` outside this task.
  - `npx tsc -p tsconfig.codex-check.json --noEmit` failed for the same stale `.next/types` reason.
  - `npx eslint ...` could not run because the repo currently has ESLint v9 without an `eslint.config.*` file.

## Run Metadata

- generated_at: `2026-04-16T17:37:50`
- watcher_exit_code: `0`
- codex_tokens_used: `91,644`

## Git Automation

- status: `main-promotion-skipped`
- branch: `develop`
- commit: `e72482dca8efd55213792a8a6e10159b62e9b891`
- note: origin/main is not an ancestor of the task commit, so watcher skipped automatic main promotion.
