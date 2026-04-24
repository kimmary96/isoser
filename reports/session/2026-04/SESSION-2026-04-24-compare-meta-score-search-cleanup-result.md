# SESSION-2026-04-24 compare meta score search cleanup

## Changed Files
- `backend/services/program_list_scoring.py`
- `backend/rag/programs_rag.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `backend/tests/test_programs_rag.py`
- `docs/specs/compare-meta-runtime-touchpoints-v1.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- 이전 cleanup까지 끝난 뒤에도 검색 helper, 추천 점수 계산, 추천 마감일 해석에는 direct `compare_meta` 읽기가 남아 있었다.
- `service_meta`는 이미 `compare_meta`의 additive bridge 역할을 하므로, 이 경로들도 같은 우선순위 원칙으로 맞추면 남은 cleanup 범위를 더 분명하게 나눌 수 있다.

## Preserved Behaviors
- 공개 API 응답 shape는 바꾸지 않았다.
- sparse row에서는 기존 `compare_meta` fallback이 계속 동작한다.
- Work24 deadline source 판정 로직과 collector/dual-write 생산 경로는 그대로 유지했다.

## Risks / Possible Regressions
- `service_meta`와 `compare_meta`가 충돌하는 legacy row에서는 이제 `service_meta`가 우선한다. 현재 방향상 맞는 우선순위지만, 예전 수동 보정이 legacy 쪽에만 남아 있었다면 추천 점수나 검색 매칭이 일부 달라질 수 있다.
- 이번 턴은 helper 우선순위 정리에 집중했기 때문에 타입 제거나 DB 스키마 정리까지 바로 이어지지는 않는다.

## Follow-up Refactoring Candidates
- collector/admin/dual-write 단계에서 `compare_meta`가 아직 생산되는 구조를 더 줄일 수 있는지 재검토
- `ProgramListRow.compare_meta`와 legacy `Program.compare_meta` 제거 가능 시점 재판정
- Work24 deadline source 판정을 `field_evidence`나 정본 컬럼 쪽으로 더 옮길 수 있는지 검토
