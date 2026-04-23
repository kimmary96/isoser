# SESSION-2026-04-24 program sort contract refactor result

## changed files

- `frontend/app/(landing)/programs/program-sort.ts`
- `frontend/app/(landing)/programs/program-sort.test.ts`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `docs/refactoring-log.md`

## why changes were made

- `/programs` 정렬 계약이 페이지와 필터 바에 중복 선언돼 있었고, 그 결과 `popular` 정렬이 URL/backend는 지원하지만 필터 바 메뉴에서는 빠져 있었다.
- 정렬 라벨, 허용값, 기본값, query 정규화를 공용 모듈로 모아 다음 정렬 추가 때 한쪽만 빠지는 회귀를 막으려 했다.

## impact scope

- Frontend only: `/programs` query sort 파싱, active filter label, 필터 바 정렬 메뉴
- Test: 정렬 계약 단위 테스트 추가
- Docs: 리팩토링 로그 추가

## preserved behaviors

- 기본 정렬은 계속 `default`이며, 정렬 query가 비었거나 알 수 없는 값이면 기본 정렬로 fallback한다.
- 기존 `deadline`, `start_soon`, `cost_*`, `duration_*` 정렬 라벨과 동작은 유지된다.
- Live Board와 backend `popular` read-model 동작은 변경하지 않았다.

## risks / possible regressions

- 프런트 공용 모듈에 정렬 정의가 모인 만큼, 이후 정렬 추가 시 이 파일을 먼저 갱신하지 않으면 `/programs` 페이지 전체 계약이 함께 누락될 수 있다.
- 추정: 현재 backend와 frontend가 서로 다른 언어 경계에 있어 완전한 단일 소스 공유는 아니므로, 장기적으로는 문서화나 계약 테스트가 더 필요하다.

## test points

- `npx --prefix frontend vitest run "app/(landing)/programs/program-sort.test.ts" "app/(landing)/programs/page-helpers.test.ts"`
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit`

## follow-up refactoring candidates

- backend `PROGRAM_SORT_OPTIONS` 성격의 계약도 별도 문서나 테스트로 고정해 frontend와 drift를 더 줄이기
- `/programs` 쿼리 파라미터 정규화 유틸을 category/region 쪽까지 공용 모듈로 분리
- 정렬 옵션 메타에 설명 문구를 붙여 UI tooltip이나 접근성 텍스트로 재사용
