-- Draft migration for the recommendation-profile refactor.
-- Purpose: keep user-entered recommendation preferences out of public.profiles.

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
  updated_at timestamptz not null default now(),
  constraint user_program_preferences_max_cost_check
    check (max_cost is null or max_cost >= 0)
);

comment on table public.user_program_preferences is
  '맞춤형 프로그램 추천에 필요한 사용자의 명시 선호 정보를 저장하는 정본 테이블';

comment on column public.user_program_preferences.target_job is
  '사용자가 직접 선택한 희망 직무. profiles.target_job보다 우선한다.';

comment on column public.user_program_preferences.preferred_regions is
  '추천에서 우선 고려할 시/도 수준 지역 선호';

comment on column public.user_program_preferences.desired_skills is
  '현재 보유 스킬과 분리된 학습 희망 스킬';

create index if not exists idx_user_program_preferences_target_job_normalized
on public.user_program_preferences(target_job_normalized);

create index if not exists idx_user_program_preferences_preferred_regions_gin
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
