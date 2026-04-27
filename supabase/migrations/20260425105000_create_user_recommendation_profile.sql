-- Draft migration for the recommendation-profile refactor.
-- Purpose: introduce a derived recommendation-profile read model for the engine.

create table if not exists public.user_recommendation_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  effective_target_job text,
  effective_target_job_normalized text,
  profile_keywords text[] not null default '{}'::text[],
  evidence_skills text[] not null default '{}'::text[],
  desired_skills text[] not null default '{}'::text[],
  activity_keywords text[] not null default '{}'::text[],
  preferred_regions text[] not null default '{}'::text[],
  profile_completeness_score numeric(5,4) not null default 0,
  recommendation_ready boolean not null default false,
  recommendation_profile_hash text not null default '',
  derivation_version integer not null default 1,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_derived_at timestamptz not null default now(),
  constraint user_recommendation_profile_completeness_score_check
    check (profile_completeness_score >= 0 and profile_completeness_score <= 1)
);

comment on table public.user_recommendation_profile is
  '추천 엔진이 직접 읽는 사용자 추천 파생 정본';

comment on column public.user_recommendation_profile.effective_target_job is
  'preferences > profiles.target_job > 최근 resume.target_job > legacy bio fallback 순서로 계산한 희망 직무';

comment on column public.user_recommendation_profile.profile_keywords is
  '추천 관련도 계산용 정규화 키워드 집합';

comment on column public.user_recommendation_profile.source_snapshot is
  '파생 결과가 어떤 원천 입력에서 왔는지 추적하기 위한 요약 스냅샷';

create index if not exists idx_user_recommendation_profile_target_job_normalized
on public.user_recommendation_profile(effective_target_job_normalized);

create index if not exists idx_user_recommendation_profile_ready
on public.user_recommendation_profile(recommendation_ready);

create index if not exists idx_user_recommendation_profile_hash
on public.user_recommendation_profile(recommendation_profile_hash);

alter table public.user_recommendation_profile enable row level security;

drop policy if exists user_recommendation_profile_select_own on public.user_recommendation_profile;
create policy user_recommendation_profile_select_own
on public.user_recommendation_profile
for select
using (auth.uid() = user_id);
