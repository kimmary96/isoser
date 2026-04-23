alter table public.recommendations
add column if not exists similarity_score double precision,
add column if not exists relevance_score double precision,
add column if not exists urgency_score double precision,
add column if not exists final_score double precision,
add column if not exists generated_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recommendations'
      and column_name = 'score'
  ) then
    execute '
      update public.recommendations
      set
        similarity_score = coalesce(similarity_score, score::double precision, 0),
        relevance_score = coalesce(relevance_score, score::double precision, 0),
        final_score = coalesce(final_score, score::double precision, 0)
      where similarity_score is null
         or relevance_score is null
         or final_score is null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recommendations'
      and column_name = 'created_at'
  ) then
    execute '
      update public.recommendations
      set generated_at = coalesce(generated_at, created_at, now())
      where generated_at is null
    ';
  end if;
end $$;

update public.recommendations
set
  similarity_score = coalesce(similarity_score, 0),
  relevance_score = coalesce(relevance_score, similarity_score, final_score, 0),
  urgency_score = coalesce(urgency_score, 0),
  final_score = coalesce(final_score, relevance_score, similarity_score, 0),
  generated_at = coalesce(generated_at, now());

delete from public.recommendations r
using (
  select
    id,
    row_number() over (
      partition by user_id, program_id
      order by generated_at desc nulls last, id
    ) as row_number
  from public.recommendations
  where user_id is not null
    and program_id is not null
) duplicates
where r.id = duplicates.id
  and duplicates.row_number > 1;

alter table public.recommendations
alter column similarity_score set default 0,
alter column relevance_score set default 0,
alter column urgency_score set default 0,
alter column final_score set default 0,
alter column generated_at set default now();

create unique index if not exists idx_recommendations_user_program_unique
on public.recommendations(user_id, program_id);
