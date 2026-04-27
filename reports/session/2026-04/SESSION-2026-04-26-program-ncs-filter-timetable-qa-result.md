# 프로그램 NCS 필터·상세 시간표 QA 결과

## 변경 파일
- `backend/services/program_list_filters.py`
- `backend/services/program_list_queries.py`
- `backend/routers/programs.py`
- `backend/rag/collector/work24_detail_parser.py`
- `backend/tests/test_programs_router.py`
- `backend/tests/test_program_backfill.py`
- `frontend/app/(landing)/programs/page-filters.ts`
- `frontend/app/(landing)/programs/programs-table-helpers.ts`
- `frontend/lib/ncs-categories.ts`
- `frontend/lib/ncs-categories.test.ts`
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `frontend/lib/programs-page-layout.ts`
- `frontend/lib/programs-page-layout.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유
- 프로그램 목록의 카테고리 필터와 과정 chip을 NCS 1차 직종 기준으로 맞추고, stale `기타`/legacy broad category 표시를 줄이기 위함.
- D-1 모집상태가 잘 보이지 않는 문제와 키워드 chip의 목록 컬럼 중복 노출을 줄이기 위함.
- 고용24 상세 페이지에서 금액/시간표 정보를 더 정확히 회수할 수 있는지 확인하기 위함.
- 온라인/오프라인 필터가 sparse read-model 컬럼 때문에 실제 오프라인 row를 0건으로 오판하던 문제를 보정하기 위함.

## 보존한 동작
- 기존 legacy category id URL은 NCS 1차 id로 alias 처리해 가능한 범위에서 기존 링크를 유지한다.
- 기존 비용 표시는 검증된 자부담 신호가 없으면 계속 `자부담 정보 확인 필요`로 보수적으로 노출한다.
- 기본 browse 300, 모집중 기본 노출, read-model happy path는 유지한다.

## QA 결과
- `/programs` 브라우저 확인: 카테고리 드롭다운이 NCS 1차 직종 24개를 표시하고, 첫 페이지 과정 chip의 `기타` 노출은 0건으로 확인.
- D-1 badge computed class: `bg-red-50 text-red-700 ring-1 ring-red-200`.
- 고용24 샘플 상세 URL에서 `selectTracseTimeTable.do` POST 성공: `45일 · 총 204시간 · 19:30~22:30, 09:00~18:00, 19:30~21:30`, 날짜별 schedule 45개 추출.
- 필터 API 확인: 기본 모집중, NCS 정보통신, NCS 문화예술디자인방송, 서울, 온라인, 오프라인, 유료, 파트타임, 고용24, 창업, 마감순 모두 200 OK.

## 리스크 / 후속 후보
- 오프라인 필터는 live read-model의 `teaching_method`가 비어 있는 row를 legacy scan으로 보정하므로 로컬 QA에서 약 22초까지 걸렸다. `program_list_index.teaching_method`를 파생값으로 backfill/refresh하는 후속 작업이 필요하다.
- 고용24 자부담 backfill dry-run에서는 상위 20건 중 patch 대상이 없었다. 더 넓은 pool에서 `--overwrite` 정책을 포함한 운영 계획은 별도 승인 후 진행하는 편이 안전하다.
- 시간표 파서는 HTML 탭 구조 기준으로 동작한다. 상세 일자별 popup `selectTimtblDetailList.do`까지 회수하면 강사/장소/교과목 단위의 더 정밀한 시간표 보강이 가능하다.

## 검증
- `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py backend\services\program_list_filters.py backend\services\program_list_queries.py backend\rag\collector\work24_detail_parser.py`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q -k "category_detail_filter or serialize_program_list_row_derives_display_metadata or serialize_program_list_row_derives_weekend or hides_selection_process or surface_serializer"`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_backfill.py -q -k "work24_detail_parser or work24_timetable_parser"`
- `npm --prefix frontend test -- lib/ncs-categories.test.ts lib/program-display.test.ts lib/programs-page-layout.test.ts "app/(landing)/programs/page-helpers.test.ts"`
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`
