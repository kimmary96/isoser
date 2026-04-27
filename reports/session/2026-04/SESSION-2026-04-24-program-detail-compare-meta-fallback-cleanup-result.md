# SESSION-2026-04-24 program detail compare-meta fallback cleanup

## Changed Files
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- `ProgramDetailResponse` 조립부는 이미 canonical 필드를 먼저 쓰고 있었지만, 상세 builder 안에서 `compare_meta`를 field별로 직접 읽는 코드가 많이 남아 있었다.
- package-5 cleanup 관점에서는 사용자 동작을 바꾸지 않으면서도, 이런 direct fallback을 한곳으로 모아 다음 축소 작업을 더 작게 만드는 편이 안전하다.

## Preserved Behaviors
- 상세 응답 shape는 바꾸지 않았다.
- canonical `program` 컬럼과 `source_record.source_specific` 우선순위는 유지했다.
- `service_meta`가 비어 있거나 일부만 있는 legacy row에서는 여전히 `compare_meta` 기반 상세 값이 살아남는다.

## Risks / Possible Regressions
- `service_meta`와 `compare_meta`에 같은 키가 모두 있을 때는 이제 `service_meta`가 우선한다. 현재 방향상 의도된 우선순위지만, legacy 수동 데이터가 더 최신이었다면 표시가 달라질 수 있다.
- 이 cleanup은 상세 builder 한 묶음만 정리한 것이므로, 검색/필터/점수 계산 쪽 `compare_meta` fallback은 아직 남아 있다.

## Follow-up Refactoring Candidates
- `backend/routers/programs.py`의 지역/참여방식/filter-options fallback 정리
- `frontend/lib/program-display.ts`의 표시 helper에서 canonical field 우선 범위 확대
- `ProgramListRow.compare_meta` 제거 가능 시점 재판정
