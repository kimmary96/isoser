# SESSION-2026-04-24 Program Source Records Sample Script Result

## 변경 파일

- `scripts/backfill_program_source_records.py`
- `backend/tests/test_program_source_records_sample_backfill_script.py`
- `docs/current-state.md`
- `docs/specs/program-source-records-sample-backfill-helper-v1.md`
- `docs/specs/program-canonical-validation-summary-v1.md`
- `docs/specs/supabase-free-plan-program-migration-ops-guide-v1.md`
- `docs/refactoring-log.md`
- `reports/SESSION-2026-04-24-program-source-records-sample-script-result.md`

## 변경 이유

- `backfill_program_source_records_sample(...)`가 실제 Supabase SQL Editor에서 `50건 적재 + 50건 primary source 연결`까지 확인됐으므로, 다음 단계는 같은 provenance sample backfill을 수동 SQL 복붙 없이 다시 실행할 수 있게 만드는 것이 자연스러웠다.
- 기존에는 SQL Editor에서 helper를 직접 호출해야 했지만, 이제는 전용 스크립트로 같은 RPC를 다시 부를 수 있다.
- 함께 문서도 갱신해 provenance sample helper가 더 이상 “미검증 초안”이 아니라 “샘플 실검증 완료 helper”라는 상태를 반영했다.
- 이후 실제 validation bundle 실행에서 provenance 단계만 statement timeout이 나는 사례가 확인돼, 현재 스크립트는 retryable timeout/lock 오류에 대해 더 작은 batch/max_rows로 자동 재시도하도록 보강됐다.

## 유지한 동작

- 기존 3단계 full backfill 초안과 `program_list_index` sample helper 경로는 그대로 유지했다.
- 이번 스크립트는 새로운 sample provenance backfill 경로만 추가하는 additive 변경이다.
- 런타임 API나 DB 스키마 자체는 이번 턴에 추가로 바꾸지 않았다.
- 기본 성공 시 출력 형식은 그대로 유지하고, 재시도가 실제로 일어나면 `attempt_count`, `effective_batch_limit`, `used_fallback_batch` 같은 메타만 추가로 붙인다.

## 리스크 / 가능한 회귀

- 새 스크립트는 sample helper RPC가 이미 DB에 반영돼 있다는 전제에서만 동작한다.
- sample provenance backfill은 full provenance retention을 대체하지 않으므로, 운영 전체 적재 상태를 기대하면 안 된다.
- helper가 문자열 JSON을 돌릴 때까지는 처리하지만, RPC 반환 포맷이 더 바뀌면 추가 보정이 필요할 수 있다.
- timeout fallback이 들어가도, 최소 batch 바닥값까지 모두 실패하면 최종 결과는 여전히 실패이며 read-model sample만 갱신된 상태가 남을 수 있다.

## 후속 리팩토링 후보

- `scripts/backfill_program_source_records.py`에 기본 preset alias나 결과 파일 저장 옵션 추가
- `refresh_program_list_index.py`와 묶어 “read model sample + provenance sample”을 한 번에 실행하는 상위 orchestration 스크립트 검토
- provenance sample trim 기준을 source family나 최근성 기준으로 더 세밀하게 조정할지 검토
