# SESSION-2026-04-24 Program Canonical Migration Transition Result

## Changed Files

- `docs/specs/program-canonical-schema-design-v1.md`
- `docs/specs/program-recommendation-backend-touchpoints-v1.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/specs/serializer-api-bff-transition-plan-v1.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`
- `reports\session\2026-04\SESSION-2026-04-24-program-canonical-migration-transition-result.md`

## Why Changes Were Made

- 이미 고정된 `program-surface-contract-v2`, 사용자 추천 스키마 문서, 축 맵 문서를 실제 실행 가능한 다음 단계로 잇는 설계 문서가 필요했다.
- 특히 이번 새 창에서 바로 해야 할 일로 지정된 4가지, 즉 프로그램 최종 스키마 설계, backend read/write 접점 정리, 통합 migration 로드맵, serializer/API/BFF 전환 순서를 한 번에 남길 필요가 있었다.
- 현재 저장소에는 `program_list_index`는 이미 있지만 `program_source_records`는 없고, 추천 read/write는 아직 raw profile 중심이어서 그 사이 연결 지점을 명확히 정리할 필요가 있었다.

## Preserved Behaviors

- 런타임 코드, DB, API 응답은 바꾸지 않았다.
- `docs/current-state.md`는 운영 truth 문서이므로 proposed 설계 문서 작업으로 덮어쓰지 않았다.
- 기존 스펙과 draft migration을 뒤집지 않고, 그 위에 다음 단계 문서만 추가했다.

## Risks / Possible Regressions

- 이번 문서는 설계 문서이므로, 이후 실제 migration/코드 전환에서 문서와 구현이 어긋나면 다시 drift가 생길 수 있다.
- `program_source_records`는 아직 실구현이 없어, 실제 collector/admin dual write 설계 때 세부 제약이나 성능 이슈가 추가로 드러날 수 있다.
- `programs`와 `program_list_index`의 현재 컬럼명을 새 canonical 이름으로 옮기는 과정에서 transition 기간이 길어지면 legacy/new 혼합 상태가 길게 유지될 수 있다.

## Follow-up Refactoring Candidates

- `backend/routers/programs.py`의 monolithic serializer와 추천 read 로직 분리
- `frontend/lib/types/index.ts`의 `Program` monolith 해체
- `frontend/app/api/dashboard/recommended-programs/route.ts`의 `_reason`, `_fit_keywords`, `_score` 임시 필드 제거
- `backend/routers/admin.py` ingest path의 `program_source_records` dual write 도입

