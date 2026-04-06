-- 자기소개서 저장소 테이블 추가
-- 테이블: cover_letters

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  company_name text,
  job_title text,
  prompt_question text,
  content text not null default '',
  tags text[] default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cover_letters_user_id on public.cover_letters(user_id);

drop trigger if exists trg_cover_letters_updated_at on public.cover_letters;
create trigger trg_cover_letters_updated_at
before update on public.cover_letters
for each row execute function public.set_updated_at();

alter table public.cover_letters enable row level security;

drop policy if exists "cover_letters_select_own" on public.cover_letters;
create policy "cover_letters_select_own" on public.cover_letters
for select using (auth.uid() = user_id);

drop policy if exists "cover_letters_insert_own" on public.cover_letters;
create policy "cover_letters_insert_own" on public.cover_letters
for insert with check (auth.uid() = user_id);

drop policy if exists "cover_letters_update_own" on public.cover_letters;
create policy "cover_letters_update_own" on public.cover_letters
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cover_letters_delete_own" on public.cover_letters;
create policy "cover_letters_delete_own" on public.cover_letters
for delete using (auth.uid() = user_id);
