# SESSION-2026-04-24 Program List Sample Refresh Script Result

## Changed Files

- `scripts/refresh_program_list_index.py`
- `backend/tests/test_program_list_refresh_fallback.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/SESSION-2026-04-24-program-list-sample-refresh-script-result.md`

## Why Changes Were Made

- `refresh_program_list_index_sample(...)` helper가 실제 Supabase DB에서 기대대로 동작하는 것이 확인됐으므로, 다음 단계는 같은 bounded sample refresh를 스크립트에서도 바로 재사용할 수 있게 만드는 것이 자연스러웠다.
- 기존에는 SQL Editor에서 helper를 수동 실행해야 했지만, 이제는 `scripts/refresh_program_list_index.py --sample-refresh`로 같은 흐름을 바로 호출할 수 있다.
- free plan이나 작은 테스트 DB에서는 이 경로가 전체 refresh보다 훨씬 안전하므로, 운영 가이드와 실제 실행 경로를 맞추는 목적도 있었다.

## Preserved Behaviors

- 기존 기본 경로인 `delta -> browse` incremental refresh는 그대로 유지했다.
- `--browse-only`와 `--legacy-full-refresh`도 유지했다.
- 새 경로는 `--sample-refresh`를 명시할 때만 동작하는 additive 옵션이다.

## Risks / Possible Regressions

- sample refresh는 full refresh 대체가 아니라 bounded validation helper이므로, 운영 전체 read model 동기화를 기대하면 안 된다.
- helper RPC가 아직 없는 환경에서 `--sample-refresh`를 쓰면 실패한다.
- stringified JSONB와 dict 응답 모두 처리하도록 했지만, Supabase RPC 응답 포맷이 더 달라지면 추가 보정이 필요할 수 있다.

## Follow-up Refactoring Candidates

- `scripts/refresh_program_list_index.py`에 sample helper 기본 preset 예시(`--sample-refresh --pool-limit 100 --delta-batch-limit 100`)를 별도 alias로 제공
- sample refresh 결과를 JSON 파일로 저장하는 옵션 추가
- browse/search/archive별 sample helper를 분리할지 검토
