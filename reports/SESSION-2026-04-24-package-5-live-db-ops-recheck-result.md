# SESSION-2026-04-24 package-5 live db ops recheck result

## changed files

- `supabase/README.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- package-5 우선순위에 따라 운영 DB migration apply / backfill / validation 절차의 실제 실행 가능 여부를 먼저 다시 판정했다.
- 현재 셸에서 live Supabase를 read-only로 확인한 결과, 프로그램 축은 일부 적용됐지만 사용자 추천 축은 아직 미적용 상태여서 기존 `supabase/README.md`만으로는 현재 운영 상태를 정확히 설명하지 못했다.
- `supabase` CLI와 direct DB connection 설정이 없는 현재 셸에서는 DDL apply를 실행할 수 없으므로, 실제 가능한 범위와 다음 안전한 실행 순서를 문서로 고정했다.

## live read-only findings

- `program_list_index` table: 존재 확인
- `program_source_records` table: 존재 확인
- `programs.primary_source_record_id`, `primary_source_code`, `primary_source_label`, `application_end_date`, `program_start_date`: 컬럼 존재 확인
- `program_list_index.source_code`, `source_label`, `application_end_date`, `program_start_date`, `recruiting_status`, `recruiting_status_label`, `primary_link`: 컬럼 존재 확인
- `user_program_preferences`: 없음
- `user_recommendation_profile`: 없음
- `recommendations.query_hash`, `profile_hash`, `expires_at`, `fit_keywords`: 없음

## preserved behaviors

- 애플리케이션 코드와 DB 런타임 동작은 변경하지 않았다.
- 기존 dirty worktree의 `frontend/app/dashboard/page.tsx` 수정은 건드리지 않았다.
- package-4 read switch 결과나 현재 soft-fail fallback 동작은 그대로 유지했다.

## risks / possible regressions

- `supabase/README.md`는 이번 턴에 실제 live 확인 결과를 반영했지만, 최종 truth는 여전히 `supabase_migrations.schema_migrations`다. SQL Editor나 migration runner에서 다시 확인하지 않으면 live apply 상태를 완전히 닫았다고 볼 수 없다.
- 현재 셸에는 `supabase` CLI와 `SUPABASE_DB_URL`이 없어 DDL apply를 직접 수행할 수 없다.
- 사용자 추천 축이 live에 없기 때문에, `refresh_user_recommendation_profile()`나 `user_recommendation_profile` 우선 read 경로의 soft-fail 로그는 당분간 계속 보일 수 있다.

## follow-up refactoring candidates

- `supabase/SQL.md`를 실제 live schema 기준 snapshot으로 다시 갱신한다.
- SQL Editor 또는 migration runner에서 `20260425103000`~`20260425112000` user recommendation 축 migration 적용 여부를 확정하고, 적용 후 `recommendations` cache 계약까지 다시 확인한다.
- user recommendation 축 적용 뒤 `scripts/refresh_program_validation_sample.py --preset free-plan-50` 기준 bounded sample validation 결과를 새 report로 남긴다.
