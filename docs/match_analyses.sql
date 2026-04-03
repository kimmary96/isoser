-- Supabase table for storing job posting match analyses
create table if not exists public.match_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_title text,
  job_posting text not null,
  total_score integer not null check (total_score >= 0 and total_score <= 100),
  grade text not null,
  summary text not null,
  matched_keywords text[] default '{}'::text[],
  missing_keywords text[] default '{}'::text[],
  recommended_activities text[] default '{}'::text[],
  analysis_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.match_analyses
  add column if not exists analysis_payload jsonb;

create index if not exists idx_match_analyses_user_created_at
  on public.match_analyses (user_id, created_at desc);

alter table public.match_analyses enable row level security;

drop policy if exists "Users can read own match analyses" on public.match_analyses;
create policy "Users can read own match analyses"
  on public.match_analyses
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own match analyses" on public.match_analyses;
create policy "Users can insert own match analyses"
  on public.match_analyses
  for insert
  with check (auth.uid() = user_id);
