alter table public.programs
add column if not exists hrd_id text,
add column if not exists start_date text,
add column if not exists end_date text,
add column if not exists cost integer,
add column if not exists subsidy_amount integer,
add column if not exists target text,
add column if not exists source_url text,
add column if not exists source text;

create unique index if not exists idx_programs_hrd_id_unique
on public.programs(hrd_id)
where hrd_id is not null;
