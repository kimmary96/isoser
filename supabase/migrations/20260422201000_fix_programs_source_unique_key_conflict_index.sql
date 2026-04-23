drop index if exists public.idx_programs_source_unique_key;

create unique index if not exists idx_programs_source_unique_key
on public.programs(source_unique_key);
