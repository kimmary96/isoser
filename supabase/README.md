# Supabase Migrations

이 폴더는 프로젝트의 DB 변경 이력을 관리합니다.
이미 적용된 migration 파일은 수정하지 않고, 보정이 필요하면 새 migration 파일을 추가합니다.

## 기본 원칙

- 파일명은 `YYYYMMDDHHMMSS_description.sql` 형식을 사용합니다.
- 이미 실행된 migration 파일은 직접 수정하지 않습니다.
- 과거 초안 스키마와 현재 코드 계약이 다르면 기존 파일을 덮어쓰지 말고 corrective migration을 추가합니다.
- live DB 적용 여부는 `supabase_migrations.schema_migrations`에서 확인합니다.

## 현재 정본 스키마 체인 (2026-04-16 기준)

### 1. programs / program_bookmarks

현재 앱 코드가 기대하는 `programs` 정본 체인은 아래 순서입니다.

1. `20260410120000_create_programs_and_bookmarks.sql`
2. `20260410133000_add_work24_sync_columns_to_programs.sql`
3. `20260415113000_add_compare_meta_to_programs.sql`
4. `20260415170000_add_programs_hub_fields.sql`

주의:

- `20260415_create_programs.sql`은 현재 앱의 `programs` 정본 스키마로 보지 않습니다.
- 북마크 정본 테이블은 `program_bookmarks`입니다.

### 2. recommendations / recommendation cache

현재 추천 캐시 계약은 아래 migration 조합이 모두 반영된 상태를 기준으로 합니다.

1. `20260415_create_recommendations.sql`
2. `20260416120000_expand_recommendations_cache_columns.sql`
3. `20260416132000_fix_recommendations_cache_contract.sql`

현재 코드 계약:

- `query_hash`
- `profile_hash`
- `expires_at`
- `reason`
- `fit_keywords`
- unique key: `user_id + query_hash + program_id`

주의:

- `20260415_create_recommendations.sql` 단독 상태의 `user_id + program_id` unique 계약은 현재 코드와 다릅니다.
- 현재 앱은 `bookmarks` 테이블이 아니라 `program_bookmarks`를 사용합니다.

### 3. recommendation_rules

정적 추천 매핑용 테이블은 아래 migration으로 관리합니다.

1. `20260416121000_create_recommendation_rules.sql`

### 4. coach_sessions

`coach_sessions`는 과거 초기 migration과 현재 코드 계약 사이에 드리프트 가능성이 있습니다.

1. `001_init_schema.sql`
2. `20260403093000_create_coach_sessions.sql`
3. `20260416143000_reconcile_coach_sessions_schema.sql`

설명:

- `001_init_schema.sql`은 구형 `coach_sessions`를 만들 수 있습니다.
- 현재 코드가 기대하는 필드(`job_title`, `section_type`, `activity_description`, `last_structure_diagnosis`, `missing_elements` 등)는 `20260403093000_create_coach_sessions.sql` 기준입니다.
- 이미 구형 테이블이 만들어진 환경은 `20260416143000_reconcile_coach_sessions_schema.sql`로 보정합니다.

## live DB 확인 순서

### 1. 적용된 migration 확인

```sql
select version
from supabase_migrations.schema_migrations
where version like '202604%'
order by version;
```

### 2. 핵심 테이블 컬럼 확인

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('programs', 'recommendations', 'recommendation_rules', 'coach_sessions')
order by table_name, ordinal_position;
```

### 3. 추천 캐시 unique 계약 확인

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.recommendations'::regclass
order by conname;
```

## 운영 메모

- 새 환경을 띄울 때는 `20260415_create_programs.sql`을 기준 스키마로 해석하지 않습니다.
- `recommendations`는 `20260415_create_recommendations.sql`만으로는 현재 코드 계약이 완성되지 않습니다.
- `coach_sessions`는 구형 환경을 직접 수정하지 말고 `20260416143000_reconcile_coach_sessions_schema.sql`로 보정합니다.
