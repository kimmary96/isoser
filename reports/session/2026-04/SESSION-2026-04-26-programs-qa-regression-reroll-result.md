# SESSION-2026-04-26-programs-qa-regression-reroll-result

## changed files
- `backend/routers/programs.py`
- `backend/services/program_list_filters.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/page-filters.ts`
- `frontend/app/(landing)/programs/programs-urgent-card.tsx`
- `frontend/app/(landing)/programs/programs-table.tsx`
- `frontend/app/(landing)/programs/programs-table-helpers.ts`
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- `/programs`의 단일 파생 필터가 browse 300 계약 안에서 실제 subset count와 순서를 만들지 못해, 필터 전후 결과가 거의 같아 보이는 회귀가 있었다.
- 카테고리 태그가 내부 IT 편향 룰과 broad category fallback에 치우쳐 `NCS 우선` 기준과 어긋났고, `기타`가 과하게 남았다.
- Closing Soon, 참여시간, keyword chip 쪽 표시도 최근 문서 규칙과 어긋난 부분이 남아 있었다.

## preserved behaviors
- browse 300 기본 계약, 광고 row 구조, 상세 이동 흐름, 운영기관 BI fallback, 기본 scope 전환 규칙은 유지했다.
- DB 스키마, read-model 테이블 구조, 기존 `/programs`, `/programs/list`, `/programs/count`, `/programs/filter-options` API shape는 바꾸지 않았다.
- 복수 필터나 keyword search에서 browse 외부 search/archive로 넘어가는 현재 계약은 유지했다.

## risks / possible regressions
- NCS 이름 기반 카테고리 그룹핑은 현재 저장된 `ncs_name/ncs_code` 텍스트 패턴에 의존하므로, 비정형 표기에서는 과소 분류될 수 있다.
- browse mode local subset은 `program_list_index` browse id pool 뒤에 live `programs` row를 다시 읽는 구조라, 단일 파생 필터 요청의 backend 비용이 기존 read-model 단독 경로보다 높다.
- Next dev App Router payload 특성 때문에 이번 세션의 브라우저 자동 확인은 load/console/overlay 위주였고, 세부 색상 class는 코드와 SSR 경로를 함께 근거로 판단했다.

## follow-up refactoring candidates
- category/target/participation derived tag를 read-model refresh 단계까지 끌어올려 browse subset도 direct read-model count/query만으로 처리하게 만들기
- `/programs` row visual rule helper를 더 좁혀 ad row, urgent card, list cell tone contract를 UI helper 단위로 고정하기
- 브라우저 E2E에서 필터 전후 count/order 차이와 keyword chip 제거를 Playwright 같은 시나리오로 상시 고정하기

## 수정 요약
- browse mode + 단일 파생 필터에서는 `program_list_index`의 기본 browse 300 id pool을 먼저 읽고, 그 id에 대응하는 live `programs` row를 같은 순서로 다시 불러와 local post-process filter를 적용하도록 바꿨다.
- `/programs/list` fallback count는 더 이상 현재 page length를 쓰지 않고 실제 filtered total을 다시 계산한다.
- 카테고리 태그와 filter matching은 `ncs_name/ncs_code` 우선 기준으로 재정렬했고, row와 filter label을 같은 사용자-facing 그룹 label로 맞췄다.
- `Closing Soon` wrapper/background, urgent card white background, participation time pill, keyword chip 정리를 current-state 기준으로 다시 맞췄다.

## 현재 문서 규칙과 실제 구현의 어긋난 부분
- 기존 구현은 browse 300 계약을 유지한다면서도 단일 파생 필터에서 broad legacy scan 또는 sparse read-model 컬럼을 사용해, 실제 subset count/order가 browse 결과와 거의 구분되지 않을 수 있었다.
- row 태그는 `AI서비스`, `PM/기획`, `기타` 같은 내부 표현을 쓰고, filter menu는 `데이터·AI`, `프로젝트·취준·창업`처럼 다른 표현을 써서 기준이 일치하지 않았다.
- Closing Soon wrapper와 urgent card background, 참여시간 detail, stale keyword chip 노출이 문서화된 최근 QA 규칙과 어긋나 있었다.

## 필터 로직 변경 내용
- `backend/routers/programs.py`
  - `_should_use_local_browse_subset(...)`를 추가해 browse mode + 단일 파생 필터 상황을 따로 식별한다.
  - `_fetch_default_browse_pool_program_ids()`와 `_fetch_program_rows_by_ids_ordered()`로 browse 300 id pool을 읽고 같은 순서의 live row를 다시 조립한다.
  - `_load_local_browse_subset_rows()`가 위 browse pool을 기준으로 category/target/cost/participation local filter를 적용해 subset row를 만든다.
  - `/programs`, `/programs/list`, `/programs/count`가 이 subset 경로를 공통으로 사용해 count와 page slice를 맞춘다.
- `list_programs_page(...)` legacy fallback은 이제 `len(rows)`가 아니라 `_count_program_rows(...)` 결과를 `count`로 돌려준다.

## 카테고리/NCS 적용 방식
- `backend/services/program_list_filters.py`
  - `ncs_name/ncs_code` 값을 row/service_meta/compare_meta/raw_data에서 먼저 모아 `PROGRAM_NCS_CATEGORY_RULES`로 category group을 추론한다.
  - 이후 explicit `category_detail`, title/summary/description/skills 기반 fallback 규칙을 적용한다.
  - row `display_categories`와 `category_detail` filter matching이 같은 `_derive_category_filter_tags(...)` 결과를 공유한다.
  - `기타`는 다른 분류 신호가 없을 때만 마지막 fallback으로 남긴다.

## UI 수정 내용
- `frontend/app/(landing)/programs/page.tsx`
  - `Closing Soon` wrapper를 `border-rose-200 bg-rose-50/70` 톤으로 조정했다.
- `frontend/app/(landing)/programs/programs-urgent-card.tsx`
  - urgent card 내부 배경을 흰색으로 되돌렸다.
- `frontend/app/(landing)/programs/programs-table.tsx`
  - 참여시간 detail도 plain text 대신 pill chip으로 렌더링한다.
- `frontend/lib/program-display.ts`
  - visible keyword chip에서 `마감임박`, `최근등록`, `관련도`, `광고` 같은 상태/보조 텍스트를 제거한다.
- `frontend/app/(landing)/programs/page-filters.ts`
  - category menu label을 row 태그와 맞는 사용자-facing 그룹 label로 정리했다.

## 테스트 결과
- Passed: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
- Passed: `npm --prefix frontend test -- lib/program-display.test.ts "app/(landing)/programs/page-helpers.test.ts"`
- Passed: `backend\venv\Scripts\python.exe -m py_compile backend/routers/programs.py backend/services/program_list_filters.py backend/tests/test_programs_router.py`
- Passed: `npm --prefix frontend run lint -- --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/programs-urgent-card.tsx" --file "app/(landing)/programs/programs-table.tsx" --file "app/(landing)/programs/programs-table-helpers.ts" --file "app/(landing)/programs/page-filters.ts" --file "lib/program-display.ts" --file "lib/program-display.test.ts"`
- Passed: `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit --pretty false`
- Browser check on `http://127.0.0.1:3000/programs`
  - page load: pass
  - error overlay: none
  - console error probe: `[]`
  - note: App Router dev payload 특성 때문에 세부 class/token 추출은 제한적이었다.

## 남은 문제
- 실데이터 기준 필터 전/후 count 숫자까지 브라우저에서 완전히 캡처하는 E2E 검증은 이번 세션에서 자동화하지 못했다.
- browse subset이 read-model id pool + live row 재조회 조합이라, 이후 read-model에 derived facet가 더 채워지면 direct read-model 경로로 다시 단순화할 여지가 있다.
