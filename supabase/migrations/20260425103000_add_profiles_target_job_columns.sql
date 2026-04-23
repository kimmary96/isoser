-- Draft migration for the recommendation-profile refactor.
-- Purpose: split stable target job semantics from legacy bio usage.

alter table public.profiles
  add column if not exists target_job text,
  add column if not exists target_job_normalized text;

comment on column public.profiles.target_job is
  '맞춤형 프로그램 추천과 비교 관련도 계산에 사용하는 사용자 희망 직무 정본';

comment on column public.profiles.target_job_normalized is
  '희망 직무 비교/추천용 정규화 값';

create index if not exists idx_profiles_target_job_normalized
on public.profiles(target_job_normalized);
