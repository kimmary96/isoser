# SESSION-2026-04-24 package-5 live validation follow-up result

## changed files

- `scripts/check_package5_live_state.py`
- `supabase/README.md`
- `supabase/SQL.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 초기 package-5 재점검 문서는 live DB가 `프로그램 축만 일부 적용`된 상태를 기준으로 적혀 있었지만, 이후 SQL Editor 확인과 read-only probe 결과가 누적되면서 실제 상태가 바뀌었다.
- 2026-04-24 후속 확인 기준으로 `profiles.target_job`, `user_program_preferences`, `user_recommendation_profile`, `refresh_user_recommendation_profile(p_user_id uuid)`, `recommendations.query_hash/profile_hash/expires_at/fit_keywords`가 live에 존재했고, `free-plan-50` bounded sample validation도 성공했다.
- 따라서 package-5 문서와 점검 스크립트의 다음 단계 안내를 “migration apply 우선”에서 “row/sample 확인과 문서 마감 우선”으로 바꾸는 최소 수정이 필요했다.
- `supabase/SQL.md`도 현재 기준 스냅샷으로 쓰이려면 `profiles.target_job*`, `recommendations` 새 컬럼, `user_program_preferences`, `user_recommendation_profile` 표가 보여야 해서 관련 섹션을 보강했다.

## preserved behaviors

- 애플리케이션 런타임 코드와 DB write 경로는 변경하지 않았다.
- 기존 program/read-model/recommendation 동작은 그대로 유지했다.
- `scripts/check_package5_live_state.py`는 계속 read-only probe만 수행하며, DDL apply나 write는 하지 않는다.
- 기존 dirty worktree와 `.claude/worktrees/`는 건드리지 않았다.

## risks / possible regressions

- 이번 판정은 `schema_migrations` 직접 조회가 아니라 SQL Editor 결과와 결과물 존재 확인을 근거로 한다. 따라서 버전 이력 자체를 최종 증빙으로 남기려면 가능한 환경에서 추가 확인이 필요하다.
- `supabase/SQL.md`는 여전히 수동 스냅샷 문서라서, 이후 live schema가 더 변하면 다시 stale해질 수 있다.
- bounded sample validation은 성공했지만 full-scale refresh/backfill 검증까지 자동으로 보장하는 것은 아니다.

## follow-up refactoring candidates

- `program_list_index` / `program_source_records` row count와 대표 sample row를 문서나 별도 검증 리포트로 한 번 더 고정한다.
- package-5 완료에 직접 필요한 최소 cleanup 1건만 더 있는지 다시 줄여 본다.
- `schema_migrations`를 조회할 수 있는 환경이 생기면 `20260425103000`~`20260425119000` 버전 이력을 별도 검증 메모로 남긴다.

## verification

- `backend\venv\Scripts\python.exe scripts\check_package5_live_state.py`
- `Get-Content reports\program-validation-sample-latest.json`
- read-only row count 확인: `program_list_index = 50`, `program_source_records = 50`
- read-only sample 확인: 최근 `program_list_index` 5건과 `program_source_records` 5건에서 핵심 컬럼(`source_code`, `source_label`, `application_end_date`, `recruiting_status`, `primary_link`, `is_primary`) 정상 조회
