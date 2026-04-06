create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_title text not null,
  section_type text not null,
  activity_description text not null,
  iteration_count integer not null default 1 check (iteration_count >= 1),
  last_feedback text,
  last_suggestions jsonb not null default '[]'::jsonb check (jsonb_typeof(last_suggestions) = 'array'),
  selected_suggestion_index integer check (selected_suggestion_index is null or selected_suggestion_index >= 0),
  suggestion_type text,
  last_structure_diagnosis jsonb not null default '{}'::jsonb check (jsonb_typeof(last_structure_diagnosis) = 'object'),
  missing_elements text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists coach_sessions_user_updated_at_idx
  on public.coach_sessions (user_id, updated_at desc);

create index if not exists coach_sessions_user_section_type_idx
  on public.coach_sessions (user_id, section_type);

create index if not exists coach_sessions_job_title_idx
  on public.coach_sessions (job_title);

drop trigger if exists set_coach_sessions_updated_at on public.coach_sessions;
create trigger set_coach_sessions_updated_at
before update on public.coach_sessions
for each row
execute function public.set_updated_at();

alter table public.coach_sessions enable row level security;

drop policy if exists "coach_sessions_select_own" on public.coach_sessions;
create policy "coach_sessions_select_own"
on public.coach_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "coach_sessions_insert_own" on public.coach_sessions;
create policy "coach_sessions_insert_own"
on public.coach_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "coach_sessions_update_own" on public.coach_sessions;
create policy "coach_sessions_update_own"
on public.coach_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "coach_sessions_delete_own" on public.coach_sessions;
create policy "coach_sessions_delete_own"
on public.coach_sessions
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.coach_sessions to authenticated;
