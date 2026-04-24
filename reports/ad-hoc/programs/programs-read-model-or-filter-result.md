# Programs Read Model Or Filter Result

## 상태

completed

## 변경 파일

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유

read model cursor pagination은 다음 페이지 조건을 PostgREST `or` 파라미터로 표현한다. 지역 다중 필터도 `location.ilike` 조건 묶음을 `or`로 표현하므로, 두 조건이 같은 query key를 쓰면 나중에 추가된 조건이 앞선 cursor 조건을 덮어 cursor 안정성이 깨질 수 있었다.

## 변경 내용

- `_add_read_model_or_filter()`로 read model `or` 조건 추가 경로를 통일했다.
- cursor 조건이 먼저 들어간 뒤 region 조건이 추가되면 `or` key를 유지하지 않고 `and=(or(...),or(...))` 형태로 병합한다.
- region-only, cursor-only 경로는 기존처럼 단일 `or` 조건으로 유지한다.
- `test_read_model_query_combines_cursor_and_region_or_filters`로 cursor와 region 필터가 동시에 유지되는지 고정했다.

## 보존한 동작

- cursor 값은 기존 stable sort value + id payload를 유지한다.
- cursor가 없고 region만 있는 요청은 기존 region `or` 필터 형태를 유지한다.
- offset pagination, browse pool 제한, recruiting-only `is_open=true` 조건은 유지한다.
- source, teaching method, cost, participation time, target 필터 계약은 변경하지 않았다.

## 영향 범위

- read model 기반 `GET /programs/list` cursor pagination
- region 다중 필터와 cursor가 함께 쓰이는 직접 API 호출 경로
- promoted/sponsor 후보 조회처럼 같은 helper를 재사용하는 read model query path

## 리스크 / 가능한 회귀

- PostgREST boolean expression 문자열 조합은 문법 회귀 가능성이 있으므로 단위 테스트로 주요 조합을 고정했다.
- 현재 프론트 메인 목록은 offset 기반 숫자 페이지네이션을 사용하므로 사용자 화면의 즉시 영향은 제한적이지만, cursor API caller에는 직접 영향이 있다.

## 테스트 포인트

- cursor-only 요청은 단일 `or` 조건을 유지하는지
- region-only 요청은 location `or` 조건을 유지하는지
- cursor + region 요청은 `and` 안에 cursor `or`와 region `or`가 모두 들어가는지
- browse mode의 `browse_rank <= 300`과 `is_open=true` 조건이 유지되는지

## 검증

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
  - `99 passed`, warnings 6건은 기존 의존성 경고

## 추가 리팩토링 후보

- read model query builder를 별도 pure helper 모듈로 분리해 PostgREST boolean expression 조합을 더 작게 테스트한다.
- cursor-only, invalid cursor, latest/deadline sort cursor 조합을 개별 회귀 테스트로 확장한다.
- 프론트 offset 허용 정책을 browse pool 300 한정 decision으로 문서화하거나 cursor map 기반 UX로 재전환한다.
