# 2026-04-28 최종 데모/배포 전 QA 점검 리포트

## 결론

- 판정: P0 자동 검증 차단 해소, 배포 대시보드/실계정 E2E는 조건부 확인 필요
- 프론트엔드 빌드, 타입, 린트, Vitest, production HTTP smoke는 통과했다.
- 로컬 backend start, `/health`, `/programs/count`, `/programs/list`, 데모 고정 상세 API는 200으로 응답했다.
- 라이브 Supabase 핵심 테이블과 최신 데모 컬럼은 대부분 존재한다.
- 후속 QA에서 `backend pytest` 전체 실패는 해소됐다.
- Render Blueprint의 누락 env 선언과 Chroma runtime seed 유실 위험은 설정 패치로 보강했다.
- 후속 E2E 중 `/programs` 검색이 backend timeout과 frontend SSR 500으로 이어지는 경로를 확인했고, 검색 실패 시 빈 결과 상태로 빠르게 복구하도록 보강했다.
- Vercel 프로젝트는 현재 로컬 CLI에서 링크되어 있지 않아 dashboard env 목록은 자동 조회하지 못했다. 실제 Production env는 배포 직전 수동 대조가 필요하다.
- 사용자 플로우 우선 QA 기준으로 공개 진입, 상세/비교, 추천/캘린더 API fallback, 보호 라우트 redirect는 production local smoke에서 정상이다.
- 발표 고정 프로그램 3개는 열리지만 원천 상세 설명력은 빈약하다. 다만 고정 카드 최적화는 현재 목표에서 제외하고, 기존 유저 플로우 안정성을 우선했다.

## 변경 파일

- 수정: `backend/routers/assistant.py`
- 수정: `backend/routers/programs.py`
- 수정: `backend/render.yaml`
- 수정: `frontend/app/(landing)/programs/page.tsx`
- 수정: `frontend/.env.local.example`
- 수정: `docs/current-state.md`
- 수정: `docs/refactoring-log.md`
- 수정: `backend/tests/test_admin_router.py`
- 수정: `backend/tests/test_ai_smoke.py`
- 수정: `backend/tests/test_assistant_router.py`
- 수정: `backend/tests/test_program_list_api_examples.py`
- 수정: `backend/tests/test_programs_router.py`
- 수정: `backend/tests/test_slack_router.py`
- 수정: `tests/test_create_task_packet.py`
- 추가/갱신: `reports/session/2026-04/SESSION-2026-04-28-final-demo-preflight-qa-result.md`
- DB migration, 큐/task packet 이동, main 머지, push, 실제 배포는 실행하지 않았다.

## 검증 통과

| 항목 | 결과 |
|---|---|
| `npm --prefix frontend run lint` | 통과 |
| `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false` | 통과 |
| `npm --prefix frontend test` | 통과, 36 files / 164 tests |
| `npm --prefix frontend run build` | 통과 |
| `backend\venv\Scripts\python.exe rag\seed.py` | 통과, 약 14초 |
| backend local `/health` | 200 |
| backend local `/programs/count` | 200, count 300 |
| backend local `/programs/list?limit=3&recruiting_only=true` | 200 |
| backend local 데모 상세 `/programs/3446285d.../detail` | 200 |
| frontend production smoke `/`, `/landing-c`, `/programs`, 데모 상세, 비교, `/login` | 모두 200 |
| 보호 라우트 `/onboarding`, `/dashboard`, `/dashboard/resume`, `/dashboard/portfolio` | 비로그인 307 로그인 redirect 정상 |
| `backend\venv\Scripts\python.exe -m pytest backend\tests\test_ai_smoke.py backend\tests\test_assistant_router.py backend\tests\test_slack_router.py tests\test_create_task_packet.py -q` | 통과, 20 passed |
| `backend\venv\Scripts\python.exe -m pytest backend\tests tests -q` | 통과, 566 passed / 1 skipped |
| 임시 persistent Chroma 2-process smoke | 통과, seed 후 다음 프로세스에서도 coach 컬렉션 count 유지 |
| `npm --prefix frontend run lint` 후속 재검증 | 통과 |
| `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false` 후속 재검증 | 통과 |
| `npm --prefix frontend test` 후속 재검증 | 통과, 36 files / 164 tests |
| `npm --prefix frontend run build` 후속 재검증 | 통과 |
| local production smoke: backend 8000 + frontend 3028 | 통과 |
| `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q` 검색 안정화 후속 | 통과, 159 passed |
| frontend `/programs?q=ai`, `/programs?q=청년`, `/programs` dev smoke | 모두 200, 검색 약 7초대 |
| backend `/programs/list?q=ai`, `/programs/list?q=청년` dev smoke | 모두 200, timeout 시 빈 search response로 약 3.5초대 복구 |

### Local production smoke 상세

| 항목 | 결과 |
|---|---|
| backend `/health` | 200 |
| backend `/programs/count` | 200 |
| backend `/programs/list?limit=3&recruiting_only=true` | 200 |
| frontend `/` | 200 |
| frontend `/landing-c` | 200 |
| frontend `/programs` | 200 |
| frontend `/programs/3446285d-ac73-4c10-97fd-0ff7d42676e0` | 200 |
| frontend `/compare?ids=...` | 200 |
| frontend `/login` | 200 |
| frontend `/api/health/config` | 200 |
| frontend `POST /api/programs/:id/detail-view` | 200 |
| frontend `/api/dashboard/recommended-programs` | 200 |
| frontend `/api/dashboard/recommend-calendar?top_k=3` | 200 |
| frontend `/dashboard` 비로그인 | 307, `/login?redirectedFrom=%2Fdashboard` |
| frontend `/onboarding` 비로그인 | 307, `/login?redirectedFrom=%2Fonboarding` |

## 실패 / 위험

### P0 - 후속 QA에서 해소

1. `backend pytest` 전체 red 상태는 해소됐다.
   - 원인: 테스트가 `routers.*` top-level 모듈을 monkeypatch하고, 앱은 `backend.routers.*` 모듈을 등록해 mock이 실제 route에 적용되지 않았다.
   - 조치: 테스트 import를 `backend.routers.*`로 통일하고, `backend/routers/assistant.py` 내부 import를 상대 import로 바꿔 동일 파일이 두 모듈로 로드되는 위험을 줄였다.
   - 추가 조치: `tests/test_create_task_packet.py`는 현재 `build_packet()` 필수 인자(`created_by`, `execution_path`, `supervisor_spec`)에 맞췄다.
   - 결과: `backend\tests tests` 전체 566 passed / 1 skipped.

2. Render Blueprint 기준 누락 env 선언은 보강했다.
   - 추가 선언: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY`, `WORK24_TRAINING_AUTH_KEY`, `SLACK_SIGNING_SECRET`, `SLACK_APPROVER_USER_IDS`
   - `CHROMA_MODE`는 `ephemeral`에서 `persistent`로 변경했다.
   - `startCommand`는 별도 `python rag/seed.py` 프로세스를 제거하고 `uvicorn main:app` 프로세스 startup에서 seed하도록 정리했다.
   - 임시 persistent smoke에서 seed된 coach 컬렉션이 다음 프로세스에도 유지되는 것을 확인했다.

3. `/programs` 검색 500/장기 대기 경로는 해소했다.
   - 원인: 검색어 입력 시 Supabase `search_text`/legacy scan이 statement timeout 또는 HTTP timeout을 내면 backend `/programs/list`가 500을 반환하고, frontend SSR이 이를 오래 기다린 뒤 500으로 전파했다.
   - 조치: backend 검색 read-model에 3.5초 timeout을 걸고, 실패 시 빈 search page response로 복구한다. legacy 검색/대량 scan은 중간 timeout 시 부분 row 또는 빈 row로 복구한다.
   - 조치: frontend `/programs`는 메인 검색 요청과 마감임박/필터 옵션 보조 요청 timeout을 분리하고, 검색/필터 상태에서는 무거운 browse fallback을 기다리지 않는다.
   - 결과: backend `/programs/list?q=ai`, `/programs/list?q=청년`은 200으로 복구되고, frontend `/programs?q=ai`, `/programs?q=청년`도 200으로 렌더링된다.
   - 리스크: DB 검색 인덱스가 timeout 나는 광범위 검색어는 결과가 빈 상태로 보일 수 있다. 데모 안정성을 위해 500/장기 대기보다 빈 결과 복구를 우선했다.

### P0 - 배포 직전 남은 수동 확인

1. Vercel 환경변수 설정을 확인해야 한다.
   - 필수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL`
   - 배포 URL 기준 권장: `NEXT_PUBLIC_BACKEND_URL`은 localhost가 아니라 Render backend URL이어야 한다.
   - 기능별 확인: `GEMINI_API_KEY`(`/api/summary`), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 필요한 운영 기능이 있다.
   - 후속 확인: Vercel project `isoser`는 조회됐고, Production env에는 `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` 3개가 등록되어 있다.
   - Production env 누락 후보: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_KAKAO_MAP_KEY`, `NEXT_PUBLIC_ADSENSE_CLIENT`
   - 영향: 핵심 공개 탐색/추천 fallback은 통과했지만, `/api/summary`, 서비스 role fallback, 분산 rate limit, 지도/광고/SEO 일부 기능은 Production에서 제한될 수 있다.
   - `frontend/.env.local.example`은 현재 코드 사용처 기준으로 누락 후보를 보강했다.

2. Render Dashboard의 실제 secret 값은 수동 확인해야 한다.
   - `render.yaml`은 선언만 보강한다. `sync: false` 값은 dashboard에서 실제 값을 채워야 한다.
   - 특히 `GOOGLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET_KEY`, `WORK24_TRAINING_AUTH_KEY`가 비어 있으면 운영 기능이 제한된다.

3. 실계정 E2E는 아직 자동 완료로 볼 수 없다.
   - Google OAuth 로그인 후 추천 대시보드, 캘린더 저장 재진입, 이력서 저장/PDF, 포트폴리오 저장/재열기, 공고 분석은 발표용 브라우저에서 직접 확인해야 한다.

### P1 - 데모 품질 위험

1. 발표 고정 프로그램 3개는 `program_list_index`에서 모두 `is_open=true`지만 `program_source_records` 연결 row가 없다.
   - 영향: 상세 페이지는 fallback으로 열리지만, 원천 기반 신청/상세 근거가 약할 수 있다.
   - 관찰: core `programs` row의 `summary`는 0자, `description`은 9~16자 수준이다.
   - 후속 확인: 3개 모두 `recruiting_status=open`, `days_left=20~56`, 상세 페이지 200으로 유저 플로우 자체는 정상이다.
   - 결정: 발표 고정 최적화는 보류하고, 실제 사용자가 탐색/상세/비교/추천 fallback을 끊김 없이 지나가는 안정성을 우선한다.

2. `program_source_records` 총 row 수가 50개뿐이다.
   - `programs`와 `program_list_index`는 각 28,225건이다.
   - 영향: 전체 서비스는 read-model/fallback으로 동작하지만, 원천 provenance 기반 상세 품질은 일부 샘플에 제한된다.
   - 후속 확인: source record가 붙은 50개는 모두 `recruiting_status=closed`, `deadline >= 2026-04-28` 후보는 0개다. 모집중 대체 카드 후보로 쓰기에는 부적합하다.
   - Work24 detail backfill dry-run은 외부 상세 HTML 응답 지연으로 1건도 70초 안에 완료되지 않아 발표 직전 자동 보강 수단으로 사용하지 않았다.

3. Render Chroma runtime seed 유실 위험은 설정 패치로 해소했다.
   - 기존 위험: `CHROMA_MODE=ephemeral` + `python rag/seed.py && uvicorn ...` 조합은 seed가 별도 프로세스에만 남았다.
   - 조치: persistent mode와 단일 uvicorn startup seed로 변경했다.
   - 남은 리스크: 실제 Render Dashboard secret 값과 디스크 mount 상태는 배포 환경에서 최종 확인해야 한다.

### P2 - 운영/문서 정합성

1. `frontend/.env.local.example`의 주요 누락 env 설명은 보강했다.
   - 추가: `NEXT_PUBLIC_KAKAO_MAP_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ADSENSE_CLIENT`, `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`
   - 남은 리스크: 예시 파일 보강은 대시보드 env 실제 값 등록을 대신하지 않는다.

2. backend CORS는 `*.vercel.app`와 localhost 중심이다.
   - Vercel preview/production 도메인은 괜찮다.
   - 커스텀 도메인을 붙이면 backend CORS 허용 origin 추가가 필요할 수 있다.

## 라이브 Supabase 점검

확인 host: `irvuoqseofydrcplrfti.supabase.co`

| 항목 | 결과 |
|---|---|
| `profiles` 핵심/확장 컬럼 | OK, count 4 |
| `activities` 핵심 컬럼 | OK, count 40 |
| `resumes.activity_line_overrides` | OK, count 3 |
| `portfolios.source_activity_id`, `portfolio_payload` | OK, count 8 |
| `calendar_program_selections` | OK, count 9 |
| `coach_sessions` 보정 컬럼 | OK, count 4 |
| `program_list_index` surface 컬럼 | OK, count 28,225 |
| `program_source_records` | OK, count 50 |
| `recommendations` cache 컬럼 | OK, count 27 |
| `user_recommendation_profile` | OK, count 4 |
| `activity-images` storage bucket | OK |
| `program_landing_chip_snapshots` | OK, count 10 |

참고: `programs.display_categories`는 존재하지 않는다. 현재 주요 공개 목록/상세는 `program_list_index` 또는 fallback 계산을 사용하므로 즉시 blocker로 보지는 않는다.

## 발표 고정 URL 상태

| 프로그램 | 상태 |
|---|---|
| `3446285d-ac73-4c10-97fd-0ff7d42676e0` | open, 상세 200 |
| `45fcd5e0-e8c9-4fa5-84a8-8c7c8498b747` | open |
| `24ebb6ab-e300-46e8-be35-bac64cc6372e` | open |
| 비교 URL 3개 조합 | frontend production smoke 200 |

## 보존된 동작

- DB migration 적용 없음.
- 큐/task packet 이동 없음.
- `main` 머지, push, 배포 실행 없음.
- assistant 라우팅 응답 계약, Slack 승인/reject 계약, 프로그램 API schema 예시는 기존 기대 동작을 유지하도록 테스트로 확인했다.
- 운영 Supabase 데이터 쓰기는 실행하지 않았다. Work24 backfill은 dry-run만 시도했고 timeout으로 종료됐다.

## 추천 후속 조치

1. 배포 전 Render/Vercel 환경변수 대시보드 값을 실제로 대조한다.
2. 발표용 브라우저에서 Google 로그인 후 P0 퍼널을 1회 이상 끝까지 녹화/리허설한다.
3. Vercel Production env에 기능별 누락 후보를 채운 뒤 `/api/summary`, 지도, 광고, 서비스 role fallback이 필요한 화면을 재확인한다.
4. Render 배포 후 `/health`의 `chroma.mode=persistent`와 seeded collection count를 확인한다.
