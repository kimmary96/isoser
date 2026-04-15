alter table if exists public.programs
add column if not exists compare_meta jsonb;
