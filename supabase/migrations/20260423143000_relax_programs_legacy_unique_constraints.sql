alter table if exists public.programs
drop constraint if exists programs_unique;

alter table if exists public.programs
drop constraint if exists programs_hrd_id_key;

drop index if exists public.programs_unique;
drop index if exists public.programs_hrd_id_key;
drop index if exists public.idx_programs_hrd_id_unique;

create unique index if not exists idx_programs_source_unique_key
on public.programs(source_unique_key);

create index if not exists idx_programs_hrd_id
on public.programs(hrd_id)
where hrd_id is not null;

create index if not exists idx_programs_source_title
on public.programs(source, title);
