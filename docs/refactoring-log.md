# 리팩토링 로그

## 2026-04-20 검증 체계 복구와 저위험 안정화

- 수정 파일:
  - `frontend/.eslintrc.json`
  - `frontend/tsconfig.codex-check.json`
  - `frontend/components/AdSlot.tsx`
  - `frontend/app/(onboarding)/onboarding/page.tsx`
  - `frontend/app/api/auth/signout/route.ts`
  - `frontend/app/api/dashboard/activities/[id]/route.ts`
  - `frontend/app/api/dashboard/activities/coach-session/route.ts`
  - `frontend/app/api/dashboard/activities/images/route.ts`
  - `frontend/app/api/dashboard/activities/route.ts`
  - `frontend/app/api/dashboard/documents/route.ts`
  - `frontend/app/api/dashboard/match/route.ts`
  - `frontend/app/api/dashboard/profile/route.ts`
  - `frontend/app/api/dashboard/resume-export/route.ts`
  - `frontend/app/api/dashboard/resume/route.ts`
  - `frontend/app/api/onboarding/route.ts`
  - `frontend/app/api/summary/route.ts`
  - `frontend/app/dashboard/activities/_components/activity-basic-tab.tsx`
  - `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
  - `frontend/app/dashboard/match/page.tsx`
  - `frontend/app/dashboard/profile/page.tsx`
  - `frontend/app/dashboard/resume/page.tsx`
  - `backend/tests/test_know_survey.py`
  - `backend/chains/job_posting_rewrite_chain.py`
  - `docs/current-state.md`
- 변경 내용:
  - 프론트에 실제 ESLint 설정을 추가해 `next lint`가 초기 설정 프롬프트에 빠지지 않고 CI/로컬 모두 비대화형 검증으로 실행되게 정리함
  - `tsconfig.codex-check.json`에서 `.next/types` 직접 의존을 끊어 stale 생성물 때문에 standalone 타입체크가 거짓 실패하던 문제를 정리함
  - KNOW 원본 자료가 저장소에 없는 환경에서도 `backend/tests/test_know_survey.py`가 import 시점 `StopIteration`으로 전체 pytest 수집을 중단하지 않게 수정함
  - `job_posting_rewrite_chain.py`의 Gemini rewrite 호출을 task cancel/cleanup 방식으로 감싸 fallback 테스트에서 `coroutine was never awaited` 경고가 다시 나오지 않게 정리함
  - 프론트 라우트/페이지에 남아 있던 unused import·unused state·문자열 lint 오류를 제거하고, `AdSlot`의 conditional Hook 호출을 동일 순서 호출로 바꿔 React Hook 규칙 위반을 해소함
- 유지된 동작:
  - 공개 랜딩, 대시보드, 활동/문서 API 계약, OAuth 흐름, 이력서/분석 기능의 입력·출력 의미는 바꾸지 않음
  - 프론트의 `<img>` 사용은 이번 작업에서 동작 변경 위험이 있어 유지했고, lint warning만 남김
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (경고만 남음)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과
  - 저장소 루트: `backend\venv\Scripts\python.exe -m pytest backend/tests tests -q` 통과 (`218 passed, 1 skipped, 6 warnings`)

## 2026-04-20 업로드 방어와 요약 API timeout 보강

- 수정 파일:
  - `frontend/lib/server/upload-validation.ts`
  - `frontend/app/api/dashboard/activities/images/route.ts`
  - `frontend/app/api/dashboard/profile/route.ts`
  - `frontend/app/api/summary/route.ts`
  - `docs/current-state.md`
- 변경 내용:
  - 활동 이미지/프로필 이미지 업로드 전에 허용 형식(JPG/PNG/WEBP/GIF)과 최대 크기를 공통 유틸로 검증하도록 정리함
  - 활동 이미지 업로드는 한 번에 최대 5개까지만 허용하고, storage path에 들어가는 `activityId`를 안전한 문자만 남기도록 정규화함
  - AI summary API는 Gemini 상류 호출이 장시간 응답하지 않을 때 무한 대기 대신 20초 timeout 후 upstream 오류로 빠르게 실패하도록 보강함
- 유지된 동작:
  - 정상 이미지 업로드 흐름, 업로드 후 public URL 반환 계약, 프로필 저장 흐름, summary API 응답 구조는 유지함
  - 기존 사용자가 올리던 일반적인 JPG/PNG/WEBP/GIF 이미지는 계속 허용됨
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (기존 `<img>` warning만 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 최소 rate limiting 적용

- 수정 파일:
  - `frontend/lib/server/rate-limit.ts`
  - `frontend/lib/api/route-response.ts`
  - `frontend/app/api/auth/google/route.ts`
  - `frontend/app/api/dashboard/activities/images/route.ts`
  - `frontend/app/api/dashboard/profile/route.ts`
  - `frontend/app/api/summary/route.ts`
  - `docs/current-state.md`
- 변경 내용:
  - 프론트 BFF route에서 재사용할 수 있는 메모리 기반 최소 요청 제한 유틸을 추가함
  - Google OAuth 시작, 활동 이미지 업로드, 프로필 수정, summary API에만 좁게 적용해 고비용/남용 가능 경로부터 1차 방어를 넣음
  - 제한 초과 시 공통 `RATE_LIMITED` 오류 코드와 `Retry-After` 헤더를 반환하도록 응답 헬퍼를 확장함
- 유지된 동작:
  - 정상 요청의 입력/출력 구조, OAuth redirect 경로, 업로드 결과 형식, summary API 응답 계약은 유지함
  - 분당 임계값 이내의 일반 사용자 흐름은 기존과 동일하게 동작함
- 한계와 리스크:
  - 현재 제한은 프로세스 로컬 메모리 기반이라 다중 인스턴스 환경에서 완전한 전역 제한은 아님
  - 운영 트래픽 특성에 따라 임계값은 추후 조정이 필요할 수 있음
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (기존 `<img>` warning만 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 업로드 파일 실체 검사와 토큰 출력 안전장치

- 수정 파일:
  - `frontend/lib/server/upload-validation.ts`
  - `frontend/app/api/dashboard/activities/images/route.ts`
  - `frontend/app/api/dashboard/profile/route.ts`
  - `frontend/get_token.mjs`
  - `docs/current-state.md`
- 변경 내용:
  - 업로드 이미지 검증이 확장자와 MIME만 보지 않고 파일 헤더(signature, magic number)까지 확인하도록 보강함
  - 활동 이미지/프로필 이미지 업로드 라우트가 새 비동기 검증 유틸을 사용하도록 조정함
  - 로컬 개발용 `get_token.mjs`는 기본 실행에서 access token을 출력하지 않고, `--print` 인자가 있을 때만 출력하도록 안전장치를 추가함
- 유지된 동작:
  - 정상적인 JPG/PNG/WEBP/GIF 업로드 흐름과 업로드 후 public URL 반환 구조는 유지함
  - 토큰이 정말 필요한 로컬 디버깅 상황에서는 기존처럼 명시적으로 출력 가능함
- 한계와 리스크:
  - 현재 업로드 검증은 파일 헤더 기반 1차 방어이며, 이미지 디코딩 자체의 악성 payload 검사는 아니다
  - `get_token.mjs`는 여전히 로컬 개발 보조 스크립트이므로 운영 환경 사용 금지 원칙은 유지해야 함
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (기존 `<img>` warning만 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 profile route 중복 로직 정리

- 수정 파일:
  - `frontend/app/api/dashboard/profile/route.ts`
  - `docs/refactoring-log.md`
- 변경 내용:
  - 프로필 저장용 요청 제한 설정을 `enforceProfileWriteRateLimit()` helper로 묶어 `PATCH`/`PUT`의 중복을 줄임
  - 레거시 `bio` 컬럼 누락 fallback 판별을 `isMissingBioColumnError()` helper로 묶어 같은 조건식을 한 곳에서 관리하도록 정리함
- 유지된 동작:
  - 프로필 조회/저장/업로드 동작, rate limit 임계값, `bio` fallback 동작은 그대로 유지함
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (기존 `<img>` warning만 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 match / coach API 요청 제한과 timeout 보강

- 수정 파일:
  - `frontend/app/api/dashboard/match/route.ts`
  - `frontend/app/api/dashboard/cover-letters/coach/route.ts`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - 합격률 분석 API에 인증 사용자 기준 분당 6회 요청 제한과 30초 timeout을 추가함
  - AI 코칭 API에 인증 사용자 기준 분당 8회 요청 제한과 30초 timeout을 추가함
  - timeout 발생 시 504 성격의 upstream 오류로 사용자에게 빠르게 실패를 알리도록 정리함
- 유지된 동작:
  - 정상 분석/코칭 요청의 입력·출력 계약과 저장 흐름은 유지함
  - 일반적인 사용량에서는 기존과 동일하게 동작함
- 한계와 리스크:
  - 현재 제한은 프로세스 메모리 기반이라 다중 인스턴스 환경의 완전한 전역 제한은 아니다
  - timeout 값은 운영 트래픽과 백엔드 평균 응답 시간을 보며 추후 조정이 필요할 수 있다
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (기존 `<img>` warning만 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 compare relevance API 보호막 추가

- 수정 파일:
  - `frontend/app/api/programs/compare-relevance/route.ts`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - 비교 관련도 계산 API에 로그인 세션 기준 분당 12회 제한을 추가함
  - 백엔드 compare relevance 호출에 20초 timeout을 추가해 장시간 대기 시 빠르게 실패하도록 정리함
- 유지된 동작:
  - 정상적인 비교 관련도 응답 구조와 로그인 요구 조건은 유지함
  - 프로그램이 없는 경우 빈 배열을 반환하는 기존 동작도 그대로 유지함
- 한계와 리스크:
  - 현재 요청 제한 key는 세션 access token 기준이라, 토큰 갱신 시 버킷이 바뀔 수 있다
  - 메모리 기반 제한이라 다중 인스턴스 전역 제한은 아니다
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (기존 `<img>` warning만 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 프론트 BFF 구조화 실패 로그 추가

- 수정 파일:
  - `frontend/lib/server/route-logging.ts`
  - `frontend/app/api/auth/google/route.ts`
  - `frontend/app/api/dashboard/activities/images/route.ts`
  - `frontend/app/api/dashboard/profile/route.ts`
  - `frontend/app/api/dashboard/match/route.ts`
  - `frontend/app/api/dashboard/cover-letters/coach/route.ts`
  - `frontend/app/api/summary/route.ts`
  - `frontend/app/api/programs/compare-relevance/route.ts`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - 주요 프론트 BFF 라우트 실패를 공통 JSON 로그로 남기는 `route-logging` 유틸을 추가함
  - route, method, category, status, code 중심으로 로그를 남기고, 민감정보가 될 수 있는 토큰/요청 본문 전문은 기록하지 않도록 제한함
  - timeout 계열 실패는 일반 실패와 구분되게 `note: timeout`을 남기도록 정리함
- 유지된 동작:
  - 사용자 응답 구조와 오류 메시지 계약은 유지함
  - 로그 추가 외에 인증/업로드/분석/요약 동작 자체는 바꾸지 않음
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (기존 `<img>` warning만 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 Upstash 전역 rate limiting fallback 추가

- 수정 파일:
  - `frontend/lib/server/rate-limit.ts`
  - `frontend/app/api/auth/google/route.ts`
  - `frontend/app/api/dashboard/activities/images/route.ts`
  - `frontend/app/api/dashboard/profile/route.ts`
  - `frontend/app/api/dashboard/match/route.ts`
  - `frontend/app/api/dashboard/cover-letters/coach/route.ts`
  - `frontend/app/api/summary/route.ts`
  - `frontend/app/api/programs/compare-relevance/route.ts`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`이 있으면 Upstash Redis REST 기반 fixed-window 요청 제한을 사용하도록 확장함
  - Upstash가 없거나 호출 실패 시 기존 메모리 기반 제한으로 자동 fallback 하도록 정리함
  - 저장 key는 SHA-256 해시 형태로 바꿔 access token이나 user id 원문이 내부 key로 직접 남지 않게 함
- 유지된 동작:
  - 기존 요청 제한 임계값과 사용자 응답 계약은 그대로 유지함
  - Upstash 환경변수가 없는 현재 환경에서도 기존 메모리 기반 제한이 그대로 동작함
- 한계와 리스크:
  - 현재 Upstash 구현은 간단한 fixed-window + `INCR`/`PEXPIRE` 조합이라, 더 정교한 sliding window 알고리즘은 아니다
  - Upstash 장애 시 메모리 fallback으로 내려가므로 완전한 전역 보장은 일시적으로 약해질 수 있다
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (기존 `<img>` warning만 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 next/image 점진 전환 1차

- 수정 파일:
  - `frontend/next.config.ts`
  - `frontend/app/(landing)/landing-a/_components.tsx`
  - `frontend/app/dashboard/layout.tsx`
  - `frontend/app/dashboard/profile/_components/profile-hero-section.tsx`
  - `frontend/app/dashboard/activities/_components/activity-basic-tab.tsx`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - Supabase storage public URL을 `next/image` remotePatterns로 허용함
  - 공개 랜딩 헤더 아바타, 대시보드 사이드바 아바타, 프로필 대표 이미지, 활동 이미지 썸네일을 `img`에서 `next/image`로 전환함
- 유지된 동작:
  - 기존 이미지 표시 위치와 크기는 유지함
  - blob preview를 사용하는 프로필 편집 모달 이미지는 안전성을 위해 이번 단계에서 그대로 둠
- 한계와 리스크:
  - 외부 blob/object URL을 쓰는 미리보기 이미지는 아직 `img`를 유지하므로 lint warning 1건은 남을 수 있다
  - remotePatterns는 현재 Supabase storage public URL 기준이며, 다른 외부 이미지 도메인을 추가로 쓰기 시작하면 설정 확장이 필요하다
- 검증 메모:
  - `frontend`: `npm run lint` 통과
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 업로드 이미지 크기 정보 검사 추가

- 수정 파일:
  - `frontend/lib/server/upload-validation.ts`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - PNG/GIF/WEBP/JPEG 파일의 width/height를 직접 읽어 정상 이미지 여부를 한 번 더 검증하도록 보강함
  - 8000px를 넘는 비정상 고해상도 이미지는 업로드를 거부하도록 제한을 추가함
- 유지된 동작:
  - 정상적인 일반 이미지 업로드 흐름과 반환 계약은 유지함
  - 기존 magic number 검사와 파일 크기 제한도 그대로 유지함
- 한계와 리스크:
  - 현재 검증은 파일 헤더와 이미지 메타데이터 기반이며, 외부 안티바이러스 엔진 연동은 아니다
- 검증 메모:
  - `frontend`: `npm run lint` 통과 (blob preview용 `<img>` warning 1건 유지)
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

## 2026-04-20 profile edit modal 이미지 경고 정리

- 수정 파일:
  - `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - 프로필 편집 모달의 avatar preview를 `img`에서 `next/image`로 전환함
  - blob URL과 storage URL 모두 안전하게 처리하기 위해 `unoptimized`를 사용함
- 유지된 동작:
  - 모달의 미리보기 이미지 표시 방식과 크기는 그대로 유지함
  - 업로드 전 로컬 미리보기와 기존 저장 이미지 모두 계속 표시 가능함

## 2026-04-20 런칭 smoke test 체크리스트 정리

- 수정 파일:
  - `docs/launch-smoke-test.md`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - 공개 진입, 로그인, 대시보드, 활동 저장소, AI 기능, 추천/비교, 운영 로그까지 한 번에 확인할 수 있는 런칭용 smoke test 체크리스트를 문서화함
  - 현재 의도적 보류 항목(blob preview용 `<img>`, 외부 안티바이러스 미연동)도 같이 적어 운영자가 남은 리스크를 구분할 수 있게 정리함
- 유지된 동작:
  - 코드 동작 변경 없음

## 2026-04-20 비개발자용 런칭 체크리스트 추가

- 수정 파일:
  - `docs/launch-checklist-nontechnical.md`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - 비개발자도 바로 따라 할 수 있는 10분짜리 배포 직전 체크리스트 문서를 추가함
  - 로그인, 프로그램 탐색, 저장, AI 기능, PDF export를 중심으로 배포 가능/보류 판단 기준을 쉽게 정리함
- 유지된 동작:
  - 코드 동작 변경 없음

## 2026-04-20 public flow 후속 정리

- 수정 파일:
  - `frontend/app/(landing)/landing-b/page.tsx`
  - `frontend/app/(landing)/landing-b/_components.tsx`
  - `frontend/app/(landing)/landing-b/_content.ts`
  - `frontend/app/(landing)/landing-b/_styles.ts`
  - `README.md`
  - `docs/current-state.md`
  - `docs/specs/api-contract.md`
  - `docs/auth/supabase-auth-local.md`
  - `docs/auth/supabase-auth-production.md`
- 변경 내용:
  - `rg` 기준으로 `landing-b` 라우트가 자기 파일군 외부에서 참조되지 않고, 루트/로그인/OAuth/공개 네비게이션 어디에서도 연결되지 않아 실사용 경로가 아니라고 판단해 제거함
  - 공개 메인 흐름 문서를 현재 코드 기준으로 다시 맞춰 `/landing-a`를 기본 진입점으로 유지하는 로그인/OAuth 동작과 `/onboarding` 신규 사용자 분기를 함수명 기준으로 정리함
  - Supabase Auth 설정 문서를 로컬/운영으로 분리해 `frontend/app/api/auth/google/route.ts`, `frontend/app/auth/callback/route.ts`, `frontend/middleware.ts`가 요구하는 Redirect URL과 env를 따로 적음
  - `README.md`와 `docs/specs/api-contract.md`의 오래된 `/dashboard/onboarding`, `/dashboard` 기본 callback 설명을 현재 라우트 기준으로 정정함
- 유지된 동작:
  - 루트 `/`는 계속 `/landing-a`로 리다이렉트됨
  - Google OAuth 시작/콜백 처리 함수와 `/dashboard*`, `/onboarding` 인증 보호 정책은 그대로 유지함
- 검증 메모:
  - 로컬 코드 검증은 `frontend`에서 `npm run build`로 수행
  - 운영 `https://isoser.vercel.app/login`은 200 응답을 확인했지만, `https://isoser.vercel.app/landing-a`와 `/compare`는 이 작업 시점에 60초 timeout이 발생해 헤더 클릭 동작을 배포 환경에서 끝까지 재현하지는 못함

## 2026-04-20 landing-b A/B 테스트 보존 복원

- 수정 파일:
  - `frontend/app/(landing)/landing-b/page.tsx`
  - `frontend/app/(landing)/landing-b/_components.tsx`
  - `frontend/app/(landing)/landing-b/_content.ts`
  - `frontend/app/(landing)/landing-b/_styles.ts`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - `landing-b`를 완전 제거하지 않고, A/B 테스트용 실험 랜딩으로 다시 복원함
  - 현재 공개 기본 진입, 로그인 기본 복귀, 공통 헤더 링크에서는 계속 `landing-a`를 메인으로 유지하고 `landing-b`는 직접 실험 링크/광고/분석 유입용 별도 경로로만 남기도록 정리함
  - 문서에도 `landing-b`가 현재 운영 메인 라우트가 아니라 보존된 실험 경로라는 점을 명시함
- 유지된 동작:
  - 루트 `/`와 로그인 기본 복귀는 계속 `/landing-a`
  - `landing-b`는 별도 OAuth 기본 진입점이나 공통 네비게이션 링크로 연결하지 않음

## 2026-04-20 공개 랜딩/프로그램/비교/로그인 흐름 정리와 OAuth 콜백 보정

### 작업 목적
- 로그인 전후 화면의 톤과 흐름을 맞추고, 공개 랜딩과 로그인 이후 진입 흐름의 단절을 줄인다.
- 프로그램/비교 화면을 로그인 전후 기준으로 일관되게 보이도록 정리한다.
- 프로그램 데이터 노출 기준을 `오늘 날짜 기준 마감순`으로 통일하고, 기본값은 `모집중 공고만` 보이게 수정한다.
- 로컬 개발 중 Supabase OAuth가 Vercel 도메인으로 튀는 문제를 확인하고, 로컬 테스트 기준 설정을 정리한다.

### 리팩토링 전 문제점
- 로그인 전 랜딩과 로그인 후 화면의 시각 언어가 달랐고, 일부 구간은 검은 배경/검은 글씨 조합으로 가독성이 떨어졌다.
- 로그인 후 사용자가 예전에 만든 랜딩 또는 기대와 다른 화면으로 이동하는 흐름이 있었다.
- 공개 프로그램/비교 화면과 로그인 이후 화면 간 제품 인상이 일치하지 않았다.
- 메인 랜딩과 프로그램 검색에서 이미 마감된 공고가 기본 노출되었다.
- 프로그램 목록의 `모집중만 보기` 필터가 의도대로 동작하지 않았고, 최근 마감 공고와 모집중 공고의 구분도 불명확했다.
- 공개 비교/프로그램 헤더의 `프로그램 탐색`, `비교` 버튼이 클릭되지 않는 증상이 있었다.
- 로컬 `localhost:3000/login`에서 Google 로그인 시작 후 Supabase가 `https://isoser.vercel.app/login?error=oauth_callback_failed`로 보내는 문제가 있었다.
- 백엔드 테스트는 저장소 문제라기보다 잘못된 Python 인터프리터 사용으로 실패했다.

### 실제 변경 사항

#### 1. 공개 랜딩/로그인/비교/프로그램 UI 정리
- 공개 랜딩을 라이트 톤 기준으로 정리하고, 로그인 화면과 로그인 이후 제품 톤을 더 가깝게 맞춤.
- 랜딩 메인 카피를 아래 문구로 교체:
  - `흩어진 국비 지원 정보,`
  - `내 상황에 맞는 것만 골라드립니다`
  - `각종 부트캠프, K-디지털, 서울시 일자리까지 한곳에 모았습니다.`
  - `3가지 조건만 알려주시면 마감 임박순으로 정렬해드립니다`
- 프로그램/비교 페이지는 새 공개 랜딩 헤더와 톤을 공유하도록 정리.
- 헤더 네비게이션에 stacking context와 z-index를 보강해 클릭 불가 가능성을 낮춤.

#### 2. 프로그램 데이터 정렬/필터 기준 수정
- backend 프로그램 목록과 count 계산 로직이 더 이상 Supabase의 `is_active`만 신뢰하지 않고, `deadline` 기준으로 `오늘 날짜`를 다시 계산하도록 수정.
- 기본값은 `모집중 공고만 + 마감 임박순(deadline asc)` 노출로 통일.
- `마감된 활동 보기` 체크 시에만 `최근 3개월 내 마감 공고`를 함께 보이도록 변경.
- compare 검색/선택 모달도 같은 기준으로 모집중 공고 위주 정렬을 따르도록 조정.

#### 3. 로그인/OAuth 복귀 흐름 수정
- `/api/auth/google`에서 `next` query를 받아 Google OAuth 시작 시 Supabase redirect URL에 포함하도록 수정.
- `/auth/callback`에서 `next`를 읽어 로그인 완료 후 원래 보던 화면으로 돌아갈 수 있게 수정.
- 기본 로그인 완료 진입점은 `/landing-a`로 유지.
- `/login` 페이지는 서버에서 세션을 먼저 확인해 이미 로그인된 사용자는 다시 로그인 화면을 보지 않고 원래 화면 또는 `/landing-a`로 리다이렉트되게 변경.
- 로그인 페이지에서 Google 로그인 버튼이 `window.location.href` 기반 클라이언트 처리 대신 복귀 경로를 포함한 링크 방식으로 동작하도록 정리.

#### 4. 로컬 개발 환경 확인
- backend용 Python은 `backend/venv/Scripts/python.exe`의 `Python 3.10.8`이 맞음을 확인.
- 해당 인터프리터로 `backend/tests/test_programs_router.py` 실행 시 `14 passed` 확인.
- 로컬 Supabase OAuth 문제는 코드보다 `Supabase URL Configuration` 설정 영향이 더 크다는 점을 확인.
- 로컬 테스트 기준으로 `Site URL`을 `http://localhost:3000`, Redirect URLs를 `/auth/callback` 기준으로 맞추면 정상 동작함을 확인.

### 파일별 / 컴포넌트별 변경 내용

#### `backend/routers/programs.py`
- 프로그램 목록과 count의 모집 상태 판단을 `deadline` 기준 현재 날짜 재계산으로 보정.
- `include_closed_recent=true`일 때 최근 90일 내 마감 공고만 추가 포함.
- `deadline` 정렬에서 모집중 공고를 우선, 최근 마감 공고는 그 뒤에 최근순으로 재정렬하도록 보강.

#### `backend/tests/test_programs_router.py`
- 모집중 기본 노출, 최근 마감 포함, deadline 정렬 기준을 회귀 테스트로 고정.
- Python 3.10 venv 기준 실행 확인.

#### `frontend/app/(landing)/landing-a/_components.tsx`
- `LandingANavBar`의 라이트 톤/공통 제품 헤더 유지.
- 메인 랜딩 카피 교체.
- 헤더 링크 `프로그램 탐색`, `비교`, `워크스페이스`에 `relative z-[1]` 부여.
- nav에 `z-[230] isolate` 추가해 클릭 불가 가능성 완화.
- 로그인 CTA, 워크스페이스 링크 스타일 정리.

#### `frontend/app/(landing)/landing-a/page.tsx`
- 공개 랜딩 허브로 유지.
- 프로그램 데이터를 불러와 히어로/필터/프로그램 섹션과 연결.
- 메인 랜딩이 `/landing-a` 기준으로 계속 동작하도록 유지.

#### `frontend/app/(auth)/login/page.tsx`
- 삭제/불안정 상태였던 로그인 페이지를 복구.
- 서버 컴포넌트 형태로 세션 확인 후 이미 로그인된 경우 `redirect()`.
- `searchParams.error`, `searchParams.redirectedFrom` 처리 추가.
- `Google로 계속하기` 링크가 `/api/auth/google?next=...`를 사용하도록 변경.

#### `frontend/app/api/auth/google/route.ts`
- `requestedNext`를 읽고 기본값을 `/landing-a`로 설정.
- `supabase.auth.signInWithOAuth()`의 `options.redirectTo`를 `${origin}/auth/callback?next=...` 형식으로 구성.

#### `frontend/app/auth/callback/route.ts`
- `code`, `next`를 읽음.
- `redirectTarget` 기본값을 `/landing-a`로 유지.
- 기존 사용자(`profiles` row 존재)는 `redirectTarget`으로 보냄.
- 신규 사용자는 `/onboarding` 유지.

#### `frontend/middleware.ts`
- 루트 `/?code=...` 유입을 `/auth/callback?next=/landing-a`로 정규화.
- `/programs/compare` -> `/compare` 리다이렉트 유지.
- `pathname === "/login"`인데 이미 세션이 있으면 `redirectedFrom` 또는 `/landing-a`로 돌려보내도록 추가.
- 보호 경로(`/onboarding`, `/dashboard...`) 비로그인 접근 시 `/login?redirectedFrom=...` 유지.

#### `frontend/app/(landing)/programs/page.tsx`
- 기본값은 모집중만, 정렬은 오늘 기준 마감 임박순.
- `마감된 활동 보기` 체크 시에만 최근 3개월 마감 공고 포함.
- 설명 문구와 필터 레이블을 새 정책에 맞게 갱신.

#### `frontend/app/(landing)/compare/programs-compare-client.tsx`
- compare 페이지가 공개 랜딩 헤더/톤을 공유하도록 유지.
- 추천/검색 시 모집중 공고 위주 정렬 정책과 맞물리도록 사용.

#### `frontend/app/(landing)/compare/program-select-modal.tsx`
- compare 선택 모달 검색 결과가 모집중/마감 기준 정책을 따르도록 연계.

#### `frontend/lib/api/backend.ts`
- 프로그램 목록/count에서 `recruiting_only`, `include_closed_recent`, `sort` 등 query 전달 유지 및 연계.

#### `docs/current-state.md`
- 현재 공개 랜딩/프로그램/비교/로그인/OAuth 동작 기준을 문서화.
- `frontend/middleware.ts`, `frontend/app/auth/callback/route.ts`, `frontend/app/api/auth/google/route.ts`, `frontend/app/(auth)/login/page.tsx` 기준 현재 동작을 반영.

#### `docs/refactoring-log.md`
- 공개 랜딩/프로그램/비교 정리, 로그인 복귀 흐름 보정 내용을 기록.

#### `reports/TASK-2026-04-20-1705-public-ui-deadline-alignment-result.md`
- 이번 공개 UI/마감 기준 정리 작업 결과를 기록.
- backend pytest 재검증 결과까지 업데이트.

### 변경 이유
- 제품 첫 진입과 로그인 이후 경험이 지나치게 달라 사용자가 같은 서비스 안에 있다는 인상을 받기 어려웠다.
- 마감 공고 기본 노출은 프로그램 탐색의 신뢰도를 떨어뜨렸다.
- 로컬 개발 중 OAuth가 배포 도메인으로 튀면 빠른 테스트와 문제 재현이 어려워진다.
- `/auth/callback`을 실제 코드 경로로 쓰면서 Supabase Redirect URL에 `/callback`이 남아 있으면 실패가 반복된다.
- 로그인 완료 후 복귀 경로(`next`)가 없으면 화면 전환이 사용자가 기대한 흐름과 어긋난다.

### 유지된 기존 동작
- 신규 사용자는 계속 `/onboarding`으로 진입한다.
- 공개 라우트 구조 `/landing-a`, `/programs`, `/compare`, `/login`은 유지했다.
- 보호 라우트 `/dashboard` 계열 구조는 유지했다.
- compare의 3슬롯 URL state와 로그인 사용자 관련도 계산 구조는 유지했다.
- 프로그램 검색의 카테고리/지역/페이지네이션 구조는 유지했다.
- Render 백엔드 자체는 유지하고, 로컬 개발 시에는 프론트가 로컬 백엔드를 보도록 설정만 바꾸는 운영 방식은 유지 가능하다.

### 영향 범위
- 공개 랜딩 첫 인상
- 로그인 페이지 UX
- Google OAuth 시작/콜백 흐름
- 로그인 후 복귀 경로
- 프로그램 목록 기본 노출 정책
- 최근 마감 공고 표시 정책
- compare 선택/추천 흐름
- 로컬 개발 환경의 인증 테스트 절차

### 테스트 체크리스트

#### UI / 라우팅
- [x] `/landing-a` 접속 시 라이트 톤 랜딩 정상 표시
- [x] 메인 카피가 요청 문구로 반영되었는지 확인
- [ ] 헤더 `프로그램 탐색`, `비교`, `워크스페이스` 클릭 동작 수동 재확인
- [ ] 로그인 후 사용자가 기대하는 진입 화면이 `/landing-a` 기준으로 맞는지 재확인
- [ ] 로그인 전후 화면 톤 일치 여부 수동 점검

#### 프로그램 정책
- [x] 기본 목록이 모집중 공고만 노출되는 로직 반영
- [x] `마감된 활동 보기` 체크 시 최근 3개월 마감 공고만 포함되는 로직 반영
- [x] deadline 정렬이 오늘 기준으로 재계산되는 backend 테스트 통과
- [ ] 실제 운영 데이터에서 마감 공고가 랜딩/프로그램에 다시 섞이지 않는지 수동 확인

#### OAuth / 인증
- [x] `/api/auth/google`가 `next`를 붙여 `/auth/callback`으로 보냄
- [x] `/auth/callback`가 `next`를 받아 복귀 처리
- [x] 이미 로그인된 사용자가 `/login`에 가면 다시 로그인 화면을 밟지 않음
- [x] 로컬 Supabase 설정에서 `Site URL=http://localhost:3000` 기준 정상 동작 확인
- [ ] 운영 Supabase 설정에서 `https://isoser.vercel.app/auth/callback` 기준 재확인

#### 빌드 / 테스트
- [x] `frontend`: `npm run build` 통과
- [x] `backend`: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py` 통과 (`14 passed`)
- [x] backend Python 인터프리터가 `3.10.8`인 것 확인

### 남은 과제
- `landing-b` 실험 경로는 아직 남아 있음. 실제 운영에서 더 이상 사용하지 않으면 정리 필요.
- 로그인 후 “정확히 어떤 화면이 기본 진입점이어야 하는지”는 `/landing-a`와 `/dashboard` 사이에서 제품 정책을 최종 확정할 필요가 있음.
- 헤더 클릭 불가 증상은 z-index 보정으로 완화했지만, 실제 브라우저/배포 환경에서 재현이 완전히 사라졌는지 재확인 필요.
- Supabase 운영용/로컬용 auth 설정을 수동으로 번갈아 바꾸는 대신, 개발용 Supabase 프로젝트 분리 여부를 검토할 필요가 있음.
- `NEXT_PUBLIC_BACKEND_URL`의 로컬/배포 환경값을 더 명확히 문서화하거나 실행 스크립트로 보조할 여지가 있음.
- 공개 랜딩과 대시보드의 정보 구조를 더 일관되게 맞출지 추가 UX 검토가 필요함.

### 불확실한 내용
- “로그인 후 원래 랜딩이 보인다”는 사용자 보고와 실제 코드 경로 사이에는 시점별 차이가 있었음.
  - 확인된 최종 코드 기준 기본 복귀는 `/landing-a`
  - 다만 사용자가 본 실제 배포 동작은 Supabase 설정과 배포 버전 차이의 영향을 받았을 가능성이 큼
- 헤더 버튼 클릭 불가의 정확한 1차 원인은 레이어 충돌로 추정했으나, 브라우저 DevTools로 완전한 원인 고정까지는 하지 않았음.
- Vercel/Render/Supabase의 실제 콘솔 값은 이 대화에서 일부는 사용자가 직접 확인했고, 일부는 코드/환경파일 기준으로 추정함.

### 다음 대화에서 바로 이어갈 수 있는 후속 작업 프롬프트

```md
현재 공개 랜딩/프로그램/비교/로그인 흐름 리팩토링은 반영된 상태다.
다음 작업을 이어서 진행해줘.

우선순위:
1. landing-b가 실제로 더 이상 필요 없는지 코드 기준으로 확인
2. 필요 없으면 관련 라우트/링크/문서 정리
3. 로그인 후 기본 진입점을 landing-a로 유지할지 dashboard로 바꿀지 비교 정리
4. 헤더 클릭 불가 이슈가 배포 환경에서도 완전히 해결됐는지 검증
5. 로컬/운영 Supabase auth 설정을 문서로 분리 정리

반드시 해줄 것:
- 현재 코드 기준으로만 판단
- 실제 참조 파일명과 함수명 명시
- 변경 시 docs/current-state.md와 docs/refactoring-log.md까지 같이 반영
- 테스트 결과를 함께 정리
```

## 2026-04-20 백업 브랜치 기준 agent 규칙/참조 복원

- 수정 파일:
  - `AGENTS.md`
  - `docs/current-state.md`
- 변경 내용:
  - 백업 브랜치 `backup_pre_reset_17af772`에만 남아 있던 중복 task 탐지, 부분 구현 재사용, review 시 `fix/update` 판정 규칙을 현재 `AGENTS.md`에 병합함
  - 현재 저장소에 이미 존재하는 `main.py` ASGI shim과 agentic architecture/presentation 문서 참조가 `docs/current-state.md`에서 누락돼 있어 다시 연결함
- 유지된 동작:
  - 현재 watcher / cowork watcher 런타임 구현은 변경하지 않음
  - `docs/agent-playbook.md` 기반 read order, rule precedence, git completion workflow 같은 최신 규칙은 그대로 유지함

## 2026-04-20 review-required 종료 처리 규칙 명시

- 수정 파일:
  - `docs/current-state.md`
  - `docs/automation/local-flow.md`
  - `docs/automation/overview.md`
  - `docs/automation/operations.md`
- 변경 내용:
  - `tasks/review-required/`를 살아 있는 수동 검토 대기열로만 사용하고, 검토가 끝난 packet은 `tasks/archive/`로 이동하는 운영 규칙을 문서화함
  - 구현이 이미 반영돼 stale로 닫는 packet도 `review-required/`에 남기지 않고 archive로 정리하며, `reports/*` verification/result/needs-review 문서는 audit trail로 유지한다고 명시함
- 유지된 동작:
  - verifier가 `review-required` verdict를 내리면 watcher가 전용 큐와 `needs-review` alert로 분기하는 기존 흐름은 유지함
  - `reports/*`와 dispatch alert는 계속 판단 근거 저장소로 남음

## 2026-04-20 Agent 규칙 문서 진입점 정리

- 수정 파일:
  - `AGENTS.md`
  - `docs/agent-playbook.md`
  - `docs/automation/task-packets.md`
  - `docs/current-state.md`
- 변경 내용:
  - 새 에이전트가 어디를 먼저 읽고 어떤 문서를 기준으로 판단해야 하는지 명확히 하기 위해 `docs/agent-playbook.md`를 단일 진입 문서로 추가함
  - `AGENTS.md`에 read order와 rule precedence를 명시해 packet, folder instructions, current-state 사이의 우선순위를 고정함
  - task packet contract와 current-state 문서에도 새 진입 문서를 링크해, planner / reviewer / implementer가 같은 읽기 순서를 따르도록 정리함
- 유지된 동작:
  - 기존 watcher / cowork watcher 흐름과 packet contract 자체는 변경하지 않음
  - 기존 세부 운영 문서들은 계속 세부 참조 문서로 유지함

## 2026-04-20 Compare 현재 적재 컬럼 기준 재정의

- 수정 파일:
  - `frontend/app/(landing)/compare/programs-compare-client.tsx`
  - `docs/current-state.md`
- 변경 내용:
  - compare 표 본문이 `compare_meta` 부재 때문에 대량 `"정보 없음"`을 노출하던 구조를 정리하고, 현재 운영 적재 컬럼 기준의 기본 정보, 운영 정보, 프로그램 개요 비교로 재구성함
  - source별 운영 메타처럼 수집 편차가 큰 값은 `"데이터 미수집"`, 실사용 컬럼의 단순 빈 값은 `"정보 없음"`으로 구분해 문구 정책을 분리함
  - 상단 slot chip과 지원 링크 fallback도 현재 컬럼 기준(`application_url -> source_url -> link`)으로 단순화해 compare_meta 의존을 제거함
- 유지된 동작:
  - `/compare` 라우트, 최대 3슬롯, URL `ids` 상태 관리, 추천 프로그램 영역, compare relevance API 흐름은 유지함
  - `compare_meta` 컬럼과 타입 자체는 삭제하지 않고, UI의 기본 표시 의존성에서만 제외함
- 후속 메모:
  - `programs-compare-client.tsx` 한 파일 안에 current-columns와 AI fit v2가 함께 들어 있으므로, 이후 compare row 정의와 relevance section을 분리 컴포넌트/상수로 나누면 scope 경계가 더 선명해질 수 있음

## 2026-04-20 Compare AI 적합도 v2 해석 레이어 추가

- 수정 파일:
  - `backend/routers/programs.py`
  - `backend/tests/test_programs_router.py`
  - `frontend/app/(landing)/compare/programs-compare-client.tsx`
  - `frontend/lib/types/index.ts`
- 변경 내용:
  - 기존 `POST /programs/compare-relevance` 계산 흐름은 유지한 채, compare relevance 응답에 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`를 추가하는 deterministic 해석 레이어를 얹음
  - compare UI의 `★ 나와의 관련도` 섹션을 `★ AI 적합도`로 재구성하고, 기존 점수/매칭 스킬 행을 유지하면서 적합도 판단, 지원 준비도, AI 한줄 요약, 보완 포인트를 추가함
  - profile/activity 정보가 약한 경우에도 endpoint가 실패하지 않고 낮은 적합도와 보완 태그를 안정적으로 반환하도록 테스트를 보강함
- 유지된 동작:
  - compare relevance endpoint 경로와 기존 점수 필드 계약은 그대로 유지함
  - 로그인 401 기반 흐름과 compare 페이지의 기존 슬롯/URL state/CTA 구조는 변경하지 않음
- 후속 메모:
  - 현재 readiness 문구는 준비도 힌트 수준에 머물러 있으므로, 실제 지원 자격 판단과 혼동되지 않게 copy audit을 별도 진행할 여지가 있음

## 2026-04-20 공개 랜딩/프로그램/비교 화면 정리와 마감 기준 재정렬

- 수정 파일:
  - `backend/routers/programs.py`
  - `backend/tests/test_programs_router.py`
  - `frontend/app/(auth)/login/page.tsx`
  - `frontend/app/(landing)/landing-a/_components.tsx`
  - `frontend/app/(landing)/landing-a/_styles.ts`
  - `frontend/app/(landing)/programs/page.tsx`
  - `frontend/app/(landing)/compare/programs-compare-client.tsx`
  - `frontend/app/(landing)/compare/program-select-modal.tsx`
  - `frontend/lib/api/backend.ts`
  - `frontend/lib/types/index.ts`
  - `docs/current-state.md`
- 변경 내용:
  - 로그인 페이지와 공개 랜딩/비교 화면을 대시보드와 더 가까운 라이트 톤으로 정리해 대비 문제를 줄이고 공통 제품 인상을 맞춤
  - 랜딩 메인 카피를 `흩어진 국비 지원 정보, 내 상황에 맞는 것만 골라드립니다` 흐름으로 교체하고, 공개 CTA와 보조 설명을 현재 프로그램 탐색/워크스페이스 구조에 맞게 다듬음
  - 프로그램 목록은 기본값으로 모집중 공고만 오늘 기준 마감순으로 노출하고, `마감된 활동 보기`를 켰을 때만 최근 3개월 내 마감 공고를 함께 표시하도록 UI와 backend query contract를 같이 변경함
  - programs router가 더 이상 Supabase `is_active` 값만 신뢰하지 않고 실제 `deadline`을 기준으로 목록/카운트를 재계산해, 메인 랜딩과 프로그램 검색에 마감 공고가 섞이는 문제를 줄임
  - compare 선택 모달 검색도 기본적으로 모집중 공고와 deadline 정렬을 따르도록 맞춤
- 유지된 동작:
  - `/landing-a`, `/programs`, `/compare`, `/login`의 기존 공개 라우트 구조는 유지함
  - compare 페이지의 3슬롯 URL state, 로그인 사용자 관련도 계산, 추천 프로그램 추가 흐름은 유지함
  - 프로그램 검색의 카테고리/지역/페이지네이션 구조는 유지함
- 후속 메모:
  - `landing-b`가 계속 실험용 경로로 남아 있으므로, 실제 운영에서 더 이상 쓰지 않으면 `/landing-a`로 정리할지 검토할 수 있음
  - `deadline`이 비어 있는 source에 대해서는 수집기 정규화 품질을 추가로 높이지 않으면 목록 후순위 처리나 제외가 늘어날 수 있음

## 2026-04-20 Tier 4 collector 회귀 테스트 보강

- 수정 파일:
  - `backend/rag/collector/tier4_collectors.py`
  - `backend/tests/test_tier4_collectors.py`
  - `backend/tests/test_scheduler_collectors.py`
  - `docs/current-state.md`
- 변경 내용:
  - Tier 4 collector 6종 각각에 대해 HTML fixture 기반 parser 회귀 테스트를 추가해 링크 조합, raw 보존 필드, 키워드 필터, district 메타데이터를 고정함
  - scheduler dry-run 테스트를 Tier 4까지 확장해 Tier 1 이후 6개 district source가 모두 `tier=4`, `status=dry_run`으로 포함되는 계약을 고정함
  - `NowonCollector`의 분류 기본값을 `취업`에서 `기타`로 낮춰, 키워드가 불명확한 공지를 과도하게 취업 카테고리로 몰아넣는 오분류를 줄임
- 유지된 동작:
  - 기존 Tier 4 collector 등록 순서와 scheduler tier 정렬 방식은 그대로 유지함
  - district collector의 수집 대상, source 메타데이터, raw payload 구조는 바꾸지 않음
- 검증 메모:
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_tier4_collectors.py backend/tests/test_scheduler_collectors.py -q`
  - 결과: `11 passed`
- 후속 메모:
  - 실서비스 HTML 변경 감지는 여전히 live smoke나 운영 수집 로그를 함께 봐야 하므로, 필요하면 이후에 source별 saved HTML fixture를 더 현실적으로 보강할 수 있음

## 2026-04-20 watcher 경로 고정값 및 승격 stamp/supervisor 루프 보정

- 수정 파일:
  - `watcher.py`
  - `cowork_watcher.py`
  - `scripts/supervise_watcher.ps1`
  - `tests/test_cowork_watcher.py`
  - `docs/current-state.md`
- 변경 내용:
  - `watcher.py`, `cowork_watcher.py`의 `PROJECT_PATH`를 예전 Windows 절대경로 하드코딩에서 스크립트 파일 위치 기준 동적 계산으로 바꾸고, 필요 시 `ISOSER_PROJECT_PATH` override를 허용함
  - `cowork_watcher.py`의 승격 stamp가 packet 전체의 `TODO_CURRENT_HEAD`를 일괄 치환하지 않고 frontmatter의 `planned_against_commit` 줄만 현재 `HEAD`로 교체하도록 좁힘
  - `scripts/supervise_watcher.ps1`가 live lock PID가 남아 있는 동안 run script를 다시 launch하지 않고 재확인만 하도록 조정해 중복 재시도 로그 루프를 줄임
  - body 안의 `TODO_CURRENT_HEAD` 텍스트가 보존되는 회귀 테스트를 추가함
- 유지된 동작:
  - 테스트와 운영 코드에서 `PROJECT_PATH` monkeypatch/override 방식은 그대로 사용 가능함
  - 승격 시 `planned_against_commit`이 placeholder일 때 현재 `HEAD`로 stamp하는 기존 기능 자체는 유지됨
- 후속 메모:
  - dated audit/report 문서의 절대경로 표기는 계속 오해를 만들 수 있으므로, 운영 문서 전반은 상대경로 또는 workspace-root 기준 표현으로 더 정리할 여지가 있음

## 2026-04-17 반복 watcher 알림 자동 remediation 큐 추가

- 수정 파일:
  - `watcher.py`
  - `tests/test_watcher.py`
  - `docs/current-state.md`
- 변경 내용:
  - watcher alert에 `alert_fingerprint`와 `repeat_count`를 함께 기록해 task id, commit hash 같은 가변값이 달라도 같은 root cause를 같은 이슈로 묶을 수 있게 함
  - `blocked`, `runtime-error`, `push-failed`가 동일 fingerprint로 3회 이상 반복되면 `tasks/inbox/`에 자동 remediation packet을 생성해 supervisor 플로우가 루트 원인 수정 작업을 직접 다시 집도록 확장함
  - 같은 fingerprint에 대해 remediation packet은 한 번만 열리도록 중복 방지 검사를 추가하고, 생성 사실은 local run ledger의 `auto-remediation-queued` 이벤트로 남기도록 함
  - 알려진 fingerprint에는 즉시 실행 runbook을 추가해 `origin/main` 자동 반영 스킵은 `self-healed` 정보 알림으로 다운그레이드하고, `tasks/done/` 중복으로 생기는 runtime-error는 duplicate packet archive로 즉시 정리하도록 확장함
- 유지된 동작:
  - 기존 Slack alert 파일과 watcher ledger 기록은 계속 남고, 알림 자체가 사라지지는 않음
  - `completed` / `recovered` 같은 정상 흐름은 자동 remediation 대상에서 제외함
- 검증 메모:
  - Python 실행은 시스템 Python이 아니라 `backend\venv\Scripts\python.exe` 기준으로 맞춘다. 이 저장소 watcher 테스트 기준 Python은 3.10.8이다.
  - watcher/self-healing 회귀 확인 명령:
    - `backend\venv\Scripts\python.exe -m pytest tests\test_watcher.py tests\test_watcher_shared.py -q`
    - `backend\venv\Scripts\python.exe -m pytest tests\test_summarize_actionable_ledgers.py tests\test_summarize_run_ledgers.py -q`
  - 확인 결과:
    - `tests\test_watcher.py`, `tests\test_watcher_shared.py`: `46 passed in 2.68s`
    - `tests\test_summarize_actionable_ledgers.py`, `tests\test_summarize_run_ledgers.py`: `4 passed`
  - Windows에서는 `.pytest_tmp` 정리 단계에서 파일 핸들 때문에 일시적으로 실패할 수 있다. 이 경우 `.pytest_tmp`를 비우고 같은 명령을 다시 실행하면 watcher 변경 자체와 무관한 정리 문제를 분리할 수 있다.
- 후속 메모:
  - 향후 반복 fingerprint별로 즉시 실행 가능한 runbook을 붙이면 packet 생성 대신 watcher 자체에서 더 직접적인 self-healing을 수행할 수 있음

## 2026-04-16 프로그램 페이지 마감 임박 정렬 보정

- 수정 파일:
  - `backend/routers/programs.py`
  - `backend/tests/test_programs_router.py`
  - `docs/current-state.md`
- 변경 내용:
  - 프로그램 목록 query helper가 `sort=deadline`일 때 `is_active=true`를 함께 적용하도록 조정함
  - `마감 임박순` 정렬에서 이미 모집완료된 프로그램이 과거 마감일 기준으로 상단에 노출되던 문제를 제거함
  - backend test에 deadline 정렬 시 active 프로그램만 조회하는 규칙을 추가해 회귀를 고정함
- 유지된 동작:
  - `최신순(latest)` 정렬과 명시적 `모집중만` 필터 동작은 그대로 유지
  - 카테고리, 검색어, 지역 필터 조합 방식은 변경하지 않음
- 후속 메모:
  - 모집완료 아카이브를 별도로 보여줄 필요가 있으면 정렬 옵션과 별개로 상태 필터를 분리하는 것이 더 명확함

## 2026-04-16 Compare 프로그램 선택 모달 추가

- 수정 파일:
  - `frontend/app/(landing)/compare/page.tsx`
  - `frontend/app/(landing)/compare/programs-compare-client.tsx`
  - `frontend/app/(landing)/compare/program-select-modal.tsx`
  - `frontend/app/api/dashboard/bookmarks/route.ts`
  - `frontend/lib/api/app.ts`
- 변경 내용:
  - compare 페이지에 슬롯별 프로그램 선택 모달을 추가하고, 찜 목록과 전체 검색에서 프로그램을 고를 수 있도록 확장함
  - compare URL `ids` 파라미터가 내부 빈 슬롯을 보존할 수 있게 정규화 규칙을 조정해 선택한 슬롯 인덱스를 그대로 반영하도록 맞춤
  - 로그인 사용자의 찜 목록은 Next API route가 backend `/bookmarks`를 프록시하는 경로로 불러오도록 정리함
- 유지된 동작:
  - 하단 추천 카드의 직접 추가 흐름과 compare 관련도 계산 흐름은 유지
  - 비교 데이터의 단일 소스는 계속 URL `ids` 파라미터로 유지
- 후속 메모:
  - compare 슬롯 순서를 drag-and-drop 또는 명시적 swap으로 재배치할 필요가 생기면 현재의 positional URL 규칙을 재사용할 수 있음

## 2026-04-16 watcher stale lock Windows 복구

- 수정 파일:
  - `scripts/watcher_shared.py`
  - `cowork_watcher.py`
  - `watcher.py`
  - `scripts/supervise_watcher.ps1`
  - `tests/test_cowork_watcher.py`
  - `tests/test_watcher.py`
  - `tests/test_watcher_shared.py`
  - `docs/current-state.md`
- 변경 내용:
  - Windows에서 stale watcher lock PID 확인 시 `os.kill(pid, 0)` 대신 `tasklist` 조회를 사용하도록 바꿔 `.watcher.lock` / `.cowork_watcher.lock` 회수 경로를 안정화함
  - `SystemError: <built-in function kill> returned a result with an exception set` 때문에 cowork watcher가 시작 직후 죽고 Slack `review-ready` 알림이 누락되던 재시작 루프를 차단함
  - Windows PID probe와 no-match 케이스를 `tests/test_watcher_shared.py`에 추가해 회귀를 고정함
  - `cowork_watcher.py`는 Codex review subprocess가 예외로 끝나거나 review 파일을 만들지 못해도 전체 프로세스를 죽이지 않고 해당 packet만 `review-failed` dispatch로 격리하도록 보강함
  - `tests/test_cowork_watcher.py`에 review subprocess 예외와 missing review file 경로를 추가해 회귀를 고정함
  - `scripts/supervise_watcher.ps1`는 UTF-8 콘솔/파일 출력을 강제하고 child script 출력을 `Out-File -Encoding utf8` 경로로 합쳐 supervisor combined log의 한글 깨짐을 줄이도록 조정함
  - `watcher.py`, `cowork_watcher.py`는 Slack alert/dispatch에 남아 있던 영어 `summary`/`next_action`/`note` 문구를 한국어 중심으로 정규화해 보고 가독성을 맞춤
- 유지된 동작:
  - POSIX 계열에서는 기존처럼 `os.kill(pid, 0)` probe를 유지
  - live lock이 잡힌 정상 watcher 중복 실행은 계속 차단
- 후속 메모:
  - supervisor combined log의 한글 인코딩 출력은 별도 정리 후보로 남음

## 2026-04-15 watcher done 후 main 자동 반영 추가

- 수정 파일:
  - `watcher.py`
  - `tests/test_watcher.py`
  - `docs/current-state.md`
- 변경 내용:
  - `tasks/done` 완료 후 watcher git automation이 현재 브랜치 push 뒤 `origin/main` fast-forward 가능 여부를 확인하고 자동 반영하도록 확장
  - `origin/main`이 현재 task commit의 조상일 때만 `git push origin <commit>:refs/heads/main`을 수행해 안전한 fast-forward만 허용
  - fetch/main push 실패 또는 main 조상 관계 불일치는 result report Git Automation 섹션과 watcher alert에 action-required로 남기도록 정리
- 유지된 동작:
  - task-scoped staging/commit 원칙은 그대로 유지
  - 현재 브랜치가 이미 `main`인 경우 기존 push 동작만 수행
  - main 자동 반영 성공 시 completed Slack 알림 요약에 `origin/main` 반영 결과가 함께 노출됨
- 추가 조정:
  - watcher가 inbox / blocked / drifted 큐를 파일명 문자열 정렬이 아니라 `TASK-YYYY-MM-DD-####` 번호 기준으로 처리하도록 명시적 정렬 키를 추가
  - drift/blocked 복구가 반복 중단된 task는 `replan-required` 경고로 승격하고, cowork packet에 재설계 체크리스트를 붙여 Slack에 더 강한 기획 보강 신호를 보내도록 확장

## 2026-04-15 watcher pipeline hardening

- 기록 버전: `60da25d7d70db974c3aca75cca3e48c76d86dc5e`
- 기록 시각: `2026-04-15T22:00:02.1780427+09:00`
- 변경 파일
  - `scripts/watcher_shared.py`
  - `scripts/compute_task_fingerprint.py`
  - `scripts/create_task_packet.py`
  - `scripts/summarize_run_ledgers.py`
  - `scripts/summarize_actionable_ledgers.py`
  - `scripts/prune_run_ledgers.py`
  - `watcher.py`
  - `cowork_watcher.py`
  - `backend/routers/slack.py`
  - `tests/test_compute_task_fingerprint.py`
  - `tests/test_create_task_packet.py`
  - `tests/test_prune_run_ledgers.py`
  - `tests/test_summarize_run_ledgers.py`
  - `tests/test_summarize_actionable_ledgers.py`
  - `tests/test_watcher_shared.py`
  - `tests/test_watcher.py`
  - `tests/test_cowork_watcher.py`
  - `docs/current-state.md`
  - `docs/automation/task-packets.md`
  - `docs/automation/README.md`
  - `docs/automation/operations.md`
  - `docs/rules/task-packet-template.md`
  - `docs/rules/task-packet-examples.md`
  - `docs/rules/claude-project-instructions.md`
  - `docs/rules/README.md`
  - `supabase/migrations/20260415213000_harden_cowork_approvals.sql`
- 핵심 변경
  - task packet이 optional `planned_files` / `planned_worktree_fingerprint`를 가지면 watcher와 cowork review가 현재 worktree와 직접 대조해 stale packet을 더 이르게 걸러내도록 보강함
  - planner가 optional fingerprint field를 실제로 채울 수 있게 `scripts/compute_task_fingerprint.py --frontmatter ...` helper와 관련 템플릿/규칙 문서를 추가함
  - `scripts/create_task_packet.py`를 추가해 current HEAD와 optional fingerprint field가 포함된 packet 초안을 기본값으로 생성할 수 있게 함
  - shared approval queue는 `task_id` 단위 갱신 대신 approval row `id`를 우선 claim/consume 하도록 바꿔 중복 poll 시 같은 요청을 다시 소비할 가능성을 줄임
  - Supabase migration으로 `cowork_approvals`에 `claimed_at` / `claimed_by` / unique `id` / 추가 index를 보강하고, backend approval request write도 claim 메타데이터를 명시적으로 초기화하도록 맞춤
  - local watcher와 cowork watcher 모두 JSONL run ledger를 남겨 alert/dispatch markdown 밖에서도 상태 전이를 추적할 수 있게 함
  - `scripts/summarize_run_ledgers.py`를 추가해 local/cowork watcher ledger의 stage 집계, task별 최신 상태, 최근 이벤트를 한 번에 확인할 수 있게 함
  - `scripts/summarize_actionable_ledgers.py`를 추가해 운영자가 실제 대응이 필요한 stage만 빠르게 triage 할 수 있게 함
  - `scripts/prune_run_ledgers.py`를 추가해 active ledger는 최근 N일만 유지하고 오래된 JSONL 이벤트는 월별 archive로 옮기도록 함
  - watcher와 cowork watcher loop에서 개별 packet 처리 예외를 격리해 `runtime-error` 기록만 남기고 프로세스는 계속 돌도록 보강함
- 후속 후보
  - packet 생성기/리뷰 프롬프트도 `planned_files`를 더 일관되게 채우도록 표준화 검토
  - run ledger를 읽는 간단한 운영 요약 스크립트나 대시보드 추가 검토

## 2026-04-15 cowork approval shared queue 전환

- 수정 파일:
  - `supabase/migrations/20260415183000_create_cowork_approvals.sql`
  - `backend/routers/slack.py`
  - `backend/tests/test_slack_router.py`
  - `cowork_watcher.py`
  - `tests/test_cowork_watcher.py`
  - `scripts/run_cowork_watcher.ps1`
  - `docs/current-state.md`
- 변경 내용:
  - Slack approval을 로컬 `cowork/approvals/*.ok` 파일 직접 생성 방식에서 Supabase `cowork_approvals` 공유 큐 기록 방식으로 전환
  - backend Slack route는 로컬 packet/review 파일 검증 대신 shared approval request를 upsert하고, 로컬 승격은 `cowork_watcher.py`가 poll해서 수행하도록 역할을 분리
  - 로컬 watcher는 requested approval row를 가져와 임시 local approval marker를 만들고 기존 승격 규칙을 적용한 뒤 `consumed`, `failed`, `ignored` 상태를 Supabase에 기록
  - cowork watcher 실행 스크립트가 `backend/.env`도 로드해서 Supabase service role 설정을 함께 읽도록 보강
- 유지된 동작:
  - 실제 packet review 생성과 stale review 차단, inbox/remote 승격 규칙은 기존 로컬 watcher 기준을 그대로 유지
  - Slack interactivity endpoint와 버튼 UI는 그대로 유지
- 후속 후보:
  - reject 흐름도 shared queue/event 저장소로 옮겨 로컬/원격 상태를 한 채널에서 추적할지 검토
  - shared approval queue에 대한 cleanup 정책과 운영 대시보드 조회 쿼리 추가 검토

## 2026-04-15 Slack interactivity Vercel 프록시 추가

- 수정 파일:
  - `frontend/app/slack/interactivity/cowork-review/route.ts`
  - `docs/current-state.md`
- 변경 내용:
  - Slack Interactivity Request URL을 `https://isoser.vercel.app/slack/interactivity/cowork-review`로 유지할 수 있도록 Next.js route handler를 추가
  - 프론트 route가 raw form body와 Slack signature/timestamp 헤더를 그대로 FastAPI backend의 `/slack/interactivity/cowork-review`로 전달하도록 구성
  - 프론트 도메인에 해당 경로가 없어 발생하던 Slack 설정 단계의 `404 Not Found`를 제거하는 배포 경로를 마련
- 유지된 동작:
  - 실제 approval/reject 처리 로직은 계속 FastAPI backend가 담당
  - Slack signature 검증과 allowlist 체크는 backend 쪽 규칙을 그대로 사용
- 후속 후보:
  - 필요하면 `/slack/commands/cowork-approve`도 동일한 프론트 프록시 route로 맞춰 slash command까지 같은 도메인으로 통일 검토
  - production 환경에서 `BACKEND_URL` 또는 `NEXT_PUBLIC_BACKEND_URL` 값이 실제 backend public URL을 가리키는지 점검

## 2026-04-15 cowork Slack review-ready 최신본/한국어 고정

- 수정 파일:
  - `cowork_watcher.py`
  - `tests/test_cowork_watcher.py`
  - `docs/current-state.md`
- 변경 내용:
  - 같은 `task_id`의 `review-ready`가 다시 발행될 때 Slack 메시지에 이전 검토 준비 알림을 대체한다는 `최신본 안내` 문구를 추가
  - review snapshot에 섞이던 영어 공통 표현을 한국어 위주로 정규화해 Slack에서 바로 읽기 쉽게 조정
  - review-ready 포맷 변경을 테스트로 고정
  - 추가 영어 표현 치환을 보강해 전체 판정과 핵심 확인사항에 영어/한국어가 섞이는 현상을 더 줄임
- 유지된 동작:
  - 실제 리뷰 원문 파일은 그대로 유지하고 Slack 표시 단계에서만 요약 문구를 정규화
  - approval/reject 버튼과 기존 review-ready dispatch 파일 경로는 그대로 유지
- 추가 조정:
  - review-ready Slack 메시지에서 패킷/리뷰 경로, 승인 방법, 반복 설명을 제거하고 `판정` + 번호형 `핵심 확인사항` 중심으로 재구성
  - 승인/거절 버튼 클릭 시 원본 review-ready 메시지를 갱신하고, 이후 `승격 완료`/`승격 보류` 알림은 동일 task 스레드에 답글로 보내도록 Slack thread metadata를 shared approval queue에 저장
- 후속 후보:
  - 오래된 Slack review-ready 메시지를 자동으로 resolve하거나 스레드 reply로 무효화 표식을 남기는 방식 검토

## 2026-04-15 Slack 승인 결과 채널 공용화

- 수정 파일:
  - `backend/routers/slack.py`
  - `backend/tests/test_slack_router.py`
  - `docs/current-state.md`
- 변경 내용:
  - Slack interactivity 버튼 클릭 시 즉시 반환하는 처리중 ack는 기존처럼 개인(ephemeral) 응답으로 유지
  - 실제 승인/거절 결과 후속 메시지는 `response_url`에 `in_channel`로 보내 채널 참여자가 함께 볼 수 있도록 변경
  - 채널 공용 후속 응답 타입을 테스트로 고정
- 유지된 동작:
  - 3초 제한을 피하기 위한 빠른 ack + background 처리 구조는 그대로 유지
  - approval marker 생성과 stale review 검사 규칙은 그대로 유지

## 2026-04-15 cowork 재승인 상태 정리

- 수정 파일:
  - `cowork_watcher.py`
  - `tests/test_cowork_watcher.py`
  - `docs/current-state.md`
- 변경 내용:
  - 같은 `task_id`의 cowork packet이 다시 review-ready로 올라올 때 예전 `cowork/approvals/<task-id>.ok`와 `cowork/dispatch/<task-id>-promoted.md`를 자동 정리하도록 보강
  - 이미 한 번 promoted 된 task가 blocked/drifted 후 다시 review-ready가 되었을 때 Slack 승인 버튼이 실질적으로 무시되던 상태 충돌을 제거
  - stale approval/promoted state reset 경로를 테스트로 고정
- 유지된 동작:
  - review stale 판정과 approval marker 기반 승격 규칙은 그대로 유지
  - 이미 실제 승격이 끝난 packet은 promoted dispatch가 다시 생기기 전까지 중복 승격되지 않음
- 후속 후보:
  - Slack interactivity 후속 메시지에 `이미 승격됨`과 `재검토 후 재승인 가능`을 더 명확히 구분해서 표기할지 검토
  - watcher 쪽 recovery escalation에서도 재에스컬레이션 시 stale cowork state를 한 번에 정리하도록 공통화 검토

## 2026-04-15 랜딩 로그인 복귀 흐름 정리

- 수정 파일:
  - `frontend/app/(landing)/landing-a/_components.tsx`
  - `frontend/app/(landing)/landing-b/page.tsx`
  - `frontend/app/(landing)/programs/page.tsx`
  - `frontend/app/(landing)/programs/[id]/page.tsx`
  - `frontend/app/(landing)/compare/page.tsx`
  - `frontend/app/dashboard/layout.tsx`
  - `frontend/middleware.ts`
  - `frontend/app/auth/callback/route.ts`
  - `frontend/app/page.tsx`
  - `docs/current-state.md`
- 변경 내용:
  - 루트 접근을 `/landing-a`로 리다이렉트해서 landing-a를 메인 랜딩 허브로 고정
  - 루트 `/?code=...` OAuth 유입을 `/auth/callback?next=/landing-a`로 정규화해서 콜백 파라미터가 랜딩 주소에 남지 않도록 조정
  - OAuth 완료 후 기존 사용자의 기본 이동 경로를 `/landing-a`로 변경
  - `frontend/app` 구조를 `(landing)` 그룹과 `dashboard` 축 기준으로 재배치하고, `landing-a`, `landing-b`, `programs`, `compare`를 랜딩 그룹 아래로 정리
  - 비교 페이지를 `/programs/compare` 대신 `/compare`로 올리고, 레거시 접근은 미들웨어에서 `/compare`로 리다이렉트하도록 정리
  - landing-a 상단 헤더를 로그인 상태 인식형 공통 네비게이션으로 바꿔 `Programs`, `Compare`, `내 프로필` 이동과 프로필 표시를 통합
  - 대시보드, landing-b, programs 목록/상세, compare 모두 같은 landing-a 헤더를 유지해서 랜딩 축과 대시보드 사이 이동을 일관되게 맞춤
- 유지된 동작:
  - 프로필이 없는 신규 사용자는 계속 `/onboarding`으로 보냄
  - `/dashboard*`와 `/onboarding` 인증 보호 정책은 그대로 유지
  - 구글 OAuth 시작 경로 `/api/auth/google`는 그대로 유지
- 후속 후보:
  - `/login`에서도 이미 로그인된 사용자를 `/landing-a` 또는 `/dashboard`로 정리하는 UX 처리 검토
  - `landing-a`, `programs`, `compare`, `dashboard`의 본문 컨테이너 폭과 헤더 active state를 더 세밀하게 통일할지 검토

## 작업 목적

랜딩페이지 개편 전에 기존 대시보드/도메인 구조를 먼저 정리해서 아래 문제를 해결하는 것이 목적이었다.

- 프론트 대형 페이지의 과도한 비대화
- 브라우저에서 직접 Supabase를 호출하던 구조 정리
- 데이터 로직과 UI 계층 분리
- 공통 API 계약 및 에러 응답 형식 정리
- 대시보드 진입 전제 조건을 `로그인 사용자` 기준으로 단순화
- 이후 랜딩 개편, 디자인 개선, 기능 확장 시 충돌을 줄일 수 있는 구조 확보

---

## 리팩토링 전 문제점

### 1. 데이터 접근 경로가 제각각이었음

- 일부 화면은 브라우저에서 Supabase를 직접 호출
- 일부는 Next API route를 경유
- 일부는 FastAPI 백엔드를 직접 호출
- 결과적으로 F12 네트워크 탭에서 내부 테이블/쿼리 구조가 쉽게 노출됨

대표 사례:

- `frontend/app/dashboard/profile/page.tsx`
- `frontend/app/dashboard/resume/page.tsx`
- `frontend/app/dashboard/match/page.tsx`
- `frontend/app/dashboard/activities/[id]/page.tsx`
- `frontend/app/dashboard/cover-letter/[id]/page.tsx`

### 2. 대형 페이지에 상태/비즈니스 로직/UI가 한 파일에 섞여 있었음

- `profile`
- `resume`
- `resume/export`
- `activities/[id]`
- `match`
- `cover-letter/[id]`

문제:

- 수정 범위가 넓어짐
- 테스트/검증 포인트가 많아짐
- 랜딩 개편 전 공용 UI 추출이 어려움

### 3. API 계약이 불명확했음

- Next API route마다 응답 형식이 제각각
- 어떤 route는 `{ error }`, 어떤 route는 `{ detail }`, 어떤 route는 plain JSON
- 프론트 예외 처리 일관성 부족

### 4. 게스트 모드가 구조 복잡도를 증가시켰음

- `localStorage` 기반 guest 분기
- 로그인 흐름과 guest 흐름이 동시에 존재
- 훅/페이지 곳곳에 `isGuestMode()` 분기 존재
- 인증 기반 서버 경유 구조와 상충

### 5. 세부 UX/구조 문제

- `profile`의 dead button 존재
- 대시보드 레이아웃 브랜드 표기 오타
- `match`, `activities` 모달 스타일 불일치
- `resume/export` 번들 과대

---

## 실제 변경 사항

### A. 백엔드 정리

#### 1. Supabase service role key 단일화

- `SUPABASE_SERVICE_ROLE_KEY` 기준으로 정리
- 중복 alias 사용 제거

관련 파일:

- `backend/routers/programs.py`
- `backend/rag/collector/scheduler.py`
- `backend/.env.example`
- `check_env.py`

#### 2. Supabase admin 접근 공통화

추가 파일:

- `backend/utils/supabase_admin.py`

적용 파일:

- `backend/routers/admin.py`
- `backend/routers/bookmarks.py`
- `backend/routers/programs.py`
- `backend/repositories/coach_session_repo.py`
- `backend/chains/job_posting_rewrite_chain.py`

#### 3. 프로그램 라우터 중복 등록 정리

수정 파일:

- `backend/main.py`

#### 4. 추천 프로그램 엔드포인트 구현/복구

수정 파일:

- `backend/routers/programs.py`

내용:

- `/programs/recommend` 실제 동작하도록 정리
- 프론트 대시보드 추천 흐름 복구

---

### B. 문서/PRD 정리

생성/수정 파일:

- `docs/specs/prd.md`
- `docs/specs/prd.html`
- `docs/specs/prd.pdf`
- `scripts/generate_prd_pdf.py`

내용:

- 사업계획서 v2 기준 PRD 재작성
- 현재 구현 완료 범위 / 미완성 범위 반영

---

### C. 프론트 데이터 접근 구조 개편

#### 1. 브라우저 직접 Supabase 접근 제거

다음 도메인을 Next API route 또는 백엔드 API 경유 구조로 변경:

- profile
- resume
- documents
- match
- activities
- cover-letter
- dashboard me
- recommended programs
- onboarding
- resume export
- auth signout

추가된 주요 route:

- `frontend/app/api/dashboard/profile/route.ts`
- `frontend/app/api/dashboard/resume/route.ts`
- `frontend/app/api/dashboard/documents/route.ts`
- `frontend/app/api/dashboard/match/route.ts`
- `frontend/app/api/dashboard/activities/route.ts`
- `frontend/app/api/dashboard/activities/[id]/route.ts`
- `frontend/app/api/dashboard/activities/images/route.ts`
- `frontend/app/api/dashboard/activities/coach-session/route.ts`
- `frontend/app/api/dashboard/cover-letters/route.ts`
- `frontend/app/api/dashboard/cover-letters/[id]/route.ts`
- `frontend/app/api/dashboard/cover-letters/coach/route.ts`
- `frontend/app/api/dashboard/me/route.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/resume-export/route.ts`
- `frontend/app/api/onboarding/route.ts`
- `frontend/app/api/auth/signout/route.ts`
- `frontend/app/api/auth/google/route.ts`
- `frontend/app/auth/callback/route.ts`

공용 클라이언트 계층:

- `frontend/lib/api/app.ts`

#### 2. `/api/summary` 보강

수정 파일:

- `frontend/app/api/summary/route.ts`

적용 내용:

- content-type 검사
- prompt 길이 제한
- API key 누락 처리
- upstream 오류 구분

#### 3. 불필요한 노출 제거

수정 파일:

- `frontend/components/KakaoMap.tsx`

내용:

- 카카오 키 관련 콘솔 출력 제거

---

### D. 페이지 구조 리팩토링

## 1. `activities/[id]`

기존 문제:

- 활동 상세 편집, STAR 편집, AI 코치, 저장/삭제 모달이 한 파일에 밀집

추가/분리 파일:

- `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
- `frontend/app/dashboard/activities/_components/activity-basic-tab.tsx`
- `frontend/app/dashboard/activities/_components/activity-star-tab.tsx`
- `frontend/app/dashboard/activities/_components/activity-coach-panel.tsx`
- `frontend/app/dashboard/activities/_components/activity-detail-modals.tsx`

수정 파일:

- `frontend/app/dashboard/activities/[id]/page.tsx`

리팩토링 내용:

- 상태/데이터 로직을 `useActivityDetail`로 이동
- 기본 정보 탭 / STAR 탭 / 코치 패널 / 모달 분리
- 이후 guest 모드 제거하면서 guest 저장/삭제 fallback도 완전히 제거

---

## 2. `profile`

기존 문제:

- 프로필 fetch, 통계 계산, 경력 카드, 활동 탭, 수정 모달, 리스트 렌더링이 한 페이지에 혼합

추가 파일:

- `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
- `frontend/app/dashboard/profile/_components/profile-completion-card.tsx`
- `frontend/app/dashboard/profile/_components/profile-hero-section.tsx`
- `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx`
- `frontend/app/dashboard/profile/_components/profile-section-editors.tsx`
- `frontend/app/dashboard/profile/_components/profile-activity-strip.tsx`
- `frontend/app/dashboard/profile/_components/profile-detail-cards.tsx`
- `frontend/app/dashboard/profile/_lib/profile-page.ts`

수정 파일:

- `frontend/app/dashboard/profile/page.tsx`

리팩토링 내용:

- 데이터 로딩/저장 로직을 `useProfilePage`로 이동
- 활동 탭 스트립 별도 컴포넌트화
- 경력 카드, 리스트 카드, 하단 액션 분리
- dead button 수정:
  - `onOpenSettings={() => {}}` 제거
  - 설정 버튼 클릭 시 프로필 수정 모달 오픈으로 변경

---

## 3. `resume`

기존 문제:

- 활동 선택, 프로필/Bio 편집, 질문 선택, AI 사이드바, 이력서 저장이 한 파일에 혼합

추가 파일:

- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/_components/resume-preview-pane.tsx`
- `frontend/app/dashboard/resume/_components/resume-assistant-sidebar.tsx`

수정 파일:

- `frontend/app/dashboard/resume/page.tsx`

리팩토링 내용:

- 데이터/저장 로직을 `useResumeBuilder`로 이동
- 중앙 미리보기와 우측 AI/템플릿 패널 분리
- guest fallback 저장 제거

---

## 4. `resume/export`

기존 문제:

- `@react-pdf/renderer` 관련 코드가 페이지에 직접 포함돼 번들 비대

추가 파일:

- `frontend/app/dashboard/resume/export/_hooks/use-resume-export.ts`
- `frontend/app/dashboard/resume/export/_components/resume-pdf-download.tsx`

수정 파일:

- `frontend/app/dashboard/resume/export/page.tsx`

리팩토링 내용:

- 데이터 fetch를 hook으로 분리
- PDF 다운로드 영역 동적 로딩
- 페이지 번들 축소

결과:

- `/dashboard/resume/export` 번들 크기 대폭 감소
- 이전 작업 기준 약 `518kB -> 4.67kB` 수준까지 감소

주의:

- 이 수치는 당시 build 결과 기준 기록이며, 현재 빌드 시점에 약간 달라질 수 있음

---

## 5. `match`

기존 문제:

- 분석 입력 모달, 결과 상세 모달, 분석 로직이 한 파일에 뒤섞여 있었음
- 일부 직접 접근/guest fallback 존재

추가 파일:

- `frontend/app/dashboard/match/_hooks/use-match-page.ts`
- `frontend/app/dashboard/match/_components/match-analysis-input-modal.tsx`
- `frontend/app/dashboard/match/_components/match-analysis-detail-modal.tsx`

수정 파일:

- `frontend/app/dashboard/match/page.tsx`

리팩토링 내용:

- 입력/상세 모달 분리
- 목록/저장/삭제는 서버 API 경유
- guest fallback 제거
- 현재는 분석 생성/삭제/목록 로딩 모두 인증 사용자 기준

---

## 6. `cover-letter/[id]`

기존 문제:

- 상세 조회, 저장, 삭제, 코칭, 문항 편집이 한 파일에 섞여 있었음

추가 파일:

- `frontend/app/dashboard/cover-letter/_hooks/use-cover-letter-detail.ts`

수정 파일:

- `frontend/app/dashboard/cover-letter/[id]/page.tsx`

리팩토링 내용:

- 데이터/저장/삭제/코칭 로직을 hook으로 이동
- guest cover letter fallback 제거
- 저장/삭제는 서버 route 경유로 고정

---

### E. 공통 모달 스타일 통일

추가 파일:

- `frontend/app/dashboard/_components/modal-shell.tsx`

적용 파일:

- `frontend/app/dashboard/activities/_components/activity-detail-modals.tsx`
- `frontend/app/dashboard/match/_components/match-analysis-input-modal.tsx`
- `frontend/app/dashboard/match/_components/match-analysis-detail-modal.tsx`

내용:

- 오버레이
- 패널 radius
- 헤더/서브타이틀
- 닫기 버튼
- footer 구조

을 공통 셸 기반으로 정리

---

### F. API 계약 문서화 및 타입 정리

#### 1. API 계약 문서 추가

생성 파일:

- `docs/specs/api-contract.md`

포함 내용:

- Next App API
- FastAPI backend API
- 인증 방식
- 공통 에러 형식
- 요청/응답 shape
- 계약 주의사항

#### 2. 프론트 타입 계약 정리

수정 파일:

- `frontend/lib/types/index.ts`

추가/정리 타입 예:

- `DashboardMeResponse`
- `DashboardProfileResponse`
- `ResumeBuilderResponse`
- `ResumeExportResponse`
- `MatchDashboardResponse`
- `DocumentsResponse`
- `ActivityListResponse`
- `ActivityDetailResponse`
- `ActivityMutationResponse`
- `CoverLetterListResponse`
- `CoverLetterDetailResponse`
- `CoverLetterMutationResponse`
- `ProgramListResponse`

#### 3. API client 타입 연동

수정 파일:

- `frontend/lib/api/app.ts`

내용:

- 로컬 임시 타입 제거
- 문서 기준 shared type 사용
- 에러 응답의 `code`를 포함해 예외 메시지 구성

---

### G. Next API 에러 계약 통일

추가 파일:

- `frontend/lib/api/route-response.ts`

추가 함수:

- `apiOk(...)`
- `apiError(error, status, code)`

주요 적용 파일:

- `frontend/app/api/dashboard/profile/route.ts`
- `frontend/app/api/dashboard/match/route.ts`
- `frontend/app/api/dashboard/activities/route.ts`
- `frontend/app/api/dashboard/activities/[id]/route.ts`
- `frontend/app/api/dashboard/activities/images/route.ts`
- `frontend/app/api/dashboard/activities/coach-session/route.ts`
- `frontend/app/api/dashboard/resume/route.ts`
- `frontend/app/api/dashboard/resume-export/route.ts`
- `frontend/app/api/dashboard/documents/route.ts`
- `frontend/app/api/dashboard/cover-letters/route.ts`
- `frontend/app/api/dashboard/cover-letters/[id]/route.ts`
- `frontend/app/api/dashboard/cover-letters/coach/route.ts`
- `frontend/app/api/dashboard/me/route.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/onboarding/route.ts`
- `frontend/app/api/summary/route.ts`
- `frontend/app/api/auth/signout/route.ts`

결과:

- JSON route는 공통적으로 `{ error, code }`
- redirect route는 예외
  - `GET /api/auth/google`
  - `GET /auth/callback`

---

### H. 게스트 모드 제거

삭제 파일:

- `frontend/lib/guest.ts`

수정 파일:

- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/app/dashboard/activities/page.tsx`
- `frontend/app/dashboard/documents/page.tsx`
- `frontend/app/dashboard/cover-letter/page.tsx`
- `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
- `frontend/app/dashboard/resume/export/_hooks/use-resume-export.ts`
- `frontend/app/dashboard/match/_hooks/use-match-page.ts`
- `frontend/app/dashboard/cover-letter/_hooks/use-cover-letter-detail.ts`
- `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
- `frontend/app/dashboard/activities/_components/activity-basic-tab.tsx`
- `frontend/app/dashboard/activities/[id]/page.tsx`

제거 내용:

- `enableGuestMode()`
- `disableGuestMode()`
- `isGuestMode()`
- guest fallback localStorage 데이터
- guest용 resume/activity/cover-letter 생성/삭제 분기
- 로그인 화면의 “게스트로 둘러보기” 버튼

결과:

- `/dashboard`는 로그인 사용자 전제만 유지
- 인증/서버 경유 구조와 일치
- 상태 분기 수 감소

---

## 파일별/컴포넌트별 변경 내용

### 백엔드

- `backend/utils/supabase_admin.py`
  - Supabase admin client 설정 공통화
- `backend/main.py`
  - programs router 중복 등록 제거
- `backend/routers/programs.py`
  - 추천 프로그램 관련 경로 정리
- `backend/routers/admin.py`
  - admin Supabase 접근 공통 helper 사용
- `backend/routers/bookmarks.py`
  - bookmarks Supabase 접근 공통 helper 사용
- `backend/repositories/coach_session_repo.py`
  - Supabase admin 설정 공통 helper 사용
- `backend/chains/job_posting_rewrite_chain.py`
  - Supabase admin 설정 공통 helper 사용

### 프론트 공통

- `frontend/lib/api/app.ts`
  - 프론트용 공통 app API client
- `frontend/lib/api/route-response.ts`
  - JSON route 공통 응답 헬퍼
- `frontend/lib/types/index.ts`
  - API 계약 타입 정리
- `frontend/components/KakaoMap.tsx`
  - 콘솔 로그 제거

### 프론트 API route

- `frontend/app/api/dashboard/*`
  - 대시보드 데이터 전반 서버 경유화
- `frontend/app/api/onboarding/route.ts`
  - 온보딩 저장 서버 처리
- `frontend/app/api/auth/google/route.ts`
  - OAuth 시작 서버 처리
- `frontend/app/auth/callback/route.ts`
  - OAuth callback 서버 처리
- `frontend/app/api/auth/signout/route.ts`
  - 로그아웃 API
- `frontend/app/api/summary/route.ts`
  - 입력 검증 및 에러 응답 강화

### 프론트 대시보드 구조

- `frontend/app/dashboard/_components/modal-shell.tsx`
  - 공통 모달 셸
- `frontend/app/dashboard/profile/*`
  - profile 전용 hook/lib/components로 세분화
- `frontend/app/dashboard/resume/*`
  - builder, preview, assistant sidebar 구조화
- `frontend/app/dashboard/resume/export/*`
  - export hook + PDF download component
- `frontend/app/dashboard/activities/*`
  - activity detail hook + tab/panel/modal 분리
- `frontend/app/dashboard/match/*`
  - match hook + input/detail modal 분리
- `frontend/app/dashboard/cover-letter/*`
  - cover letter detail hook 분리

---

## 변경 이유

### 1. 브라우저 노출 최소화

- 직접 Supabase 접근을 줄여 F12에서 내부 구조 노출 축소

### 2. 유지보수성 향상

- 페이지 파일에서 비즈니스 로직 제거
- 화면 조립과 데이터 처리 책임 분리

### 3. 랜딩 개편 전 구조 정리

- 랜딩 UI를 새로 만들기 전에 앱 내부 구조를 안정화
- 이후 공용 카드, CTA, preview 블록 재활용 기반 확보

### 4. 인증 흐름 단순화

- guest와 member 두 흐름을 동시에 관리하지 않도록 정리
- `로그인 -> 온보딩 -> 대시보드` 퍼널 기준으로 통일

### 5. API 계약 일관성 확보

- 프론트 예외 처리 예측 가능성 향상
- 문서/타입/실제 route 간 정합성 개선

---

## 유지된 기존 동작

아래 기능은 구조만 바뀌고 사용자 기능 자체는 유지하는 방향으로 리팩토링했다.

- 프로필 조회/수정
- 활동 목록 조회
- 활동 상세 조회/저장/삭제
- STAR 저장 및 요약 생성
- 활동 이미지 업로드
- 이력서 생성
- 문서 저장소 조회
- PDF 내보내기
- 자기소개서 목록/상세/저장/삭제
- 자기소개서 코칭 요청
- 공고 매칭 분석 생성/조회/삭제
- 추천 프로그램 조회
- 온보딩 저장
- 로그인/로그아웃

---

## 영향 범위

### 직접 영향

- `frontend/app/dashboard/**`
- `frontend/app/api/**`
- `frontend/lib/api/**`
- `frontend/lib/types/index.ts`
- `backend/routers/**`
- `backend/repositories/coach_session_repo.py`
- `backend/chains/job_posting_rewrite_chain.py`
- `backend/utils/supabase_admin.py`
- `docs/specs/api-contract.md`
- `docs/prd.*`

### 간접 영향

- 로그인 상태 기반 진입 흐름
- 대시보드 초기 로딩
- 에러 메시지 처리 방식
- 브라우저 번들 크기
- 향후 랜딩-대시보드 연결 구조

---

## 테스트 체크리스트

아래 항목은 이번 리팩토링 이후 확인해야 할 체크리스트이다.

### 공통

- [ ] `frontend`에서 `npm run build` 통과
- [ ] 로그인하지 않은 상태에서 `/dashboard` 접근 시 `/login`으로 리다이렉트
- [ ] 로그인 후 `/dashboard` 정상 진입
- [ ] 로그아웃 정상 동작

### 프로필

- [ ] 프로필 조회 정상
- [ ] 프로필 수정 모달 오픈/저장 정상
- [ ] 포트폴리오 링크 설정/열기 정상
- [ ] 경력/학력/수상/자격증/외국어 리스트 수정 정상

### 활동

- [ ] 활동 목록 조회 정상
- [ ] 새 활동 생성 정상
- [ ] 기존 활동 수정 정상
- [ ] 이미지 업로드 정상
- [ ] STAR 저장 정상
- [ ] AI 코치 요청/세션 저장 정상
- [ ] 삭제 모달 및 삭제 동작 정상

### 이력서

- [ ] 활동 선택 후 이력서 생성 정상
- [ ] 문서 저장소 반영 정상
- [ ] resume export 페이지 진입 정상
- [ ] PDF 다운로드 정상

### 자기소개서

- [ ] 목록 조회 정상
- [ ] 상세 조회 정상
- [ ] 새 자기소개서 저장 정상
- [ ] 수정 정상
- [ ] 삭제 정상
- [ ] 코칭 요청 정상

### 매칭 분석

- [ ] 이력서 목록 조회 정상
- [ ] 이미지/PDF 공고 추출 정상
- [ ] 분석 생성 정상
- [ ] 결과 상세 모달 정상
- [ ] 분석 삭제 정상

### 프로그램

- [ ] `/dashboard` 추천 프로그램 조회 정상
- [ ] `/programs` 목록 조회 정상
- [ ] `/programs/[id]` 상세 조회 정상

### API 계약

- [ ] JSON route 실패 시 `{ error, code }` 형식 확인
- [ ] redirect route는 redirect만 수행하는지 확인

---

## 남은 과제

### 1. `DashboardMeResponse` 계약 정리 필요

현재 상태:

- 타입은 `user | null` 허용
- 실제 route는 비로그인 시 `401 { error, code: "UNAUTHORIZED" }`

정리 필요 파일:

- `frontend/lib/types/index.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/api/dashboard/me/route.ts`
- `frontend/app/dashboard/layout.tsx`
- `frontend/app/dashboard/page.tsx`

권장 방향:

- 예외 기반으로 갈 경우 타입에서 `user | null` 제거
- 또는 route를 `200 { user: null }`로 바꾸고 프론트 분기 유지

### 2. 백엔드 일부 source adapter TODO 정리

확인 파일:

- `backend/rag/source_adapters/work24_job_support.py`

상태:

- TODO/placeholder 주석 존재
- 실제 운영 노출 범위 점검 필요

### 3. 개발용 토큰 출력 스크립트 정리

확인 파일:

- `frontend/get_token.mjs`

문제:

- access token 직접 출력
- 로컬 전용이라도 보안 위생상 정리 권장

### 4. 랜딩 개편 본작업 미착수

현재는 기반 구조 정리만 완료
다음 단계는 랜딩 UI/브랜드/전환 흐름 설계 필요

---

## 불확실한 내용

- `resume/export` 번들 감소 수치는 작업 당시 build 로그 기준이며, 이후 변경으로 현재 수치와 차이가 있을 수 있음
- 모든 route에 대한 런타임 API 수동 검증은 이 대화 내에서 전부 수행하지 못했고, build 중심 검증 위주로 진행됨
- 백엔드 엔드포인트 일부는 AST/빌드 기준 확인 중심이었고, 실제 운영 데이터 조건까지 모두 검증한 것은 아님

---

## 다음 대화에서 바로 이어갈 수 있는 후속 작업 프롬프트

### 1. 랜딩 개편 시작

```md
현재 리팩토링된 구조를 기준으로 랜딩페이지 개편을 시작하자.
먼저 기존 landing/app/page.tsx와 관련 컴포넌트를 검토해서
- 현재 문제점
- 바꿔야 할 정보 구조
- 전환 퍼널
- 로그인 이후 연결 흐름
을 정리한 뒤 바로 구현해줘.
브랜드 톤은 신뢰감 있고 취업/커리어 SaaS 느낌으로 가고,
기존 대시보드와 단절되지 않게 설계해줘.
```

### 2. `DashboardMeResponse` 계약 정리

```md
getDashboardMe 관련 타입/route/호출부 계약이 아직 애매하다.
frontend/lib/types/index.ts
frontend/lib/api/app.ts
frontend/app/api/dashboard/me/route.ts
frontend/app/dashboard/layout.tsx
frontend/app/dashboard/page.tsx
를 기준으로 계약을 하나로 통일하고, 그에 맞게 수정해줘.
```

### 3. 출시 전 최종 점검

```md
랜딩 개편 전에 현재 프로젝트 전체를 출시 전 점검 관점으로 다시 리뷰해줘.
우선순위는
1. 런타임 에러 가능성
2. 인증/보안 문제
3. dead UI / 미연결 버튼
4. API 계약 불일치
5. 구조상 위험한 중복
순서로 보고, 발견한 건 바로 수정까지 진행해줘.
```

### 4. 백엔드 TODO 정리

```md
backend/rag/source_adapters/work24_job_support.py를 포함해서
현재 백엔드에서 TODO/placeholder 상태인 기능을 전부 찾아서
실제 운영에 위험한 부분만 우선순위로 정리해줘.
문서만 만들지 말고, 위험도/영향도/수정 난이도까지 같이 적어줘.
```

### 5. 리팩토링 후 문서 보강

```md
docs/specs/api-contract.md와 이번 리팩토링 로그를 기준으로
docs/architecture-overview.md 문서를 새로 만들어줘.
프론트 계층, Next API 계층, FastAPI 계층, Supabase 계층을
현재 코드 기준으로 실제 흐름 위주로 정리해줘.
```

---

## 2026-04-14 추가 메모

- `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
  - resume preview의 `bio` 저장에 마지막 saved trimmed 값 비교와 저장 중 가드를 추가해서 `Enter` 후 `blur`로 같은 값이 중복 저장되는 요청을 막음
- workspace 정리
  - VS Code 재시작 시 불필요한 `cowork/` 스캐폴딩과 루트 `__pycache__/` 노출을 줄이기 위해 워크스페이스 설정과 automation 문구를 정리함
- `watcher.py`
  - 로컬 task queue smoke test 중 드러난 Windows 이동/출력 이슈를 줄이기 위해 task 파일 이동에 재시도 가드를 추가하고 `codex exec` 출력은 UTF-8로 읽도록 보강함
- 로컬 automation 검증
  - `tasks/inbox -> tasks/running -> reports/*-drift.md -> tasks/blocked` 경로를 문서 smoke task로 실제 검증했고, 현재 문구가 이미 반영된 경우 drift로 안전 중단되는 것을 확인함
- cowork automation 추가
  - `cowork_watcher.py`를 추가해서 `cowork/packets -> cowork/reviews -> cowork/approvals -> tasks/inbox|tasks/remote` 승격 경로를 자동화하고, 상태 알림은 `cowork/dispatch/`에 남기도록 정리함
- `frontend/app/landing-b/page.tsx`
  - 기존 메인 랜딩을 건드리지 않고 `/landing-b`에 퀴즈 기반 온보딩 랜딩을 별도 route로 추가함
  - 상태, 정적 결과 데이터, 시각 효과를 페이지 내부에만 두어 전역 스타일 충돌 없이 실험성 랜딩을 격리함

## 2026-04-15 추가 메모

- `watcher.py`
  - 성공 task에서 `reports/<task-id>-result.md`의 `Changed files` 목록과 task/report 파일만 stage해서 `[codex] <task-id> 구현 완료` 자동 commit/push를 시도하도록 보강함
  - git 자동화 결과는 result report의 `## Git Automation` 섹션에 남기도록 정리함
  - `drift`, `blocked`, `completed`, `push-failed` 상태를 `dispatch/alerts/<task-id>-*.md`로 별도 기록하고, drift task는 `tasks/drifted/`로 분리해 사람이 폴더만 봐도 중단 상태를 바로 알 수 있게 함
  - `SLACK_WEBHOOK_URL` 환경변수가 있으면 같은 terminal-state alert를 Slack incoming webhook으로도 전송하도록 보강함
  - alert 본문 포맷을 `type`, `stage`, `status`, `severity`, `packet`, `created_at`, `report`, `summary`, `next_action` 기준으로 표준화함
- `scripts/run_watcher.ps1`, `.watcher.env.example`
  - watcher 실행 스크립트가 저장소 루트 `.watcher.env`를 자동 로드하도록 하고, Slack webhook 로컬 설정 템플릿을 추가함
- `docs/`
  - 루트에 평평하게 쌓여 있던 문서를 `automation`, `rules`, `specs`, `data`, `research`, `worklogs`로 재분류함
  - `docs/current-state.md`와 `docs/codex-workflow.md`는 루트 인덱스 성격을 유지하고, 세부 문서는 하위 폴더로 이동해 탐색성을 높임
- `dispatch/alerts/README.md`, `dispatch/alerts/DISPATCH_ALERT_PROMPT.md`
  - root `dispatch/alerts`를 local watcher terminal outcome 채널로 문서화하고, Dispatch가 alert를 읽고 대응하는 표준 프롬프트를 추가함
- `cowork/FOLDER_INSTRUCTIONS.md`, `cowork/README.md`
  - `cowork/dispatch`는 cowork packet workflow 전용, `dispatch/alerts`는 local watcher outcome 전용으로 역할을 문서상 분리함
- `frontend/app/landing-a/page.tsx`
  - 기존 `/`를 유지한 채 `/landing-a`에 정보 허브 중심 랜딩 A를 별도 route로 추가함
  - ticker, sticky nav/search, 프로그램 카드, 비교 섹션, 이용 흐름, CTA를 페이지 내부 정적 데이터와 로컬 스타일로만 구성해 전역 수정 범위를 피함
- `scripts/watcher_shared.py`, `watcher.py`, `cowork_watcher.py`
  - watcher 두 종류에 중복되던 lock 처리, frontmatter 파싱, markdown IO, Codex CLI 해석, retry 기반 파일 이동 로직을 공통 모듈로 추출함
  - `watcher.py`와 `cowork_watcher.py`는 각자 흐름 제어만 남기고, 공통 유틸은 wrapper를 통해 재사용하도록 정리해 이후 alert/queue 변경 시 수정 지점을 줄임
- `tests/test_cowork_watcher.py`
  - 실제 cowork 승격 동작이 copy 기반이라는 점과 stale review 판정이 mtime 비교라는 점에 맞춰 테스트를 현재 규칙 기준으로 정리함
- `docs/automation/watcher-shared.md`
  - watcher 공통 유틸의 책임 범위, wrapper 유지 이유, 테스트 전제를 별도 운영 문서로 정리해 이후 구조 변경 시 기준 문서로 삼을 수 있게 함
- `frontend/app/landing-a/page.tsx`, `frontend/app/landing-a/_*.ts*`
  - 랜딩 A의 정적 데이터, 테마 스타일, 섹션 렌더링을 페이지 본문에서 분리해 `page.tsx`는 상태와 조립만 담당하도록 정리함
- `frontend/app/landing-b/page.tsx`, `frontend/app/landing-b/_*.ts*`
  - 랜딩 B의 퀴즈 상태 계산은 페이지에 두고, 정적 데이터와 퀴즈/결과/보조 섹션 렌더링을 별도 파일로 분리해 이후 실험 랜딩 수정 범위를 줄임
- `cowork_watcher.py`, `scripts/run_cowork_watcher.ps1`
  - cowork watcher도 `.watcher.env`의 `SLACK_WEBHOOK_URL`을 로드해 `review-ready`, `review-failed`, `approval-blocked-stale-review`, `promoted` dispatch를 Slack으로 미러링하도록 보강함
  - Slack 메시지에는 approval marker 생성 안내를 포함하되, 현재 연동이 incoming webhook 기반이라 Slack에서 직접 approval을 수신하는 양방향 흐름은 아직 지원하지 않음을 문서화함
- `backend/routers/slack.py`, `backend/main.py`, `backend/.env.example`
  - Slack slash command `/isoser-approve <TASK-ID> [inbox|remote]`를 받을 수 있는 backend 엔드포인트를 추가함
  - Slack signing secret 검증, 승인 가능 사용자 allowlist, review stale 검사 후에만 `cowork/approvals/<task-id>.ok` marker를 생성하도록 제한함
- `backend/tests/test_slack_router.py`
  - slash command 승인 성공/실패(stale review) 시나리오를 테스트로 고정함
- `docs/automation/slack-approval-setup.md`, `docs/automation/README.md`, `docs/automation/operations.md`, `docs/current-state.md`
  - Slack webhook 알림과 `/isoser-approve` slash command를 실제 운영에 붙이기 위한 환경변수, Slack App 설정, 재시작 순서, smoke test 절차를 문서화함
- `cowork_watcher.py`, `backend/routers/slack.py`
  - `review-ready` Slack 알림을 blocks 기반 버튼 메시지로 바꿔 `승인`, `원격`, `거절` 액션을 직접 누를 수 있게 함
  - backend에 `POST /slack/interactivity/cowork-review`를 추가해 버튼 클릭 시 approval marker 생성 또는 rejection dispatch 기록을 처리하도록 확장함
- `tests/test_cowork_watcher.py`, `backend/tests/test_slack_router.py`
  - review-ready 버튼 payload 생성과 Slack interactivity 승인/거절 흐름을 테스트로 고정함
- `watcher.py`, `tests/test_watcher.py`
  - local watcher Slack alert를 영문 key-value 나열에서 한국어 섹션형 blocks 메시지로 바꿔 `작업`, `단계`, `상태`, `요약`, `다음 조치`가 바로 보이도록 정리함
- `cowork_watcher.py`, `tests/test_cowork_watcher.py`
  - cowork review/promotion Slack 메시지도 한국어 섹션형 blocks 메시지로 정리하고, review-ready는 버튼을 유지한 채 `검토 상태`, `패킷`, `리뷰`, `승인 방법`이 바로 보이도록 개선함
- `backend/routers/programs.py`
  - 기존 `/programs` 응답 shape는 유지한 채 `q`, `regions`, `recruiting_only`, `sort` query를 추가하고 `/programs/count`를 분리해 목록 화면의 총건수 요구를 non-breaking하게 맞춤
- `frontend/app/programs/page.tsx`, `frontend/lib/api/backend.ts`, `frontend/lib/types/index.ts`
  - `/programs`를 URL query 기반 서버 렌더링 허브 페이지로 확장하고 검색, 카테고리/지역 필터, 모집중 토글, 정렬, 20건 페이지네이션을 추가함
- `frontend/app/programs/compare/page.tsx`, `frontend/app/programs/compare/programs-compare-client.tsx`, `frontend/lib/types/index.ts`, `supabase/migrations/20260415113000_add_compare_meta_to_programs.sql`
  - `/programs/compare` 공개 비교 화면을 추가하고 `?ids=` URL state, 3슬롯 비교 그리드, 추천 프로그램 추가/제거, `compare_meta` 기반 허들/대상 표시를 최소 범위로 구현함
- `frontend/lib/program-categories.ts`
  - 프론트 카테고리 상수를 현재 backend/programs category 체계에 맞는 `AI`, `IT`, `디자인`, `경영`, `창업`, `기타` 중심으로 정렬함
- `backend/tests/test_programs_router.py`
  - programs query param helper와 count parsing 규칙을 테스트로 고정함
- `docs/specs/api-contract.md`, `docs/current-state.md`
  - 확장된 programs 목록 query와 `/programs/count` endpoint를 현재 코드 기준으로 문서화함
- `watcher.py`, `tests/test_watcher.py`
  - `tasks/drifted/`와 `tasks/blocked/`를 주기적으로 스캔해 recovery report를 기반으로 packet을 자동 보정하고 `tasks/inbox/`로 재큐잉하는 auto recovery 루프를 추가함
  - 무한 재시도를 막기 위해 packet의 `auto_recovery_attempts`를 읽어 최대 자동 복구 횟수를 제한하고, packet이 실제로 `queued + current HEAD` 상태로 갱신된 경우에만 재투입하도록 제한함
- `watcher.py`, `tests/test_watcher.py`
  - 자동 복구가 안전하지 않거나 재시도 한도에 걸린 task는 `cowork/packets/<task-id>.md`로 자동 에스컬레이션하고, `dispatch/alerts/<task-id>-needs-review.md` alert에서 Slack approval 또는 피드백 흐름으로 연결되도록 확장함
- `docs/automation/local-flow.md`, `docs/automation/overview.md`, `docs/current-state.md`
  - local watcher 운영 문서에 `drifted/blocked -> recovery -> inbox` 재개발 흐름과 `recovered` alert를 반영함
- `backend/routers/programs.py`, `backend/rag/programs_rag.py`, `backend/rag/chroma_client.py`
  - `/programs/recommend`에 category/region/job_title/force_refresh를 추가하고 기본 추천 결과를 `recommendations` 테이블에 24시간 캐시하도록 확장함
  - Chroma metadata `where` 필터와 filter miss/failure 시 전체 검색 폴백을 추가해 필터 기반 추천과 캐시 없는 복구 경로를 함께 보강함
- `backend/rag/collector/base_html_collector.py`, `backend/rag/collector/scheduler.py`
  - Tier 2 서울시 HTML collector 공통 베이스에 `BeautifulSoup` 파싱 유틸을 복구해 parser 테스트 6건이 실제 실행되도록 고정함
  - scheduler import fallback은 `ModuleNotFoundError` 중 `rag` 경로 불일치에만 반응하도록 좁혀 실행 환경 차이만 흡수하고 실제 collector import 오류는 숨기지 않게 유지함
- `watcher.py`, `tests/test_watcher.py`
  - Codex 실행 중 별도 heartbeat 스레드가 `tasks/running/<task>.md` mtime을 주기적으로 갱신하도록 보강해, 결과 리포트를 쓴 뒤 stdout이 잠잠해지는 작업이 stale timeout으로 `blocked` 처리되던 오탐을 줄임
  - watcher 테스트에 heartbeat touch와 `run_codex()` heartbeat 시작/정리 경로를 추가해 장기 실행 중 queue 상태 보존을 고정함

## 2026-04-16 추가 메모

- 2026-04-20: `backend/rag/programs_rag.py`, `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `frontend/app/api/dashboard/recommend-calendar/route.ts`, `frontend/lib/api/app.ts`, `frontend/lib/types/index.ts`
  - 추천 하이브리드 점수 공식을 `0.6 / 0.4`로 복구하고, cache read 시 저장된 `final_score`를 재사용하지 않도록 stale-cache recovery 규칙을 추가함
  - `GET /programs/recommend/calendar`와 `/api/dashboard/recommend-calendar`를 추가해 만료 프로그램 제외, `final_score desc + deadline asc` 정렬, `d_day_label` 포함 응답 계약을 캘린더 전용으로 분리함
  - router regression test에 cache 재계산, stale fallback, 비로그인 캘린더 계약, 캘린더 정렬/만료 제외 회귀를 고정함

- `backend/routers/admin.py`, `backend/tests/test_admin_router.py`
  - 추천 데이터 파이프라인 검증 중 드러난 Supabase `programs` 스키마 hybrid 상태를 흡수하도록 admin sync upsert에 후방 호환 fallback을 추가함
  - `is_certified`, `raw_data`, `support_type`, `teaching_method` 같은 누락 컬럼은 자동으로 제외하고 재시도하며, `programs_unique`/`programs_hrd_id_key` 충돌 시에는 row-by-row merge fallback으로 기존 row를 찾아 upsert하도록 보강함
  - 테스트로 missing-column fallback과 unique-constraint fallback을 고정함
- `backend/rag/chroma_client.py`, `backend/tests/test_chroma_client.py`
  - Gemini embedding 429가 `google-genai` 내부 `APIError` 생성 문제로 번지던 경로를 정리하고, 재시도 후에도 quota 초과가 지속되면 local deterministic embedding fallback으로 자동 전환하도록 보강함
  - Chroma upsert는 embedding batch를 잘게 나누고, 테스트로 chunked upsert와 local fallback 전환 경로를 고정함
- `docs/automation/overview.md`, `docs/automation/local-flow.md`, `docs/automation/task-packets.md`, `docs/current-state.md`, `cowork/FOLDER_INSTRUCTIONS.md`, `cowork/README.md`
  - cowork review 흐름과 local execution 흐름을 end-to-end로 다시 정리해 `cowork/packets`는 원본 packet, `cowork/reviews`는 review 산출물, `tasks/inbox`는 승인된 최신 packet 사본의 실행 큐라는 역할 구분을 문서 전반에 명시함
  - "review 문서가 inbox로 간다"는 오해를 막기 위해 packet 수정, review 재생성, approval, promotion, execution, recovery/escalation까지의 상태 전이를 같은 용어로 맞춤
- `CLAUDE.md`, `README.md`
  - 상위 운영 문서에도 같은 의미 체계를 반영해 cowork review workspace와 `tasks/` execution queue의 차이, 그리고 `cowork/packets -> cowork/reviews -> approval -> tasks/inbox|remote -> watcher` 흐름을 짧게 요약함
- `backend/rag/collector/regional_html_collectors.py`, `backend/tests/test_tier2_collectors.py`
  - `SeSAC` 제목 정제 규칙을 상태 chip, D-day, 모집기간 꼬리 메타 제거 중심으로 고정하고 테스트를 추가함
  - `서울시 50플러스`에서 `일자리 참여 신청` 같은 메뉴성 anchor를 별도로 걸러 live 수집 품질을 높임
- `backend/rag/collector/base_api_collector.py`, `backend/rag/collector/scheduler.py`, `backend/tests/test_scheduler_collectors.py`
  - API collector가 `last_collect_status`/`last_collect_message`를 남기도록 바꿔, scheduler가 `0건 수집`과 `config_error`/`request_failed`를 구분해 source별 상태를 반환하도록 정리함
  - scheduler는 normalize 후 `(title, source)` 기준 dedupe와 100건 batch upsert를 적용해 대량 source 저장 시 PostgREST conflict 실패를 줄임
- `backend/rag/collector/work24_collector.py`
  - 오래된 `wantedInfoSrch.do` 대신 현재 동작하는 고용24 국민내일배움카드 훈련과정 OpenAPI(`callOpenApiSvcInfo310L01.do`)로 전환하고, `WORK24_TRAINING_AUTH_KEY`를 기본 키로 사용하도록 정리함
- `backend/rag/collector/kstartup_collector.py`
  - 예전 `apis.data.go.kr/B552735/...` endpoint 대신 공공데이터포털의 현재 K-Startup 조회서비스 `nidapi.k-startup.go.kr/api/kisedKstartupService/v1/getAnnouncementInformation`로 옮기고, 서울 지역/접수 종료일 필터를 기본 적용함
- `backend/rag/collector/hrd_collector.py`
  - `HRDNET_API_KEY` alias를 허용해 운영 환경 이름 차이 때문에 collector가 불필요하게 비활성화되는 경우를 줄임
- `backend/rag/collector/normalizer.py`
  - compact date(`YYYYMMDD`)도 `deadline`으로 파싱되도록 보강해 K-Startup 응답의 접수마감일이 누락되지 않게 함
- `backend/rag/collector/scheduler.py`, `backend/tests/test_scheduler_collectors.py`, `backend/.env.example`
  - `HRDCollector`를 optional source로 전환하고 기본 플래그를 `ENABLE_HRD_COLLECTOR=false`로 명시함
  - scheduler는 HRD 플래그 off일 때 `skipped_disabled`, 키가 없을 때 `skipped_missing_config`로 기록하고 `failed_count`에는 포함하지 않도록 조정함
  - 실제 사용자용 HRD course-list API가 확인되기 전까지는 HRD를 운영 기본 경로에서 제외하는 현재 정책을 문서와 테스트에 반영함
- `scripts/run_watcher.ps1`, `scripts/run_cowork_watcher.ps1`, `scripts/supervise_watcher.ps1`, `scripts/start_watchers.ps1`, `.vscode/tasks.json`
  - watcher 실행 스크립트가 `backend/venv/Scripts/python.exe`를 우선 사용하도록 정리해 실행 환경 차이로 인한 모듈 누락을 줄임
  - local watcher와 cowork watcher를 supervisor PowerShell 프로세스가 감시하면서, 종료 시 combined log에 종료 시각과 재시작 정보를 남기고 자동 재기동하도록 보강함
  - VS Code workspace folder open 시 watcher supervisor를 자동 기동해 프로젝트를 열 때마다 수동으로 watcher를 다시 띄우지 않아도 되도록 함
- `scripts/install_start_watchers_task.ps1`, `scripts/show_start_watchers_task.ps1`, `scripts/remove_start_watchers_task.ps1`
  - Windows 작업 스케줄러에 `Isoser Start Watchers` on-logon task를 등록/조회/삭제하는 스크립트를 추가해, VS Code 없이도 로그인 시 watcher supervisor가 자동 실행되도록 운영 경로를 확장함
- `scripts/watcher_shared.py`, `tests/test_watcher_shared.py`
  - Windows에서 stale PID probe 중 `os.kill(pid, 0)`가 `SystemError`를 내는 경우도 죽은 프로세스로 간주하도록 보강해, stale lock 때문에 cowork watcher supervisor가 재시작 루프에 빠지는 문제를 줄임
- `frontend/app/dashboard/page.tsx`, `frontend/app/api/dashboard/recommended-programs/route.ts`, `frontend/lib/api/app.ts`
  - 추천 대시보드 필터를 단일 카테고리/지역 칩으로 분리하고, BFF가 추천 이유·키워드·점수를 병합해 카드 UI가 기존 D-day/마감/관련도 구조를 유지한 채 설명 정보를 확장하도록 정리함
- `backend/rag/programs_rag.py`, `backend/routers/programs.py`, `frontend/app/dashboard/page.tsx`, `frontend/app/(landing)/compare/programs-compare-client.tsx`
  - 추천 점수에서 순수 관련도(`relevance_score`)와 마감 임박도(`urgency_score`)를 분리하고, 프로필 쿼리에서 이름/포트폴리오 URL 노이즈를 제거해 시맨틱 검색 품질을 높임
  - 비교 페이지는 별도 `/programs/compare-relevance` 계산 경로를 추가해 관련도 바, 기술 스택 일치도, 매칭 스킬 태그를 로그인 사용자 기준으로 표시하도록 정리함
- `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/recommended-programs-section.tsx`
  - 공개 `/programs` 상단에 로그인 사용자 전용 맞춤 추천 섹션을 추가하고, 비로그인 사용자에게는 로그인 유도 배너를 노출하도록 분리함
  - 추천 fetch 실패 시 섹션만 숨기고 기존 필터, 검색, 페이지네이션, 카드 CTA 흐름은 그대로 유지하도록 구성함
- 2026-04-16: 프로그램 허브 SEO 작업으로 루트/랜딩/비교/프로그램 상세 metadata를 정리하고, 상세 페이지에 `getProgram(id)` 재사용 기반 JSON-LD `Course` 스키마 출력을 추가함.
- 2026-04-16: `NEXT_PUBLIC_ADSENSE_CLIENT` 기반 AdSense 스크립트와 공용 `AdSlot` 컴포넌트를 추가하고, 공개 `landing-a` / `programs` / `programs/[id]`에만 최소 수동 슬롯을 삽입해 대시보드 비광고 정책을 유지함.
- 2026-04-16: `watcher.py`, `tests/test_watcher.py`, `docs/current-state.md`
  - local watcher가 cowork approval marker의 `slack_message_ts`를 읽어 같은 task의 후속 Slack alert를 기존 작업 스레드에 이어서 보내도록 보강함
  - `tasks/inbox`에 이미 `running`/`blocked`/`drifted`/`done` 상태가 있는 동일 packet이 다시 들어오면 watcher가 재실행 대신 `tasks/archive/`로 보관하고 건너뛰게 해 `FileExistsError` runtime-error 루프를 막음
  - 완료 처리 시 `tasks/done/<task>.md`가 이미 존재해도 watcher가 중복 running packet만 archive로 치우고 Git/Slack 후속 처리를 이어가도록 보강했으며, 회귀 테스트를 추가함
- 2026-04-16: `cowork_watcher.py`, `tests/test_cowork_watcher.py`, `docs/current-state.md`
  - cowork watcher가 승인된 packet의 목적지(`tasks/inbox|remote`)가 이미 존재하면 중복 승격으로 간주하고 기존 파일을 재사용하도록 바꿔 `FileExistsError` runtime-error 반복을 막음
  - 이 경우에도 `promoted` dispatch를 남겨 후속 루프가 멈추지 않게 하고, remote approval queue는 `already present in <target>` 메모와 함께 consume 처리하도록 정리함
- 2026-04-17: `watcher.py`, `tests/test_watcher.py`, `docs/current-state.md`, `docs/automation/local-flow.md`
  - local watcher execution을 supervisor `inspector -> implementer` 2단계로 나눠, 구현 전에 `reports/<task-id>-supervisor-inspection.md` handoff를 남기도록 정리함
  - inspector가 drift/blocked를 먼저 걸러내고 implementer는 inspection handoff를 읽어 구현·검증·result report를 작성하도록 prompt 경계를 분리함
  - 완료 시 git stage 범위에 supervisor inspection report도 포함해 task-scoped worktree를 더 일관되게 유지하도록 조정함
- 2026-04-17: `scripts/watcher_langgraph.py`, `tests/test_watcher_langgraph.py`, `docs/automation/watcher-langgraph.md`, `docs/automation/overview.md`, `docs/current-state.md`
  - 현재 watcher supervisor execution path를 LangGraph 상태 그래프로 정리하고, 현재 구현 graph와 verifier gate를 추가한 제안 graph를 함께 문서화함
  - reviewer 관점에서 verification gate 부재, manual review 노드 비명시성, recovery graph 연결 약점을 정리하고 개선안을 문서에 반영함
- 2026-04-17: `watcher.py`, `tests/test_watcher.py`, `scripts/watcher_langgraph.py`, `tests/test_watcher_langgraph.py`, `docs/current-state.md`, `docs/automation/local-flow.md`, `docs/automation/watcher-langgraph.md`
  - watcher supervisor runtime에 `verifier` 단계를 실제로 추가해 완료 조건을 `inspection report + result report + verification report`로 강화함
  - implementer는 구현과 result report 초안만 담당하고, verifier는 read-only 최종 검증과 `reports/<task-id>-supervisor-verification.md` 산출만 담당하도록 prompt 경계를 분리함
  - LangGraph 문서와 테스트를 현재 runtime 구조에 맞게 갱신하고, 다음 개선 지점을 verification failure의 manual review 분리로 재정의함
- 2026-04-17: `watcher.py`, `tests/test_watcher.py`, `scripts/watcher_langgraph.py`, `tests/test_watcher_langgraph.py`, `docs/current-state.md`, `docs/automation/local-flow.md`, `docs/automation/watcher-langgraph.md`
  - verifier가 `- verdict: review-required`를 machine-readable하게 남기면 watcher가 일반 blocked alert 대신 `needs-review` 공식 경로와 cowork packet escalation로 분기하도록 조정함
  - verification 보류는 런타임 저장소상 `tasks/blocked/`에 잠시 적재되지만, 운영 의미상으로는 manual review 노드로 다루도록 LangGraph spec과 문서를 맞춤
- 2026-04-17: `watcher.py`, `tests/test_watcher.py`, `docs/current-state.md`, `docs/automation/local-flow.md`, `docs/automation/overview.md`
  - verifier의 `review-required` 결과를 `tasks/review-required/` 전용 큐로 분리해 일반 blocked와 운영 의미를 저장소 레벨에서도 분리함
  - `tasks/review-required/`는 auto recovery 대상에서 제외하고, `needs-review` alert + cowork packet escalation 전용 큐로 문서와 테스트를 정렬함
- 2026-04-17: `scripts/summarize_run_ledgers.py`, `scripts/summarize_actionable_ledgers.py`, `tests/test_summarize_run_ledgers.py`, `tests/test_summarize_actionable_ledgers.py`, `CLAUDE.md`
  - 운영 요약 스크립트가 현재 queue snapshot도 함께 출력하도록 확장해 `tasks/review-required/` 대기 현황을 ledger 이벤트와 별개로 바로 볼 수 있게 함
  - 상위 프로젝트 문서 `CLAUDE.md`에도 supervisor 3단계와 `tasks/review-required/` 전용 큐 의미를 반영해 운영 용어를 맞춤
- 2026-04-20: `backend/rag/collector/tier4_collectors.py`, `backend/rag/collector/scheduler.py`
  - 서울 자치구 Tier 4 HTML collector 6종을 전용 모듈로 분리해 추가하고, scheduler dry-run 경로에 Tier 4 등록을 연결함
  - 실서비스 HTML 구조 기준으로 HTTP-only 구로, `cntrId=CT00006` 고정 성동, Imweb board 패턴 노원, 메인 기반 마포 제약을 각 collector 내부에 고정해 기존 Tier 1~3 계약은 유지함
