# Session Result: program-supabase-config-recovery

## Changed files

- `backend/utils/supabase_admin.py`
- `frontend/lib/api/backend.ts`
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-detail-fallback.ts`
- `frontend/lib/server/public-programs-fallback.ts`
- `frontend/lib/api/backend-endpoint.ts`
- `frontend/lib/program-filters.ts`
- `frontend/lib/program-filters.test.ts`
- `frontend/lib/server/public-programs-fallback.ts`
- `frontend/lib/supabase/env.ts`
- `frontend/lib/supabase/server.ts`
- `frontend/lib/supabase/service-role.ts`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/landing-c/_program-utils.test.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/calendar-selections/route.ts`
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 랜딩 `/programs`, 랜딩 추천 경로, 대시보드 추천/북마크 BFF 공통 장애 원인을 먼저 재현한 결과, local backend `127.0.0.1:8000`의 `/programs/list`, `/programs/count`, `/programs/recommend/calendar`가 모두 `503 {"detail":"Supabase is not configured"}`를 반환했다.
- 실제 파일 상태를 확인하면 `frontend/.env.local`과 `backend/.env`에는 Supabase URL/key가 존재했으므로, 핵심 문제는 “값 부재”보다 “실행 중인 프로세스가 그 env를 못 읽는 상태”였다.
- 이를 완화하기 위해 backend/Next server 양쪽 모두 process env 우선 원칙은 유지하면서, 로컬 operator session에서는 env 파일 재해석 fallback을 추가했다.
- 추가 재검증에서 dashboard BFF는 복구됐지만 public `/landing-c`와 `/programs`는 여전히 backend program endpoint 503에 직접 묶여 있었고, `/programs/filter-options`의 caught 503 detail이 dev SSR payload에 그대로 남아 `Supabase is not configured`가 다시 보이는 경로가 확인됐다.
- 이를 막기 위해 public landing/program page에는 direct Supabase summary fallback을 추가했고, non-critical한 `getProgramFilterOptions()`는 retryable local backend metadata 오류일 때 빈 옵션을 반환해 기존 static filter option fallback으로 조용히 내려가도록 정리했다.
- 이어서 관련 문서와 현재 runtime을 다시 맞춰 보니, 최근 free-plan validation 때문에 live `program_list_index`가 `50건` 샘플 상태로 유지되고 있었고 public browse 화면이 이 underfilled read-model을 그대로 믿으면서 예전에 합의한 `browse_rank <= 300`, `광고 3개`, `모집중만`, `만족도/추천 점수 우선` 규칙이 다시 약해졌다.
- 그래서 backend 기본 browse API는 underfilled default read-model을 감지하면 legacy 목록/count/filter-option 경로로 되돌리도록 보강했고, frontend public fallback도 read-model 50건에 묶이지 않도록 legacy open `programs` row를 넓게 읽어 로컬 정렬 후 `300 programs / 3 promoted / 12 urgent` 구성을 복원했다.
- 추가 확인에서 landing/list는 살아 있어도 상세 `/programs/[id]`는 backend `/programs/{id}/detail` 단일 의존이라 `과정 보기` 진입 시 다시 "프로그램 정보를 불러오지 못했습니다" 에러 박스로 떨어지는 경로가 확인됐다.
- 이를 막기 위해 detail page에도 direct Supabase fallback을 추가해 backend detail endpoint가 stale/local failure 상태일 때는 `programs` row와 primary `program_source_records`를 직접 읽어 같은 상세 화면을 유지하게 했다.
- 후속 리팩토링으로는 랜딩 칩 의미가 `program-filters.ts`와 `landing-c/_program-utils.ts`에 이중으로 퍼져 있던 중복을 줄이기 위해, 공용 chip definition과 local matcher helper를 같은 모듈로 모았다.
- 추가 확인에서 랜딩 `무료` chip은 `free-no-card`만 backend에 전달하고 있었고, 실제 live `programs`에는 `cost=0`이지만 `cost_type`이 비어 있는 무료/내일배움 후보가 있어도 read-model/metadata sparse 상태에서 빈 결과로 보이는 문제가 드러났다.
- 이를 줄이기 위해 `무료` chip 의미를 `free-no-card + naeil-card`로 넓히고, 비용 칩에서는 legacy `programs`를 더 넓게 훑은 뒤 같은 chip matcher를 적용하는 전용 fallback loader를 추가했다.
- 추가 후속 요청에 따라 `/programs`의 `마감된 공고 보기` 체크 경로와 homepage browse pool refresh 정책도 다시 정리했다. 현재 read-model archive 경로는 최근 90일 컷오프와 `모집중 우선 + 최근 마감 후순위` 규칙을 그대로 표현하지 못하므로, `include_closed_recent=true`일 때는 legacy deadline-window path를 강제해 체크했을 때만 최근 3개월 마감 공고를 함께 검색하도록 보수적으로 고정했다.
- 동시에 read-model refresh SQL은 DB `current_date`(UTC) 기준 때문에 한국시간 자정과 9시간 어긋날 수 있었으므로, `program_list_kst_today()` helper와 daily wrapper/cron migration을 추가해 `300건 browse pool`이 매일 `00:00 KST` 기준으로 다시 계산되게 했다.
- 후속으로 공개 탐색 규칙 제안안을 실제 런타임에 일부 반영했다. `landing-c`와 `/programs`는 이제 `keyword 또는 active filter group 2개 이상`일 때만 `search(scope=all)`로 전환하고, 단일 필터 탐색은 계속 `browse(scope=default)`로 남겨 `300 browse pool` 안에서 먼저 찾도록 정리했다.
- 또 browse pool 자체도 더 urgency-first가 되도록 새 migration에서 `KST open-only -> urgency bucket -> bucket 내부 recommended_score/click hotness -> source diversity -> 300 cut` 순으로 `refresh_program_list_browse_pool(300)`를 재정의했다.

## Preserved behaviors

- 기존 우선순위인 process env -> runtime client 생성 흐름은 유지했다.
- public API contract와 응답 shape는 바꾸지 않았다.
- Supabase anon/service-role 사용 구분도 유지했다.
- `/programs` 필터 바는 backend filter-option endpoint가 비정상일 때도 기존 static source/target 옵션으로 계속 동작한다.
- 기본 공개 browse의 의도였던 `300건 curated browse pool`, 상단 `광고 3개`, 모집중만 노출, landing `추천 공고 3건`은 다시 user-visible 규칙으로 복원했다.
- 공개 상세 `/programs/[id]`도 backend stale 상태에서 generic error box로 떨어지지 않고 직접 Supabase row 기반으로 렌더링을 이어간다.
- 랜딩 `무료` 칩의 사용자-visible 동작은 유지하면서도, query param 생성과 fallback local filtering이 같은 공용 정의를 사용하도록 정리했다.
- 랜딩 `무료` 칩은 이제 내일배움카드 기반 무료 후보까지 포함하며, local stale-backend 상태에서도 전용 free fallback 덕분에 실제 무료 후보를 다시 렌더링한다.
- `/programs`의 `마감된 공고 보기`는 체크하지 않았을 때 기존처럼 모집중만 보이고, 체크했을 때만 최근 90일 내 마감 공고가 추가된다.
- 공개 랜딩 회귀 수정의 우선 기준은 앞으로 `landing-c`이며, `landing-a`는 보존 경로로만 유지한다.
- `/programs`와 `landing-c`의 browse/search scope 전환 규칙은 이제 같은 helper와 같은 테스트로 고정된다.

## Verification

- Passed: `npm --prefix frontend run lint -- --file lib/supabase/server.ts`
- Passed: `npm --prefix frontend run lint -- --file lib/api/backend.ts --file lib/api/backend-endpoint.ts --file lib/supabase/env.ts --file lib/supabase/server.ts --file lib/supabase/service-role.ts --file app/api/dashboard/recommend-calendar/route.ts --file app/api/dashboard/recommended-programs/route.ts --file app/api/dashboard/calendar-selections/route.ts`
- Passed: `npm --prefix frontend run lint -- --file lib/api/backend.ts --file lib/server/public-programs-fallback.ts --file app/(landing)/landing-c/page.tsx --file app/(landing)/programs/page.tsx`
- Passed: `npm --prefix frontend run lint -- --file lib/server/program-card-summary.ts --file lib/server/public-programs-fallback.ts --file app/(landing)/landing-c/page.tsx --file app/(landing)/landing-c/_program-utils.ts --file app/(landing)/landing-c/_program-utils.test.ts --file app/(landing)/programs/page.tsx`
- Passed: `python -` probe with `backend.utils.supabase_admin.get_supabase_admin_settings()` returned resolved Supabase URL, timeout, and service-role prefix after the fallback change.
- Passed: `python -` probe with `request_supabase(method='GET', path='/rest/v1/programs', params={'select': 'id,title', 'limit': '1'})` returned a real row through the hardened backend config path.
- Passed on fresh process: `GET http://127.0.0.1:8001/health`
- Passed on fresh process: `GET http://127.0.0.1:8001/programs/list?limit=3`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -k "underfilled_default_browse_read_model_triggers_fallback or read_model_query_limits_default_browse_pool or read_model_query_popular_sort_skips_browse_pool"`
- Passed: `GET http://127.0.0.1:3000/api/dashboard/recommend-calendar`
- Passed: `GET http://127.0.0.1:3000/api/dashboard/recommended-programs`
- Passed: browser check on `http://127.0.0.1:3000/landing-c` reported `OK` overlay state and `HAS_CONTENT`
- Passed: browser check on `http://127.0.0.1:3000/programs` reported `OK` overlay state and `PROGRAMS_OK`
- Passed: direct HTML probe on `http://127.0.0.1:3000/landing-c` contained `추천 공고 3건`
- Passed: direct HTML probe on `http://127.0.0.1:3000/programs` contained `전체 프로그램 50개`
- Passed: direct HTML probe on `http://127.0.0.1:3000/programs` no longer contained `Supabase is not configured`
- Passed: direct helper probe `loadPublicProgramsPageFallback()` returned `{ programs: 300, promoted: 3, urgent: 12 }`
- Passed on fresh Next dev (`http://127.0.0.1:3001/programs`): rendered `전체 프로그램 300개`, `광고` 3개, and `Closing Soon`
- Passed on fresh Next dev (`http://127.0.0.1:3001/landing-c`): rendered `추천 공고 3건`
- Passed: `npm --prefix frontend run lint -- --file "lib/server/program-detail-fallback.ts" --file "app/(landing)/programs/[id]/page.tsx"`
- Passed on fresh Next dev (`http://127.0.0.1:3001/programs/004c1989-f408-43fa-82fd-343d1ef967c1`): rendered `프로그램 요약`, `교육기관 정보`
- Passed: `npm --prefix frontend exec vitest run lib/program-filters.test.ts "app/(landing)/landing-c/_program-utils.test.ts"`
- Passed: `npm --prefix frontend run lint -- --file "lib/program-filters.ts" --file "app/(landing)/landing-c/_program-utils.ts" --file "app/(landing)/landing-a/_program-feed.tsx"`
- Passed: `npm --prefix frontend run lint -- --file "lib/server/public-programs-fallback.ts" --file "app/(landing)/landing-c/page.tsx" --file "app/(landing)/landing-a/page.tsx" --file "lib/program-filters.ts" --file "lib/program-filters.test.ts" --file "app/(landing)/landing-c/_program-utils.test.ts"`
- Passed: direct service-role probe on `program_list_index` showed `2026-04-25` 기준 `future free-no-card = 0`, while direct legacy `programs` probe still showed future `cost=0` rows, confirming the sparse `cost_type` mismatch.
- Passed: direct helper probe `loadPublicFreeProgramFallbackRows(20)` returned real future 무료 후보 2건.
- Passed on fresh Next dev (`http://127.0.0.1:3002/landing-c?chip=무료`): no empty-state message, and rendered `[도봉구청년창업센터] 제3차 스케일업 아카데미 ...`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -k "read_model_is_disabled_for_recent_closed_mode or program_browse_pool_daily_refresh_migration_uses_kst_midnight_schedule"`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -k "program_list_mode_treats_two_filter_groups_as_search or program_active_filter_group_count_counts_filter_families or program_browse_pool_priority_migration_uses_urgency_bucket_before_diversity or read_model_mode_splits_browse_search_and_archive"`
- Passed: `npm --prefix frontend exec vitest run lib/program-list-scope.test.ts`
- Passed: `npm --prefix frontend run lint -- --file "lib/program-list-scope.ts" --file "app/(landing)/landing-c/page.tsx" --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/page-filters.ts" --file "lib/server/public-programs-fallback.ts"`

## Risks / possible regressions

- local env file parsing은 단순 `KEY=value` 형식을 기준으로 하므로, 복잡한 multiline env 문법에는 대응하지 않는다.
- 이 세션의 `127.0.0.1:8000` listener는 stale process로 남아 있어, 현재 떠 있는 오래된 서버를 자동으로 교체하지는 못했다.
- 브라우저용 `createBrowserClient()`는 클라이언트 번들 특성상 파일 fallback을 쓸 수 없으므로, 클라이언트 빌드 타임 env 누락 문제는 별도다.
- backend `filter-options`가 죽어 있을 때는 `/programs`의 source/target 목록이 동적 축소 대신 static fallback 옵션으로 보인다.
- legacy `programs` direct fallback은 canonical read-model보다 표시 필드가 덜 정제될 수 있어, browse/read-model refresh가 정상으로 돌아오면 같은 규칙을 다시 read-model 우선으로 타게 하는 편이 가장 안정적이다.
- direct detail fallback은 Python backend detail builder의 모든 가공 규칙을 1:1로 복제하지는 않으므로, 아주 세부적인 field precedence는 backend 정상 경로와 일부 다를 수 있다.
- 랜딩 칩 메타를 공용화했기 때문에, 이후 칩별 시각 스타일까지 완전히 공용화하려면 `landing-a`/`landing-c` UI layer에서 추가 정리가 필요하다.
- 전용 free fallback은 현재 legacy `programs` 스캔 기반이므로, 장기적으로는 read-model `cost_type`/무료 분류 품질을 끌어올려 이 우회 경로 의존도를 줄이는 편이 낫다.
- 새 pg_cron migration은 저장소 기준으로 job을 선언한 것이므로, live Supabase에 migration이 실제 apply되지 않은 환경에서는 자정 refresh가 바로 실행되지는 않는다.
- urgency bucket browse pool 재정의도 동일하게 migration apply 전까지는 live DB에 반영되지 않는다. 저장소 fallback 정렬은 먼저 맞췄지만, read-model browse_rank 자체는 live migration 적용 이후에만 완전히 같은 규칙을 쓴다.
- `landing-a`는 앞으로 parity 우선순위에서 제외되므로, 새 public browse 규칙은 `landing-c` 기준으로 먼저 반영된다.

## Follow-up refactoring candidates

- frontend/server 쪽 env file reader를 별도 공용 helper로 분리해 `calendar-selections`의 중복 로컬 env 파서와 합친다.
- local dev start 스크립트에서 backend/frontend env sanity check를 먼저 수행해 stale process와 env drift를 더 빨리 드러나게 한다.
- stale listener를 자동 탐지해 현재 코드 버전과 맞지 않으면 경고하는 local health-check 스크립트를 추가한다.
- `getProgramFilterOptions()`도 read-model 또는 direct Supabase 기반 lightweight fallback을 추가해, static option fallback보다 현재 결과 집합에 더 가까운 source/target 집계를 제공할 수 있게 한다.
- free-plan sample validation과 실제 public browse runtime을 더 분리해, 검증용 `program_list_index` sample 50건이 사용자-facing 기본 browse 규칙까지 축소시키지 않도록 운영 플래그 또는 별도 dataset을 두는 방안을 검토한다.
- compare batch/detail도 같은 종류의 fallback이 필요한지 실제 사용자 경로 기준으로 한 번 더 점검한다.
- 랜딩 칩 색상/아이콘/카피까지 chip definition 메타에서 함께 관리하도록 확장해 `landing-a`와 `landing-c`의 표현 중복도 줄일 수 있다.
- `program_list_index.cost_type` / browse sample 생성 규칙을 정리해 free/no-card/내일배움 분류가 read-model에서도 직접 맞도록 보강하면, landing 비용 칩 fallback을 더 가볍게 줄일 수 있다.
- archive/open+recent-closed 혼합 모드를 read-model 자체에서 표현할 수 있도록 전용 scope/materialized ordering을 설계하면, 현재의 legacy fallback 의존을 나중에 다시 줄일 수 있다.
- active filter group count를 backend facet/count 경로 전체와 UI telemetry에 연결해, 실제 사용자가 언제 browse에서 search로 넘어가는지 운영 지표로 확인하는 단계가 다음 후속 작업이다.

## Runtime restart update (2026-04-25)

### Changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

### Why changes were made

- backend/frontend를 모두 재기동한 뒤에도 `/programs` 메인 리스트가 비는지 다시 확인하는 과정에서, default public browse fallback이 flat `/programs/list`에서는 stale read-model로 재진입하고 legacy browse query가 base `programs` 테이블에 `scope=eq.default`를 넘겨 결과를 비우는 문제를 재현했다.
- same-session recovery가 실제 cold restart 상황에서도 유지되도록, flat endpoint와 page endpoint의 fallback 판정을 다시 맞추고 legacy browse query를 read-model 전용 필드 없이 실행하도록 정리했다.

### Preserved behaviors

- 검색어 또는 active filter group 2개 이상일 때 `search` 모드로 전환하는 공개 탐색 계약은 유지했다.
- default public browse가 정상 read-model을 쓸 수 있을 때는 기존 read-model 경로를 그대로 사용하고, underfilled/stale 상태에서만 legacy fallback으로 우회한다.
- `/programs/count`는 공개 browse 계약인 `300`을 계속 기준값으로 보여주고, `filter-options`는 기존처럼 동적 조회 실패 시 fallback 경로를 유지한다.

### Risks / possible regressions

- `127.0.0.1:8000` stale listener는 여전히 남아 있어 직접 그 포트만 호출하면 `503 Supabase is not configured`가 보일 수 있다.
- legacy browse fallback은 응답 시간을 줄이기 위해 KST 오늘 이후 deadline window와 bounded scan limit을 쓰므로, 원본 `programs` 테이블의 미래 open row 품질이 매우 나쁠 때는 read-model보다 대표성이 떨어질 수 있다.
- `/programs/count = 300`은 공개 browse 계약을 지키기 위한 값이라, live browse refresh가 비정상일 때 실제 legacy 후보 수와는 다를 수 있다.

### Tests

- Passed: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -k "list_programs_flat_endpoint_falls_back_when_default_browse_read_model_is_underfilled or count_programs_returns_browse_pool_limit_when_default_read_model_is_underfilled or build_program_query_params_bounds_default_browse_deadline_scan or build_program_query_params_for_filtered_list"`
- Passed: `backend\venv\Scripts\python.exe -m py_compile backend/routers/programs.py backend/tests/test_programs_router.py`
- Passed: fresh backend `http://127.0.0.1:8001/programs/list?limit=3` returned populated legacy browse rows with `source="legacy"`
- Passed: fresh backend `http://127.0.0.1:8001/programs/count` returned `{"count":300}`
- Passed: fresh backend `http://127.0.0.1:8001/programs/filter-options` returned `200`
- Passed: fresh frontend `http://127.0.0.1:3000/programs` returned SSR HTML with response length `383807` and table markup present
- Passed: fresh frontend `http://127.0.0.1:3000/landing-c` returned SSR HTML with `Live Board` and `Opportunity feed` sections present

## Runtime stabilization update (2026-04-26)

### Changed files

- `backend/services/program_list_queries.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `scripts/refresh_program_list_index.py`
- `backend/tests/test_program_list_refresh_fallback.py`
- `scripts/repair-local-backend.ps1`
- `scripts/run-backend-checks.ps1`
- `backend/README.md`
- `supabase/migrations/20260426110000_add_program_list_browse_refresh_resilient.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

### Why changes were made

- 남아 있던 3개 리팩토링 후보를 운영 안정화 관점에서 코드로 마무리했다. 대상은 stale local backend repair, browse fallback query builder 분리, browse refresh timeout-safe 경로였다.
- fresh `8001` + fresh `3001` 검증 중 `program_list_index`가 `count=300`이어도 이미 마감된 row를 `/programs` 첫 페이지에 섞는 추가 회귀를 재현했다. browse pool refresh가 stale일 때 underfilled만 보고 read-model을 신뢰하면 운영 화면에 closed row가 다시 노출되기 때문에, closed-row read-model guard를 추가했다.

### Preserved behaviors

- 기본 browse `300` 계약과 `keyword 또는 2개 이상 필터 => search` 계약은 유지했다.
- browse refresh helper가 live DB에 아직 없을 때 `scripts/refresh_program_list_index.py`는 기존 `refresh_program_list_browse_pool` RPC로 계속 fallback 한다.
- `landing-c` 우선 운영 원칙과 public detail fallback, free chip fallback은 그대로 유지했다.

### Risks / possible regressions

- `127.0.0.1:8000`에는 여전히 ownerless stale listener가 남아 있어, 같은 포트의 직접 HTTP 확인은 계속 503일 수 있다.
- 새 resilient browse RPC migration은 저장소에 반영됐지만 live Supabase에 아직 적용되지 않은 상태라, manual refresh는 기존 browse RPC timeout 리스크를 아직 가진다.
- `scripts/repair-local-backend.ps1`는 monitored port(`8000/8001`)와 probe 결과를 기준으로 kill 후보를 판단하므로, 다른 커스텀 포트 운영은 별도 파라미터로 봐야 한다.

### Tests

- Passed: `backend\venv\Scripts\python.exe -m py_compile backend/routers/programs.py backend/services/program_list_queries.py backend/tests/test_programs_router.py scripts/refresh_program_list_index.py backend/tests/test_program_list_refresh_fallback.py`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_list_refresh_fallback.py -q`
- Passed: `powershell -File scripts/repair-local-backend.ps1 -Json` detected the stale ownerless `8000` listener and can start fresh backends on alternate preferred ports
- Passed: fresh `8001` backend after code reload returned `/programs/list?limit=5` with `source="legacy"` and open rows only, confirming the new closed-row read-model fallback engaged
- Passed: fresh `3001` frontend rendered `/programs` without closed rows on the first table page (`NO_CLOSED_TEXT`) and `/programs/[id]` detail still rendered `프로그램 요약`, `교육기관 정보`
