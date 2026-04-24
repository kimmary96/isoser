# Supabase Migrations

이 폴더는 프로젝트의 DB 변경 이력을 관리합니다.
이미 적용된 migration 파일은 수정하지 않고, 보정이 필요하면 새 migration 파일을 추가합니다.

## 기본 원칙

- 파일명은 `YYYYMMDDHHMMSS_description.sql` 형식을 사용합니다.
- 이미 실행된 migration 파일은 직접 수정하지 않습니다.
- 과거 초안 스키마와 현재 코드 계약이 다르면 기존 파일을 덮어쓰지 말고 corrective migration을 추가합니다.
- live DB 적용 여부의 최종 정본은 `supabase_migrations.schema_migrations`입니다.

## 패키지 5 운영 재점검 메모 (2026-04-24)

### 현재 셸에서 실제로 가능한 것

- `backend/.env`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 있어 service-role REST 읽기와 이미 존재하는 RPC 호출은 가능합니다.
- 현재 셸에는 `supabase` CLI가 없고, `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`도 없습니다.
- 따라서 이 셸에서는 live DB DDL migration apply나 `supabase_migrations.schema_migrations` 직접 조회를 확정적으로 수행할 수 없습니다.
- 즉, 이 셸에서 할 수 있는 일은 `읽기 확인`과 `이미 존재하는 helper/RPC 재실행 판단`까지입니다.

### 2026-04-24 live read-only 확인 결과

| 항목 | 결과 | 의미 |
| --- | --- | --- |
| `program_list_index` table | 존재 확인 | 프로그램 목록 read-model은 live에 있음 |
| `program_source_records` table | 존재 확인 | provenance 테이블은 live에 있음 |
| `programs.primary_source_*`, `application_end_date`, `program_start_date` | 컬럼 존재 확인 | 프로그램 canonical additive 컬럼은 live에 들어와 있음 |
| `program_list_index.source_code`, `source_label`, `application_end_date`, `recruiting_status`, `primary_link` | 컬럼 존재 확인 | surface-contract용 주요 summary 컬럼은 live에 들어와 있음 |
| `user_program_preferences` table | 없음 | 사용자 추천 정본 패키지 일부가 아직 live 미적용 |
| `user_recommendation_profile` table | 없음 | 추천 read switch는 코드상 soft-fail fallback 상태로 보는 것이 맞음 |
| `recommendations.query_hash`, `profile_hash`, `expires_at`, `fit_keywords` | 없음 | 추천 cache 정렬 migration도 live 미완료로 봐야 함 |

현재 판정:

- 코드 저장소 기준 현재 작업 패키지는 `패키지 5`가 맞습니다.
- 하지만 live DB 기준으로는 프로그램 축은 `부분 적용`, 사용자 추천 축은 `미적용` 상태입니다.
- 따라서 package-5 완료로 적기 전에 먼저 `user recommendation migrations 적용 -> 검증 -> sample validation` 순서를 밟아야 합니다.

## 현재 정본 migration 체인

### 1. programs / program_list_index / program_source_records

현재 코드가 기대하는 프로그램 축 체인은 아래 묶음으로 봅니다.

1. base `programs`
   - `20260410120000_create_programs_and_bookmarks.sql`
   - `20260410133000_add_work24_sync_columns_to_programs.sql`
   - `20260415113000_add_compare_meta_to_programs.sql`
   - `20260415170000_add_programs_hub_fields.sql`
   - `20260422190000_add_programs_source_unique_key.sql`
   - `20260422203000_add_programs_search_text_index.sql`
   - `20260422212000_add_programs_category_detail.sql`
   - `20260422213000_add_programs_cost_time_filters.sql`
   - `20260423112000_refine_programs_search_metadata.sql`
   - `20260423143000_relax_programs_legacy_unique_constraints.sql`
2. read-model/runtime
   - `20260423170000_add_program_list_read_model.sql`
   - `20260423191000_program_list_read_model_runtime_indexes.sql`
   - `20260423192000_optimize_program_list_refresh.sql`
   - `20260423193000_enable_program_list_read_model_rls.sql`
   - `20260423194000_harden_program_functions_search_path.sql`
   - `20260423195000_improve_program_list_browse_pool_quality.sql`
   - `20260423203000_conservative_program_participation_display.sql`
   - `20260423204000_add_program_list_browse_refresh_fallback.sql`
   - `20260423205500_add_program_list_delta_refresh.sql`
   - `20260424110000_add_program_detail_click_hotness.sql`
3. canonical/provenance additive
   - `20260425113000_create_program_source_records.sql`
   - `20260425114000_add_program_canonical_columns.sql`
   - `20260425115000_backfill_program_source_records_from_programs.sql`
   - `20260425116000_backfill_program_canonical_fields.sql`
   - `20260425117000_extend_program_list_index_surface_contract.sql`
4. bounded validation helpers
   - `20260425118000_add_program_list_sample_refresh_helper.sql`
   - `20260425119000_add_program_source_records_sample_backfill_helper.sql`

### 2. user recommendation additive

현재 코드가 기대하는 사용자 추천 축 체인은 아래입니다.

1. `20260425103000_add_profiles_target_job_columns.sql`
2. `20260425104000_create_user_program_preferences.sql`
3. `20260425105000_create_user_recommendation_profile.sql`
4. `20260425110000_create_user_recommendation_profile_refresh_function.sql`
5. `20260425111000_backfill_user_recommendation_inputs.sql`
6. `20260425112000_align_recommendations_with_user_recommendation_profile.sql`

중요:

- 2026-04-24 live read-only 확인에서는 이 묶음이 아직 적용되지 않은 것으로 보입니다.
- 즉, `frontend/lib/server/recommendation-profile.ts`와 backend 추천 read는 현재 정상적으로 `soft-fail fallback` 중이라고 보는 편이 맞습니다.

### 3. recommendations / recommendation cache

현재 추천 캐시 계약은 아래 묶음이 모두 반영된 상태를 기준으로 합니다.

1. `20260415_create_recommendations.sql`
2. `20260416120000_expand_recommendations_cache_columns.sql`
3. `20260416132000_fix_recommendations_cache_contract.sql`
4. `20260423123000_align_recommendations_cache_schema.sql`
5. `20260425112000_align_recommendations_with_user_recommendation_profile.sql`

현재 코드 계약:

- `query_hash`
- `profile_hash`
- `expires_at`
- `reason`
- `fit_keywords`
- unique key: `user_id + query_hash + program_id`

주의:

- live read-only 확인에서는 `recommendations.query_hash` 자체가 아직 보이지 않았습니다.
- 따라서 추천 cache는 live DB에서 아직 최신 계약으로 정렬되지 않았다고 보는 편이 안전합니다.

## package-5 현재 권장 실행 순서

### 1. 먼저 migration 적용 여부를 SQL Editor 또는 migration runner에서 확정

```sql
select version
from supabase_migrations.schema_migrations
where version in (
  '20260425103000',
  '20260425104000',
  '20260425105000',
  '20260425110000',
  '20260425111000',
  '20260425112000',
  '20260425113000',
  '20260425114000',
  '20260425115000',
  '20260425116000',
  '20260425117000',
  '20260425118000',
  '20260425119000'
)
order by version;
```

### 2. user recommendation 축 미적용이면 그 묶음을 먼저 적용

우선순위:

1. `20260425103000_add_profiles_target_job_columns.sql`
2. `20260425104000_create_user_program_preferences.sql`
3. `20260425105000_create_user_recommendation_profile.sql`
4. `20260425110000_create_user_recommendation_profile_refresh_function.sql`
5. `20260425111000_backfill_user_recommendation_inputs.sql`
6. `20260425112000_align_recommendations_with_user_recommendation_profile.sql`

이유:

- 지금 저장소 코드는 이미 `user_recommendation_profile` 우선 read와 `refresh_user_recommendation_profile()` bridge를 품고 있습니다.
- live DB에 이 구조가 없으면 추천 경로는 계속 fallback으로만 동작합니다.

### 3. 적용 직후 확인할 SQL

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'user_program_preferences',
    'user_recommendation_profile',
    'program_source_records',
    'program_list_index'
  )
order by table_name;
```

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'recommendations'
  and column_name in ('query_hash', 'profile_hash', 'expires_at', 'fit_keywords')
order by column_name;
```

```sql
select
  count(*) as preference_rows,
  count(*) filter (where coalesce(target_job, '') <> '') as preference_rows_with_target_job
from public.user_program_preferences;
```

```sql
select
  count(*) as derived_rows,
  count(*) filter (where recommendation_ready = true) as ready_rows,
  count(*) filter (where coalesce(effective_target_job, '') <> '') as rows_with_effective_target_job
from public.user_recommendation_profile;
```

### 4. program 축은 full refresh 대신 bounded sample validation부터

상세 가이드는 [docs/specs/supabase-free-plan-program-migration-ops-guide-v1.md](../docs/specs/supabase-free-plan-program-migration-ops-guide-v1.md)를 따릅니다.

권장 명령:

```powershell
backend\venv\Scripts\python.exe scripts/refresh_program_validation_sample.py --preset free-plan-50 --output reports/program-validation-sample-latest.json
```

필요 시 provenance fallback 바닥값 조정:

```powershell
backend\venv\Scripts\python.exe scripts/refresh_program_validation_sample.py --preset free-plan-50 --source-record-fallback-min-batch-limit 10
```

helper가 이미 적용된 환경인지 먼저 보고 싶으면 최소 read-only 확인 후 진행합니다.

### 5. sample validation 뒤 확인할 SQL

```sql
select count(*) as program_list_index_rows
from public.program_list_index;
```

```sql
select count(*) as program_source_record_rows
from public.program_source_records;
```

```sql
select
  id,
  title,
  source_code,
  source_label,
  application_end_date,
  recruiting_status,
  recruiting_status_label,
  primary_link
from public.program_list_index
order by indexed_at desc nulls last
limit 20;
```

## 운영 리스크 메모

- 현재 셸에서는 migration apply 자체를 확정 실행할 수 없습니다. SQL Editor나 migration runner가 별도로 필요합니다.
- user recommendation 축이 live에 없는데도 코드가 이미 read/write bridge를 시도하므로, 해당 경로의 soft-fail 로그는 지금 상태에서는 버그라기보다 미적용 신호일 수 있습니다.
- `refresh_program_list_index(300)` full refresh는 free plan에서 바로 돌리지 않습니다.
- package-5 완료 조건은 “문서만 최신”이 아니라 `user recommendation migrations live 적용 + sample validation 통과 + row/sample 확인`까지입니다.
