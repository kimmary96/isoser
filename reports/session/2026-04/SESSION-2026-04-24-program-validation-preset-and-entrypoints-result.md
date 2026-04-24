# SESSION-2026-04-24 Program Validation Preset and Entrypoints Result

## 변경 파일

- `scripts/refresh_program_validation_sample.py`
- `backend/tests/test_program_validation_sample_script.py`
- `docs/current-state.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/specs/supabase-free-plan-program-migration-ops-guide-v1.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`
- `reports\session\2026-04\SESSION-2026-04-24-program-validation-preset-and-entrypoints-result.md`

## 변경 이유

- 방금 실제로 검증된 free plan 안전 명령은 사실상 `50/50/50` 묶음이었는데, 매번 여섯 개 숫자를 다시 치게 두면 다음 세션에서 운영 실수가 생기기 쉬웠다.
- 그래서 validation bundle 스크립트에 `--preset free-plan-50`을 추가해 의도를 명시적으로 고정하고, `--output`으로 결과 JSON을 파일에도 남길 수 있게 했다.
- 동시에 serializer/API/BFF 전환 문서는 기존에 원칙과 순서만 있었다. 이번 턴에서는 실제 저장소 기준으로 어떤 파일과 함수부터 바꿔야 하는지 다시 확인해 코드 진입점 문서를 따로 만들었다.

## 유지한 동작

- `scripts/refresh_program_validation_sample.py`의 기존 숫자 기반 CLI 호출은 그대로 유지했다.
- preset은 기존 기본값 위에 얹는 alias일 뿐이라, 예전 명령도 계속 동작한다.
- explicit CLI 인자는 preset보다 우선하도록 유지했다.
- 기존 `run_validation_sample()`의 핵심 성공/실패 구조는 유지했고, 실제 DB helper 계약도 바꾸지 않았다.
- serializer/API/BFF 문서는 현재 코드를 설명하는 정리 문서만 추가했으며, 런타임 API 응답이나 프론트 화면 동작은 이번 턴에 직접 바꾸지 않았다.

## 리스크 / 가능한 회귀

- `--output`은 파일 쓰기를 새로 수행하므로, 잘못된 경로를 주면 스크립트가 파일 저장 단계에서 실패할 수 있다.
- preset은 현재 검증된 `free-plan-50` 한 종류만 제공하므로, 더 큰 샘플을 operator가 자동으로 안전하다고 오해하면 안 된다.
- 새 진입점 문서는 2026-04-24 기준 실제 코드를 바탕으로 쓴 것이므로, 이후 backend/frontend 구조가 바뀌면 문서도 같이 갱신해야 한다.

## 테스트 포인트

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_validation_sample_script.py backend/tests/test_program_source_records_sample_backfill_script.py backend/tests/test_program_list_refresh_fallback.py`
- `backend\venv\Scripts\python.exe scripts/refresh_program_validation_sample.py --help`
- 필요 시 실제 운영형 확인:
  - `backend\venv\Scripts\python.exe scripts/refresh_program_validation_sample.py --preset free-plan-50`
  - `backend\venv\Scripts\python.exe scripts/refresh_program_validation_sample.py --preset free-plan-50 --output reports\ops\program-validation\program-validation-sample-latest.json`

## 추가 리팩토링 후보

- `--preset free-plan-100` 같은 상위 샘플 preset 추가 전, 실제 DB timeout/용량 여유 검증을 먼저 자동 기록하도록 보강
- bundle 스크립트가 성공 후 추천 SQL 검증 쿼리까지 함께 출력하도록 운영 모드 추가
- `frontend/lib/types/index.ts`의 `Program` monolith를 실제 구현 단계에서 `ProgramCardSummary`, `ProgramListRow`, `ProgramDetailResponse`, `ProgramSurfaceContext`로 분해

