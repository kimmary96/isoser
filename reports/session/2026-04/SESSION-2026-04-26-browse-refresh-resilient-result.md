# Browse Refresh Resilient Result

작성일: 2026-04-26

## changed files

- `backend/services/program_list_queries.py`
- `backend/routers/programs.py`
- `backend/tests/test_program_list_refresh_fallback.py`
- `scripts/refresh_program_list_index.py`
- `scripts/repair-local-backend.ps1`
- `supabase/migrations/20260426110000_add_program_list_browse_refresh_resilient.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 공개 프로그램 목록 query param 조립 로직을 router 밖으로 분리해 browse/search/archive 규칙을 재사용 가능하게 정리했다.
- browse pool refresh가 timeout 또는 lock pressure에서 전부 실패하지 않도록 bounded fallback SQL 경로를 추가했다.
- refresh 스크립트가 새 RPC가 없는 운영 환경에서도 기존 RPC로 자동 fallback 하도록 맞춰 migration 적용 전후 호환을 유지했다.
- stale local backend listener를 probe하고 정리할 수 있는 PowerShell 운영 스크립트를 추가했다.

## preserved behaviors

- 공개 `/programs/list`와 `/programs/count`의 기존 browse/search/archive 계약은 유지했다.
- browse refresh 스크립트는 새 RPC가 없을 때도 기존 `refresh_program_list_browse_pool`로 계속 동작한다.
- 기존 일일 browse refresh job 이름 `program-list-browse-pool-daily-kst`는 유지한다.
- local backend repair 스크립트는 `-Fix`/`-StartFresh`를 주지 않으면 상태 조회만 수행한다.

## risks / possible regressions

- 새 SQL wrapper는 cron job 내용을 교체하므로 운영 반영 전 함수 권한과 `pg_cron` 사용 가능 여부를 다시 확인해야 한다.
- bounded browse refresh는 full refresh와 후보군 구성이 달라 edge case에서 source diversity나 urgency 분포가 약간 달라질 수 있다.
- router query builder 분리 과정에서 direct function call 기반 테스트는 import 경로와 helper 계약 drift를 다시 점검해야 한다.
- backend repair 스크립트는 Windows PowerShell/CIM cmdlet 가용성에 의존한다.

## follow-up refactoring candidates

- `program_list_queries.py`의 query builder 관련 단위 테스트를 별도 파일로 분리해 router 테스트의 결합도를 더 낮추기
- browse refresh SQL의 source grouping 규칙을 helper SQL 함수로 추출해 중복 case expression 줄이기
- refresh script stage result schema를 typed helper로 정리해 fallback/result 메타 조립 중복 줄이기
- local backend repair 스크립트 probe signature와 kill/start policy를 watcher/local dev 공용 helper로 통합하기
