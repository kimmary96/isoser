-- Draft migration for the final program canonical refactor.
-- Purpose: add a free-plan-safe helper that refreshes only a bounded sample of public.program_list_index.

create or replace function public.refresh_program_list_index_sample(
  batch_limit integer default 100,
  browse_pool_limit integer default 100,
  max_rows integer default 100,
  keep_latest_snapshot_count integer default 1
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  effective_batch_limit integer := greatest(coalesce(batch_limit, 100), 1);
  effective_pool_limit integer := greatest(coalesce(browse_pool_limit, 100), 1);
  effective_max_rows integer := greatest(
    coalesce(max_rows, greatest(coalesce(batch_limit, 100), coalesce(browse_pool_limit, 100))),
    1
  );
  effective_keep_snapshot_count integer := greatest(coalesce(keep_latest_snapshot_count, 1), 1);
  delta_rows integer := 0;
  browse_rows integer := 0;
  trimmed_rows integer := 0;
  trimmed_snapshot_rows integer := 0;
  remaining_rows integer := 0;
  remaining_browse_rows integer := 0;
begin
  effective_batch_limit := least(effective_batch_limit, effective_max_rows);
  effective_pool_limit := least(effective_pool_limit, effective_max_rows);

  if not pg_try_advisory_xact_lock(hashtextextended('program_list_refresh_sample', 0)) then
    raise exception 'program list refresh sample already running' using errcode = '55P03';
  end if;

  delta_rows := public.refresh_program_list_delta(effective_batch_limit);
  browse_rows := public.refresh_program_list_browse_pool(effective_pool_limit);

  with ranked as materialized (
    select
      i.id,
      row_number() over (
        order by
          case
            when i.browse_rank is not null and i.browse_rank <= effective_pool_limit then 0
            when coalesce(i.is_ad, false) then 1
            else 2
          end asc,
          case when i.browse_rank is not null then i.browse_rank else 2147483647 end asc,
          coalesce(i.click_hotness_score, 0) desc,
          coalesce(i.recommended_score, 0) desc,
          coalesce(i.last_detail_viewed_at, i.updated_at, i.indexed_at, 'epoch'::timestamptz) desc,
          i.id asc
      ) as keep_rank
    from public.program_list_index i
  ),
  deleted as (
    delete from public.program_list_index i
    using ranked r
    where i.id = r.id
      and r.keep_rank > effective_max_rows
    returning 1
  )
  select count(*) into trimmed_rows from deleted;

  with ranked as materialized (
    select
      f.id,
      row_number() over (
        partition by f.scope, f.pool_limit
        order by f.generated_at desc, f.id desc
      ) as keep_rank
    from public.program_list_facet_snapshots f
    where f.scope = 'browse'
      and f.pool_limit = effective_pool_limit
  ),
  deleted as (
    delete from public.program_list_facet_snapshots f
    using ranked r
    where f.id = r.id
      and r.keep_rank > effective_keep_snapshot_count
    returning 1
  )
  select count(*) into trimmed_snapshot_rows from deleted;

  select count(*) into remaining_rows
  from public.program_list_index;

  select count(*) into remaining_browse_rows
  from public.program_list_index
  where browse_rank is not null
    and browse_rank <= effective_pool_limit;

  return jsonb_build_object(
    'batch_limit', effective_batch_limit,
    'browse_pool_limit', effective_pool_limit,
    'max_rows', effective_max_rows,
    'keep_latest_snapshot_count', effective_keep_snapshot_count,
    'delta_rows', delta_rows,
    'browse_rows', browse_rows,
    'trimmed_rows', trimmed_rows,
    'trimmed_facet_snapshots', trimmed_snapshot_rows,
    'remaining_rows', remaining_rows,
    'remaining_browse_rows', remaining_browse_rows,
    'generated_at', now()
  );
end;
$$;

comment on function public.refresh_program_list_index_sample(integer, integer, integer, integer) is
  'Free-plan-safe helper for SQL Editor validation. Refreshes a bounded sample of program_list_index, then trims extra rows and stale browse snapshots.';
