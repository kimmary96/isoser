create extension if not exists pg_trgm;

alter table public.programs
add column if not exists search_text text generated always as (
  regexp_replace(
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
  )
) stored;

create index if not exists idx_programs_search_text_trgm
on public.programs using gin (search_text gin_trgm_ops);
