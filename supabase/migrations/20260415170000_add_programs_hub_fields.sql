alter table public.programs
add column if not exists support_type text,
add column if not exists teaching_method text,
add column if not exists is_certified boolean not null default false,
add column if not exists raw_data jsonb;
