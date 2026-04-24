# SESSION-2026-04-24 Program Validation Sample Bundle Script Result

## 변경 파일

- `scripts/refresh_program_validation_sample.py`
- `backend/tests/test_program_validation_sample_script.py`
- `docs/current-state.md`
- `docs/specs/supabase-free-plan-program-migration-ops-guide-v1.md`
- `docs/refactoring-log.md`
- `reports\session\2026-04\SESSION-2026-04-24-program-validation-sample-bundle-script-result.md`

## 변경 이유

- `refresh_program_list_index_sample(...)`와 `backfill_program_source_records_sample(...)`가 각각 실검증을 마쳤기 때문에, 다음 병목은 “같은 두 명령을 계속 따로 실행해야 한다”는 운영 번거로움이었다.
- 이번 스크립트는 free plan 반복 검증에서 가장 자주 쓰는 두 단계를 `read model sample refresh -> provenance sample backfill` 순서로 묶어 한 번에 재실행하게 한다.
- 실패 시 어느 단계에서 멈췄는지 바로 보이도록 결합 JSON 리포트 형식으로 맞췄다.
- 이후 실제 터미널 실행에서 `from scripts import ...`가 깨지고 `.env`도 자동 로드되지 않는 문제가 확인돼, 저장소 루트 import path와 backend env loader를 명시적으로 부트스트랩하도록 후속 보정했다.
- 이후 실제 bundle 실행에서 `program_source_records` 단계가 statement timeout으로 실패하는 사례가 확인돼, provenance 스크립트 쪽에 더 작은 batch/max_rows로 자동 재시도하는 fallback을 추가했다.

## 유지한 동작

- 기존 `scripts/refresh_program_list_index.py`와 `scripts/backfill_program_source_records.py`는 그대로 유지했다.
- 새 스크립트는 두 경로를 재사용만 하며, RPC 계약이나 DB helper 동작을 바꾸지 않는다.
- full refresh나 full backfill 경로는 이번 턴에 건드리지 않았다.
- 보정 후에도 bundle 스크립트의 입력 인자와 결합 JSON 출력 형태는 그대로 유지했다.
- provenance 단계가 fallback으로 성공하면 bundle 스크립트는 그대로 성공으로 처리하고, 실제 사용된 batch 크기는 source-record report 안의 `effective_batch_limit`로 남긴다.

## 리스크 / 가능한 회귀

- bundle 스크립트도 결국 두 helper RPC가 DB에 이미 반영돼 있어야만 동작한다.
- 첫 단계가 성공하고 둘째 단계가 실패하면 DB에는 read-model sample만 갱신된 상태가 남을 수 있다.
- 이 스크립트는 free plan 샘플 검증용이므로 운영 전체 동기화 스크립트로 보면 안 된다.
- import/bootstrap 보정은 직접 실행 경로를 고친 것이므로, 패키지 import 방식이 바뀌는 다른 스크립트와 충돌하지 않는지는 기존 테스트 세트로만 확인했다.

## 후속 리팩토링 후보

- bundle 결과를 파일로 저장하는 옵션 추가
- bundle 실행 후 검증 쿼리용 추천 SQL까지 함께 출력하는 모드 검토
- browse/search/archive 샘플을 분리한 상위 preset 구성 검토

