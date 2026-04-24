# SESSION-2026-04-24 program surface legacy meta cleanup

## Changed Files
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `docs/specs/compare-meta-runtime-touchpoints-v1.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- `compare_meta`는 이미 정본이 아니지만, 목록/정렬/지역 매칭과 프런트 표시 helper에 direct read가 분산돼 있어 cleanup 범위를 다시 쪼개기 어려웠다.
- 현재 동작을 바꾸지 않으면서도 “정본/`service_meta` 우선, sparse legacy fallback만 유지” 구조를 더 넓게 고정해 두는 편이 이후 축소 작업을 안전하게 만든다.

## Preserved Behaviors
- 공개 응답 shape와 프런트 카드 표시 문구는 바꾸지 않았다.
- 정본 컬럼과 `service_meta`가 비어 있을 때는 기존 `compare_meta` fallback이 계속 살아 있다.
- 검색 텍스트 조립, Work24 deadline source 판정처럼 의미가 큰 direct `compare_meta` 경로는 이번 턴에 건드리지 않았다.

## Risks / Possible Regressions
- `service_meta`와 `compare_meta`가 서로 다른 값을 가질 때는 이제 helper를 거치며 `service_meta`가 우선한다. 현재 방향상 의도된 우선순위지만, 수동 보정 데이터가 legacy 쪽에만 남아 있었다면 표시가 달라질 수 있다.
- 프런트 표시 helper는 여전히 `compare_meta` fallback을 유지하므로 타입에서 바로 제거할 수 있는 단계는 아직 아니다.

## Follow-up Refactoring Candidates
- `backend/routers/programs.py`의 검색 텍스트/필터 옵션/Work24 deadline source 판정에서 남은 direct `compare_meta` 묶음 정리
- `frontend/lib/program-display.ts`에서 실제로 사용 중인 `compare_meta` fallback helper 범위 재평가
- `ProgramListRow.compare_meta` 제거 가능 시점 재판정
