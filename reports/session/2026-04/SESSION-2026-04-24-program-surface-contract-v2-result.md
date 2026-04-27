# SESSION-2026-04-24-program-surface-contract-v2-result

## 변경 파일

- `docs/specs/program-surface-contract-v2.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`

## 왜 변경했는가

- 프로그램 화면들이 같은 `program_id`를 서로 다른 의미로 보여주는 문제를 구조적으로 정리할 기준 문서가 필요했다.
- 초기 제안은 카드형과 테이블형을 하나의 summary 계약으로 묶는 방향이었지만, 실제 페이지 검토 결과 프로그램 목록 테이블은 카드형보다 더 많은 열을 쓰고 있었다.
- 그래서 `BaseSummary -> CardSummary / ListRow -> Detail + SurfaceContext` 구조로 계약을 다시 고정하고, 이후 스키마/API/UI 개편의 기준 문서로 저장했다.

## 보존한 동작

- 코드와 런타임 동작은 변경하지 않았다.
- 기존 API, DB, UI는 그대로 유지된다.
- `docs/current-state.md`는 운영 truth 문서이므로, 아직 구현되지 않은 proposed 계약으로 덮어쓰지 않았다.

## 리스크 / 가능한 회귀

- 이 문서를 바로 구현 문서처럼 오해하면 현재 운영 구조와 혼동할 수 있다.
- 이후 스키마 설계서와 serializer 계약서가 이 문서와 어긋나면 다시 화면별 drift가 생길 수 있다.

## 후속 리팩토링 후보

- `frontend/lib/types/index.ts`의 거대한 `Program` 타입 해체
- `frontend/components/landing/program-card-helpers.ts`와 `frontend/app/(landing)/landing-c/_program-utils.ts`의 formatter 중복 제거
- backend `programs` router serializer 계층 분리
