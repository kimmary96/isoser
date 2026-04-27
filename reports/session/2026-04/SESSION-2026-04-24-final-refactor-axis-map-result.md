# SESSION-2026-04-24 Final Refactor Axis Map Result

## Changed Files

- `docs/specs/final-refactor-axis-map-v1.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`
- `reports\session\2026-04\SESSION-2026-04-24-final-refactor-axis-map-result.md`

## Why Changes Were Made

- 프로그램 정본 개편과 사용자 추천 개편 외에 어떤 축을 같이 봐야 하는지 최상위 기준 문서로 묶기 위해 추가했다.
- 새 창에서 이어서 작업할 때 기존 대화 맥락이 사라져도, 어떤 축이 메인이고 어떤 축이 후순위인지 문서만 읽고 바로 복구할 수 있게 하기 위해 정리했다.

## Preserved Behaviors

- 런타임 코드, DB, API 응답은 바꾸지 않았다.
- 기존 스펙 문서는 유지하고, 이번 문서는 그 위를 묶는 상위 기준 문서로 추가했다.

## Risks / Possible Regressions

- 이 문서는 방향과 우선순위를 고정하는 스펙이므로, 이후 세부 스키마/API 문서가 이 기준과 어긋나면 다시 drift가 생길 수 있다.
- 특히 `정규화 사전 축`과 `serializer 축`을 구현 단계에서 빼면 다시 화면/추천 불일치가 생길 수 있다.

## Follow-up Refactoring Candidates

- 프로그램 스키마 설계서
- 공통 serializer / API 계약서
- 정규화 사전 설계서
- 행동 신호 1차 반영 설계서

