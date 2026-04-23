# Work24 Deadline Risk Mitigation Result

## Changed Files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `scripts/program_backfill.py`
- `backend/tests/test_program_backfill.py`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/program-utils.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made

- 운영 DB 점검에서 Work24 계열 3406개 중 3346개가 `deadline = end_date`로 확인됐다.
- 현재 DB에는 `close_date`, `compare_meta.application_deadline`, `compare_meta.training_end_date`, `raw_data`가 비어 있어 DB 내부 값만으로 실제 신청 마감일을 복구할 수 없다.
- 기존 `/programs` 후보 조회가 DB `deadline` 필터에 먼저 의존하면 오염 deadline이 비교 모달, 목록, 추천, 캘린더 후보군을 왜곡할 수 있다.

## What Changed

- `/programs` 목록/count/filter-options/recommendation 후보 조회는 `deadline >= today` 단일 DB 필터를 먼저 걸지 않고, 1,000건 단위 후보 scan 후 resolved deadline으로 후처리한다.
- resolved deadline은 `close_date`, deadline 관련 `compare_meta`, `deadline` 순으로 해석하고, Work24 `deadline == end_date`는 모집 마감일로 보지 않는다.
- 캘린더 추천 item은 resolved deadline이 없는 프로그램을 제외해 날짜 없는 프로그램이 캘린더에 들어가지 않게 했다.
- Work24 detail response는 `close_date`가 비어 있어도 `compare_meta.application_deadline` 또는 신뢰 가능한 `deadline`을 신청 종료일로 표시한다.
- backfill patch는 Work24 `deadline == end_date` 오염 row에 실제 상세 신청 마감일이 들어오면 `overwrite` 없이 `deadline`과 빈 `close_date`를 교체한다.
- backfill 대상에 `source_unique_key`, `skills`, `tags`, `raw_data`를 추가해 기존 legacy row 품질 복구 범위를 넓혔다.
- 프론트 목록은 제목/source가 있으면 표시하고, resolved deadline이 없으면 `마감일 미확인`으로 보여준다.

## Preserved Behaviors

- 기존 `close_date` 우선순위와 deadline 관련 `compare_meta` 우선순위는 유지했다.
- K-Startup의 신청 종료일 중심 날짜 매핑은 유지했다.
- 검색 index fallback, category/category_detail 후처리 검색, 비용/참여 시간 파생 필터는 유지했다.
- DB 값은 이번 작업에서 직접 수정하지 않았다.

## Risks / Possible Regressions

- deadline 기반 목록/count/recommendation은 후보 scan 범위가 넓어져 DB 요청량이 기존보다 늘 수 있다.
- Work24 row 중 실제 신청 마감일을 아직 찾지 못한 항목은 모집중 목록/캘린더 추천에서 제외되거나 `마감일 미확인`으로 표시된다.
- Supabase direct fallback은 backend 장애 시 Work24 오염 row를 제외하므로 fallback 추천 수가 줄 수 있다.

## Follow-Up Refactoring Candidates

- Work24 detail backfill을 운영에서 실행해 `deadline`, `close_date`, `compare_meta.application_deadline`, `source_unique_key`, `skills`, `raw_data`를 실제로 채운다.
- `고용24`와 `work24_training` source naming을 통합하고 legacy row의 `source_unique_key` 누락을 정리한다.
- resolved deadline 계산을 backend router와 RAG 모듈의 공용 utility로 분리한다.
- 운영 DB에 `cost_type`, `participation_time` migration 적용 여부를 확인해 SQL.md/schema drift를 줄인다.

## Verification

- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py backend\tests\test_program_backfill.py -q`
  - `75 passed`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests -q`
  - `238 passed, 1 skipped`
- Passed: `npm --prefix frontend run lint -- --file "app/api/dashboard/recommend-calendar/route.ts" --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/program-utils.ts"`
- Passed: `npm --prefix frontend exec tsc -- --noEmit --project frontend/tsconfig.json`
- Passed: `npm --prefix frontend run test`
  - `2 passed`, `7 tests passed`
- Passed: `npm --prefix frontend run build`
- Passed: `git diff --check -- backend/routers/programs.py backend/tests/test_programs_router.py scripts/program_backfill.py backend/tests/test_program_backfill.py frontend/app/api/dashboard/recommend-calendar/route.ts "frontend/app/(landing)/programs/page.tsx" "frontend/app/(landing)/programs/program-utils.ts"`
