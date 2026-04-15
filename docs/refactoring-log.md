# 리팩토링 로그

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
- 유지된 동작:
  - 실제 리뷰 원문 파일은 그대로 유지하고 Slack 표시 단계에서만 요약 문구를 정규화
  - approval/reject 버튼과 기존 review-ready dispatch 파일 경로는 그대로 유지
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
