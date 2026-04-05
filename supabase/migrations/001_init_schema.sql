-- isoser Supabase 초기 스키마
-- 테이블: profiles, activities, resumes, coach_sessions, match_analyses, portfolios
-- 포함: RLS 정책, storage bucket(activity-images) 설정

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  education text,
  career text[] default '{}'::text[],
  education_history text[] default '{}'::text[],
  awards text[] default '{}'::text[],
  certifications text[] default '{}'::text[],
  languages text[] default '{}'::text[],
  skills text[] default '{}'::text[],
  self_intro text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  period text,
  role text,
  skills text[] default '{}'::text[],
  description text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  star_situation text,
  star_task text,
  star_action text,
  star_result text,
  organization text,
  team_size integer,
  team_composition text,
  my_role text,
  contributions text[] default '{}'::text[],
  image_urls text[] default '{}'::text[]
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_job text,
  template_id text not null default 'simple',
  selected_activity_ids text[] default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_title text,
  job_posting text not null,
  total_score double precision not null,
  grade text not null,
  summary text not null,
  matched_keywords text[] default '{}'::text[],
  missing_keywords text[] default '{}'::text[],
  recommended_activities text[] default '{}'::text[],
  analysis_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  template_id text not null default 'simple',
  selected_activity_ids text[] default '{}'::text[],
  thumbnail_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_activities_user_id on public.activities(user_id);
create index if not exists idx_resumes_user_id on public.resumes(user_id);
create index if not exists idx_coach_sessions_user_id on public.coach_sessions(user_id);
create index if not exists idx_match_analyses_user_id on public.match_analyses(user_id);
create index if not exists idx_portfolios_user_id on public.portfolios(user_id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_activities_updated_at on public.activities;
create trigger trg_activities_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

drop trigger if exists trg_resumes_updated_at on public.resumes;
create trigger trg_resumes_updated_at
before update on public.resumes
for each row execute function public.set_updated_at();

drop trigger if exists trg_coach_sessions_updated_at on public.coach_sessions;
create trigger trg_coach_sessions_updated_at
before update on public.coach_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_portfolios_updated_at on public.portfolios;
create trigger trg_portfolios_updated_at
before update on public.portfolios
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.resumes enable row level security;
alter table public.coach_sessions enable row level security;
alter table public.match_analyses enable row level security;
alter table public.portfolios enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "activities_select_own" on public.activities;
create policy "activities_select_own" on public.activities
for select using (auth.uid() = user_id);

drop policy if exists "activities_insert_own" on public.activities;
create policy "activities_insert_own" on public.activities
for insert with check (auth.uid() = user_id);

drop policy if exists "activities_update_own" on public.activities;
create policy "activities_update_own" on public.activities
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "activities_delete_own" on public.activities;
create policy "activities_delete_own" on public.activities
for delete using (auth.uid() = user_id);

drop policy if exists "resumes_select_own" on public.resumes;
create policy "resumes_select_own" on public.resumes
for select using (auth.uid() = user_id);

drop policy if exists "resumes_insert_own" on public.resumes;
create policy "resumes_insert_own" on public.resumes
for insert with check (auth.uid() = user_id);

drop policy if exists "resumes_update_own" on public.resumes;
create policy "resumes_update_own" on public.resumes
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "resumes_delete_own" on public.resumes;
create policy "resumes_delete_own" on public.resumes
for delete using (auth.uid() = user_id);

drop policy if exists "coach_sessions_select_own" on public.coach_sessions;
create policy "coach_sessions_select_own" on public.coach_sessions
for select using (auth.uid() = user_id);

drop policy if exists "coach_sessions_insert_own" on public.coach_sessions;
create policy "coach_sessions_insert_own" on public.coach_sessions
for insert with check (auth.uid() = user_id);

drop policy if exists "coach_sessions_update_own" on public.coach_sessions;
create policy "coach_sessions_update_own" on public.coach_sessions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_sessions_delete_own" on public.coach_sessions;
create policy "coach_sessions_delete_own" on public.coach_sessions
for delete using (auth.uid() = user_id);

drop policy if exists "match_analyses_select_own" on public.match_analyses;
create policy "match_analyses_select_own" on public.match_analyses
for select using (auth.uid() = user_id);

drop policy if exists "match_analyses_insert_own" on public.match_analyses;
create policy "match_analyses_insert_own" on public.match_analyses
for insert with check (auth.uid() = user_id);

drop policy if exists "match_analyses_update_own" on public.match_analyses;
create policy "match_analyses_update_own" on public.match_analyses
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "match_analyses_delete_own" on public.match_analyses;
create policy "match_analyses_delete_own" on public.match_analyses
for delete using (auth.uid() = user_id);

drop policy if exists "portfolios_select_own_or_public" on public.portfolios;
create policy "portfolios_select_own_or_public" on public.portfolios
for select using (auth.uid() = user_id or is_public = true);

drop policy if exists "portfolios_insert_own" on public.portfolios;
create policy "portfolios_insert_own" on public.portfolios
for insert with check (auth.uid() = user_id);

drop policy if exists "portfolios_update_own" on public.portfolios;
create policy "portfolios_update_own" on public.portfolios
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "portfolios_delete_own" on public.portfolios;
create policy "portfolios_delete_own" on public.portfolios
for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('activity-images', 'activity-images', true)
on conflict (id) do nothing;

drop policy if exists "activity_images_public_read" on storage.objects;
create policy "activity_images_public_read" on storage.objects
for select
using (bucket_id = 'activity-images');

drop policy if exists "activity_images_auth_upload" on storage.objects;
create policy "activity_images_auth_upload" on storage.objects
for insert
to authenticated
with check (bucket_id = 'activity-images' and owner = auth.uid()::text);

drop policy if exists "activity_images_owner_update" on storage.objects;
create policy "activity_images_owner_update" on storage.objects
for update
to authenticated
using (bucket_id = 'activity-images' and owner = auth.uid()::text)
with check (bucket_id = 'activity-images' and owner = auth.uid()::text);

drop policy if exists "activity_images_owner_delete" on storage.objects;
create policy "activity_images_owner_delete" on storage.objects
for delete
to authenticated
using (bucket_id = 'activity-images' and owner = auth.uid()::text);
