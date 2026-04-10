create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  location text,
  provider text,
  summary text,
  description text,
  tags text[] default '{}'::text[],
  skills text[] default '{}'::text[],
  curriculum text,
  application_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);

create index if not exists idx_programs_category on public.programs(category);
create index if not exists idx_programs_location on public.programs(location);
create index if not exists idx_programs_is_active on public.programs(is_active);
create index if not exists idx_program_bookmarks_user_id on public.program_bookmarks(user_id);
create index if not exists idx_program_bookmarks_program_id on public.program_bookmarks(program_id);

drop trigger if exists trg_programs_updated_at on public.programs;
create trigger trg_programs_updated_at
before update on public.programs
for each row execute function public.set_updated_at();

alter table public.programs enable row level security;
alter table public.program_bookmarks enable row level security;

drop policy if exists "programs_public_read" on public.programs;
create policy "programs_public_read" on public.programs
for select using (true);

drop policy if exists "program_bookmarks_select_own" on public.program_bookmarks;
create policy "program_bookmarks_select_own" on public.program_bookmarks
for select using (auth.uid() = user_id);

drop policy if exists "program_bookmarks_insert_own" on public.program_bookmarks;
create policy "program_bookmarks_insert_own" on public.program_bookmarks
for insert with check (auth.uid() = user_id);

drop policy if exists "program_bookmarks_delete_own" on public.program_bookmarks;
create policy "program_bookmarks_delete_own" on public.program_bookmarks
for delete using (auth.uid() = user_id);
