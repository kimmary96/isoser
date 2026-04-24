# SESSION-2026-04-24 Program Source Records Sample Helper Result

## 변경 파일

- `supabase/migrations/20260425119000_add_program_source_records_sample_backfill_helper.sql`
- `docs/specs/program-source-records-sample-backfill-helper-v1.md`
- `docs/specs/program-canonical-validation-summary-v1.md`
- `docs/specs/supabase-free-plan-program-migration-ops-guide-v1.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`
- `reports\session\2026-04\SESSION-2026-04-24-program-source-records-sample-helper-result.md`

## 변경 이유

- `program_list_index`는 이미 sample helper와 스크립트 경로까지 검증이 끝났지만, `program_source_records`는 여전히 전체 3단계 full backfill 초안만 있어 free plan에서 다시 검증하기가 부담스러웠다.
- 이번 추가 helper는 현재 `program_list_index` 샘플 program id를 우선 대상으로 provenance를 조금만 다시 채우고, 초과 source row를 다시 줄여 free plan에서도 프로그램 축 A 검증을 이어갈 수 있게 하려는 목적이다.
- 문서도 함께 보강해, read model sample helper는 “실검증 완료”, provenance sample helper는 “다음 SQL Editor 검증용 초안”으로 상태를 분리해 남겼다.

## 유지한 동작

- 기존 3단계 full backfill 초안 `20260425115000_backfill_program_source_records_from_programs.sql`는 그대로 유지했다.
- `program_list_index` sample helper와 스크립트 경로는 건드리지 않았다.
- 런타임 코드, API 응답, 실제 운영 DB 상태는 이번 턴에 바꾸지 않았다.

## 리스크 / 가능한 회귀

- 새 helper는 아직 실제 Supabase DB에서 실행 검증하지 않았으므로, 첫 실행 시 row 선택 우선순위나 trim 순서에 대한 추가 보정이 필요할 수 있다.
- 이 helper는 초과 source row를 지울 때 해당 row를 참조하던 `programs.primary_source_*`도 같이 비우므로, 운영 전체 provenance 유지 용도로 보면 안 된다.
- 후보 선정이 현재 `program_list_index` 샘플을 우선 사용하므로, read model 샘플이 비어 있거나 치우쳐 있으면 provenance sample도 같은 영향을 받는다.

## 후속 리팩토링 후보

- `backfill_program_source_records_sample(...)`를 실제 SQL Editor에서 `50`건 기준으로 검증하고 반환 JSON/trim 결과를 문서에 추가
- 필요하면 `scripts/refresh_program_list_index.py`와 별도의 provenance sample helper 호출 스크립트나 서브커맨드 경로 추가
- 장기적으로는 `program_source_records.raw_payload` 보관 정책을 source family별로 더 가볍게 나누는 방안 검토

