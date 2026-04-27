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
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.coach_sessions
  add column if not exists job_title text,
  add column if not exists section_type text,
  add column if not exists activity_description text,
  add column if not exists iteration_count integer not null default 1,
  add column if not exists last_feedback text,
  add column if not exists last_suggestions jsonb not null default '[]'::jsonb,
  add column if not exists selected_suggestion_index integer,
  add column if not exists suggestion_type text,
  add column if not exists last_structure_diagnosis jsonb not null default '{}'::jsonb,
  add column if not exists missing_elements text[] not null default '{}'::text[];

update public.coach_sessions
set
  job_title = coalesce(job_title, ''),
  section_type = coalesce(section_type, ''),
  activity_description = coalesce(activity_description, ''),
  iteration_count = greatest(coalesce(iteration_count, 1), 1),
  last_suggestions = coalesce(last_suggestions, '[]'::jsonb),
  last_structure_diagnosis = coalesce(last_structure_diagnosis, '{}'::jsonb),
  missing_elements = coalesce(missing_elements, '{}'::text[]);

alter table public.coach_sessions
  alter column job_title set default '',
  alter column section_type set default '',
  alter column activity_description set default '';

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
