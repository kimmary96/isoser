# 리팩토링 로그

## 2026-04-23 프로그램 검색/deadline audit/추천 캐시 정합화

- 변경 파일
  - `backend/routers/programs.py`
  - `backend/tests/test_programs_router.py`
  - `scripts/program_backfill.py`
  - `backend/tests/test_program_backfill.py`
  - `supabase/migrations/20260423123000_align_recommendations_cache_schema.sql`
  - `docs/current-state.md`
- 변경 내용
  - `/programs?q=` 백엔드 후처리 검색에 `category`, `category_detail`, 프론트 카테고리 라벨 alias를 포함해 비교 모달의 "카테고리 검색" 기대와 실제 검색 범위를 맞춤
  - `scripts/program_backfill.py --deadline-audit` dry-run을 추가해 `deadline` 기반 모집중 검색에서 누락될 수 있는 row를 분류하도록 함
  - Windows 콘솔에서도 audit JSON/markdown 출력이 깨지지 않도록 stdout UTF-8 설정을 추가함
  - `recommendations` 캐시 테이블에 최신 추천 캐시 컬럼과 `(user_id, program_id)` unique index를 맞추는 migration을 추가함
  - 최신 캐시 컬럼이 없는 운영 DB에서는 legacy `score`/`created_at` 캐시를 읽어 fresh recommendation fallback 전까지 완충하도록 함
- 보존한 동작
  - 기존 `search_text` 후보 축소와 short ASCII 검색 fallback 정책은 유지함
  - 추천 fresh path, 캐시 stale 판정, anonymous/default 추천 fallback은 유지함
  - deadline audit는 읽기 전용 dry-run이며 DB 값을 수정하지 않음
- 검증
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_program_backfill.py -q` 통과 (`70 passed`)
  - `scripts/program_backfill.py --deadline-audit --limit 200 --format json` 운영 dry-run 실행: 후보 248건 중 의심 245건, `work24_deadline_copied_from_end_date` 182건, `active_row_without_recruiting_deadline` 48건, `deadline_equals_end_date_review` 15건
- 리스크/후속 후보
  - 카테고리 alias 검색 추가로 검색 결과가 이전보다 넓어질 수 있어 운영 키워드별 결과 품질 확인이 필요함
  - `deadline` 누락/오매핑 row는 audit만 추가됐고 실제 backfill/apply는 별도 승인 후 진행해야 함
  - 운영 DB에 `cost_type`, `participation_time` 컬럼이 없다면 비용/참여 시간 필터는 계속 fallback 휴리스틱에 의존함

## 2026-04-23 프로필 주소 지역 필드 추가

- 변경 파일
  - `supabase/migrations/20260423100000_add_address_to_profiles.sql`
  - `frontend/app/api/dashboard/profile/route.ts`
  - `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx`
  - `frontend/app/dashboard/profile/_components/profile-hero-section.tsx`
  - `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
  - `frontend/app/dashboard/profile/page.tsx`
  - `frontend/lib/types/index.ts`
  - `docs/current-state.md`
- 변경 내용
  - `profiles`에 `address`, `region`, `region_detail` 컬럼을 추가하는 migration을 작성함
  - 프로필 편집 모달에 주소 입력을 추가하고 저장 API에서 주소 텍스트를 시·도와 시·군·구 단위로 정규화해 함께 저장하도록 함
  - 프로필 헤더에는 개인정보 노출을 줄이기 위해 원문 주소 대신 정규화된 지역 정보만 표시하도록 함
- 보존한 동작
  - 기존 이름, 희망 직무, 이메일, 전화번호, 포트폴리오, 프로필 이미지 저장 흐름은 유지함
  - migration이 적용되지 않은 환경에서는 선택 프로필 컬럼을 제외하고 기존 프로필 저장이 이어지도록 fallback을 유지함
- 리스크/후속 후보
  - 주소 파싱은 사전 기반이므로 복잡한 주소나 해외 주소는 `region`이 비어 있을 수 있음
  - 관련도 점수에 지역 가중치를 반영할 때는 서버 공용 `region_normalizer`로 분리하는 후속 리팩토링이 적합함

## 2026-04-22 programs 상단 필터 바 개편

- 변경 파일
  - `frontend/app/(landing)/programs/page.tsx`
  - `frontend/app/(landing)/programs/programs-filter-bar.tsx`
  - `frontend/lib/api/backend.ts`
  - `frontend/lib/types/index.ts`
  - `backend/routers/programs.py`
  - `backend/tests/test_programs_router.py`
  - `supabase/migrations/20260422212000_add_programs_category_detail.sql`
  - `docs/current-state.md`
  - `reports/programs-filter-bar-redesign-result.md`
- 변경 내용
  - `/programs`의 기존 왼쪽 사이드 필터를 상단 검색 중심 필터 바로 재구성함
  - 카테고리 선택은 기본 select 대신 참고 화면처럼 컬러 점, 선택 강조, 행 단위 항목을 가진 드롭다운 메뉴로 조정함
  - 카테고리 메뉴는 `웹개발`, `모바일`, `데이터·AI`, `클라우드·보안`, `IoT·임베디드·반도체`, `게임·블록체인`, `기획·마케팅·기타`, `디자인·3D`, `프로젝트·취준·창업` 항목으로 구성하고 현재 API의 큰 분류에 매핑함
  - 상단 필터 헤더의 `현재 결과` 요약 박스를 제거함
  - `programs.category_detail` migration과 backend/frontend API 파라미터를 추가해 세부 카테고리를 별도 컬럼으로 필터링할 수 있게 함
  - 카테고리 메뉴를 클라이언트 컴포넌트 상태로 전환해 항목 클릭 시 선택 표시와 hidden query 값이 즉시 바뀌게 함
  - 카테고리, 온/오프라인, 지역, 정렬을 같은 커스텀 드롭다운 디자인으로 통일하고 항목 선택 시 메뉴가 즉시 닫히도록 변경함
  - 운영 DB에 migration이 아직 적용되지 않은 환경에서는 backend가 `category_detail` 필터를 제거하고 큰 카테고리 필터로 fallback하도록 방어함
  - 검색, 카테고리, 온/오프라인, 지역, 정렬을 1차 필터로 배치하고, 최근 마감 공고 포함은 추가 필터 영역으로 이동함
  - 기존 백엔드가 지원하는 `teaching_methods`와 `sort=deadline|latest`를 URL query와 목록/count API 호출에 연결함
  - 활성 필터 chip과 초기화 버튼을 상단 필터 바 안으로 모아 현재 조건이 더 잘 보이게 함
- 보존한 동작
  - 프로그램 카드 UI, 상세 보기 `/programs/[id]`, 비교 추가 `/compare?ids=`, 지원 링크 흐름은 유지함
  - 기본값은 모집중 공고만 마감 임박순으로 노출하는 기존 정책을 유지함
  - 지원되지 않는 비용순, 고급 추천 대상, 선발 절차 세부 필터는 UI에 추가하지 않음
- 검증
  - `frontend`: `npm run lint`
  - `frontend`: `npx tsc --noEmit -p tsconfig.codex-check.json`
  - `backend`: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`
  - `agent-browser`: `http://localhost:3001/programs` 로드, Next 오류 overlay 없음, 필터/카드 주요 요소 렌더 확인
  - `Invoke-WebRequest`: `http://localhost:3001/programs` 200 응답과 카테고리 메뉴 텍스트 포함 확인
  - `Invoke-WebRequest`: `http://localhost:3000/programs` 200 응답, `현재 결과` 문구 제거, `웹개발`/`데이터·AI` 카테고리 텍스트 포함 확인
  - `Invoke-WebRequest`: `http://localhost:3000/programs?category_detail=data-ai` 200 응답과 `카테고리: 데이터·AI` 활성 chip 확인
- 추가 리팩토링 후보
  - 운영 데이터에 `cost`, `support_type`, `source` 기반 필터를 안정적으로 쿼리할 수 있게 백엔드 계약을 확장한 뒤 UI에 단계적으로 추가
  - 프로그램 카드 렌더링을 별도 `ProgramCard` 컴포넌트로 분리해 `page.tsx` 길이를 더 줄이기

# 2026-04-22 고용24/K-Startup 수집 필드 매핑 보강

- 변경 파일
  - `backend/rag/collector/work24_collector.py`
  - `backend/rag/collector/kstartup_collector.py`
  - `backend/rag/collector/program_field_mapping.py`
  - `backend/rag/collector/normalizer.py`
  - `backend/tests/test_work24_kstartup_field_mapping.py`
  - `backend/tests/test_program_source_diff_cli.py`
  - `scripts/program_source_diff.py`
  - `cowork/packets/TASK-2026-04-22-1800-program-source-field-mapping.md`
  - `cowork/packets/TASK-2026-04-22-1810-program-schema-backfill.md`
  - `reports/TASK-2026-04-22-1800-program-source-field-mapping-result.md`
  - `reports/TASK-2026-04-22-1810-program-schema-backfill-plan.md`
- 변경 내용
  - 고용24와 K-Startup API raw에 있던 기관명, 지역, 설명, 시작/종료일, 원본 링크, 비용/지원금 일부, 전화/분류/대상 상세 같은 값을 공통 normalizer row까지 보존하도록 collector mapping을 보강함
  - source별 field mapping을 `program_field_mapping.py`로 중앙화함
  - 운영 DB에 없을 수 있는 컬럼은 scheduler payload에 직접 추가하지 않고, 추적용 부가 정보는 기존 `compare_meta` JSONB에 저장하도록 제한함
  - 프로그램 ID 기준 raw → normalized → DB → API → UI 표시값 diff CLI를 추가함
  - 운영 DB schema check 결과 `raw_data`, `support_type`, `teaching_method`, `is_certified` 누락을 확인하고 별도 backfill task로 분리함
  - 고용24/K-Startup 필드 보존 회귀 테스트를 추가함
- 보존한 동작
  - 기존 source fetch, normalize, scheduler 상태 반환, `(title, source)` dedupe/upsert 흐름은 유지함
  - 기존 상세/비교 UI 계약은 바꾸지 않고 이미 참조 중인 `provider`, `location`, `description`, `start_date`, `end_date`, `source_url` 필드를 채우는 방향으로 처리함
- 검증
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_work24_kstartup_field_mapping.py -q`
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_source_diff_cli.py -q`
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_scheduler_collectors.py -q`
  - 실제 API dry-run 1건씩으로 normalized row에 상세 필드가 남는지 확인함
- 추가 리팩토링 후보
  - 운영 DB 스키마 보강 및 기존 row backfill task 실행
  - 상세/비교 UI의 `정보 없음`/`데이터 미수집`/`매핑 누락` 표시 기준 source trace 기반 분리

## 2026-04-22 Tier 4 crawler diagnostics follow-up

- 수정 파일:
  - `backend/rag/collector/tier4_collectors.py`
  - `backend/rag/collector/scheduler.py`
  - `backend/tests/test_tier4_collectors.py`
  - `backend/tests/test_scheduler_collectors.py`
  - `docs/current-state.md`
- 변경 내용:
  - Tier 4 district collector가 URL별 요청 성공 수, 요청 실패 수, parse-empty 수를 `last_collect_message`에 남기도록 보강함
  - scheduler dry-run 결과 메시지에 raw item 수, dedupe 후 row 수, collector 진단 메시지를 포함해 운영자가 0건/중복 제거/selector 의심을 더 빨리 구분할 수 있게 함
  - Tier 4 collector 진단 메시지와 scheduler dry-run 메시지 계약을 테스트로 고정함
- 유지된 동작:
  - collector `.collect()` 반환 형식, normalize 계약, Tier 1~4 정렬, upsert 동작은 변경하지 않음
  - Tier 4 수집 대상과 selector 자체는 변경하지 않음
- 검증 메모:
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_tier4_collectors.py backend/tests/test_scheduler_collectors.py -q`
  - Tier 4 collector 6종 live dry-run 확인: 6종 모두 `status=dry_run`, `failed_count=0`

## 2026-04-20 docs fast-path lightweight verification

- 수정 파일:
  - `watcher.py`
  - `tests/test_watcher.py`
  - `docs/current-state.md`
- 변경 내용:
  - docs 계열 task는 inspector와 implementer까지만 Codex를 실행하고, verifier 단계는 watcher가 경량 verification report를 직접 기록하도록 줄였다.
  - 코드 task의 기존 3단계 supervisor 흐름은 그대로 유지했다.
- 유지된 동작:
  - `reports/<task-id>-supervisor-inspection.md`, `reports/<task-id>-result.md`, `reports/<task-id>-supervisor-verification.md` artifact 구조는 유지된다.
  - `review-required` 분기와 코드 task 검증 강도는 유지된다.
- 검증 메모:
  - `tests/test_watcher.py`에 docs fast-path 전용 회귀 테스트를 추가했다.

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

## 2026-04-20 운영용 Notion / Slack 배포 템플릿 추가

- 수정 파일:
  - `docs/launch-checklist-notion.md`
  - `docs/launch-checklist-slack.md`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - Notion에 바로 붙여 넣어 쓸 수 있는 체크박스형 배포 체크리스트를 추가함
  - Slack 운영 채널에 바로 붙여 넣어 쓸 수 있는 배포 점검 결과, 승인 요청, 조건부 배포, 배포 보류, 배포 완료 템플릿을 추가함
  - 체크 결과가 배포 가능/조건부 배포/배포 보류 판단으로 자연스럽게 이어지도록 문구를 정리함
- 유지된 동작:
  - 코드 동작 변경 없음

## 2026-04-20 설정 상태 진단 health endpoint 추가

- 수정 파일:
  - `frontend/lib/server/env-status.ts`
  - `frontend/app/api/health/config/route.ts`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- 변경 내용:
  - Supabase, Gemini, Upstash 설정 존재 여부와 backend `/health` 연결 상태를 한 번에 확인할 수 있는 프론트 health endpoint를 추가함
  - URL, 토큰 같은 민감정보 원문은 그대로 노출하지 않고 설정 여부와 backend host 정도만 보여주도록 제한함
- 유지된 동작:
  - 기존 사용자 기능, 로그인, 저장, AI 응답 계약은 바꾸지 않음
- 검증 메모:
  - `frontend`: `npm run lint` 통과
  - `frontend`: `npx tsc -p tsconfig.codex-check.json --noEmit` 통과
  - `frontend`: `npm run build` 통과

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

- 2026-04-21: `backend/chains/pdf_parse_utils.py`, `backend/chains/pdf_sentence_scorer.py`, `backend/tests/test_pdf_chain.py`, `backend/tests/test_pdf_sentence_scorer.py`
  - 박준호 시연용 이력서 템플릿 검증 중 `프로젝트` 섹션이 프로필 경력으로 이어 붙는 문제를 발견해, 경력 섹션 종료 헤더에 `project/projects/프로젝트`를 추가함
  - `(5인 팀: PM 1 / ...)` 팀 구성 표기를 `(5인: ...)`와 동일하게 인식하도록 역할/팀 정규식을 확장함
  - `기능 개발` 같은 개발형 문장은 기여내용으로 분류하되, `백엔드 개발자` 같은 역할명 단독 줄은 기여내용에서 제외하도록 scorer 기준을 보강함
  - scorer를 `classify_activity_sentence()` 점수 기반 분류 함수와 호환 래퍼(`looks_like_intro_line`, `looks_like_contribution_line`)로 재구성해 기준 조정과 테스트 추가가 쉬운 구조로 리팩토링함
  - `backend/chains/pdf_parser_rules.py`를 추가해 활동 타입 alias, 경력/비경력/종료 섹션 헤더, 소개/기여/역할명 rule table을 한 곳에서 관리하도록 분리함
  - `SentenceScoreWeights`와 `SENTENCE_SCORE_WEIGHTS`를 추가해 scorer 점수값과 metric 패턴도 rule table에서 관리하도록 후속 리팩토링함
  - 박준호 백엔드/김지원 PM 포트폴리오 원문을 `backend/tests/fixtures/pdf_texts/` fixture로 분리하고, role-only 직무명 사전과 scorer reason을 `metric_signal`/`keyword_signal`/`role_only` 등으로 세분화함
  - `ISOSER_PDF_PARSE_DEBUG_SCORER=1` 옵션을 추가해 실제 파싱 중 문장 분류 kind/score/reason을 debug log로 남길 수 있게 하고, PDF expected snapshot fixture를 `backend/tests/fixtures/pdf_expected/`에 추가해 템플릿별 회귀 테스트를 parameterize함
  - 박준호 실제 PDF를 `backend/tests/fixtures/pdf_files/park_backend_resume.pdf`에 추가하고, PyMuPDF 텍스트 추출부터 source fallback 파싱, expected snapshot 비교까지 e2e 회귀 테스트로 고정함

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
- 2026-04-17: `watcher.py`, `tests/test_watcher.py`
  - 같은 blocked/runtime/push fingerprint에 대한 auto-remediation packet이 이미 active queue에 있으면 watcher가 alert 파일과 ledger는 계속 남기되 중복 Slack 알림은 suppress 하도록 조정함
  - repeated alert auto-remediation이 이미 진행 중인 동안 같은 root cause가 채널을 다시 paging 하는 운영 노이즈를 줄이는 데 초점을 맞춤
- 2026-04-17: `backend/rag/programs_rag.py`, `backend/routers/programs.py`, `frontend/app/api/dashboard/recommend-calendar/route.ts`, `frontend/lib/api/app.ts`, `frontend/lib/types/index.ts`
  - 추천 점수를 `관련도 0.6 + 마감 임박도 0.4` 하이브리드 스코어로 통일하고, 캐시 조회 시에도 현재 deadline 기준으로 urgency/final score를 다시 계산해 구버전 cache가 정렬을 망치지 않도록 정리함
  - 캘린더 전용 `GET /recommend/calendar` 및 BFF `GET /api/dashboard/recommend-calendar`를 추가해 `deadline`, `d_day_label`, `relevance_score`, `urgency_score`, `final_score`를 함께 전달하도록 분리함
## 2026-04-16 recommendation backend stage3

- changed files:
  - `backend/routers/programs.py`
  - `backend/rag/recommendation_rules_seed.py`
  - `backend/.env.example`
  - `backend/tests/test_programs_router.py`
  - `backend/tests/test_recommendation_rules_seed.py`
  - `supabase/migrations/20260416132000_fix_recommendations_cache_contract.sql`
  - `docs/current-state.md`
- why:
  - move `/programs/recommend` to the guide's db-first flow
  - use `recommendation_rules` before live RAG
  - cache personalized results by `profile_hash + query_hash`
  - preserve cached `reason` / `fit_keywords`
  - document exact backend env key names and where to obtain them
- preserved behaviors:
  - anonymous users still get default program recommendations
  - filtered program list/count routes keep the same API contract
  - personalized fallback still returns default programs when profile/activity data is insufficient
- risks / follow-ups:
  - live Supabase migration application and Work24/Gemini integration are still unverified without secrets
  - `recommendations` uniqueness changed to `user_id + query_hash + program_id`, so live migration order must be checked before rollout

## 2026-04-16 coach recommendation context

- changed files:
  - `backend/routers/coach.py`
  - `backend/chains/coach_graph.py`
  - `backend/tests/test_coach_e2e.py`
  - `backend/tests/test_coach_sessions_api.py`
  - `docs/current-state.md`
- why:
  - load the latest cached recommended programs for signed-in users before running the coach graph
  - inject recommendation titles, reasons, and fit keywords into the coach prompt as additional grounding context
  - keep coach feedback working even when Supabase or the recommendation cache is unavailable
- preserved behaviors:
  - intro-generate mode still skips recommendation loading and session persistence
  - feedback mode still works for anonymous users and for users with no cached recommendations
  - existing coach session persistence contract is unchanged
- risks / follow-ups:
  - the prompt now depends on recommendation cache freshness, so stale `recommendations` rows can influence coach tone until live invalidation is verified
  - Gemini fallback responses still ignore recommendation context because fallback generation remains heuristic-only

## 2026-04-16 supabase migration audit follow-up

- changed files:
  - `supabase/migrations/20260416143000_reconcile_coach_sessions_schema.sql`
  - `supabase/README.md`
  - `docs/recommendation/program-recommendation-checklist.md`
  - `docs/recommendation/recommendation-guide.md.md`
  - `docs/current-state.md`
- why:
  - reconcile legacy `coach_sessions` environments created by `001_init_schema.sql` with the current coach repository contract without editing historical migrations
  - document the canonical migration chains for `programs`, `recommendations`, `recommendation_rules`, and `coach_sessions`
  - record which migration files are now treated as stale drafts versus active schema chain references
- preserved behaviors:
  - existing recommendation backend and coach integration logic are unchanged
  - historical migration files remain untouched; the fix is additive through a new corrective migration
  - fresh environments can keep using the current canonical migration chain without rewriting old files
- risks / follow-ups:
  - live DB verification is still pending because `supabase_migrations.schema_migrations` and actual table columns were not queried in this turn
  - environments that already ran only `001_init_schema.sql` still need `20260416143000_reconcile_coach_sessions_schema.sql` applied before coach session writes are considered safe

## 2026-04-16 recommendation BFF and dashboard contract

- changed files:
  - `frontend/app/api/dashboard/recommended-programs/route.ts`
  - `frontend/lib/types/index.ts`
  - `frontend/lib/api/app.ts`
  - `frontend/app/dashboard/page.tsx`
  - `docs/recommendation/program-recommendation-checklist.md`
  - `docs/recommendation/recommendation-guide.md.md`
  - `docs/current-state.md`
- why:
  - preserve recommendation `reason`, `fit_keywords`, and `score` at the BFF layer instead of dropping them
  - expose a dedicated recommended program contract to the dashboard client
  - render recommendation reasons and fit keyword chips in the dashboard UI
  - document the non-live collaboration risks of using personal API keys against shared services
- preserved behaviors:
  - dashboard recommendation loading and empty states remain in place
  - the backend recommendation API contract is unchanged
  - live verification is still deferred; this change is local-contract and UI focused
- risks / follow-ups:
  - actual logged-in dashboard rendering still needs live verification against a real backend response
  - writing recommendation cache rows with a personal Gemini key against a shared Supabase project can affect what other collaborators read from `recommendations`

## 2026-04-20 coach and recommendation harness baseline

- changed files:
  - `docs/recommendation/ai-harness-plan.md`
  - `backend/tests/test_ai_smoke.py`
  - `pytest.ini`
  - `docs/current-state.md`
- why:
  - define what "harness engineering" means for the chatbot and recommendation flows
  - add an executable P0 baseline that smoke-tests `/programs/recommend` and `/coach/feedback`
  - separate already-implemented backend smoke coverage from still-missing frontend/browser harness work
- preserved behaviors:
  - production router logic is unchanged
  - existing unit and API tests remain the primary regression net for detailed branching
- risks / follow-ups:
  - frontend BFF and dashboard rendering still do not have an automated runner
  - recommendation invalidation smoke after profile/activity mutations is still pending

## 2026-04-20 public preview routes for in-app browser

- changed files:
  - `frontend/app/api/preview/recommended-programs/route.ts`
  - `frontend/app/api/preview/coach/route.ts`
  - `frontend/app/preview/page.tsx`
  - `frontend/app/preview/_components/preview-shell.tsx`
  - `frontend/app/preview/recommendation/page.tsx`
  - `frontend/app/preview/recommendation/recommendation-preview-client.tsx`
  - `frontend/app/preview/coach/page.tsx`
  - `frontend/app/preview/coach/coach-preview-client.tsx`
  - `docs/current-state.md`
- why:
  - create login-free local preview routes for the recommendation cards and coach feedback flow so the Codex in-app browser can be used during UI iteration
  - keep preview traffic separate from the dashboard BFF and signed-in routes
  - keep the preview endpoints dev-only by returning `404` in production mode
- preserved behaviors:
  - existing dashboard recommendation and coach routes are unchanged
  - preview coach requests remain anonymous and do not persist user sessions
  - preview recommendation cards still use the real backend `/programs/recommend` response shape
- risks / follow-ups:
  - preview recommendation uses anonymous recommendations, so personalized dashboard behavior still needs regular-browser verification
  - preview coach does not include signed-in recommendation context because in-app browser login state is intentionally avoided

## 2026-04-20 unified assistant preview and harness follow-up

- changed files:
  - `backend/main.py`
  - `backend/routers/assistant.py`
  - `backend/tests/test_assistant_router.py`
  - `backend/tests/test_ai_smoke.py`
  - `backend/tests/test_programs_router.py`
  - `frontend/app/api/preview/assistant/route.ts`
  - `frontend/app/preview/page.tsx`
  - `frontend/app/preview/assistant/page.tsx`
  - `frontend/app/preview/assistant/assistant-preview-client.tsx`
  - `frontend/lib/api/app.ts`
  - `frontend/lib/types/index.ts`
  - `docs/recommendation/ai-harness-plan.md`
  - `docs/current-state.md`
- why:
  - add one minimal assistant entry point that can reuse the already-shipped coach and recommendation routes instead of introducing a second AI stack
  - give the chatbot and recommendation work a single local preview URL so implementation and manual QA do not depend on dashboard login
  - extend the smoke baseline to cover the new assistant route and repair the cached calendar recommendation test setup to match the current route contract
  - restore the dashboard calendar export aliases needed for a clean frontend production build
- preserved behaviors:
  - `/coach/feedback`, `/programs/recommend`, and `/programs/recommend/calendar` keep their existing request and response contracts
  - the new preview route is additive and stays dev-only
  - existing signed-in dashboard flows remain unchanged
- risks / follow-ups:
  - assistant intent detection is currently keyword-based, so ambiguous prompts can still fall into `clarify` or the wrong tool path
  - the preview surface is anonymous, so personalized recommendation cache behavior and signed-in coach context still need dashboard-level verification
  - the real dashboard coach inputs were not yet unified with the assistant entry point in this step

## 2026-04-20 dashboard coach wiring through assistant

- changed files:
  - `backend/routers/assistant.py`
  - `backend/tests/test_assistant_router.py`
  - `frontend/app/api/dashboard/activities/coach/route.ts`
  - `frontend/app/api/dashboard/cover-letters/coach/route.ts`
  - `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
  - `frontend/app/dashboard/cover-letter/_hooks/use-cover-letter-detail.ts`
  - `frontend/lib/api/app.ts`
  - `frontend/lib/types/index.ts`
  - `docs/current-state.md`
- why:
  - route the real activity and cover-letter coach inputs through `/assistant/message` instead of the older direct coach call path
  - add `preferred_intent` and safer mixed-prompt handling so dashboard coach surfaces can force coach behavior while the preview assistant remains reusable
  - keep the dashboard UI response shape unchanged by unwrapping `coach_result` inside the dashboard BFF routes
- preserved behaviors:
  - dashboard coach panels still read and render `CoachFeedbackResponse`
  - coach session continuity still uses the backend coach session contract through `session_id` and `updated_history`
  - preview assistant behavior and recommendation routes remain additive
- risks / follow-ups:
  - there is still no automated browser-level signed-in dashboard run, so this step is verified by backend tests and frontend build rather than a full UI robot
  - dashboard coach surfaces currently force `preferred_intent="coach"`, so they do not yet expose recommendation or clarify branches inside those panels
- 2026-04-20: `scripts/watcher_shared.py`, `watcher.py`, `cowork_watcher.py`, `scripts/create_task_packet.py`, `docs/automation/task-packets.md`, `docs/rules/task-packet-template.md`, `docs/current-state.md`
  - `spec_version`이 있는 packet을 Supervisor 표준 spec으로 간주하고 `request_id`, `execution_path`, `allowed_paths`, `blocked_paths`, `fallback_plan`, `rollback_plan`, `dedupe_key` 등을 watcher/cowork watcher가 실행 전에 검증하도록 보강함
  - `allowed_paths`와 `blocked_paths` 중복, 허용되지 않은 `execution_path`/`risk_level` 같은 모순 frontmatter를 cowork review 단계와 local execution 단계에서 조기 차단하도록 정리함
  - `scripts/create_task_packet.py --supervisor-spec` 옵션을 추가해 확장 frontmatter를 가진 안전한 packet 초안을 더 쉽게 만들 수 있게 했고, 관련 운영 문서를 현재 런타임 규칙에 맞춰 갱신함
- 2026-04-21: `frontend/app/dashboard/page.tsx`, `frontend/app/dashboard/portfolio/page.tsx`, `docs/presentation/2026-04-21-demo-assets-sheet.md`, `docs/current-state.md`
  - 발표 전 P0 기준으로 캘린더 일정 적용과 포트폴리오 생성 구현 여부를 확인하고, 퍼널을 끊는 두 지점만 최소 변경으로 보강함
  - 대시보드는 캘린더 전용 추천 BFF를 사용하고 추천 카드에서 `캘린더에 적용` CTA를 제공하며, 적용된 일정은 최대 3개까지 로컬 저장해 재진입 시 유지함
  - 포트폴리오 페이지는 직접 진입 시 준비중 문구에서 멈추지 않고 성과 저장소 활동을 선택해 포트폴리오 초안을 생성할 수 있게 함
- 2026-04-21: `supabase/migrations/20260421160000_add_calendar_and_portfolio_persistence.sql`, `frontend/app/api/dashboard/calendar-selections/route.ts`, `frontend/app/api/dashboard/portfolios/route.ts`, `frontend/lib/api/app.ts`, `frontend/lib/types/index.ts`
  - 캘린더 적용 상태를 서버에 저장하기 위해 `calendar_program_selections` 테이블과 dashboard BFF를 추가함
  - 포트폴리오 생성 결과를 기존 `portfolios` 테이블의 `portfolio_payload` JSONB 컬럼에 저장하고 `/dashboard/portfolio`에서 저장 초안을 다시 열 수 있게 함
  - 랜딩 A 타입 오류는 현재 신규 섹션을 보존한 채 누락된 `compareCards` import를 복구해 타입체크 통과 상태로 정리함
- 2026-04-21: `TASK-2026-04-21-0649-landing-a-visual-revamp`
  - `frontend/app/(landing)/landing-a` 내부에서 랜딩 A 카피와 섹션 순서를 이력 기반 추천/지원 준비 플랫폼 프레이밍으로 재배치함
  - 기능 맛보기 4개 카드는 `frontend/public/landing-a/` placeholder SVG 파일을 참조하도록 구성해 추후 같은 파일명 교체만으로 실제 캡처 전환이 가능하게 함
  - 기존 `listPrograms`/`getProgramCount`, 검색/칩 필터, 프로그램 카드, 로그인 네브바, 푸터/광고 슬롯 동작은 유지함
  - review-required 후속 조치로 히어로 직후 요약 섹션을 `LandingADeadlineSummarySection`으로 명확히 하고 `D-Day 요약`/`모집 상태`/`다음 액션` 라벨을 추가해 packet의 D-Day/마감 요약 역할과 실제 렌더링을 맞춤
  - 수동 리뷰 피드백 반영으로 landing-a 렌더링에서 상단 티커/네브바, D-Day 요약, 문제/해결 비교, 추천 정확도, KPI 뼈대 섹션을 제거하고, 6단계 지원 준비 흐름은 유지한 채 온보딩 톤의 네이비 히어로와 컴팩트 live board 중심 구조로 축소함
  - 히어로 주 CTA는 로그인 확인 전 `/login`, 로그인 확인 후 `/dashboard#recommend-calendar`로 이동하도록 바꾸고, 대시보드 캘린더 위치에 `recommend-calendar` 앵커를 추가함
  - 후속 수동 리뷰 피드백으로 landing-a 전용 헤더를 복구해 `프로그램 상세`(`/programs`), `비교`(`/compare`), `대시보드`(`/dashboard#recommend-calendar`), 로그인/프로필 이동을 제공하고, 로그인된 사용자 프로필 버튼은 `/dashboard/profile`로 바로 이동하게 함
- 2026-04-21: `frontend/app/api/dashboard/recommend-calendar/route.ts`, `frontend/app/dashboard/portfolio/page.tsx`, `docs/current-state.md`, `docs/presentation/2026-04-21-demo-assets-sheet.md`
  - 발표 전 P0 안정화로 캘린더 추천 응답이 빈 배열이거나 백엔드 fetch가 실패할 때 공개 프로그램 마감순 fallback을 Supabase에서 직접 적용해 `/dashboard`가 `추천 프로그램이 없습니다` 또는 `fetch failed`에서 멈추지 않게 함
  - 포트폴리오 초안 미리보기 화면에 브라우저 인쇄 기반 `PDF로 저장` 버튼을 추가해 발표용 최소 PDF 저장 흐름을 확보함
  - Supabase OAuth 설정에 맞춰 로컬 프론트 검증 포트를 `localhost:3000` 기준으로 재고정함
- 2026-04-21: `frontend/components/MiniCalendar.tsx`, `frontend/app/dashboard/page.tsx`, `docs/current-state.md`
  - 발표 전 P0 안정화로 `캘린더에 적용` 클릭 결과가 텍스트 목록에만 남지 않도록, 적용된 프로그램을 해당 마감 날짜 셀 안에 녹색 `적용` 라벨과 프로그램명으로 직접 표시함
  - 달력 상단에 `YYYY년 M월` 중앙 라벨과 이전/다음 월 이동 버튼을 추가하고, 적용된 프로그램의 마감월로 자동 이동하게 함
  - 기존 날짜 클릭 필터와 추천 카드 목록 동작은 유지함
- 2026-04-21: `frontend/app/api/dashboard/calendar-selections/route.ts`, `docs/current-state.md`
  - 발표 전 P0 안정화로 캘린더 적용 저장 API가 쿠키 세션으로 사용자를 확인한 뒤 서버 쪽 service role client를 사용해 `calendar_program_selections`를 저장/조회하도록 보강함
  - 로컬 발표 환경에서는 service role key가 `frontend/.env.local`에 없고 `backend/.env`에만 있어도 서버 route가 해당 값을 읽어 저장을 이어가도록 처리함
- 2026-04-21: `frontend/app/(landing)/landing-c/page.tsx`, `docs/current-state.md`
  - 제공된 `이소서 Landing.html` reference를 신규 `/landing-c` Next.js 페이지로 이식함
  - 원본의 스플릿 히어로, 프로그램 피드, 기능 미리보기, 로그인 이후 여정, 최종 CTA 구조를 유지하면서 실제 `/programs`, `/compare`, `/login`, `/dashboard#recommend-calendar`, `/programs/[id]` 라우트로 액션을 연결함
  - 기존 landing-a/b 기본 진입과 공통 라우트 동작은 변경하지 않고, 프로그램 목록은 기존 `listPrograms`/`getProgramCount` backend helper를 재사용함
- 2026-04-21: `frontend/app/(landing)/landing-a/_components.tsx`, `frontend/app/(landing)/landing-a/_navigation.tsx`, `frontend/app/(landing)/landing-a/_hero.tsx`, `frontend/app/(landing)/landing-a/_program-feed.tsx`, `frontend/app/(landing)/landing-a/_support-sections.tsx`, `frontend/app/(landing)/landing-a/_auth.ts`, `frontend/app/(landing)/landing-a/_shared.ts`, `frontend/app/(landing)/landing-a/_style-tag.tsx`, `docs/current-state.md`
  - landing-a의 비대해진 `_components.tsx`를 기존 import 호환용 export 허브로 축소하고, 헤더/네비게이션, 히어로, 검색·프로그램 피드, 하단 지원 섹션, 스타일 태그를 섹션 단위 파일로 분리함
  - 프로그램 deadline/score/link helper는 `_shared.ts`로, 헤더/히어로의 로그인 상태 조회는 `useLandingAUser()` hook으로 분리해 중복 인증 조회 로직을 줄임
  - 페이지 조립 순서, 공개 링크, 검색/칩 필터, 프로그램 카드, CTA/푸터 렌더링은 유지함
- 2026-04-21: `frontend/app/(landing)/landing-a/_program-feed.tsx`, `frontend/app/(landing)/landing-a/_navigation.tsx`, `docs/current-state.md`
  - `LandingAProgramsSection` 내부의 프로그램 카드 렌더를 `ProgramCard`로 분리해 feed 섹션의 조건 렌더링과 카드 UI 책임을 나눔
  - `LandingANavBar`와 `LandingAHeader`의 브랜드 마크, 프로필/로그인 액션, 랜딩 A 헤더 링크 패턴을 `BrandMark`, `AuthAction`, `UserAvatar`, `landingAHeaderLinks`로 정리해 중복 JSX를 줄임
  - 기존 링크 목적지, 모바일 라벨, 로그인/프로필 분기, 프로그램 카드 버튼 동작은 유지함
- 2026-04-21: `frontend/app/(landing)/landing-a/_hero.tsx`, `frontend/app/(landing)/landing-a/_program-feed.tsx`, `docs/current-state.md`
  - `LandingAFilterBar`의 칩 버튼 상태별 class 분기를 `getChipButtonClass()`로 분리해 필터 렌더링 map 내부 조건식을 단순화함
  - `LandingAHeroSection`의 live board 프로그램 카드 렌더를 `HeroProgramSignalCard`로 분리하고, 히어로 통계 3개는 `heroStats` 배열 기반 렌더링으로 정리함
  - 기존 히어로 CTA, 캘린더 링크, live board 텍스트, 검색/칩 필터 동작은 유지함
- 2026-04-21: `frontend/app/(landing)/landing-a/page.tsx`, `docs/current-state.md`
  - landing-a 칩 `AI·데이터`, `IT·개발`, `경영`이 백엔드 저장 카테고리와 다른 문자열을 exact match로 요청해 0건이 되는 문제를 확인함
  - 사용자 노출 라벨은 유지하되 API 요청 카테고리를 각각 `AI`, `IT`, `경영`으로 매핑해 기존 프로그램 목록/count endpoint와 일치시킴
  - `AI·데이터`와 `IT·개발` 필터 URL에서 hero count/live board가 정상 표시되는 것을 로컬 화면으로 확인함
- 2026-04-22: `frontend/app/page.tsx`, `frontend/middleware.ts`, `frontend/app/auth/callback/route.ts`, `frontend/app/(auth)/login/page.tsx`, `frontend/app/(landing)/landing-c/page.tsx`, `docs/current-state.md`, `docs/auth/supabase-auth-local.md`, `docs/auth/supabase-auth-production.md`
  - 메인 랜딩 기본 진입점을 `/landing-a`에서 `/landing-c`로 전환하고, 루트 OAuth 유입과 로그인 완료 기본 복귀도 `/landing-c` 기준으로 맞춤
  - landing-c의 AI/IT/경영 칩 필터를 백엔드 저장 카테고리(`AI`, `IT`, `경영`)로 매핑해 필터 결과가 끊기지 않도록 보정함
  - landing-c의 시작/추천 CTA를 `/login?redirectedFrom=/dashboard` 또는 `/dashboard#recommend-calendar` 흐름으로 연결하고, 워크스페이스 버튼의 목적지를 라벨과 일치시킴
- 2026-04-22: `frontend/lib/routes.ts`, `frontend/lib/program-filters.ts`, `frontend/app/page.tsx`, `frontend/middleware.ts`, `frontend/app/api/auth/google/route.ts`, `frontend/app/auth/callback/route.ts`, `frontend/app/(auth)/login/page.tsx`, `frontend/app/(landing)/landing-a/page.tsx`, `frontend/app/(landing)/landing-a/_content.ts`, `frontend/app/(landing)/landing-a/_navigation.tsx`, `frontend/app/(landing)/landing-c/page.tsx`, `docs/current-state.md`, `docs/auth/supabase-auth-local.md`, `docs/auth/supabase-auth-production.md`
  - `DEFAULT_PUBLIC_LANDING`, 추천 캘린더 경로, 로그인/OAuth href helper를 `frontend/lib/routes.ts`로 공통화해 landing-c 기본 진입과 인증 복귀 경로 drift를 줄임
  - 랜딩 A/C 칩 목록과 카테고리/지역 API 매핑을 `frontend/lib/program-filters.ts`로 공통화함
  - 로그인 redirect가 `/dashboard#recommend-calendar` 같은 hash target을 `redirectedFrom`/OAuth `next`로 보존하도록 하고, landing-c의 추천 CTA를 해당 helper로 연결함
  - landing-c 상단 헤더를 landing-a 기존 헤더 컴포넌트로 교체해 공개 랜딩 헤더 UI를 통일함
- 2026-04-22: `frontend/components/landing/LandingHeader.tsx`, `frontend/components/landing/program-card-helpers.ts`, `frontend/app/(landing)/landing-a/_navigation.tsx`, `frontend/app/(landing)/landing-a/_program-feed.tsx`, `frontend/app/(landing)/landing-a/_shared.ts`, `frontend/app/(landing)/landing-c/page.tsx`, `frontend/lib/routes.test.ts`, `frontend/lib/program-filters.test.ts`, `frontend/package.json`, `frontend/package-lock.json`, `docs/current-state.md`
  - 공개 랜딩 헤더 구현을 `frontend/components/landing/LandingHeader.tsx`로 이동해 landing-a/c가 같은 헤더 UI와 인증 CTA 로직을 사용하도록 정리함
  - 랜딩 A/C 프로그램 카드에서 공유하는 deadline, href, score, tag normalization helper를 `frontend/components/landing/program-card-helpers.ts`로 분리함
  - Vitest를 dev dependency와 `npm test` 스크립트로 추가하고, `routes.ts`와 `program-filters.ts`의 기본 랜딩, 내부 경로 검증, hash target 보존, 칩 매핑 단위 테스트를 추가함
- 2026-04-22: `frontend/package.json`, `frontend/package-lock.json`, `docs/current-state.md`, `reports/TASK-2026-04-22-landing-page-c-change-result.md`
  - 리스크 관리 후속으로 Next.js와 `eslint-config-next`를 `15.5.15`로 업그레이드해 `npm audit --omit=dev` 기준 production 취약점 0건 상태로 정리함
  - `npm test`, `npm run lint`, `npx tsc -p tsconfig.codex-check.json --noEmit`, `npm run build`를 모두 통과해 패치 업그레이드의 기본 회귀 위험을 확인함
- 2026-04-22: `frontend/app/(landing)/landing-c/page.tsx`, `docs/current-state.md`, `reports/TASK-2026-04-22-landing-page-c-change-result.md`
  - landing-c 프로그램 카드를 요약/태그/이소서 관련도 중심에서 제목, 운영기관, 마감, 지원 혜택, 운영 방식, `과정 보기` CTA 중심의 정보형 카드로 재구성함
  - 상단 이미지 영역은 추가하지 않고 기존 검색/칩 필터, 프로그램 상세 이동, 공통 랜딩 헤더 동작은 유지함
- 2026-04-22: `frontend/app/(landing)/landing-c/page.tsx`, `frontend/lib/types/index.ts`, `docs/current-state.md`
  - landing-c Live Board 문구를 `추천 공고 N건`으로 바꾸고, Opportunity feed와 별도 모집중 마감순 목록에서 고용24, 창업진흥원/K-Startup, 새싹/SeSAC 공고를 각 1개씩 고르도록 조정함
  - 각 소스의 공고는 마감 임박순으로 선택되며 마감일이 지난 공고는 모집중 목록에서 제외되어 다음 후보로 자동 교체되도록 함
  - Opportunity feed 카드는 제목, 운영기관, 훈련 기간을 본문으로 두고 훈련비, 지역, 내배카 필수, 만족도를 태그로 표시하며, `과정 보기` 옆에 `/compare?ids=` 비교 버튼을 추가함
- 2026-04-22: `scripts/program_backfill.py`, `backend/routers/programs.py`, `frontend/app/(landing)/programs/[id]/page.tsx`, `frontend/lib/api/backend.ts`, `frontend/lib/types/index.ts`, `backend/tests/test_program_backfill.py`, `docs/current-state.md`
  - 고용24/K-Startup 기존 `programs` row를 source 고유 식별자 기준으로 보강하는 dry-run/apply 백필 CLI를 추가함
  - 상세페이지 전용 `GET /programs/{program_id}/detail` 응답 모델을 추가해 목록/비교와 다른 상세 필드 계약을 분리함
  - 상세페이지는 새 detail 응답을 사용하고, 값이 없는 상세 섹션은 `정보 없음` 문구 남발 대신 섹션 단위로 숨기도록 조정함
  - 운영 DB 활성 후보에 대해 백필을 적용해 K-Startup/고용24 샘플 row의 기관, 지역, 설명, 일정, 원본 링크가 상세 API와 상세페이지에 노출될 수 있게 함
- 2026-04-22: `backend/tests/test_programs_router.py`
  - 상세 응답 계약 회귀 테스트를 추가해 K-Startup의 `start_date/end_date`는 신청 기간으로, 고용24의 `start_date/end_date`는 운영 기간으로 매핑되는 동작을 고정함
  - 원본 링크 우선순위, 지원 대상, 수강료/지원금, 정원 잔여 계산, 연락처 노출 같은 상세페이지 핵심 필드 매핑도 Supabase 호출 없이 검증하도록 보강함
- 2026-04-22: `frontend/app/(landing)/landing-c/page.tsx`, `frontend/lib/routes.ts`, `frontend/lib/routes.test.ts`, `docs/current-state.md`
  - landing-c 히어로의 `지금 지원 가능한 프로그램 보기` CTA 옆에 `내 이력 등록` 버튼을 추가함
  - 온보딩 PDF 이력 등록 경로를 `ONBOARDING_RESUME_IMPORT = "/onboarding"` 상수로 추가하고, 버튼은 `getLoginHref(ONBOARDING_RESUME_IMPORT)`를 사용해 로그인 후 온보딩으로 복귀하도록 연결함
  - routes 단위 테스트에 온보딩 redirect href 생성을 추가해 인증 복귀 경로 회귀를 고정함
- 2026-04-22: `frontend/app/(landing)/landing-c/page.tsx`, `docs/current-state.md`
  - landing-a의 6단계 순환 흐름 섹션을 landing-c의 Opportunity feed와 Career Asset Workspace 사이에 추가함
  - landing-c의 흰 패널, 얇은 보더, 차분한 surface 카드 톤에 맞춰 시각 스타일을 조정하고 기존 section order와 CTA 동작은 유지함
- 2026-04-22: `frontend/app/(landing)/landing-c/page.tsx`, `docs/current-state.md`
  - landing-c의 기존 Journey 섹션을 제거하고 Circular flow 섹션을 해당 위치로 이동해 흐름 설명 섹션 중복을 줄임
  - Opportunity feed 다음에는 Career Asset Workspace가 바로 이어지고, 기능 미리보기 뒤에 Circular flow가 노출되도록 section order를 정리함
- 2026-04-22: `frontend/components/landing/LandingHeader.tsx`, `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/[id]/page.tsx`, `frontend/app/(landing)/compare/page.tsx`, `frontend/app/(landing)/landing-b/page.tsx`, `frontend/app/dashboard/layout.tsx`, `docs/current-state.md`
  - landing-c에서 쓰는 공통 `LandingHeader`를 프로그램 목록, 프로그램 상세, 비교, landing-b, 대시보드 레이아웃에도 적용해 상단 헤더 UI를 통일함
  - `LandingHeader`에 자체 CSS 변수 fallback을 추가해 landing-c가 아닌 화면에서도 동일한 색상/보더/CTA 스타일을 유지하도록 보강함
  - 대시보드 사이드바 sticky offset과 높이 계산을 단일 공통 헤더 높이에 맞춰 조정하고, 구형 `LandingATickerBar`/`LandingANavBar` 직접 렌더링을 제거함
- 2026-04-22: `backend/rag/collector/work24_detail_parser.py`, `scripts/program_backfill.py`, `backend/tests/test_program_backfill.py`, `docs/current-state.md`
  - `program_backfill.py` 안에 있던 고용24 상세 HTML 파싱 책임을 `work24_detail_parser.py`로 분리함
  - 백필 스크립트는 source URL과 title을 넘겨 상세 필드 dict를 받아 `SourceRecord`로 감싸는 역할만 남겨 책임을 줄임
  - 기존 고용24 상세 fallback 테스트는 새 파서 모듈의 HTTP mock 경로를 사용하도록 갱신해 동작 유지 여부를 확인함
- 2026-04-22: `backend/rag/collector/base_api_collector.py`, `backend/rag/collector/work24_collector.py`, `backend/rag/collector/program_field_mapping.py`, `backend/rag/collector/scheduler.py`, `backend/routers/programs.py`, `supabase/migrations/20260422190000_add_programs_source_unique_key.sql`
  - 고용24 collector를 고정 page limit 대신 OpenAPI `scn_cnt` 기반 full sync로 전환해 수집 범위 밖 기관명 검색 누락을 줄임
  - 고용24/K-Startup normalized row에 `source_unique_key`를 추가하고, scheduler는 이 키를 우선 upsert 기준으로 사용하며 migration 미적용 운영 DB에서는 legacy conflict fallback으로 저장을 계속하도록 보강함
  - `/programs?q=` 검색은 Supabase 1,000건 반환 제한을 고려해 후보를 페이지 조회하고, title/provider/description/location/tags/compare_meta 순서로 null-safe 부분 검색 및 정렬하도록 확장함
- 2026-04-22: `frontend/app/(landing)/programs/[id]/page.tsx`, `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
  - 프로그램 상세 페이지를 서버 데이터 fetch와 클라이언트 상세 UI로 분리하고, 실제 `ProgramDetail` 값이 있는 섹션만 Hero, 탭, 본문/사이드바, 빠른 목차, 북마크/공유 UI에 표시하도록 정리함
- 2026-04-22: `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `supabase/migrations/20260422203000_add_programs_search_text_index.sql`, `docs/current-state.md`
  - 프로그램 검색 후속으로 `programs.search_text` generated column과 trigram index migration을 추가해 title/provider/description/location/tags/skills/target/compare_meta 통합 검색 후보를 DB에서 먼저 줄일 수 있게 함
  - 백엔드 `/programs?q=`는 `search_text.ilike`를 우선 사용하되, 아직 migration이 적용되지 않은 환경에서는 기존 1,000건 단위 후보 scan으로 자동 fallback하도록 보강함
  - 기존 검색 결과 우선순위와 null-safe Python 정렬은 유지하고, 검색 인덱스 사용 및 fallback 동작을 `backend/tests/test_programs_router.py`로 고정함
- 2026-04-22: `backend/routers/programs.py`, `backend/rag/programs_rag.py`, `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`, `frontend/app/(landing)/landing-c/page.tsx`, `frontend/app/dashboard/page.tsx`, `frontend/components/MiniCalendar.tsx`, `backend/tests/test_programs_router.py`, `reports/TASK-2026-04-22-1900-program-dday-deadline-result.md`
  - 프로그램 카드/상세/대시보드/추천 캘린더의 D-day 기준을 모집 마감일(`close_date` 또는 `deadline`)로 통일하고, 프론트의 `end_date` fallback을 제거함
  - 고용24에서 훈련 종료일이 `deadline`과 같은 값으로 저장된 row는 모집 마감일로 보지 않고 D-day 계산에서 제외하도록 방어함
  - 훈련/운영 기간 표시는 기존대로 `start_date`/`end_date`를 유지하고, backend router 회귀 테스트와 frontend lint/typecheck로 검증함
- 2026-04-22: `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/programs-filter-bar.tsx`, `frontend/lib/api/backend.ts`, `frontend/lib/types/index.ts`, `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `supabase/migrations/20260422213000_add_programs_cost_time_filters.sql`, `docs/current-state.md`, `reports/programs-filter-bar-redesign-result.md`
  - 프로그램 상단 필터에 시·도 지역, 비용, 참여 시간 다중 선택 드롭다운을 추가하고 URL query와 목록/count API 파라미터에 연결함
  - 비용은 `내일배움카드`, `무료(내배카 X)`, `유료`, 참여 시간은 `파트타임`, `풀타임`으로 분류하며, DB 컬럼이 없는 환경에서도 기존 row의 비용/지원/기간/텍스트 정보를 기준으로 backend에서 보수적으로 필터링하도록 함
  - 운영 DB 적용용 `cost_type`, `participation_time` migration과 trigger/index를 추가하고, 기존 카드 리스트와 상세 보기 흐름은 유지함
- 2026-04-22: `backend/rag/collector/program_field_mapping.py`, `backend/routers/admin.py`, `scripts/program_backfill.py`, `backend/tests/test_work24_kstartup_field_mapping.py`, `backend/tests/test_admin_router.py`, `backend/tests/test_program_backfill.py`, `reports/TASK-2026-04-22-1915-work24-deadline-source-separation-result.md`
  - 고용24 `traEndDate`를 `raw_deadline`으로 넘기지 않고 `end_date`와 `compare_meta.training_end_date`로만 보존하도록 분리함
  - 관리자 sync도 별도 `deadline`/`close_date`가 없으면 고용24 `deadline=end_date`를 저장하지 않도록 수정함
  - 운영 DB의 기존 의심 row를 직접 수정하지 않고 `scripts/program_backfill.py --work24-deadline-audit` dry-run 리포트로 먼저 식별하도록 추가함
- 2026-04-22: `backend/main.py`, `backend/rag/chroma_client.py`, `backend/tests/test_chroma_client.py`, `backend/tests/test_main_chroma_startup.py`, `docs/current-state.md`, `reports/backend-startup-chroma-quota-result.md`
  - `CHROMA_MODE=ephemeral` 로컬 개발 모드에서는 기본 startup seed를 생략해 서버 기동이 Gemini embedding quota 초과 재시도에 묶이지 않도록 조정함
  - Gemini embedding 429를 한 번 감지하면 같은 프로세스의 이후 embedding function도 즉시 local deterministic fallback을 사용하도록 전역 fallback 플래그를 추가함
  - 필요 시 `ISOSER_CHROMA_SEED_ON_STARTUP=true`, `ISOSER_EMBEDDING_LOCAL_FALLBACK=true`로 운영/개발 동작을 명시 override할 수 있게 함
- 2026-04-23: `frontend/app/(landing)/compare/page.tsx`, `frontend/app/(landing)/compare/programs-compare-client.tsx`, `frontend/app/(landing)/compare/compare-table-sections.tsx`, `frontend/app/(landing)/compare/compare-relevance-section.tsx`, `docs/current-state.md`, `reports/compare-page-detail-fields-result.md`
  - 비교 페이지가 목록용 `Program`만 쓰던 구조에서 상세 API `ProgramDetail`을 함께 조회해 비용, 지원금, 지원 대상, 정원, 만족도, 문의 같은 공통 상세 필드를 표에 반영하도록 개선함
  - 비교 표를 기본 정보, 일정, 비용·지원, 대상·모집, 소개로 재구성하고, 상세 API 실패 시 기존 목록 필드 fallback으로 화면이 유지되도록 함
  - `programs.skills`가 운영 DB에서 비어 있을 수 있는 현실을 반영해 AI 적합도와 표 라벨을 기술 스택/스킬 확정 표현 대신 프로필 키워드/수집 키워드 중심으로 완화함
- 2026-04-23: `backend/routers/programs.py`, `backend/rag/collector/program_field_mapping.py`, `backend/rag/collector/normalizer.py`, `frontend/lib/api/backend.ts`, `frontend/lib/types/index.ts`, `frontend/app/(landing)/compare/page.tsx`, `frontend/app/(landing)/compare/compare-relevance-section.tsx`, `backend/tests/conftest.py`, `backend/tests/test_programs_router.py`, `backend/tests/test_work24_kstartup_field_mapping.py`, `docs/current-state.md`
  - 비교 페이지 상세 호출 리스크를 줄이기 위해 `POST /programs/details/batch`를 추가하고, 프론트 비교 페이지는 상세 정보를 슬롯별 단건 호출 대신 batch로 조회하도록 변경함
  - compare relevance 응답에 `region_match_score`, `matched_regions`를 추가해 주소/지역 기반 신호를 기술 키워드와 분리해 표시함
  - 고용24/K-Startup mapping과 normalizer에 보수적인 `skills` 추출/저장 흐름을 추가해 `programs.skills`가 계속 비어 남는 문제를 줄임
- 2026-04-23: `backend/routers/programs.py`, `backend/rag/collector/regional_html_collectors.py`, `frontend/app/(landing)/compare/page.tsx`, `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/program-card.tsx`, `frontend/app/(landing)/programs/programs-filter-bar.tsx`, `frontend/app/(landing)/programs/recommended-programs-section.tsx`, `frontend/app/api/dashboard/bookmarks/[programId]/route.ts`, `frontend/app/api/dashboard/recommended-programs/route.ts`, `frontend/lib/api/backend.ts`, `frontend/lib/types/index.ts`, `backend/tests/test_programs_router.py`, `docs/current-state.md`, `reports/compare-page-detail-fields-result.md`
  - 비교 페이지 기본 프로그램 조회도 `POST /programs/batch`로 통합해 상세/기본 조회 모두 batch 경로를 사용하도록 정리함
  - 지역 매칭을 문자열 포함 수준에서 시/도 정규화, 인접권역, 온라인/혼합형 판정으로 보강하고 `score_breakdown`, `relevance_reasons`, `relevance_grade`, `relevance_badge`를 relevance/recommend 응답에 추가함
  - `/programs`를 맞춤 추천, 마감 임박, 전체 프로그램 섹션으로 나누고, 목록 카드는 상세 이동 본문과 BFF 경유 찜 버튼만 남기는 구조로 조정함
  - 후속으로 선발 절차/채용 연계 필터를 텍스트 fallback 기반으로 추가하고, 스킬 키워드 사전을 보안/모바일/게임/반도체 등으로 확장함
  - 목록/추천 카드 초기 렌더링 시 기존 `program_bookmarks`를 서버에서 읽어 찜 별 상태가 비어 보이지 않도록 prefetch를 추가함
- 2026-04-23: `backend/rag/collector/program_field_mapping.py`, `backend/rag/collector/normalizer.py`, `backend/tests/test_work24_kstartup_field_mapping.py`
  - 고용24/K-Startup mapping에서 제목, 설명, 대상, NCS 코드 기반의 보수적 skill keyword 후보를 추출해 `programs.skills`가 항상 비어 있지 않도록 보강함
  - normalizer가 `skills` 입력을 중복 제거된 문자열 배열로 정리하도록 추가하고, Work24/K-Startup mapping 테스트로 기대 skill 후보를 고정함
- 2026-04-23: `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `frontend/lib/types/index.ts`
  - compare relevance 응답에 `region_match_score`, `matched_regions`를 추가하고, 프로필 지역 정보가 있을 때만 지역 일치 신호를 관련도에 보수적으로 반영하도록 함
  - 프로필 지역 정보가 없는 기존 사용자의 관련도 점수는 기존 계산값을 유지하도록 회귀 테스트로 고정함
- 2026-04-23: `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `reports/TASK-2026-04-23-0556-address-field-and-region-matching-result.md`
  - 지역 매칭에서 명시 `teaching_method`를 먼저 판정하고, 온라인+오프라인/지역명 조합은 혼합형으로 분류하도록 보강함
  - 주소 미입력 프로필의 `score_breakdown`은 지역 가중치를 제외한 임시 가중치로 계산하고, 주소가 있는 프로필은 최종 지역 가중치를 유지하도록 테스트 기대값을 추가함
- 2026-04-23: `frontend/app/(landing)/programs/bookmark-state-provider.tsx`, `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/program-card.tsx`, `docs/current-state.md`, `reports/compare-page-detail-fields-result.md`
  - `/programs` 화면에 program id 기준 bookmark state provider를 추가해 맞춤 추천, 마감 임박, 전체 프로그램에 같은 카드가 중복 노출될 때 찜 상태가 즉시 동기화되도록 함
  - `ProgramCard`는 provider가 없는 위치에서는 기존 `initialBookmarked` 기반 로컬 상태로 계속 동작하게 해 재사용 범위의 기존 동작을 유지함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `reports/TASK-2026-04-23-0557-programs-listing-page-restructure-result.md`
  - 프로그램 목록의 비용 active filter chip 제거 URL이 운영 기관, 추천 대상, 선발 절차, 채용 연계 필터를 함께 보존하도록 보완함
  - `/programs` 구조 개편 잔여 보완 결과와 검증 결과를 task result report로 기록함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/program-card.tsx`, `frontend/app/(landing)/programs/program-bookmark-button.tsx`, `frontend/app/(landing)/programs/program-utils.ts`, `docs/current-state.md`, `reports/programs-table-list-restructure-result.md`
  - `/programs`의 맞춤 추천 섹션을 제거하고 전체 프로그램 탐색이 바로 이어지도록 구조를 단순화함
  - 마감 임박 프로그램은 기존 카드 컴포넌트를 유지하되 1줄 가로 스크롤 레일로 축소함
  - 전체 프로그램 결과는 카드 그리드에서 교육기관/프로그램명, 과정, 모집상태, 비용, 온·오프라인, 기간, 참여 시간, 선발절차·키워드, 채용연계, 운영기관을 비교하는 테이블로 전환함
  - 카드와 테이블이 공유하는 D-day, 관련도, 텍스트 리스트 helper를 `program-utils.ts`로 분리하고 테이블 행용 찜 버튼을 별도 client component로 추가함
- 2026-04-23: `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `frontend/app/api/dashboard/recommend-calendar/route.ts`, `frontend/app/dashboard/page.tsx`, `frontend/lib/types/index.ts`, `docs/current-state.md`, `reports/dashboard-recommend-calendar-relevance-result.md`
  - 캘린더 추천 응답에 기존 맞춤 추천 카드에서 쓰던 `fit_keywords`, `relevance_reasons`, `score_breakdown`, `relevance_grade`, `relevance_badge`를 추가함
  - 대시보드 추천 캘린더 카드가 관련도 배지, 관련도 퍼센트, 맞춤 추천 키워드, 추천 근거 목록을 표시하도록 보강함
  - fallback 공개 프로그램은 개인화 근거 없이 기존 마감순 보호 동작을 유지하도록 빈 추천 필드를 내려준다
- 2026-04-23: `frontend/app/api/dashboard/recommend-calendar/route.ts`, `frontend/app/dashboard/page.tsx`, `docs/current-state.md`, `reports/dashboard-recommend-calendar-relevance-result.md`
  - 대시보드 추천 캘린더 BFF의 백엔드 추천 fetch에 3.5초 timeout, backend 목록 fallback에 2.5초 timeout을 추가해 상류 지연 시 공개 프로그램 fallback으로 빠르게 전환되도록 함
  - 대시보드 기본 추천 목록을 15분 localStorage cache로 저장하고 재진입 시 즉시 표시한 뒤 최신 추천으로 갱신하도록 함
- 2026-04-23: `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `frontend/app/(landing)/programs/page.tsx`, `frontend/lib/api/backend.ts`, `frontend/lib/types/index.ts`, `docs/current-state.md`, `reports/compare-page-detail-fields-result.md`
  - `GET /programs/filter-options`를 추가해 운영 기관, 추천 대상, 선발 절차, 채용 연계 필터 옵션을 현재 검색/카테고리/지역/수업방식/모집 상태 조건에 맞는 실제 프로그램 row에서 추출하도록 함
  - `/programs` 서버 페이지는 옵션 조회가 실패하거나 빈 배열이면 기존 정적 옵션으로 fallback해 기존 필터 동작을 유지함
- 2026-04-23: `frontend/app/(landing)/programs/[id]/page.tsx`, `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`, `frontend/app/(landing)/programs/program-bookmark-button.tsx`, `docs/current-state.md`, `reports/compare-page-detail-fields-result.md`
  - 프로그램 상세 페이지 북마크 버튼이 로컬 토글만 하던 문제를 기존 dashboard bookmark BFF mutation 컴포넌트 재사용으로 교체함
  - 상세 페이지 서버 렌더링 시 `program_bookmarks`에서 현재 사용자 초기 찜 상태를 읽어 목록 페이지와 같은 기준으로 표시하도록 함
- 2026-04-23: `frontend/app/(landing)/compare/program-select-modal.tsx`, `docs/current-state.md`, `reports/compare-page-detail-fields-result.md`
  - 비교 프로그램 선택 모달의 전체 검색 탭에 `/programs/filter-options` 기반 운영 기관, 추천 대상, 선발 절차, 채용 연계 필터를 추가함
  - 옵션 조회 실패가 검색 결과 로딩을 막지 않도록 옵션 fetch는 best-effort로 분리하고, 선택된 옵션은 기존 `/programs` 목록 query 파라미터로 적용함
- 2026-04-23: `frontend/app/(landing)/landing-c/page.tsx`, `frontend/app/(landing)/landing-c/_*.ts*`, `docs/current-state.md`, `reports/landing-c-component-refactor-result.md`
  - landing-c의 단일 대형 `page.tsx`를 landing-a와 유사하게 스타일 변수, 정적 콘텐츠, 검색 파라미터 정규화, 프로그램 표시/정렬 helper, 히어로, Opportunity feed, 하단 지원 섹션 파일로 분리함
  - `page.tsx`는 기존 `listPrograms` 호출, Live Board 후보 조회, Opportunity feed 정렬, 섹션 조립만 맡도록 축소해 화면/라우팅 동작 변경 없이 수정 리스크를 낮춤
  - 후속으로 landing-a/c의 프로그램 카드 표시 helper 중 중복되는 provider/location/period 정규화 로직을 공용 helper로 더 줄일 수 있음
- 2026-04-23: `docs/launch-smoke-test.md`, `reports/landing-c-component-refactor-result.md`
  - 런칭 smoke checklist의 공개 진입과 로그인 기본 복귀 항목을 현재 기본 랜딩인 `/landing-c` 기준으로 갱신함
  - landing-c 리팩토링 후속 검증 포인트로 Live Board, 검색/칩 필터, Opportunity feed 카드, 카드 액션 렌더 확인을 명시함
  - 로컬 dev server `http://localhost:3031/landing-c`에서 HTTP 200, 루트 `/`의 `/landing-c` 307 redirect, agent-browser nonblank/error-overlay/key element smoke를 확인함
- 2026-04-23: `frontend/app/(landing)/programs/programs-filter-bar.tsx`, `frontend/app/(landing)/programs/[id]/page.tsx`, `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`, `frontend/app/(landing)/programs/[id]/not-found.tsx`, `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `docs/current-state.md`, `reports/programs-qa-immediate-fixes-result.md`
  - QA에서 발견된 programs 정렬/다중 필터/잘못된 ID/공유 안내 문제를 즉시 수정함
  - 정렬은 버튼형 메뉴 대신 select 변경 즉시 제출로 단순화하고, 다중 필터 메뉴에는 `선택 적용` submit 버튼을 추가해 열린 메뉴 상태에서도 선택값을 URL query에 반영할 수 있게 함
  - 프로그램 상세 API는 UUID 형식이 아닌 id를 404로 방어하고, 상세 페이지는 내부 Supabase 오류 대신 전용 한국어 404/안내 화면과 공유 복사 결과 메시지를 제공함
- 2026-04-23: `frontend/app/(landing)/programs/programs-filter-bar.tsx`, `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `docs/current-state.md`, `reports/programs-filter-toggle-latest-sort-fix-result.md`
  - 다중 필터 메뉴의 `선택 적용` 버튼을 제거하고, 필터 항목 또는 `전체선택` 클릭 즉시 메뉴가 닫히도록 조정함
  - `/programs?sort=latest&recruiting_only=true`에서 최신 원천 데이터 첫 묶음이 표시 불가 항목으로 채워져 결과가 비는 문제를 해결하기 위해 최신순 모집중 후보를 1,000건 단위로 넓게 조회한 뒤 실제 모집 마감일 기준으로 후처리함
  - 고용24 `deadline=end_date` 보정 후 `days_left`가 없는 항목은 모집중 목록/count에서 제외하도록 목록과 카운트 기준을 맞추고, 관련 backend 회귀 테스트를 추가함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/programs-filter-bar.tsx`, `docs/current-state.md`, `reports/programs-filter-search-layout-result.md`
  - `/programs` 목록 필터에서 선발 절차와 채용 연계 필터를 제거하고, 해당 query는 목록 화면의 active chip/API 요청/페이지네이션 URL 보존 대상에서 제외함
  - 검색 input, 검색 버튼, 초기화 버튼을 필터 드롭다운 아래 별도 줄로 내려 배치해 필터 선택 후 검색 실행 흐름이 더 명확하게 보이도록 조정함
  - 비교 프로그램 선택 모달과 backend filter-options 계약은 다른 화면에서 계속 쓰일 수 있어 변경하지 않음
  - 검색/초기화 버튼 폭을 필터 토글 1칸과 맞추고, 정렬을 native select 대신 같은 커스텀 토글 UI로 맞춰 `마감 임박순` 디자인 불일치를 해소함
- 2026-04-23: `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `frontend/app/(landing)/programs/page.tsx`, `frontend/lib/types/index.ts`, `docs/current-state.md`, `reports/programs-list-metadata-normalization-result.md`
  - `/programs` 목록 응답에 실제 row 텍스트 기반 파생 표시 필드 `display_categories`, `participation_mode_label`, `participation_time_text`, `selection_process_label`, `extracted_keywords`를 추가함
  - 카테고리는 기존 source/category_detail을 참고하되 제목/요약/설명/tags/skills/compare_meta 기반 규칙으로 보정하고, 짧은 영문 키워드는 단어 경계가 맞을 때만 매칭해 URL/식별자 오분류를 줄임
  - 목록 테이블은 파생 카테고리 badge, 참여 시간 라벨+상세 시간, 선발절차 라벨, 실제 내용 기반 keyword chip을 우선 표시하고 빈 keyword chip/dash 중복은 숨기도록 조정함
- 2026-04-23: `backend/routers/programs.py`, `backend/rag/collector/work24_detail_parser.py`, `scripts/program_backfill.py`, `frontend/app/(landing)/programs/page.tsx`, `frontend/lib/types/index.ts`, `supabase/migrations/20260423112000_refine_programs_search_metadata.sql`, `backend/tests/test_programs_router.py`, `backend/tests/test_program_backfill.py`, `docs/current-state.md`, `reports/programs-list-metadata-normalization-result.md`
  - `ai` 검색이 고용24 `tracseId=AIG...`, `source_url`, `hrd_id` 같은 운영 식별자 때문에 바리스타/ERP/포토샵 과정을 잘못 포함하던 문제를 해결함
  - 검색, category detail 추론, 목록 파생 카테고리/키워드 생성에서 `compare_meta` 전체 JSON 대신 교육 내용 관련 allowlist key만 사용하도록 조정함
  - 고용24 상세 HTML 파서가 명시된 수강신청/모집/접수 마감일만 `deadline`으로 보강하고, 훈련유형/주야/주말/훈련시간을 `compare_meta`에 보존하도록 확장함
  - 목록 비용 칸은 KDT/산대특/국기/내일배움 같은 실제 지원유형 텍스트가 있으면 작은 badge로 함께 표시함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `docs/current-state.md`
  - 전체 프로그램 테이블에서 채용연계 열을 제거해 목록 가로 폭과 정보 밀도를 줄임
  - `compare_meta.employment_connection` 데이터/API 필드는 유지해 상세/비교 등 다른 화면의 재사용 가능성은 보존함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `docs/current-state.md`
  - 전체 프로그램 결과 카드가 테이블 행의 최소 폭에 맞춰 함께 넓어지도록 조정함
  - 테이블 내부만 잘려 스크롤되는 대신 결과 카드 전체가 가로 스크롤되도록 해 카드 끝과 행 끝이 맞게 함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `docs/current-state.md`
  - `/programs` 본문 컨테이너의 고정 최대폭을 제거해 Program Search, Closing Soon, 전체 프로그램 카드가 화면 전체 폭을 같은 기준으로 사용하도록 조정함
  - 전체 프로그램 테이블은 가로 스크롤 대신 `table-fixed`와 줄바꿈으로 카드 안에서 펼쳐지도록 변경하고, 마감 임박 레일은 그리드 배치로 전환함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `docs/current-state.md`
  - `/programs` 본문 컨테이너를 무제한 폭 대신 `max-w-[1680px]`로 고정해 테이블이 가려지지 않을 정도로 넓게 유지함
  - Closing Soon은 다시 한 행 가로 레일로 바꾸고 초과 카드는 오른쪽으로 이어지도록 `shrink-0` 카드 배치를 적용함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `docs/current-state.md`
  - Closing Soon 레일에서 일반 `ProgramCard` 대신 마감일, 제목, 핵심 chip, 2줄 설명만 표시하는 압축 카드 렌더링을 사용해 카드 높이를 줄임
  - 필터와 전체 프로그램 테이블 사이의 세로 간격을 줄여 섹션 전환이 더 이어져 보이도록 조정함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `docs/current-state.md`
  - Closing Soon 조회에서 검색어/필터 파라미터를 제거해 검색 결과와 무관하게 전역 마감임박 섹션이 계속 유지되도록 변경함
  - 섹션 안내 문구도 검색 조건과 별개인 기준으로 갱신함
- 2026-04-23: `frontend/app/(landing)/programs/page.tsx`, `docs/current-state.md`, `reports/programs-filter-scoped-closing-soon-result.md`
  - 필터 적용 후 바로 아래 Closing Soon 레일에 전역 마감임박 공고가 섞여 보이던 혼란을 줄이기 위해 목록/count와 같은 검색/카테고리/지역/수업방식/비용/참여시간/기관/대상 조건을 Closing Soon 조회에도 재사용하도록 변경함
  - Closing Soon 안내 문구를 현재 검색 조건 기준으로 갱신하고, 같은 파일의 중복 urgent chip key 방어 로직을 유지함
- 2026-04-23: `backend/rag/collector/normalizer.py`, `backend/tests/test_work24_kstartup_field_mapping.py`, `scripts/program_source_diff.py`, `supabase/migrations/20260423112000_refine_programs_search_metadata.sql`, `docs/current-state.md`, `reports/program-detail-data-diagnosis-result.md`
  - 운영 DB에 누락될 수 있는 `category_detail`, `support_type`, `teaching_method`, `raw_data`, `search_text` 등 programs metadata 컬럼을 최신 migration 시작부에서 `add column if not exists`로 보강하도록 정리함
  - collector normalized row가 원본 `raw` payload를 `raw_data`로 넘기도록 추가해 신규 수집/재수집 row에서 원본 API 필드 비교가 가능하게 함
  - `scripts/program_source_diff.py`의 추적 필드에 `raw_data`를 포함해 live raw, DB raw_data, API/UI 매핑 차이를 같은 진단 리포트에서 볼 수 있게 함
- 2026-04-23: `backend/routers/programs.py`, `scripts/program_backfill.py`, `frontend/app/api/dashboard/recommend-calendar/route.ts`, `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/program-utils.ts`, `backend/tests/test_programs_router.py`, `backend/tests/test_program_backfill.py`, `docs/current-state.md`, `reports/work24-deadline-risk-mitigation-result.md`
  - 운영 DB에서 고용24 계열 3346개 row가 `deadline=end_date`로 확인된 상태를 반영해, 목록/count/filter-options/recommendation 경로가 DB `deadline >= today` 단일 필터를 먼저 걸지 않고 후보 scan 후 resolved deadline으로 후처리하도록 보강함
  - 고용24 `deadline=end_date` row는 모집 마감일 미확인으로 처리하고, 캘린더 추천은 resolved deadline이 없는 프로그램을 날짜형 추천에서 제외하도록 조정함
  - backfill은 기존 고용24 오염 deadline을 상세 페이지에서 찾은 실제 신청 마감일로 `overwrite` 없이 교체하고, 빈 `close_date`, `source_unique_key`, `skills`, `tags`, `raw_data`도 보강 후보로 포함함
- 2026-04-23: `reports/work24-kstartup-operational-risk-management-2026-04-23.md`
  - 운영 Supabase 읽기 전용 재점검 결과를 기준으로 Work24/K-Startup 남은 리스크를 source identity, deadline 복구, skills/raw_data 보강, API scan latency로 분류함
  - Work24 상세 페이지 10건 dry-run에서 deadline patch는 0건이고 compare_meta patch만 가능함을 확인해 broad deadline apply를 보류하기로 기록함
  - 운영 적용 전 backup, source_unique_key preview/apply, post-apply verification, rollback SQL과 go/no-go 기준을 정리함
- 2026-04-23: `backend/rag/collector/normalizer.py`, `backend/rag/collector/scheduler.py`, `backend/routers/admin.py`, `supabase/migrations/20260423143000_relax_programs_legacy_unique_constraints.sql`, `reports/work24-kstartup-db-risk-apply-2026-04-23.md`
  - 운영 DB에서 Work24/K-Startup `source_unique_key` 526건, live source 기존 row patch 3,382건, 신규 row 48건, HTML source key 110건을 안전 적용하고 최종 `source_unique_key` 누락 0건을 확인함
  - scheduler dedupe 기준을 `source_unique_key` 우선으로 바꾸고, normalizer가 source/link/title 기반 fallback key를 생성해 legacy unique 제거 후에도 반복 sync 중복을 줄이도록 함
  - `source_unique_key`가 있는 row는 admin/scheduler fallback에서 legacy `hrd_id`나 `(title, source)` row로 병합하지 않게 해 같은 제목의 다른 회차가 덮이지 않도록 방어함
  - `programs_unique(title, source)`와 `hrd_id` unique 제약이 남아 있으면 live 후보 2,560건은 여전히 저장 불가하므로, legacy unique 제거 migration 적용 후 backfill/sync 재실행이 필요함
- 2026-04-23: `backend/rag/source_adapters/work24_training.py`, `backend/rag/collector/work24_collector.py`, `backend/routers/admin.py`, `backend/tests/test_work24_training_adapter.py`, `backend/tests/test_scheduler_collectors.py`, `backend/tests/test_admin_router.py`, `reports/work24-training-api-params-result-2026-04-23.md`
  - 고용24 국민내일배움카드 목록 API 요청을 문서 기준 필수 파라미터(`srchTraStDt`, `srchTraEndDt`, `sort`, `sortCol` 포함)와 맞추고, scheduler/admin sync가 같은 `build_training_list_params` helper를 쓰도록 정리함
  - `srchNcsCd` 대신 문서 기준 `srchNcs1~4`를 지원하고, 기존 `ncs_code` 입력은 코드 길이에 따라 `srchNcs1~4`로 후방 호환 매핑함
  - scheduler는 env로 `wkendSe`, 지역 중분류, NCS 1~4차, 훈련유형/구분/종류, 과정명, 기관명, 정렬값을 넘길 수 있고, admin sync는 같은 파라미터를 query alias로 받을 수 있게 함
- 2026-04-23: `backend/rag/collector/program_field_mapping.py`, `backend/rag/collector/normalizer.py`, `backend/rag/source_adapters/work24_training.py`, `backend/routers/admin.py`, `docs/data/work24-training-sync.md`, `reports/work24-region-normalization-refactoring-summary-2026-04-23.md`
  - Work24 row의 `address`와 `trngAreaCd`에서 `region`/`region_detail`을 정규화해 전국 수집 시에도 프로그램이 서울 source meta에 고정되지 않도록 보강함
  - collector normalizer와 admin sync payload가 row-level region 값을 보존하도록 연결하고, Work24 scheduler/admin sync env/query 사용법을 데이터 문서로 분리함
- 2026-04-23: `backend/rag/collector/program_field_mapping.py`, `backend/rag/source_adapters/work24_supplementary.py`, `backend/rag/source_adapters/work24_training.py`, `backend/rag/collector/work24_collector.py`, `backend/routers/admin.py`, `docs/data/work24-training-sync.md`, `reports/work24-region-code-backfill-result-2026-04-23.md`
  - Work24 공통 코드 API `dtlGb=1` 응답의 `regionCd`/`regionNm`을 파싱해 `trngAreaCd` 중분류 코드를 `성남시 분당구` 같은 시군구명 `region_detail`로 변환하도록 연결함
  - scheduler와 admin sync가 `WORK24_COMMON_CODES_AUTH_KEY`가 있을 때 지역 코드 map을 사용하고, 실패 시 기존 주소/광역 코드 fallback을 유지하도록 보강함
  - 운영 Supabase Work24 3,438건 중 코드/주소 기반으로 안전하게 보정 가능한 3,383건을 적용했고, 타임아웃 후 남은 patch를 이어 적용해 최종 복구 가능 후보를 0건으로 줄임
- 2026-04-23: `frontend/app/dashboard/page.tsx`, `frontend/app/(landing)/compare/program-select-modal.tsx`, `docs/current-state.md`, `reports/program-bookmark-dashboard-compare-result.md`
  - 대시보드에 `program_bookmarks` 기반 `찜한 훈련` 섹션을 추가해 목록/상세에서 북마크한 프로그램을 같은 dashboard bookmark BFF로 조회해 보여주도록 함
  - 비교 프로그램 선택 모달은 닫았다 다시 열 때 찜 목록을 새로 조회하도록 조정해 최근 북마크 변경이 모달에 반영되게 함
  - 기존 북마크 저장/삭제 BFF와 backend `/bookmarks` 계약은 유지하고, 대시보드/비교는 같은 저장 상태를 읽는 방식으로 연결함
- 2026-04-23: `frontend/app/api/dashboard/bookmarks/route.ts`, `frontend/app/(landing)/compare/program-select-modal.tsx`, `docs/current-state.md`, `reports/program-bookmark-dashboard-compare-result.md`
  - 찜 목록 BFF의 GET 경로를 backend 프록시 대기 대신 현재 Supabase 로그인 사용자 기준 `program_bookmarks`/`programs` 직접 조회로 바꿔 비교 모달 loading 고착 가능성을 줄임
  - 비교 모달 전체 검색 탭에서 운영 기관/추천 대상/선발 절차/채용 연계 필터 select와 filter-options 호출을 제거하고 검색어 기반 목록만 남김
- 2026-04-23: `frontend/app/(auth)/login/page.tsx`, `frontend/app/(landing)/programs/program-bookmark-button.tsx`, `frontend/app/(landing)/programs/program-card.tsx`, `docs/current-state.md`, `reports/login-bookmark-auth-flow-result.md`
  - 로그인 페이지 문구를 공개/랜딩 복귀 설명 대신 찜 저장, 맞춤 추천, 문서 준비 기능을 사용할 수 있다는 안내로 조정함
  - 비로그인 사용자가 프로그램 목록/상세의 별 버튼을 누르면 현재 경로와 query/hash를 `redirectedFrom`으로 보존해 로그인 페이지로 이동하도록 변경함
  - `ProgramCard`의 별 버튼 직접 구현을 제거하고 공용 `ProgramBookmarkButton`으로 위임해 목록 카드에서도 같은 로그인 유도/찜 동작을 사용하도록 정리함
  - 로그인 사용자의 기존 dashboard bookmark BFF 저장/삭제 흐름과 pending 중복 클릭 방어는 유지함
- 2026-04-23: `backend/routers/admin.py`, `backend/tests/test_admin_router.py`, `backend/tests/test_programs_router.py`, `reports/work24-default-exposure-sync-result-2026-04-23.md`
  - 운영 Work24 서울 live sync를 재실행해 보류됐던 신규 row를 재시도했고, 1차 estimated new rows 2,434건과 2차 idempotency 0건을 확인함
  - admin sync upsert를 100건 단위 batch로 나눠 Supabase payload/timeout 리스크를 줄임
  - `/programs` 기본 노출은 창업/source 명시 필터가 없을 때 Work24 70% mix를 유지하고, 창업 필터에서는 mix를 적용하지 않는 회귀 테스트를 추가함
- 2026-04-23: `frontend/lib/programs-page-layout.ts`, `frontend/lib/programs-page-layout.test.ts`, `frontend/app/(landing)/programs/page.tsx`, `reports/programs-page-layout-regression-tests-result.md`
  - `/programs` 마감임박 섹션이 검색/필터와 독립적으로 조회되는 정책을 `buildUrgentProgramsParams()` helper로 분리하고 Vitest로 고정함
  - 마감임박 압축 카드 chip 중복 제거를 `buildUrgentProgramChips()` helper로 분리해 React duplicate key 회귀를 테스트로 방어함
- 2026-04-23: `backend/rag/collector/program_field_mapping.py`, `backend/rag/source_adapters/work24_training.py`, `backend/routers/admin.py`, `backend/routers/programs.py`, `backend/rag/programs_rag.py`, `scripts/program_backfill.py`, `frontend/app/api/dashboard/recommend-calendar/route.ts`, `frontend/lib/types/index.ts`, `docs/current-state.md`, `docs/data/work24-training-sync.md`, `reports/work24-training-start-deadline-fallback-result-2026-04-23.md`
  - Work24 국민내일배움카드 목록 API에 별도 모집마감일이 없어 `traStartDate`를 `deadline`/`compare_meta.application_deadline` fallback으로 저장하고 `compare_meta.deadline_source=traStartDate`를 남기도록 변경함
  - 기존 고용24 `deadline=end_date` 오염값 무시 방어는 유지하되, `deadline_source=traStartDate`가 있는 1일 과정은 신뢰하도록 backend 목록/추천/backfill/frontend fallback을 함께 보정함
  - `traStartDate`/`traEndDate` 기반 날짜 메타를 `YYYY-MM-DD`로 정규화해 Python 3.10 날짜 파싱과 D-day 계산이 basic date 문자열에 막히지 않도록 함
