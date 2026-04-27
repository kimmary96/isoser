-- Draft migration for the recommendation-profile refactor.
-- Purpose: keep recommendation cache schema aligned with current backend contract.

alter table public.recommendations
  add column if not exists query_hash text,
  add column if not exists profile_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists reason text,
  add column if not exists fit_keywords text[] default '{}'::text[],
  add column if not exists similarity_score double precision default 0,
  add column if not exists relevance_score double precision default 0,
  add column if not exists urgency_score double precision default 0,
  add column if not exists final_score double precision default 0,
  add column if not exists generated_at timestamptz default now();

update public.recommendations
set
  similarity_score = coalesce(similarity_score, score::double precision, 0),
  relevance_score = coalesce(relevance_score, similarity_score, score::double precision, 0),
  urgency_score = coalesce(urgency_score, 0),
  final_score = coalesce(final_score, relevance_score, similarity_score, score::double precision, 0),
  generated_at = coalesce(generated_at, created_at, now()),
  expires_at = coalesce(expires_at, generated_at + interval '24 hours', created_at + interval '24 hours', now() + interval '24 hours'),
  fit_keywords = coalesce(fit_keywords, '{}'::text[]);

alter table public.recommendations
  alter column similarity_score set default 0,
  alter column relevance_score set default 0,
  alter column urgency_score set default 0,
  alter column final_score set default 0,
  alter column generated_at set default now(),
  alter column fit_keywords set default '{}'::text[];

do $$
begin
  begin
    alter table public.recommendations
      alter column fit_keywords set not null;
  exception
    when others then
      null;
  end;
end;
$$;

alter table public.recommendations
  drop constraint if exists recommendations_unique;

drop index if exists idx_recommendations_user_program_unique;

delete from public.recommendations r
using (
  select
    id,
    row_number() over (
      partition by user_id, query_hash, program_id
      order by generated_at desc nulls last, id
    ) as row_number
  from public.recommendations
  where user_id is not null
    and program_id is not null
    and query_hash is not null
) duplicates
where r.id = duplicates.id
  and duplicates.row_number > 1;

create index if not exists idx_recommendations_query_hash
on public.recommendations(query_hash);

create index if not exists idx_recommendations_profile_hash
on public.recommendations(profile_hash);

create index if not exists idx_recommendations_expires_at
on public.recommendations(expires_at);

create index if not exists idx_recommendations_user_query_hash
on public.recommendations(user_id, query_hash);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recommendations'::regclass
      and conname = 'recommendations_user_query_program_unique'
  ) and not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'recommendations'
      and indexname = 'idx_recommendations_user_query_program_unique'
  ) then
    create unique index idx_recommendations_user_query_program_unique
    on public.recommendations(user_id, query_hash, program_id);
  end if;
end;
$$;
