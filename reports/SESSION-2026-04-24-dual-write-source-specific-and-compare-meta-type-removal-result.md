# SESSION-2026-04-24 dual write source specific and compare meta type removal

## Changed Files
- `backend/services/program_dual_write.py`
- `backend/routers/admin.py`
- `backend/tests/test_admin_router.py`
- `backend/tests/test_program_dual_write.py`
- `frontend/lib/types/index.ts`
- `frontend/lib/program-display.ts`
- `frontend/app/(landing)/landing-c/_program-utils.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `docs/specs/compare-meta-runtime-touchpoints-v1.md`

## Why Changes Were Made
- `compare_meta` 의존의 핵심 뿌리는 collector/admin/dual-write 단계에서 같은 메타를 여러 곳에 중복 복제하던 구조였다.
- 프런트 타입도 `compare_meta`를 공개 계약처럼 계속 품고 있어 cleanup이 끝난 것처럼 보이지 않았다.
- Work24 training-start deadline marker 판정도 적재 경로마다 helper가 따로 있어 규칙이 다시 벌어질 위험이 있었다.

## Preserved Behaviors
- 기존 프로그램 upsert/additive field/provenance row 생성 동작은 유지했다.
- sparse legacy row에서는 `compare_meta` 기반 fallback이 계속 살아 있다.
- 프런트 표시 helper는 runtime에서 여전히 legacy 메타 fallback을 읽을 수 있다.

## Risks / Possible Regressions
- `program_source_records.source_specific`에 더 이상 안 실리는 키가 있으므로, 저장소 밖 수동 SQL이나 외부 스크립트가 그 넓은 mirror 구조를 가정했다면 별도 확인이 필요하다.
- 프런트 타입에서 `compare_meta`를 제거했기 때문에, 새 코드가 다시 그것을 직접 읽으려 하면 이제 타입에서 막힌다. 현재 방향상 의도된 보호다.

## Follow-up Refactoring Candidates
- collector output 단계에서 `compare_meta` 자체를 더 잘게 줄일 수 있는지 검토
- Work24 deadline source marker를 `field_evidence`나 더 명시적인 canonical field로 옮길 수 있는지 검토
- backend 응답/DB 축에서 남은 `compare_meta` 제거 시점 재판정
