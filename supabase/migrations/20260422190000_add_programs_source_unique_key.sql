alter table public.programs
add column if not exists source_unique_key text;

create unique index if not exists idx_programs_source_unique_key
on public.programs(source_unique_key)
where source_unique_key is not null;

