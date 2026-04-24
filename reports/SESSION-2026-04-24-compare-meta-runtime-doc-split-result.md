# SESSION-2026-04-24 compare-meta runtime doc split

## Changed Files
- `docs/specs/compare-meta-runtime-touchpoints-v1.md`
- `docs/specs/README.md`
- `docs/recommendation/program-recommendation-checklist.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- `compare_meta`가 이미 최종 정본은 아닌데도, 실제 저장소 코드에서는 아직 여러 fallback/bridge 경로에 남아 있었다.
- 반대로 `docs/recommendation/program-recommendation-checklist.md`는 2026-04-16 감사 기록인데, 일부 항목이 현재 정본 판단 문서처럼 보일 수 있었다.
- 그래서 “현재 실제 사용 경로”와 “과거 감사 기록”을 문서 차원에서 분리했다.

## Preserved Behaviors
- 코드와 DB 동작은 바꾸지 않았다.
- `compare_meta`를 즉시 제거하지 않고, 현재 active bridge 경로를 문서로만 고정했다.
- 기존 추천/상세/목록/표시 fallback 동작은 그대로 유지된다.

## Risks / Possible Regressions
- 새 문서는 저장소 코드 기준 audit라서, 저장소 밖 수동 SQL이나 외부 운영 스크립트 사용 여부까지는 판단하지 않는다.
- 오래된 체크리스트 안의 세부 실행 기록은 그대로 남아 있으므로, 상단 고지를 읽지 않고 중간 항목만 보면 여전히 혼동할 수 있다.

## Follow-up Refactoring Candidates
- `backend/routers/programs.py`의 상세/검색/필터 fallback에서 `compare_meta` 의존을 항목별로 더 줄이기
- `frontend/lib/program-display.ts` helper에서 canonical field 우선 범위를 더 넓히기
- `ProgramListRow.compare_meta` 제거 가능 시점 재판정
