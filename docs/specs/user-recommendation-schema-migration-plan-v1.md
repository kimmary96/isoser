# User Recommendation Schema Migration Plan v1

기준일: 2026-04-24  
상태: proposed  
범위: 맞춤형 프로그램 추천용 사용자 스키마 전환 계획

## 1. 문서 목적

이 문서는 [user-recommendation-schema-v1.md](./user-recommendation-schema-v1.md)를 실제 적용 가능한 migration 계획으로 풀어쓴 문서다.

목표는 아래 4가지다.

1. `profiles`의 의미 충돌을 정리한다.
2. 추천에 필요한 사용자 선호와 추천 정본을 별도 구조로 분리한다.
3. 기존 추천 기능을 깨지 않으면서 read/write를 새 구조로 옮긴다.
4. `supabase/SQL.md`, migration 체인, backend 추천 코드의 drift를 줄인다.

## 2. 적용 전제

- 서비스 미런칭 상태라 구조 개편은 적극적으로 할 수 있다.
- 다만 실DB에는 이미 데이터가 있으므로 `add -> backfill -> switch -> cleanup` 순서를 지킨다.
- 이번 범위의 핵심은 사용자 추천 입력 구조 정리이며, 프로그램 스키마 전면 개편과는 분리된 패키지로 본다.

## 3. 최우선으로 해결할 문제

### 3.1 `bio`와 희망 직무 의미 충돌

기존 UI는 `희망 직무` 입력을 `bio`에 저장했다.
2026-04-24 기준 현재 profile modal/write path는 `target_job`과 `bio`를 분리했고, 이 migration reason은 legacy row/fallback cleanup 관점에서 계속 유효하다.

### 3.2 추천 정본 부재

초안 당시에는 추천이 `profiles + activities + 요청 payload`를 조합해 쓰고 있었고, 이를 정리한 단일 추천 정본이 없었다.
2026-04-24 기준 현재 code/live에는 `user_recommendation_profile` 경로가 들어와 있으므로, 이 항목은 적용 전 문제 정의로 읽는 편이 맞다.

### 3.3 추천 캐시 hash 기준 불안정

현재 `profile_hash`는 추천과 직접 관련 없는 값까지 포함해 캐시가 자주 흔들릴 수 있다.

### 3.4 `recommendations` 문서/코드 drift

`SQL.md`는 현재 코드가 기대하는 `query_hash`, `profile_hash`, `expires_at`, `fit_keywords`를 충분히 반영하지 않는다.

## 4. 최종 목표 스키마

이번 migration plan은 아래 구조를 목표로 한다.

| 테이블 | 역할 |
| --- | --- |
| `profiles` | 기본 사용자 프로필/연락처/표시 정보 |
| `activities` | 경험 근거 데이터 |
| `resumes` | 문서 자산 |
| `user_program_preferences` | 사용자가 직접 입력한 추천 선호 |
| `user_recommendation_profile` | 추천 엔진이 읽는 정규화/파생 정본 |
| `recommendations` | 추천 결과 캐시 |

이번 1차 migration 범위에서는 `user_program_events`는 설계만 남기고 실제 생성은 보류한다.

## 5. 단계별 migration 패키지

## 5.1 패키지 A: `profiles` 의미 분리

### 목적

- `bio`와 `target_job`를 분리한다.
- 기존 profile 화면과 추천/비교 로직이 같은 필드를 다른 의미로 쓰는 문제를 끊는다.

### 제안 migration 파일

- `20260425103000_add_profiles_target_job_columns.sql`

### SQL 초안

```sql
alter table public.profiles
  add column if not exists target_job text,
  add column if not exists target_job_normalized text;

create index if not exists idx_profiles_target_job_normalized
on public.profiles(target_job_normalized);
```

### 비고

- `desired_job`는 1차에서 만들지 않는다.
- 먼저 `target_job` 단일 정본을 세우는 편이 낫다.

## 5.2 패키지 B: 사용자 추천 선호 테이블 신설

### 목적

- 사용자가 직접 입력한 추천 선호를 `profiles`와 분리한다.

### 제안 migration 파일

- `20260425104000_create_user_program_preferences.sql`

### SQL 초안

```sql
create table if not exists public.user_program_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_job text,
  target_job_normalized text,
  preferred_regions text[] not null default '{}'::text[],
  preferred_region_details text[] not null default '{}'::text[],
  preferred_categories text[] not null default '{}'::text[],
  preferred_teaching_methods text[] not null default '{}'::text[],
  preferred_participation_times text[] not null default '{}'::text[],
  preferred_cost_types text[] not null default '{}'::text[],
  desired_skills text[] not null default '{}'::text[],
  remote_ok boolean,
  max_cost integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_program_preferences_target_job_norm
on public.user_program_preferences(target_job_normalized);

create index if not exists idx_user_program_preferences_regions_gin
on public.user_program_preferences using gin(preferred_regions);

create index if not exists idx_user_program_preferences_desired_skills_gin
on public.user_program_preferences using gin(desired_skills);

alter table public.user_program_preferences enable row level security;

drop policy if exists user_program_preferences_select_own on public.user_program_preferences;
create policy user_program_preferences_select_own
on public.user_program_preferences
for select
using (auth.uid() = user_id);

drop policy if exists user_program_preferences_insert_own on public.user_program_preferences;
create policy user_program_preferences_insert_own
on public.user_program_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists user_program_preferences_update_own on public.user_program_preferences;
create policy user_program_preferences_update_own
on public.user_program_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 5.3 패키지 C: 추천 정본 테이블 신설

### 목적

- 추천 엔진이 직접 읽는 정규화/파생 정본을 만든다.

### 제안 migration 파일

- `20260425105000_create_user_recommendation_profile.sql`

### SQL 초안

```sql
create table if not exists public.user_recommendation_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  effective_target_job text,
  effective_target_job_normalized text,
  profile_keywords text[] not null default '{}'::text[],
  evidence_skills text[] not null default '{}'::text[],
  desired_skills text[] not null default '{}'::text[],
  activity_keywords text[] not null default '{}'::text[],
  preferred_regions text[] not null default '{}'::text[],
  profile_completeness_score numeric not null default 0,
  recommendation_ready boolean not null default false,
  recommendation_profile_hash text not null default '',
  derivation_version integer not null default 1,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_derived_at timestamptz not null default now()
);

create index if not exists idx_user_recommendation_profile_target_job_norm
on public.user_recommendation_profile(effective_target_job_normalized);

create index if not exists idx_user_recommendation_profile_ready
on public.user_recommendation_profile(recommendation_ready);

create index if not exists idx_user_recommendation_profile_keywords_gin
on public.user_recommendation_profile using gin(profile_keywords);

create index if not exists idx_user_recommendation_profile_skills_gin
on public.user_recommendation_profile using gin(evidence_skills);

alter table public.user_recommendation_profile enable row level security;

drop policy if exists user_recommendation_profile_select_own on public.user_recommendation_profile;
create policy user_recommendation_profile_select_own
on public.user_recommendation_profile
for select
using (auth.uid() = user_id);
```

### 비고

- 1차에서는 일반 사용자의 직접 update policy를 만들지 않는다.
- 이 테이블은 파생 정본이므로 backend/service-role이 재생성하는 방향이 안전하다.

## 5.4 패키지 D: 파생 프로필 생성 함수

### 목적

- 추천 엔진이 읽을 `user_recommendation_profile`을 일관되게 계산한다.

### 제안 migration 파일

- `20260425110000_create_user_recommendation_profile_refresh_function.sql`

### 함수 설계 초안

```sql
create or replace function public.refresh_user_recommendation_profile(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_profile record;
  v_pref record;
  v_resume_target text;
  v_effective_target_job text;
  v_preferred_regions text[];
begin
  select *
  into v_profile
  from public.profiles
  where id = p_user_id;

  select *
  into v_pref
  from public.user_program_preferences
  where user_id = p_user_id;

  select target_job
  into v_resume_target
  from public.resumes
  where user_id = p_user_id
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  v_effective_target_job := coalesce(
    nullif(v_pref.target_job, ''),
    nullif(v_profile.target_job, ''),
    nullif(v_resume_target, ''),
    nullif(v_profile.bio, '')
  );

  v_preferred_regions := case
    when coalesce(array_length(v_pref.preferred_regions, 1), 0) > 0 then v_pref.preferred_regions
    when coalesce(nullif(v_profile.region, ''), '') <> '' then array[v_profile.region]
    else '{}'::text[]
  end;

  insert into public.user_recommendation_profile (
    user_id,
    effective_target_job,
    effective_target_job_normalized,
    profile_keywords,
    evidence_skills,
    desired_skills,
    activity_keywords,
    preferred_regions,
    profile_completeness_score,
    recommendation_ready,
    recommendation_profile_hash,
    derivation_version,
    source_snapshot,
    updated_at,
    last_derived_at
  )
  values (
    p_user_id,
    v_effective_target_job,
    lower(regexp_replace(coalesce(v_effective_target_job, ''), '\s+', ' ', 'g')),
    '{}'::text[],
    '{}'::text[],
    coalesce(v_pref.desired_skills, '{}'::text[]),
    '{}'::text[],
    coalesce(v_preferred_regions, '{}'::text[]),
    0,
    false,
    '',
    1,
    jsonb_build_object(
      'profile', to_jsonb(v_profile),
      'preferences', to_jsonb(v_pref),
      'resume_target_job', v_resume_target
    ),
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    effective_target_job = excluded.effective_target_job,
    effective_target_job_normalized = excluded.effective_target_job_normalized,
    desired_skills = excluded.desired_skills,
    preferred_regions = excluded.preferred_regions,
    source_snapshot = excluded.source_snapshot,
    updated_at = now(),
    last_derived_at = now();
end;
$$;
```

### 비고

- 위 함수는 최소 골격이다.
- 실제 구현에서는 `profile_keywords`, `evidence_skills`, `activity_keywords`, `profile_completeness_score`, `recommendation_profile_hash` 계산 로직을 추가해야 한다.
- 다만 SQL 함수 안에서 과도한 자연어 정규화를 넣기보다는 Python backend에서 계산하고 이 함수는 upsert entrypoint로만 두는 것도 가능하다.

## 5.5 패키지 E: 기존 데이터 backfill

### 목적

- 기존 `profiles`, `resumes`, `activities` 기반으로 추천 정본을 초기화한다.

### 제안 migration 파일

- `20260425111000_backfill_user_recommendation_inputs.sql`

### backfill 원칙

우선순위는 아래다.

1. `user_program_preferences.target_job`
2. `profiles.target_job`
3. 최신 `resumes.target_job`
4. legacy `profiles.bio`

중요:

- `bio -> target_job`는 초기 백필용 fallback일 뿐 장기 정본이 아니다.
- UI와 API가 분리된 뒤에는 이 fallback을 제거해야 한다.

### SQL 초안

```sql
update public.profiles
set target_job = nullif(trim(bio), ''),
    target_job_normalized = lower(regexp_replace(coalesce(trim(bio), ''), '\s+', ' ', 'g'))
where coalesce(target_job, '') = ''
  and coalesce(trim(bio), '') <> '';

insert into public.user_program_preferences (
  user_id,
  target_job,
  target_job_normalized,
  preferred_regions,
  created_at,
  updated_at
)
select
  p.id as user_id,
  p.target_job,
  lower(regexp_replace(coalesce(p.target_job, ''), '\s+', ' ', 'g')) as target_job_normalized,
  case
    when coalesce(nullif(p.region, ''), '') <> '' then array[p.region]
    else '{}'::text[]
  end as preferred_regions,
  now(),
  now()
from public.profiles p
on conflict (user_id) do nothing;
```

### 후속 실행 초안

```sql
select public.refresh_user_recommendation_profile(id)
from public.profiles;
```

## 5.6 패키지 F: 추천 캐시 계약 정렬

### 목적

- `recommendations`가 새 추천 정본을 기준으로 동작하게 맞춘다.

### 제안 migration 파일

- `20260425112000_align_recommendations_with_user_recommendation_profile.sql`

### 작업 내용

- `recommendations`에 현재 코드가 기대하는 컬럼이 실제로 있는지 다시 확인
- `query_hash`, `profile_hash`, `expires_at`, `fit_keywords` drift 복구
- unique 계약을 `user_id + query_hash + program_id`로 유지

### 비고

- 이 단계는 새 테이블을 만드는 것보다 덜 눈에 띄지만 중요도가 높다.
- 추천 시스템이 새 정본을 읽더라도 cache 계약이 흔들리면 효과가 반감된다.

## 6. 코드 변경 순서

## 6.1 1차 코드 변경

대상:

- `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx`
- `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
- `frontend/app/api/dashboard/profile/route.ts`
- `frontend/lib/types/index.ts`

해야 할 일:

- `bio` 입력과 `target_job` 입력을 분리
- 프로필 API가 `target_job`를 읽고 저장하도록 확장
- 기존 `bio`는 태그라인 의미로 되돌림

## 6.2 2차 코드 변경

대상:

- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`

해야 할 일:

- `_fetch_profile_row()` 중심 구조를 `user_recommendation_profile` 우선 구조로 전환
- `_build_profile_hash()`는 raw `profiles` snapshot 대신 추천 정본 기준으로 계산
- compare relevance도 `profiles` 직접 해석을 줄이고 추천 정본을 우선 사용

## 6.3 3차 코드 변경

대상:

- `frontend/app/api/dashboard/resume/route.ts`
- 필요 시 추천 invalidation helper

해야 할 일:

- 최신 resume의 `target_job`를 추천 fallback 입력으로 연결
- 프로필/선호 저장 시 추천 정본 refresh + cache invalidation 순서를 고정

## 7. 검증 SQL

### 7.1 `profiles.target_job` 채움 확인

```sql
select
  count(*) filter (where coalesce(target_job, '') <> '') as profiles_with_target_job,
  count(*) filter (where coalesce(target_job, '') = '' and coalesce(trim(bio), '') <> '') as legacy_bio_only
from public.profiles;
```

### 7.2 preference/backfill 생성 확인

```sql
select
  count(*) as preference_rows,
  count(*) filter (where coalesce(target_job, '') <> '') as preference_rows_with_target_job
from public.user_program_preferences;
```

### 7.3 recommendation profile 생성 확인

```sql
select
  count(*) as derived_rows,
  count(*) filter (where recommendation_ready = true) as ready_rows,
  count(*) filter (where coalesce(effective_target_job, '') <> '') as rows_with_effective_target_job
from public.user_recommendation_profile;
```

### 7.4 resume fallback 후보 확인

```sql
select r.user_id, r.target_job
from public.resumes r
left join public.user_program_preferences p on p.user_id = r.user_id
where coalesce(p.target_job, '') = ''
  and coalesce(r.target_job, '') <> '';
```

### 7.5 recommendations drift 확인

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'recommendations'
order by ordinal_position;
```

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'recommendations';
```

## 8. 롤백 전략

### 패키지 A~C

- additive migration이라 코드 read switch만 되돌리면 된다.
- 새 컬럼/테이블을 즉시 사용하지 않으면 기존 동작으로 복귀 가능하다.

### 패키지 D~E

- 파생 프로필 생성 함수와 backfill은 원본 row를 삭제하지 않는다.
- 문제가 생기면 추천 read 경로를 다시 `profiles + activities` fallback으로 돌릴 수 있다.

### 패키지 F

- `recommendations` unique/index 변경은 신중해야 한다.
- 이 단계 전에는 반드시 duplicate 검사 SQL과 백업 스냅샷을 남겨야 한다.

## 9. 구현 우선순위

### P0

- `profiles.target_job` 추가
- `user_program_preferences` 생성
- `user_recommendation_profile` 생성
- profile UI/API에서 `bio`와 `target_job` 분리

### P1

- 추천 정본 refresh/backfill
- 추천 cache hash를 새 정본 기준으로 전환
- `recommendations` 계약 정렬

### P2

- resume fallback 연결
- 행동 신호 저장소 `user_program_events` 설계/도입
- 활동 스킬 canonical normalization

## 10. 이 문서 다음 순서

이 문서 다음에는 아래 순서로 이어간다.

1. `사용자 추천 serializer / derivation 설계서`
2. `program 추천 스키마와 program surface 계약 연결 문서`
3. `실제 migration SQL 파일 초안`
