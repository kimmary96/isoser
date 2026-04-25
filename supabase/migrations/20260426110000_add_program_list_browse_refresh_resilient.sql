create or replace function public.refresh_program_list_browse_pool_bounded(
  pool_limit integer default 300,
  candidate_limit integer default null
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  affected integer;
  base_date date := public.program_list_kst_today();
  effective_pool_limit integer := greatest(coalesce(pool_limit, 300), 1);
  effective_candidate_limit integer := greatest(
    coalesce(candidate_limit, greatest(effective_pool_limit * 8, 1200)),
    effective_pool_limit
  );
begin
  with candidates as materialized (
    select
      i.id,
      i.source,
      i.recommended_score,
      i.click_hotness_score,
      i.updated_at,
      i.indexed_at,
      case
        when lower(coalesce(i.source, '')) in ('고용24', 'work24', 'hrd-net', 'hrdnet') then 'work24'
        when lower(coalesce(i.source, '')) like '%고용24%' then 'work24'
        when lower(coalesce(i.source, '')) like '%work24%' then 'work24'
        when lower(coalesce(i.source, '')) like '%k-startup%' then 'kstartup'
        when lower(coalesce(i.source, '')) like '%kstartup%' then 'kstartup'
        when lower(coalesce(i.source, '')) like '%startup%' then 'kstartup'
        when lower(coalesce(i.source, '')) like '%sesac%' then 'sesac'
        when nullif(i.source, '') is not null then lower(i.source)
        else 'unknown'
      end as source_group,
      case
        when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) between 0 and 7 then 1
        when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) between 8 and 30 then 2
        when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) is null then 3
        else 3
      end as urgency_bucket,
      row_number() over (
        partition by
          case
            when lower(coalesce(i.source, '')) in ('고용24', 'work24', 'hrd-net', 'hrdnet') then 'work24'
            when lower(coalesce(i.source, '')) like '%고용24%' then 'work24'
            when lower(coalesce(i.source, '')) like '%work24%' then 'work24'
            when lower(coalesce(i.source, '')) like '%k-startup%' then 'kstartup'
            when lower(coalesce(i.source, '')) like '%kstartup%' then 'kstartup'
            when lower(coalesce(i.source, '')) like '%startup%' then 'kstartup'
            when lower(coalesce(i.source, '')) like '%sesac%' then 'sesac'
            when nullif(i.source, '') is not null then lower(i.source)
            else 'unknown'
          end,
          case
            when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) between 0 and 7 then 1
            when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) between 8 and 30 then 2
            when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) is null then 3
            else 3
          end
        order by
          i.recommended_score desc nulls last,
          coalesce(i.click_hotness_score, 0) desc nulls last,
          coalesce(i.updated_at, i.indexed_at) desc nulls last,
          i.id asc
      ) as source_rank_calc
    from public.program_list_index i
    where i.is_open
      and not coalesce(i.is_ad, false)
    order by
      case
        when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) between 0 and 7 then 1
        when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) between 8 and 30 then 2
        when coalesce(i.days_left, case when i.deadline is not null then i.deadline - base_date else null end) is null then 3
        else 3
      end asc,
      i.recommended_score desc nulls last,
      coalesce(i.click_hotness_score, 0) desc nulls last,
      coalesce(i.updated_at, i.indexed_at) desc nulls last,
      i.id asc
    limit effective_candidate_limit
  ),
  diversified as (
    select
      c.id,
      row_number() over (
        order by
          c.urgency_bucket asc,
          case
            when c.source_group = 'work24'
              and c.source_rank_calc <= ceil(greatest(effective_pool_limit, 1)::numeric * 0.70)
              then c.source_rank_calc * 10 + 1
            when c.source_group <> 'work24'
              then c.source_rank_calc * 10 + 2
            else ceil(greatest(effective_pool_limit, 1)::numeric * 20) + c.source_rank_calc
          end asc,
          c.recommended_score desc nulls last,
          coalesce(c.click_hotness_score, 0) desc nulls last,
          c.id asc
      ) as new_browse_rank
    from candidates c
  ),
  selected as materialized (
    select id, new_browse_rank
    from diversified
    where new_browse_rank <= effective_pool_limit
  ),
  click_activity as materialized (
    select
      d.program_id,
      sum(d.view_count)::bigint as detail_view_count,
      sum(case when d.bucket_date >= base_date - 6 then d.view_count else 0 end)::bigint as detail_view_count_7d,
      max(d.last_viewed_at) as last_detail_viewed_at
    from public.program_detail_daily_stats d
    join selected s on s.id = d.program_id
    group by d.program_id
  ),
  cleared as (
    update public.program_list_index i
    set browse_rank = null,
        indexed_at = now()
    where i.browse_rank is not null
      and not exists (select 1 from selected s where s.id = i.id)
    returning 1
  ),
  refreshed as (
    update public.program_list_index i
    set
      title = p.title,
      provider = p.provider,
      summary = left(coalesce(p.summary, p.description, ''), 280),
      category = p.category,
      category_detail = p.category_detail,
      region = coalesce(p.region, p.region_detail, p.location),
      region_detail = p.region_detail,
      location = p.location,
      teaching_method = p.teaching_method,
      cost = p.cost,
      cost_type = coalesce(
        nullif(p.cost_type, ''),
        public.program_list_infer_cost_type(p.cost, p.support_type, coalesce(p.compare_meta, '{}'::jsonb), p.title, p.summary, p.description)
      ),
      participation_time = coalesce(
        nullif(p.participation_time, ''),
        public.program_list_infer_participation_time(p.start_date::text, p.end_date::text, coalesce(p.compare_meta, '{}'::jsonb), p.title, p.summary, p.description)
      ),
      source = p.source,
      source_url = p.source_url,
      link = p.link,
      thumbnail_url = p.thumbnail_url,
      deadline = public.program_list_try_date(
        coalesce(
          p.close_date::text,
          p.compare_meta ->> 'application_deadline',
          p.compare_meta ->> 'recruitment_deadline',
          p.compare_meta ->> 'application_end_date',
          p.compare_meta ->> 'recruitment_end_date',
          p.deadline::text
        )
      ),
      close_date = public.program_list_try_date(p.close_date::text),
      start_date = public.program_list_try_date(p.start_date::text),
      end_date = public.program_list_try_date(p.end_date::text),
      is_open = coalesce(
        p.is_active,
        public.program_list_try_date(
          coalesce(
            p.close_date::text,
            p.compare_meta ->> 'application_deadline',
            p.compare_meta ->> 'recruitment_deadline',
            p.compare_meta ->> 'application_end_date',
            p.compare_meta ->> 'recruitment_end_date',
            p.deadline::text
          )
        ) is null
        or public.program_list_try_date(
          coalesce(
            p.close_date::text,
            p.compare_meta ->> 'application_deadline',
            p.compare_meta ->> 'recruitment_deadline',
            p.compare_meta ->> 'application_end_date',
            p.compare_meta ->> 'recruitment_end_date',
            p.deadline::text
          )
        ) >= base_date
      ),
      is_active = p.is_active,
      is_ad = coalesce(p.is_ad, false),
      detail_view_count = coalesce(c.detail_view_count, i.detail_view_count, 0),
      detail_view_count_7d = coalesce(c.detail_view_count_7d, i.detail_view_count_7d, 0),
      click_hotness_score = public.program_list_click_hotness_score(
        coalesce(c.detail_view_count_7d, i.detail_view_count_7d, 0),
        coalesce(c.detail_view_count, i.detail_view_count, 0),
        i.recommended_score
      ),
      last_detail_viewed_at = coalesce(c.last_detail_viewed_at, i.last_detail_viewed_at),
      display_categories = array_remove(array[p.category_detail, p.category], null),
      tags = coalesce(p.tags, '{}'::text[]),
      skills = coalesce(p.skills, '{}'::text[]),
      target_summary = public.program_list_text_array(to_jsonb(p.target)),
      compare_meta = coalesce(p.compare_meta, '{}'::jsonb),
      search_text = regexp_replace(
        lower(
          concat_ws(
            ' ',
            p.title,
            p.provider,
            p.summary,
            p.description,
            p.category,
            p.category_detail,
            p.location,
            p.region,
            p.region_detail,
            p.source,
            array_to_string(p.tags, ' '),
            array_to_string(p.skills, ' '),
            p.compare_meta ->> 'application_method',
            p.compare_meta ->> 'business_type',
            p.compare_meta ->> 'course_content',
            p.compare_meta ->> 'description',
            p.compare_meta ->> 'education_content',
            p.compare_meta ->> 'job_category',
            p.compare_meta ->> 'ncs_name',
            p.compare_meta ->> 'program_summary',
            p.compare_meta ->> 'summary',
            p.compare_meta ->> 'target',
            p.compare_meta ->> 'trainTarget',
            p.compare_meta ->> 'training_content'
          )
        ),
        '\s+',
        '',
        'g'
      ),
      days_left = case
        when public.program_list_try_date(
          coalesce(
            p.close_date::text,
            p.compare_meta ->> 'application_deadline',
            p.compare_meta ->> 'recruitment_deadline',
            p.compare_meta ->> 'application_end_date',
            p.compare_meta ->> 'recruitment_end_date',
            p.deadline::text
          )
        ) is null then null
        else public.program_list_try_date(
          coalesce(
            p.close_date::text,
            p.compare_meta ->> 'application_deadline',
            p.compare_meta ->> 'recruitment_deadline',
            p.compare_meta ->> 'application_end_date',
            p.compare_meta ->> 'recruitment_end_date',
            p.deadline::text
          )
        ) - base_date
      end,
      browse_rank = s.new_browse_rank,
      updated_at = coalesce(p.updated_at, p.created_at, i.updated_at, now()),
      indexed_at = now()
    from selected s
    join public.programs p on p.id = s.id
    left join click_activity c on c.program_id = s.id
    where i.id = s.id
    returning 1
  )
  select count(*) into affected from refreshed;

  insert into public.program_list_facet_snapshots (scope, pool_limit, facets)
  select
    'browse',
    effective_pool_limit,
    jsonb_build_object(
      'category', coalesce((select jsonb_agg(jsonb_build_object('value', category, 'count', count) order by count desc, category) from (select category, count(*) from public.program_list_index where browse_rank <= effective_pool_limit and is_open and category is not null group by category) s), '[]'::jsonb),
      'region', coalesce((select jsonb_agg(jsonb_build_object('value', region, 'count', count) order by count desc, region) from (select region, count(*) from public.program_list_index where browse_rank <= effective_pool_limit and is_open and region is not null group by region) s), '[]'::jsonb),
      'teaching_method', coalesce((select jsonb_agg(jsonb_build_object('value', teaching_method, 'count', count) order by count desc, teaching_method) from (select teaching_method, count(*) from public.program_list_index where browse_rank <= effective_pool_limit and is_open and teaching_method is not null group by teaching_method) s), '[]'::jsonb),
      'cost_type', coalesce((select jsonb_agg(jsonb_build_object('value', cost_type, 'count', count) order by count desc, cost_type) from (select cost_type, count(*) from public.program_list_index where browse_rank <= effective_pool_limit and is_open and cost_type is not null group by cost_type) s), '[]'::jsonb),
      'participation_time', coalesce((select jsonb_agg(jsonb_build_object('value', participation_time, 'count', count) order by count desc, participation_time) from (select participation_time, count(*) from public.program_list_index where browse_rank <= effective_pool_limit and is_open and participation_time is not null group by participation_time) s), '[]'::jsonb),
      'source', coalesce((select jsonb_agg(jsonb_build_object('value', source, 'count', count) order by count desc, source) from (select source, count(*) from public.program_list_index where browse_rank <= effective_pool_limit and is_open and source is not null group by source) s), '[]'::jsonb)
    );

  return affected;
end;
$$;

create or replace function public.refresh_program_list_browse_pool_resilient(
  pool_limit integer default 300,
  candidate_limit integer default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  effective_pool_limit integer := greatest(coalesce(pool_limit, 300), 1);
  effective_candidate_limit integer := greatest(
    coalesce(candidate_limit, greatest(effective_pool_limit * 8, 1200)),
    effective_pool_limit
  );
  browse_rows integer := 0;
  mode text := 'full';
  fallback_reason text := null;
begin
  begin
    browse_rows := public.refresh_program_list_browse_pool(effective_pool_limit);
  exception
    when query_canceled or lock_not_available or deadlock_detected then
      mode := 'bounded_fallback';
      fallback_reason := SQLERRM;
      browse_rows := public.refresh_program_list_browse_pool_bounded(
        effective_pool_limit,
        effective_candidate_limit
      );
  end;

  return jsonb_build_object(
    'pool_limit', effective_pool_limit,
    'candidate_limit', effective_candidate_limit,
    'browse_rows', browse_rows,
    'mode', mode,
    'fallback_reason', fallback_reason,
    'generated_at', now()
  );
end;
$$;

create or replace function public.refresh_program_list_browse_pool_daily_resilient(
  pool_limit integer default 300,
  batch_limit integer default 500,
  max_batches integer default 20,
  candidate_limit integer default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  effective_pool_limit integer := greatest(coalesce(pool_limit, 300), 1);
  effective_max_batches integer := greatest(coalesce(max_batches, 20), 1);
  effective_batch_limit integer := greatest(coalesce(batch_limit, 500), 1);
  current_batch_limit integer := effective_batch_limit;
  effective_candidate_limit integer := greatest(
    coalesce(candidate_limit, greatest(effective_pool_limit * 8, 1200)),
    effective_pool_limit
  );
  min_batch_limit integer := 50;
  batch_affected integer := 0;
  delta_rows integer := 0;
  batches_run integer := 0;
  batch_retries integer := 0;
  browse_result jsonb;
begin
  loop
    exit when batches_run >= effective_max_batches;
    begin
      batch_affected := public.refresh_program_list_delta(current_batch_limit);
    exception
      when query_canceled or lock_not_available or deadlock_detected then
        if current_batch_limit <= min_batch_limit then
          raise;
        end if;
        current_batch_limit := greatest(current_batch_limit / 2, min_batch_limit);
        batch_retries := batch_retries + 1;
        continue;
    end;

    batches_run := batches_run + 1;
    delta_rows := delta_rows + batch_affected;
    exit when batch_affected < current_batch_limit;
  end loop;

  browse_result := public.refresh_program_list_browse_pool_resilient(
    effective_pool_limit,
    effective_candidate_limit
  );

  return jsonb_build_object(
    'base_date_kst', public.program_list_kst_today(),
    'pool_limit', effective_pool_limit,
    'initial_batch_limit', effective_batch_limit,
    'batch_limit_used', current_batch_limit,
    'max_batches', effective_max_batches,
    'batches_run', batches_run,
    'batch_retries', batch_retries,
    'delta_rows', delta_rows,
    'browse', browse_result
  );
end;
$$;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'program-list-browse-pool-daily-kst'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'program-list-browse-pool-daily-kst',
    '0 15 * * *',
    $job$select public.refresh_program_list_browse_pool_daily_resilient(300, 500, 20, 2400);$job$
  );
end;
$$;

comment on function public.refresh_program_list_browse_pool_bounded(integer, integer) is
  'Timeout-safe bounded browse pool refresh. Rebuilds browse_rank from a capped open candidate set sized for the final public pool.';

comment on function public.refresh_program_list_browse_pool_resilient(integer, integer) is
  'Attempts the full browse pool refresh first, then falls back to the bounded helper when query timeout or lock pressure occurs.';

comment on function public.refresh_program_list_browse_pool_daily_resilient(integer, integer, integer, integer) is
  'Daily browse refresh wrapper that can reduce delta batch size on timeout/lock pressure and then run the resilient browse pool refresh helper.';
