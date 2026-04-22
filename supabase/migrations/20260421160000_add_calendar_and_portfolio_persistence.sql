create table if not exists public.calendar_program_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program_id)
);

create index if not exists idx_calendar_program_selections_user_id
  on public.calendar_program_selections(user_id);

create index if not exists idx_calendar_program_selections_program_id
  on public.calendar_program_selections(program_id);

drop trigger if exists trg_calendar_program_selections_updated_at on public.calendar_program_selections;
create trigger trg_calendar_program_selections_updated_at
before update on public.calendar_program_selections
for each row execute function public.set_updated_at();

alter table public.calendar_program_selections enable row level security;

drop policy if exists "calendar_program_selections_select_own" on public.calendar_program_selections;
create policy "calendar_program_selections_select_own" on public.calendar_program_selections
for select using (auth.uid() = user_id);

drop policy if exists "calendar_program_selections_insert_own" on public.calendar_program_selections;
create policy "calendar_program_selections_insert_own" on public.calendar_program_selections
for insert with check (auth.uid() = user_id);

drop policy if exists "calendar_program_selections_update_own" on public.calendar_program_selections;
create policy "calendar_program_selections_update_own" on public.calendar_program_selections
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "calendar_program_selections_delete_own" on public.calendar_program_selections;
create policy "calendar_program_selections_delete_own" on public.calendar_program_selections
for delete using (auth.uid() = user_id);

alter table public.portfolios
  add column if not exists source_activity_id uuid references public.activities(id) on delete set null,
  add column if not exists portfolio_payload jsonb;

create index if not exists idx_portfolios_source_activity_id
  on public.portfolios(source_activity_id);
