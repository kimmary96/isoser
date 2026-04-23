create extension if not exists pg_trgm;

alter table public.programs
add column if not exists provider text,
add column if not exists summary text,
add column if not exists description text,
add column if not exists location text,
add column if not exists region text,
add column if not exists region_detail text,
add column if not exists tags text[] default '{}'::text[],
add column if not exists skills text[] default '{}'::text[],
add column if not exists target text[] default '{}'::text[],
add column if not exists compare_meta jsonb;

alter table public.programs
add column if not exists search_text text;

create or replace function public.update_programs_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := regexp_replace(
    lower(
      concat_ws(
        ' ',
        new.title,
        new.provider,
        new.summary,
        new.description,
        new.location,
        new.region,
        new.region_detail,
        array_to_string(new.tags, ' '),
        array_to_string(new.skills, ' '),
        array_to_string(new.target, ' '),
        new.compare_meta::text
      )
    ),
    '\s+',
    '',
    'g'
  );
  return new;
end;
$$;

drop trigger if exists trg_programs_search_text on public.programs;
create trigger trg_programs_search_text
before insert or update on public.programs
for each row execute function public.update_programs_search_text();

update public.programs
set search_text = regexp_replace(
  lower(
    concat_ws(
      ' ',
      title,
      provider,
      summary,
      description,
      location,
      region,
      region_detail,
      array_to_string(tags, ' '),
      array_to_string(skills, ' '),
      array_to_string(target, ' '),
      compare_meta::text
    )
  ),
  '\s+',
  '',
  'g'
);

create index if not exists idx_programs_search_text_trgm
on public.programs using gin (search_text gin_trgm_ops);
