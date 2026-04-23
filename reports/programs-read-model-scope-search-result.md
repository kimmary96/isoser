# Programs Read Model Scope Search Result

## 상태

completed

## 변경 파일

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유

`/programs/list?q=...&scope=all` 검색 경로는 `scope=all`을 통해 read model search mode로 전환한다. 하지만 기존 `_build_read_model_params()`는 search mode에서 `params["scope"] = "eq.all"`을 `program_list_index` 쿼리에 추가했다. `program_list_index`에는 `scope` 컬럼이 없으므로, UI 검색 요청이 read model에서 실패하고 legacy fallback으로 돌아갈 수 있었다.

## 변경 내용

- `scope`는 `_program_list_mode()`의 browse/search/archive mode 결정에만 사용한다.
- read model query params에는 `scope` 컬럼 필터를 추가하지 않도록 제거했다.
- `scope=all`이 search mode로 전환되면서도 `scope` filter를 보내지 않는 회귀 테스트를 추가했다.

## 보존한 동작

- `scope=all`은 계속 search mode를 활성화한다.
- `scope=archive`, `closed`, `recent_closed` 계열은 기존처럼 archive mode로 처리된다.
- `q`, category, region, source, teaching method, cost, participation time, target 필터 계약은 유지했다.
- read model 사용 불가 시 legacy fallback 흐름은 유지했다.

## 영향 범위

- `GET /programs/list`
- `GET /programs/count`
- read model 기반 검색 요청
- 프론트 `/programs` 검색 URL의 `scope=all` 경로

## 리스크 / 가능한 회귀

- `scope` 컬럼을 실제 필터로 기대하는 read model 호출자가 있었다면 더 이상 적용되지 않는다. 현재 `program_list_index`에는 해당 컬럼이 없어 필터로 쓰는 것이 잘못된 상태였다.
- archive mode는 `scope` 컬럼이 아니라 `is_open=false`로 동작하므로 이번 변경의 직접 영향은 낮다.

## 테스트 포인트

- `scope=all`이 search mode로 전환되는지
- read model params에 `scope` key가 없는지
- browse mode의 `browse_rank <= 300` 제한은 유지되는지
- recruiting-only search에서는 `is_open=true`가 유지되는지

## 검증

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`

## 추가 리팩토링 후보

- cursor 조건과 region `or` 필터가 서로 덮어쓰는 문제를 다음 우선순위로 테스트/수정한다.
- read model query builder를 별도 pure helper 모듈로 분리해 PostgREST params 조합 회귀를 더 작게 테스트한다.
- offset 허용 정책을 browse pool 300 한정 decision으로 문서화하거나 cursor 기반 UX로 재전환한다.
