# 교육/지원 프로그램 추천시스템 체크리스트

기준 날짜: 2026-04-16  
기준 브랜치: `develop`  
현재 기준 커밋: `60da25d7d70db974c3aca75cca3e48c76d86dc5e`

## 목적

- 1차 목표는 `교육/지원 프로그램 추천`을 먼저 완성하는 것이다.
- 추천 대상 데이터 적재, 백엔드 추천 API, 대시보드 추천 UI를 순서대로 연결한다.
- 현재 `develop`에는 추천 API의 일부가 이미 반영되어 있으므로, 새로 만들기보다 `검증 -> 보완 -> 연결` 순서로 진행한다.

## 이번 범위

- 포함
  - 프로그램 데이터 적재 상태 점검
  - 추천 캐시/필터/사유 노출 흐름 점검
  - 대시보드 추천 카드 완성
- 제외
  - 채용공고/일자리 추천
  - 추천 알고리즘 대규모 재설계
  - 운영 자동화 고도화

## 현재 상태 요약

- 이미 확인된 추천 관련 핵심 파일
  - `backend/routers/programs.py`
  - `backend/rag/programs_rag.py`
  - `backend/rag/chroma_client.py`
  - `frontend/app/api/dashboard/recommended-programs/route.ts`
  - `frontend/app/dashboard/page.tsx`
  - `frontend/lib/api/app.ts`
  - `frontend/lib/types/index.ts`
- 최신 `develop`에는 아래 내용이 일부 이미 들어가 있다.
  - `/programs/recommend` 요청 파라미터 확장
  - `recommendations` 캐시 로직
  - category / region 기반 추천 필터
  - Chroma metadata `where` 검색
- 아직 남은 가능성이 높은 작업
  - BFF에서 추천 이유/키워드 전달
  - 대시보드 필터 UI
  - 추천 사유/키워드 표시
  - 프로필/활동 저장 후 추천 캐시 무효화 연결

## 작업 원칙

- 코드 수정 전에는 반드시 현재 파일 상태를 다시 읽고 진행한다.
- `교육/지원 프로그램 추천`이 안정화되기 전에는 `일자리 추천` 작업으로 확장하지 않는다.
- 외부 의존성 문제로 막히면 UI부터 억지로 붙이지 말고 데이터 적재 단계에서 멈춘다.
- `.env`, 로컬 DB 파일, Chroma 백업 `.bin` 파일은 커밋하지 않는다.
- 마이그레이션 정리는 이미 적용된 파일을 임의 삭제하는 대신, 실제 적용 상태를 확인한 뒤 후속 migration 또는 archive 전략으로 처리한다.

## 단계별 영향 파일 사용법

- 아래 `영향 파일` 목록은 각 단계를 진행할 때 가장 먼저 열어봐야 하는 1차 대상이다.
- 실제 구현 중 연쇄 수정이 생기면 라우터, 타입, 테스트, 대시보드 페이지 순서로 함께 확인한다.
- 같은 단계라도 `백엔드 계약 변경 -> BFF -> 프론트 타입 -> UI` 순서로 영향이 번지는지 같이 본다.

## 0. 시작 전 준비

- [ ] `develop` 브랜치가 최신인지 확인한다.
- [ ] `git status` 기준으로 커밋 불필요한 로컬 산출물(`.bin`, `.sqlite3`, 백업 폴더`)이 섞여 있지 않은지 본다.
- [ ] `.gitignore`에 아래 항목이 실제로 반영되어 있는지 점검한다.
  - `*.bin`
  - `*.sqlite3`
  - `chroma_store_*/`
  - `backend/.env`
- [ ] `backend/.env`에 아래 키가 실제로 채워져 있는지 확인한다.
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_SECRET_KEY`
  - `WORK24_OPEN_API_AUTH_KEY`
  - `GOOGLE_API_KEY`

전역 env 파일 확인 범위:

- `backend/.env`
- `backend/.env.example`
- `frontend/.env.local`
- `frontend/.env.local.example`
- `backend/render.yaml` (배포 환경 변수 선언 참고용)

실제 런타임 로드 경로:

- 백엔드 앱 시작점인 `backend/main.py`는 `backend/rag/runtime_config.py`의 `load_backend_dotenv()`를 통해 `backend/.env`만 자동 로드한다.
- 프론트는 `frontend/.env.local`을 별도로 사용한다.
- 따라서 `backend/.env.example` 또는 `frontend/.env.local.example`에만 있는 값은 실제 런타임 설정으로 간주하지 않는다.
- `backend/render.yaml`은 배포 환경 변수 선언 참고용이며, 로컬 실행 시 자동 로드되지 않는다.

실행 결과 (2026-04-16):

- [x] `develop` 최신 여부 확인
  - 결과: 현재 로컬 `develop`은 `origin/develop` 기준 `ahead 3, behind 2` 상태다.
- [x] 로컬 산출물 확인
  - 결과: `backend/chroma_store_backup_20260407_135012/`, `backend/chroma_store_failed_20260407_135355/`가 untracked 상태다.
  - 결과: `docs/recommendation/`과 `tasks/inbox/TASK-2026-04-15-17*.md`도 untracked 상태다.
- [x] `.gitignore` 점검
  - 결과: `backend/.env`는 이미 ignore 대상이다.
  - 결과: `*.bin`, `*.sqlite3`, `chroma_store_*/` 패턴은 현재 없다.
- [x] `backend/.env` 필수 키 점검
  - 결과: 저장소 전역 env 파일 검색 기준 실제 값 확인 대상은 `backend/.env`, `frontend/.env.local`이다.
  - 결과: 현재 셸 프로세스 환경변수에는 `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY`, `WORK24_OPEN_API_AUTH_KEY`, `WORK24_TRAINING_AUTH_KEY`, `GOOGLE_API_KEY`가 직접 주입되어 있지 않다.
  - 결과: `backend/.env`에 실제로 있는 관련 키는 `GOOGLE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WORK24_OPEN_API_AUTH_KEY`, `WORK24_JOB_DUTY_AUTH_KEY`다.
  - 결과: `frontend/.env.local`에 실제로 있는 관련 키는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL`다.
  - 결과: `backend/.env`에는 `SUPABASE_URL`은 없지만 `NEXT_PUBLIC_SUPABASE_URL=set` 상태다.
  - 결과: 현재 백엔드 코드는 `SUPABASE_URL`이 없으면 `NEXT_PUBLIC_SUPABASE_URL`을 fallback으로 읽는다.
  - 결과: `SUPABASE_SERVICE_ROLE_KEY`는 `backend/.env`, `frontend/.env.local` 어디에도 없다.
  - 결과: `ADMIN_SECRET_KEY`는 `backend/.env`, `frontend/.env.local` 어디에도 없다.
  - 결과: `WORK24_OPEN_API_AUTH_KEY=blank`
  - 결과: `GOOGLE_API_KEY=set`
  - 추가 확인: 현재 코드의 실제 sync 경로는 `WORK24_OPEN_API_AUTH_KEY`가 아니라 `WORK24_TRAINING_AUTH_KEY`를 요구한다.
  - 결과: `WORK24_TRAINING_AUTH_KEY`는 `backend/.env`, `frontend/.env.local` 어디에도 없다.
  - 추가 확인: `backend/.env.example`에는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY` 예시 키가 있지만 실제 런타임 파일은 아니다.
  - 추가 확인: `backend/render.yaml`에는 `GOOGLE_API_KEY`, 일부 Work24 계열 키 선언이 있지만 `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY`, `WORK24_TRAINING_AUTH_KEY`의 로컬 대체 근거는 아니다.

판정:

- 0단계 확인은 완료했다.
- 멈춤 조건이 충족되어 1단계 스키마 작업과 2단계 데이터 적재 작업으로 진행하지 않는다.
- 특히 현재 상태에서는 Supabase Admin 경로와 Work24 sync 경로가 모두 막혀 있다.
- 정정: `Supabase URL 없음`이 blocker는 아니다. 실제 blocker는 `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY`, `WORK24_OPEN_API_AUTH_KEY`, `WORK24_TRAINING_AUTH_KEY`다.

멈춤 조건:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY` 중 하나라도 비어 있으면 다음 단계로 가지 않는다.
- `WORK24_OPEN_API_AUTH_KEY`가 비어 있으면 데이터 적재부터 막히므로 먼저 채운다.
- `GOOGLE_API_KEY`가 비어 있으면 Gemini 기반 추천 사유 생성(`reason`, `fit_keywords`)이 빠지므로 다음 단계로 가지 않는다.

현재 판정:

- [x] `SUPABASE_URL`은 fallback 경로(`NEXT_PUBLIC_SUPABASE_URL`)로 충족
- [x] `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY` 누락으로 멈춤 조건 충족
- [x] `WORK24_OPEN_API_AUTH_KEY` 공란으로 멈춤 조건 충족
- [x] 실제 코드 기준 `WORK24_TRAINING_AUTH_KEY` 누락으로 sync 실행 불가
- [ ] 다음 단계 진행

영향 파일 / 설정 파일:

- `.gitignore`
- `backend/.env`
- `backend/chroma_store/`
- `backend/chroma_store_backup_*/`
- `backend/chroma_store_failed_*/`

## 1. 스키마 정합성 먼저 확인

- [ ] `supabase/migrations/20260410120000_create_programs_and_bookmarks.sql`와 `supabase/migrations/20260415_create_programs.sql`의 `programs` 정의 차이를 비교한다.
- [ ] 실제 Supabase의 `supabase_migrations.schema_migrations`를 조회해 어떤 migration이 적용되었고 어떤 migration이 미적용 상태인지 확인한다.
- [ ] migration 실행 순서를 정리한다.
  - 먼저 적용된 migration
  - 아직 적용되지 않은 migration
  - 적용 순서가 꼬이면 안 되는 migration
- [ ] `program_bookmarks`와 `bookmarks` 중 어떤 테이블을 정본으로 쓸지 확정한다.
- [ ] `programs` 테이블 정의도 하나를 정본으로 확정한다.
- [ ] 정본이 아닌 migration 파일은 상태에 따라 조치 항목을 정한다.
  - 이미 적용됨: 파일 삭제 대신 후속 corrective migration으로 정리
  - 미적용: archive 또는 주석 처리 후보로 분류
- [ ] `supabase/migrations/20260415_create_recommendations.sql`가 현재 라우터 구조와 충돌 없는지 확인한다.
- [ ] 실제 Supabase에 아래 컬럼/테이블이 있는지 확인한다.
  - `programs.hrd_id`
  - `programs.category`
  - `programs.location`
  - `programs.deadline`
  - `programs.compare_meta`
  - `recommendations`

실행 결과 (로컬 코드 기준, 2026-04-16):

- [x] 현재 코드 기준 `programs` 정본은 아래 migration 조합이다.
  - `20260410120000_create_programs_and_bookmarks.sql`
  - `20260410133000_add_work24_sync_columns_to_programs.sql`
  - `20260415113000_add_compare_meta_to_programs.sql`
  - `20260415170000_add_programs_hub_fields.sql`
- [x] `20260415_create_programs.sql`는 현재 라우터가 기대하는 `location`, `support_type`, `teaching_method`, `raw_data`, `compare_meta` 기준과 어긋나는 별도 초안 성격으로 판정했다.
- [x] 북마크 정본 테이블은 `program_bookmarks`다.
  - 근거: `backend/routers/bookmarks.py`는 `program_bookmarks`만 사용한다.
  - 판정: `20260415_create_recommendations.sql` 안의 `bookmarks` 테이블 정의는 현재 코드 기준 비정본/충돌 후보다.
- [x] `recommendations` 테이블은 현재 캐시 hash 컬럼이 없다.
  - 구현: `supabase/migrations/20260416120000_expand_recommendations_cache_columns.sql`
  - 추가 컬럼: `query_hash`, `profile_hash`, `expires_at`
- [x] `recommendation_rules` 테이블은 로컬 migration 기준 존재하지 않았다.
  - 구현: `supabase/migrations/20260416121000_create_recommendation_rules.sql`
- [ ] 실제 Supabase `supabase_migrations.schema_migrations` 적용 상태 확인
  - 상태: `SUPABASE_SERVICE_ROLE_KEY` 부재로 live 검증 보류
- [ ] 실제 Supabase 컬럼/테이블 존재 확인
  - 상태: live 검증 보류

영향 파일:

- `backend/utils/supabase_admin.py`
- `backend/routers/bookmarks.py`
- `backend/routers/programs.py`
- `supabase/migrations/20260410120000_create_programs_and_bookmarks.sql`
- `supabase/migrations/20260410133000_add_work24_sync_columns_to_programs.sql`
- `supabase/migrations/20260415113000_add_compare_meta_to_programs.sql`
- `supabase/migrations/20260415170000_add_programs_hub_fields.sql`
- `supabase/migrations/20260415_create_programs.sql`
- `supabase/migrations/20260415_create_recommendations.sql`

완료 기준:

- `programs` 스키마 기준이 하나로 정리된다.
- `recommendations`를 읽고 쓰는 현재 코드와 DB 테이블 정의가 맞는다.

## 2. 프로그램 데이터 적재 상태 확인

- [ ] `backend/routers/admin.py`의 `/sync/programs` 기준으로 적재 흐름을 읽는다.
- [ ] `backend/rag/collector/*`와 `backend/rag/source_adapters/work24_training.py` 기준으로 입력 데이터가 `programs` 테이블에 어떤 shape로 들어가는지 본다.
- [ ] `POST /admin/sync/programs`를 실행해 `synced > 0`인지 확인한다.
- [ ] 적재 후 Supabase `programs` 테이블에 실제 row 수가 생겼는지 확인한다.
- [ ] `deadline` 또는 `end_date`가 이미 지난 프로그램이 추천 후보에 남지 않는지 확인한다.
- [ ] `SELECT DISTINCT location FROM programs`로 실제 적재된 지역값을 확인해 UI 필터 후보와 맞는지 본다.
- [ ] Chroma `programs` 컬렉션에도 검색 가능한 문서가 들어갔는지 확인한다.
- [ ] Work24 sync 중 rate limit 또는 빈 응답 대응이 있는지 확인한다.
  - `429`
  - 일시적 빈 응답
  - 부분 성공 후 계속 진행되는지

실행 결과 (로컬 코드 기준, 2026-04-16):

- [x] 프로그램 적재 진입점은 `backend/routers/admin.py`의 `POST /admin/sync/programs`다.
- [x] 실제 적재 어댑터는 `backend/rag/source_adapters/work24_training.py`의 `Work24TrainingAdapter`다.
- [x] 현재 sync 경로는 `WORK24_OPEN_API_AUTH_KEY`가 아니라 `WORK24_TRAINING_AUTH_KEY`를 직접 요구한다.
- [x] 적재 shape는 아래 필드를 기준으로 `programs` 테이블에 upsert된다.
  - `hrd_id`
  - `title`
  - `category`
  - `location`
  - `start_date`
  - `end_date`
  - `deadline`
  - `cost`
  - `subsidy_amount`
  - `support_type`
  - `teaching_method`
  - `raw_data`
- [x] Chroma 동기화는 upsert 이후 별도 배치로 이어진다.
  - 경로: `backend/routers/admin.py` -> `_fetch_chroma_sync_candidates()` -> `_sync_program_batches()`
- [x] rate limit 대응은 일부 들어 있다.
  - `Work24TrainingAdapter`는 요청 재시도(`REQUEST_RETRY_COUNT = 3`)를 가진다.
  - Chroma sync 배치는 예외 시 skip + warning log를 남긴다.
  - 배치 사이 `2초` sleep이 있다.
- [x] 정적 룰 시드를 위한 스크립트를 추가했다.
  - 구현: `backend/rag/recommendation_rules_seed.py`
  - 용도: `programs` 테이블 기준으로 `recommendation_rules` payload 생성 및 upsert
  - CLI: `python -m backend.rag.recommendation_rules_seed --help`
- [x] 시드 로직 테스트를 추가했다.
  - 구현: `backend/tests/test_recommendation_rules_seed.py`
- [ ] `POST /admin/sync/programs` live 실행
  - 상태: `ADMIN_SECRET_KEY`, `WORK24_TRAINING_AUTH_KEY` 부재로 보류
- [ ] 실제 Supabase row 수, `SELECT DISTINCT location`, Chroma 컬렉션 문서 수 확인
  - 상태: live 검증 보류

영향 파일:

- `backend/routers/admin.py`
- `backend/rag/collector/work24_collector.py`
- `backend/rag/collector/scheduler.py`
- `backend/rag/source_adapters/work24_training.py`
- `backend/rag/programs_rag.py`
- `backend/rag/chroma_client.py`
- `backend/rag/manage_chroma.py`
- `backend/tests/test_work24_training_adapter.py`
- `backend/tests/test_chroma_client.py`

완료 기준:

- 추천할 프로그램 row가 실제로 존재한다.
- 추천 API가 빈 목록이 아니라 실제 후보군을 만들 수 있다.

멈춤 조건:

- `synced == 0`
- Chroma 초기화 실패
- `programs` row는 있는데 `id`, `category`, `location`, `deadline`이 비정상적으로 비어 있음
- rate limit 때문에 sync가 반복 실패하고 재시도 전략이 없을 때

## 3. 백엔드 추천 API 검증

- [ ] `backend/routers/programs.py`에서 현재 `/programs/recommend` 요청/응답 shape를 고정한다.
- [ ] 비로그인 fallback이 의도대로 동작하는지 확인한다.
- [ ] 로그인은 했지만 프로필/활동이 거의 없는 신규 사용자 fallback이 어떻게 동작하는지 확인한다.
- [ ] 로그인 사용자 기준 캐시 hit / miss / force refresh 흐름을 확인한다.
- [ ] category / region 필터가 실제 DB 값과 맞는지 확인한다.
- [ ] `backend/rag/programs_rag.py`에서 `reason`, `fit_keywords`, `final_score`, `urgency_score`가 어떻게 채워지는지 점검한다.
- [ ] 추천 결과 정렬 기준을 코드에서 명시적으로 확인한다.
  - `final_score` 내림차순
  - 동일 score일 때 `urgency_score` 보조 정렬
- [ ] 캐시 TTL이 얼마인지 확인한다.
  - 현재 코드 기준 `RECOMMEND_CACHE_TTL_HOURS = 24`
- [ ] 필터 miss 시 전체 검색 fallback이 있는지 확인한다.

영향 파일:

- `backend/main.py`
- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `backend/rag/chroma_client.py`
- `backend/utils/supabase_admin.py`
- `backend/tests/test_programs_router.py`

완료 기준:

- `POST /programs/recommend`
  - [ ] 기본 추천
  - [ ] 로그인 신규 사용자 fallback
  - [ ] `category`
  - [ ] `region`
  - [ ] `force_refresh`
  - [ ] 캐시 hit
  - [ ] 캐시 miss
  모두 기대한 shape로 응답한다.

## 4. BFF 연결 체크

- [ ] `frontend/app/api/dashboard/recommended-programs/route.ts`가 query string을 받아 backend로 넘기게 한다.
- [ ] BFF에서 추천 필드를 프론트 친화적인 이름으로 매핑할지 결정한다.
  - 권장 후보: `reason`, `fitKeywords`, `score`
  - 대안: 기존 `Program` 확장 필드 유지
- [ ] 결정한 필드명으로 추천 사유/키워드/점수를 보존하게 한다.
- [ ] `frontend/lib/api/app.ts`에서 추천 API 호출 파라미터를 받을 수 있게 한다.
- [ ] `frontend/lib/types/index.ts`의 `Program` 타입에 추천 전용 optional 필드를 추가한다.
- [ ] backend가 `500` 또는 timeout일 때 BFF가 어떤 응답을 줄지 정한다.
  - 에러 그대로 전달
  - 빈 배열 반환
  - 사용자 친화 메시지 반환

영향 파일:

- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`

완료 기준:

- 대시보드가 backend 응답의 추천 사유/키워드/점수를 잃지 않고 받는다.
- BFF 에러 정책이 문서와 구현에서 일치한다.

## 5. 대시보드 UI 연결

- [ ] `frontend/app/dashboard/page.tsx`에서 추천 카드 로딩을 `selectedCategory`, `selectedRegion` 기준으로 다시 요청할 수 있게 한다.
- [ ] 카테고리 필터는 기존 공개 프로그램 허브와 같은 체계를 우선 사용한다.
  - 참고: `frontend/lib/program-categories.ts`
- [ ] 지역 필터는 현재 공개 프로그램 허브에서 쓰는 값과 맞춘다.
  - 적재 후 `SELECT DISTINCT location FROM programs` 결과를 기준으로 최종 확정한다.
- [ ] 카드에 추천 이유를 2줄 이내로 보여준다.
- [ ] 카드에 맞춤 키워드 배지를 최대 3개까지 보여준다.
- [ ] 날짜 필터(`MiniCalendar`)는 그대로 유지한다.
- [ ] 필터 변경 시 로딩 상태가 자연스럽게 보이도록 한다.
  - 스켈레톤
  - 스피너
  - 이전 결과 유지 여부
- [ ] 필터와 날짜 필터가 동시에 있을 때도 빈 상태 메시지가 이해 가능해야 한다.
- [ ] 필터가 없어도 추천 결과가 0건일 때의 빈 상태 메시지를 정의한다.
  - 신규 사용자
  - 데이터 적재 전
  - 추천 사유 생성 실패 후 fallback

영향 파일:

- `frontend/app/dashboard/page.tsx`
- `frontend/components/MiniCalendar.tsx`
- `frontend/lib/program-categories.ts`
- `frontend/lib/types/index.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`

완료 기준:

- 사용자는 대시보드에서
  - [ ] 카테고리 선택
  - [ ] 지역 선택
  - [ ] 추천 이유 확인
  - [ ] 키워드 확인
  를 할 수 있다.

## 6. 프로필/활동 갱신 후 추천 무효화

- [ ] 무효화 전략을 결정한다.
  - 즉시 갱신
  - 다음 대시보드 진입 시 갱신
- [ ] 프로필 저장 성공 후 결정된 전략을 구현한다.
- [ ] 활동 생성/수정/삭제 성공 후 결정된 전략을 구현한다.
- [ ] 실패해도 사용자 저장 자체는 막지 않도록 추천 갱신이 soft-fail인지 확인한다.

영향 파일:

- `backend/routers/programs.py`
- `backend/routers/activities.py`
- `frontend/lib/api/app.ts`
- `frontend/app/api/dashboard/profile/route.ts`
- `frontend/app/api/dashboard/activities/route.ts`
- `frontend/app/api/dashboard/activities/[id]/route.ts`
- `frontend/app/dashboard/profile/page.tsx`
- `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
- `frontend/app/dashboard/profile/_lib/profile-page.ts`
- `frontend/app/dashboard/profile/*`
- `frontend/app/dashboard/activities/page.tsx`
- `frontend/app/dashboard/activities/new/page.tsx`
- `frontend/app/dashboard/activities/[id]/page.tsx`
- `frontend/app/dashboard/activities/*`

완료 기준:

- 프로필/활동 변경 이후 오래된 추천이 계속 남아 있는 문제가 줄어든다.

## 7. 검증 순서

- [ ] 백엔드 단위 검증
  - `backend/tests/test_programs_router.py`
  - `backend/tests/test_chroma_client.py`
  - `backend/tests/test_work24_training_adapter.py`
- [ ] 프론트 타입/빌드 검증
  - `frontend` 빌드 또는 타입체크
- [ ] 수동 시나리오 검증
  - 비로그인 -> 로그인 전환 시 추천이 개인화로 바뀌는지
  - 로그인 후 대시보드 진입
  - 기본 추천 표시
  - 카테고리 필터 변경
  - 지역 필터 변경
  - 카테고리/지역 필터를 빠르게 연타했을 때 race condition이 없는지
  - 느린 네트워크 또는 timeout에서 추천 카드 에러 처리
  - 추천 이유/키워드 표시
  - 프로필 저장 후 추천 갱신
  - 활동 저장 후 추천 갱신
  - 모바일 폭에서 카드 1열

영향 파일:

- `backend/tests/test_programs_router.py`
- `backend/tests/test_chroma_client.py`
- `backend/tests/test_work24_training_adapter.py`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`

## 8. 커밋 체크포인트

- [ ] 브랜치 전략을 먼저 정한다.
  - `develop`에서 직접 작업할지
  - `feature/recommend-system` 같은 작업 브랜치를 딸지
- [ ] PR 전략을 먼저 정한다.
  - 체크포인트마다 PR
  - 마지막에 한 번에 PR
- [ ] 체크포인트 1: 스키마/데이터 적재 안정화
- [ ] 체크포인트 2: 백엔드 추천 API 검증 완료
- [ ] 체크포인트 3: BFF/타입 연결 완료
- [ ] 체크포인트 4: 대시보드 UI 완료
- [ ] 체크포인트 5: 수동 검증 및 테스트 완료

권장:

- 한 번에 크게 묶지 말고 체크포인트 단위로 끊어 작업한다.

## 9. 에러 모니터링 / 로깅

- [ ] 추천 API에서 각 외부 호출 실패 시 로그가 남는지 확인한다.
  - Supabase cache load/save/delete
  - Gemini reason generation
  - Chroma search
- [ ] Chroma 검색 실패 또는 filter miss일 때 graceful degradation이 되는지 확인한다.
  - 전체 검색 fallback
  - 기본 프로그램 fallback
- [ ] 신규 사용자 fallback과 장애 fallback 로그를 구분할 수 있는지 본다.

영향 파일:

- `backend/routers/admin.py`
- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `backend/rag/chroma_client.py`
- `backend/utils/supabase_admin.py`

## 10. 성능 기준선

- [ ] `/programs/recommend` 응답 시간 목표를 정한다.
  - 캐시 hit 목표
  - 캐시 miss 목표
- [ ] Chroma `programs` 컬렉션 문서 수 기준 검색 성능을 측정한다.
- [ ] 대시보드 필터 변경 시 체감 로딩 시간을 기록한다.
- [ ] Gemini reason 생성이 병목이면 fallback만으로도 화면이 usable한지 확인한다.

영향 파일:

- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `backend/rag/chroma_client.py`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/lib/api/app.ts`

## 11. 2차 범위: 일자리 추천은 언제 시작할지

아래가 준비되기 전에는 시작하지 않는다.

- [ ] 채용공고 데이터 소스 확정
- [ ] 채용공고 저장 테이블 정의
- [ ] 공고 수집/동기화 경로 정의
- [ ] 프로그램 추천과 공고 추천의 UI 분리 여부 결정
- [ ] 직무 taxonomy / skill map과 채용공고 매칭 규칙 설계

영향 파일:

- `backend/routers/skills.py`
- `backend/data/role_skill_map.json`
- `backend/rag/source_adapters/work24_job_info.py`
- `backend/rag/source_adapters/work24_job_support.py`
- `backend/rag/source_adapters/work24_job_duty.py`

## 최종 완료 기준

- [ ] 프로그램 데이터가 실제로 적재되어 있다.
- [ ] `/programs/recommend`가 실제 추천 결과를 반환한다.
- [ ] 대시보드에서 필터 기반 추천이 된다.
- [ ] 추천 이유와 키워드가 카드에 보인다.
- [ ] 프로필/활동 변경 후 추천이 갱신된다.
- [ ] 테스트/수동 검증 결과가 기록된다.
## 2026-04-16 coach recommendation context update

- [x] `backend/routers/coach.py`
  - 로그인 사용자 기준으로 `recommendations`와 `programs`에서 상위 추천 결과를 읽어온다
  - Supabase 미설정, 추천 캐시 0건, 조회 실패 시에도 코치 응답은 soft-fail로 유지한다
- [x] `backend/chains/coach_graph.py`
  - `CoachState`와 `CoachPromptInput`에 `recommended_programs`를 추가한다
  - 코치 프롬프트에 `[추천 프로그램 문맥]` 블록을 주입한다
- [x] 기존 동작 유지
  - `intro_generate` 모드는 계속 추천 조회를 건너뛴다
  - 비로그인 사용자와 캐시 miss 사용자는 기존 코치 흐름을 그대로 사용한다
  - 추천 문맥을 읽지 못해도 coach API 자체는 실패하지 않는다
- [x] 로컬 검증
  - `backend\\.venv310\\Scripts\\python.exe -m compileall backend/chains/coach_graph.py backend/routers/coach.py backend/tests/test_coach_e2e.py backend/tests/test_coach_sessions_api.py`
  - `backend\\.venv310\\Scripts\\python.exe -m pytest backend/tests/test_coach_e2e.py backend/tests/test_coach_sessions_api.py`
  - 결과: `16 passed`
- [ ] 라이브 검증 보류
  - 실제 `recommendations`가 채워진 로그인 사용자로 코치 응답 문맥을 확인한다
  - stale 캐시 row가 코치 응답에 과하게 영향을 주지 않는지 확인한다
  - fallback 응답은 아직 추천 문맥을 직접 사용하지 않는다

영향 파일:

- `backend/routers/coach.py`
- `backend/chains/coach_graph.py`
- `backend/tests/test_coach_e2e.py`
- `backend/tests/test_coach_sessions_api.py`

## 2026-04-16 stage4-5 local update

- [x] `frontend/app/api/dashboard/recommended-programs/route.ts`
  - 백엔드 `items[].program`만 전달하던 BFF를 수정해 `reason`, `fitKeywords`, `score`를 같이 내려주도록 변경했다.
  - 인증 실패는 `401 UNAUTHORIZED`, 백엔드 5xx는 `502 UPSTREAM_ERROR`로 구분했다.
- [x] `frontend/lib/types/index.ts`
  - `RecommendedProgram`, `RecommendedProgramsResponse` 타입을 추가했다.
- [x] `frontend/lib/api/app.ts`
  - `getRecommendedPrograms()` 반환 타입을 추천 전용 응답으로 변경했다.
- [x] `frontend/app/dashboard/page.tsx`
  - 추천 카드에 추천 사유와 키워드를 노출하도록 수정했다.
  - 점수 표시는 `score ?? final_score` 우선순위로 읽도록 맞췄다.
  - 기존 로딩/빈 상태 흐름은 유지했다.
- [ ] live 검증 보류
  - 실제 로그인 사용자 기준 BFF 응답 shape 확인
  - 실제 추천 카드의 사유/키워드 노출 확인
  - 느린 네트워크/백엔드 오류 시 에러 문구 확인

영향 파일:

- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/lib/types/index.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/dashboard/page.tsx`

## 2026-04-16 migration audit follow-up

- [x] `supabase/migrations/001_init_schema.sql`의 구형 `coach_sessions`와 `supabase/migrations/20260403093000_create_coach_sessions.sql`의 현재 계약 드리프트를 확인했다.
- [x] corrective migration을 추가했다.
  - 구현: `supabase/migrations/20260416143000_reconcile_coach_sessions_schema.sql`
  - 목적: 구형 환경에서도 현재 코드가 기대하는 `job_title`, `section_type`, `activity_description`, `last_structure_diagnosis`, `missing_elements` 등을 보정한다.
  - 원칙: 과거 migration 파일을 직접 수정하지 않고 새 migration으로 교정한다.
- [x] `programs` 정본 체인을 다시 고정했다.
  - 기준: `20260410120000` -> `20260410133000` -> `20260415113000` -> `20260415170000`
  - 메모: `20260415_create_programs.sql`은 현재 앱 정본 스키마가 아니라 별도 초안으로 취급한다.
- [x] `recommendations` 현재 계약을 다시 고정했다.
  - 기준: `20260415_create_recommendations.sql` + `20260416120000_expand_recommendations_cache_columns.sql` + `20260416132000_fix_recommendations_cache_contract.sql`
  - 메모: `20260415_create_recommendations.sql` 단독 상태의 `user_id + program_id` unique 계약은 현재 코드와 다르다.
- [x] `supabase/README.md`에 정본 체인과 live 확인 SQL을 반영했다.
- [ ] live DB에서 실제 적용 상태를 확인한다.
  - `supabase_migrations.schema_migrations`
  - `information_schema.columns`
  - `pg_constraint` 기준 `recommendations` unique 계약

영향 파일:

- `supabase/README.md`
- `supabase/migrations/001_init_schema.sql`
- `supabase/migrations/20260403093000_create_coach_sessions.sql`
- `supabase/migrations/20260415_create_programs.sql`
- `supabase/migrations/20260415_create_recommendations.sql`
- `supabase/migrations/20260416120000_expand_recommendations_cache_columns.sql`
- `supabase/migrations/20260416121000_create_recommendation_rules.sql`
- `supabase/migrations/20260416132000_fix_recommendations_cache_contract.sql`
- `supabase/migrations/20260416143000_reconcile_coach_sessions_schema.sql`

## 2026-04-16 stage3 local update

- [x] `backend/routers/programs.py`
  - Level 1: `recommendation_rules` 조회를 먼저 수행하도록 변경
  - Level 2: `profile_hash + query_hash` 기준으로 `recommendations` 캐시 조회/저장
  - Level 3: rule/cache miss 시 기존 `ProgramsRAG` 호출 유지
  - `force_refresh=true`면 rule/cache를 건너뛰고 해당 query cache를 먼저 비운 뒤 재계산
  - 로그인은 했지만 프로필/활동이 비어 있으면 기본 추천으로 fallback
  - 추천 후보에서 `deadline` / `end_date`가 지난 프로그램은 제외
- [x] `supabase/migrations/20260416132000_fix_recommendations_cache_contract.sql`
  - `recommendations.reason`, `recommendations.fit_keywords` 컬럼 추가
  - 유니크 기준을 `user_id + query_hash + program_id`로 교정
- [x] `backend/rag/recommendation_rules_seed.py`
  - category only rule key도 생성하도록 보강
- [x] `backend/.env.example`
  - 실제 백엔드 런타임 기준 env 키 이름으로 정리
  - `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY`, `WORK24_TRAINING_AUTH_KEY`, `WORK24_OPEN_API_AUTH_KEY`, `GOOGLE_API_KEY` 발급/확인 URL 주석 추가
- [x] 로컬 검증
  - `backend\\.venv310\\Scripts\\python.exe -m compileall backend/routers/programs.py backend/rag/recommendation_rules_seed.py`
  - `backend\\.venv310\\Scripts\\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_recommendation_rules_seed.py`
- [ ] live 검증 보류
  - Supabase migration 실제 적용
  - `POST /admin/sync/programs` 실실행
  - Work24 / Gemini / Supabase 실환경 연결 확인
