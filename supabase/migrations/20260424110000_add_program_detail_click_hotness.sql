create table if not exists public.program_detail_daily_stats (
  program_id uuid not null references public.programs(id) on delete cascade,
  bucket_date date not null,
  view_count bigint not null default 0,
  last_viewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (program_id, bucket_date)
);

create index if not exists idx_program_detail_daily_stats_recent
on public.program_detail_daily_stats (bucket_date desc, program_id);

alter table public.program_detail_daily_stats enable row level security;

drop policy if exists "program_detail_daily_stats_service_role_all" on public.program_detail_daily_stats;
create policy "program_detail_daily_stats_service_role_all"
on public.program_detail_daily_stats
for all
to service_role
using (true)
with check (true);

alter table public.program_list_index
add column if not exists detail_view_count bigint not null default 0,
add column if not exists detail_view_count_7d bigint not null default 0,
add column if not exists click_hotness_score numeric not null default 0,
add column if not exists last_detail_viewed_at timestamptz;

create or replace function public.program_list_click_hotness_score(
  recent_count bigint,
  total_count bigint,
  recommended numeric
)
returns numeric
language sql
immutable
as $$
  select
    greatest(coalesce(recent_count, 0), 0)::numeric * 1000000
    + least(greatest(coalesce(total_count, 0), 0), 999999)::numeric
    + coalesce(recommended, 0);
$$;

update public.program_list_index
set
  detail_view_count = coalesce(detail_view_count, 0),
  detail_view_count_7d = coalesce(detail_view_count_7d, 0),
  click_hotness_score = public.program_list_click_hotness_score(
    coalesce(detail_view_count_7d, 0),
    coalesce(detail_view_count, 0),
    recommended_score
  );

create or replace function public.record_program_detail_view(
  target_program_id uuid,
  viewed_at timestamptz default now()
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  effective_viewed_at timestamptz := coalesce(viewed_at, now());
  current_count bigint := 0;
begin
  insert into public.program_detail_daily_stats (
    program_id,
    bucket_date,
    view_count,
    last_viewed_at,
    created_at,
    updated_at
  )
  values (
    target_program_id,
    effective_viewed_at::date,
    1,
    effective_viewed_at,
    effective_viewed_at,
    effective_viewed_at
  )
  on conflict (program_id, bucket_date) do update
  set
    view_count = public.program_detail_daily_stats.view_count + 1,
    last_viewed_at = greatest(public.program_detail_daily_stats.last_viewed_at, excluded.last_viewed_at),
    updated_at = excluded.updated_at
  returning view_count into current_count;

  with rollup as (
    select
      d.program_id,
      sum(d.view_count)::bigint as detail_view_count,
      sum(case when d.bucket_date >= current_date - 6 then d.view_count else 0 end)::bigint as detail_view_count_7d,
      max(d.last_viewed_at) as last_detail_viewed_at
    from public.program_detail_daily_stats d
    where d.program_id = target_program_id
    group by d.program_id
  )
  update public.program_list_index pli
  set
    detail_view_count = coalesce(rollup.detail_view_count, 0),
    detail_view_count_7d = coalesce(rollup.detail_view_count_7d, 0),
    last_detail_viewed_at = rollup.last_detail_viewed_at,
    click_hotness_score = public.program_list_click_hotness_score(
      coalesce(rollup.detail_view_count_7d, 0),
      coalesce(rollup.detail_view_count, 0),
      pli.recommended_score
    ),
    indexed_at = greatest(pli.indexed_at, now())
  from rollup
  where pli.id = rollup.program_id;

  return current_count;
end;
$$;

create or replace function public.refresh_program_list_delta(batch_limit integer default 500)
returns integer
language plpgsql
set search_path = public
as $$
declare
  affected integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('program_list_refresh_delta', 0)) then
    raise exception 'program list refresh delta already running' using errcode = '55P03';
  end if;

  insert into public.program_list_index as pli (
    id, title, provider, summary, category, category_detail, region, region_detail, location,
    teaching_method, cost, cost_type, participation_time, source, source_url, link, thumbnail_url,
    deadline, close_date, start_date, end_date, is_open, is_active, is_ad, promoted_rank,
    deadline_confidence, excellence_score, satisfaction_avg, satisfaction_count,
    bayesian_satisfaction, review_confidence, deadline_urgency, freshness_score, data_completeness,
    recommended_score, recommendation_reasons, detail_view_count, detail_view_count_7d,
    click_hotness_score, last_detail_viewed_at, display_categories, participation_mode_label,
    participation_time_text, selection_process_label, extracted_keywords, tags, skills, target_summary,
    compare_meta, search_text, days_left, browse_rank, updated_at, indexed_at
  )
  with click_activity as materialized (
    select
      d.program_id,
      sum(d.view_count)::bigint as detail_view_count,
      sum(case when d.bucket_date >= current_date - 6 then d.view_count else 0 end)::bigint as detail_view_count_7d,
      max(d.last_viewed_at) as last_detail_viewed_at
    from public.program_detail_daily_stats d
    group by d.program_id
  ),
  candidate_ids as materialized (
    select p.id
    from public.programs p
    left join public.program_list_index i on i.id = p.id
    left join click_activity c on c.program_id = p.id
    where i.id is null
      or coalesce(p.updated_at, p.created_at, 'epoch'::timestamptz) > coalesce(i.updated_at, 'epoch'::timestamptz)
      or coalesce(c.last_detail_viewed_at, 'epoch'::timestamptz) > coalesce(i.last_detail_viewed_at, 'epoch'::timestamptz)
      or i.indexed_at < current_date
    order by
      case when i.id is null then 0 else 1 end,
      greatest(
        extract(epoch from coalesce(p.updated_at, p.created_at, 'epoch'::timestamptz)),
        extract(epoch from coalesce(c.last_detail_viewed_at, 'epoch'::timestamptz))
      ) desc,
      p.id asc
    limit greatest(coalesce(batch_limit, 500), 1)
  ),
  normalized as (
    select
      p.id,
      p.title,
      p.provider,
      p.summary,
      p.description,
      p.category,
      p.category_detail,
      p.region,
      p.region_detail,
      p.location,
      p.teaching_method,
      p.cost,
      coalesce(
        nullif(p.cost_type, ''),
        public.program_list_infer_cost_type(p.cost, p.support_type, coalesce(p.compare_meta, '{}'::jsonb), p.title, p.summary, p.description)
      ) as cost_type,
      coalesce(
        nullif(p.participation_time, ''),
        public.program_list_infer_participation_time(p.start_date::text, p.end_date::text, coalesce(p.compare_meta, '{}'::jsonb), p.title, p.summary, p.description)
      ) as participation_time,
      p.source,
      p.source_url,
      p.link,
      p.thumbnail_url,
      p.close_date,
      p.start_date,
      p.end_date,
      p.deadline,
      p.is_active,
      p.is_ad,
      p.is_certified,
      p.tags,
      p.skills,
      p.target,
      p.updated_at,
      p.created_at,
      coalesce(p.compare_meta, '{}'::jsonb) as meta,
      coalesce(c.detail_view_count, 0) as detail_view_count,
      coalesce(c.detail_view_count_7d, 0) as detail_view_count_7d,
      c.last_detail_viewed_at,
      public.program_list_try_date(
        coalesce(
          p.close_date::text,
          p.compare_meta ->> 'application_deadline',
          p.compare_meta ->> 'recruitment_deadline',
          p.compare_meta ->> 'application_end_date',
          p.compare_meta ->> 'recruitment_end_date',
          p.deadline::text
        )
      ) as resolved_deadline,
      public.program_list_try_date(p.close_date::text) as parsed_close_date,
      public.program_list_try_date(p.start_date::text) as parsed_start_date,
      public.program_list_try_date(p.end_date::text) as parsed_end_date
    from public.programs p
    join candidate_ids cids on cids.id = p.id
    left join click_activity c on c.program_id = p.id
  ),
  scored as (
    select
      n.*,
      case
        when n.parsed_close_date is not null
          or n.meta ? 'application_deadline'
          or n.meta ? 'recruitment_deadline'
          or n.meta ? 'application_end_date'
          or n.meta ? 'recruitment_end_date'
          then 'high'
        when lower(replace(replace(concat_ws(' ', n.meta ->> 'deadline_source', n.meta ->> 'application_deadline_source', n.meta ->> 'recruitment_deadline_source'), '_', ''), '-', '')) in ('trastartdate', 'trainingstartdate', 'trainingstart')
          then 'medium'
        else 'low'
      end as deadline_confidence_calc,
      case when coalesce(n.is_certified, false) then 1.0 else 0.0 end as excellence_score_calc,
      case
        when nullif(n.meta ->> 'satisfaction_score', '') is null then null
        when (n.meta ->> 'satisfaction_score')::numeric <= 5 then least(1.0, greatest(0.0, (n.meta ->> 'satisfaction_score')::numeric / 5.0))
        when (n.meta ->> 'satisfaction_score')::numeric <= 100 then least(1.0, greatest(0.0, (n.meta ->> 'satisfaction_score')::numeric / 100.0))
        else null
      end as satisfaction_unit,
      greatest(0, coalesce(nullif(n.meta ->> 'review_count', '')::integer, 0)) as review_count_calc
    from normalized n
  ),
  ranked as (
    select
      s.*,
      ((coalesce(s.satisfaction_unit, 0.72) * s.review_count_calc + 0.72 * 20) / (s.review_count_calc + 20)) as bayesian_calc,
      least(1.0, sqrt(s.review_count_calc::numeric) / 10.0) as review_confidence_calc,
      case
        when s.deadline_confidence_calc = 'high' and s.resolved_deadline is not null and s.resolved_deadline >= current_date and s.resolved_deadline <= current_date + 3 then 1.0
        when s.deadline_confidence_calc = 'high' and s.resolved_deadline is not null and s.resolved_deadline > current_date + 3 and s.resolved_deadline < current_date + 30 then 1.0 - ((s.resolved_deadline - current_date - 3)::numeric / 27.0)
        else 0.0
      end as urgency_calc,
      case
        when coalesce(s.updated_at, s.created_at) is null then 0.3
        when coalesce(s.updated_at, s.created_at)::date >= current_date - 7 then 1.0
        when coalesce(s.updated_at, s.created_at)::date <= current_date - 120 then 0.0
        else 1.0 - (((current_date - coalesce(s.updated_at, s.created_at)::date) - 7)::numeric / 113.0)
      end as freshness_calc
    from scored s
  ),
  final as (
    select
      r.*,
      (
        (case when nullif(r.title, '') is not null then 1 else 0 end) +
        (case when nullif(r.provider, '') is not null then 1 else 0 end) +
        (case when nullif(r.summary, '') is not null then 1 else 0 end) +
        (case when nullif(r.category, '') is not null then 1 else 0 end) +
        (case when nullif(r.category_detail, '') is not null then 1 else 0 end) +
        (case when nullif(coalesce(r.region, r.location), '') is not null then 1 else 0 end) +
        (case when nullif(r.teaching_method, '') is not null then 1 else 0 end) +
        (case when nullif(r.cost_type, '') is not null then 1 else 0 end) +
        (case when nullif(r.participation_time, '') is not null then 1 else 0 end) +
        (case when nullif(r.thumbnail_url, '') is not null then 1 else 0 end)
      )::numeric / 10.0 as completeness_calc
    from ranked r
  ),
  projected as (
    select
      f.*,
      least(1.0, greatest(0.0,
        f.excellence_score_calc * 0.35
        + f.bayesian_calc * 0.30
        + f.review_confidence_calc * 0.10
        + f.urgency_calc * 0.10
        + f.freshness_calc * 0.10
        + f.completeness_calc * 0.05
      )) as recommended_calc,
      array_remove(array[
        case when f.excellence_score_calc >= 1 then '우수기관' end,
        case when f.bayesian_calc >= 0.8 and f.review_confidence_calc >= 0.2 then '만족도 상위' end,
        case when f.urgency_calc >= 0.75 then '마감임박' end,
        case when f.freshness_calc >= 0.85 then '최근 등록' end,
        case when f.completeness_calc >= 0.75 then '상세정보 충실' end
      ], null) as reasons_calc
    from final f
  )
  select
    id,
    title,
    provider,
    left(coalesce(summary, description, ''), 280),
    category,
    category_detail,
    coalesce(region, region_detail, location),
    region_detail,
    location,
    teaching_method,
    cost,
    cost_type,
    participation_time,
    source,
    source_url,
    link,
    thumbnail_url,
    resolved_deadline,
    parsed_close_date,
    parsed_start_date,
    parsed_end_date,
    coalesce(is_active, resolved_deadline is null or resolved_deadline >= current_date),
    is_active,
    coalesce(is_ad, false),
    null::integer,
    deadline_confidence_calc,
    excellence_score_calc,
    satisfaction_unit,
    review_count_calc,
    bayesian_calc,
    review_confidence_calc,
    urgency_calc,
    freshness_calc,
    completeness_calc,
    recommended_calc,
    reasons_calc,
    detail_view_count,
    detail_view_count_7d,
    public.program_list_click_hotness_score(detail_view_count_7d, detail_view_count, recommended_calc),
    last_detail_viewed_at,
    array_remove(array[category_detail, category], null),
    case participation_time when 'full-time' then '풀타임' when 'part-time' then '파트타임' else participation_time end,
    null,
    null,
    '{}'::text[],
    coalesce(tags, '{}'::text[]),
    coalesce(skills, '{}'::text[]),
    public.program_list_text_array(to_jsonb(target)),
    meta,
    regexp_replace(
      lower(
        concat_ws(
          ' ',
          title,
          provider,
          summary,
          description,
          category,
          category_detail,
          location,
          region,
          region_detail,
          source,
          array_to_string(tags, ' '),
          array_to_string(skills, ' '),
          meta ->> 'application_method',
          meta ->> 'business_type',
          meta ->> 'course_content',
          meta ->> 'description',
          meta ->> 'education_content',
          meta ->> 'job_category',
          meta ->> 'ncs_name',
          meta ->> 'program_summary',
          meta ->> 'summary',
          meta ->> 'target',
          meta ->> 'trainTarget',
          meta ->> 'training_content'
        )
      ),
      '\s+',
      '',
      'g'
    ),
    case when resolved_deadline is null then null else resolved_deadline - current_date end,
    null::integer,
    coalesce(updated_at, created_at, now()),
    now()
  from projected
  on conflict (id) do update set
    title = excluded.title,
    provider = excluded.provider,
    summary = excluded.summary,
    category = excluded.category,
    category_detail = excluded.category_detail,
    region = excluded.region,
    region_detail = excluded.region_detail,
    location = excluded.location,
    teaching_method = excluded.teaching_method,
    cost = excluded.cost,
    cost_type = excluded.cost_type,
    participation_time = excluded.participation_time,
    source = excluded.source,
    source_url = excluded.source_url,
    link = excluded.link,
    thumbnail_url = excluded.thumbnail_url,
    deadline = excluded.deadline,
    close_date = excluded.close_date,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_open = excluded.is_open,
    is_active = excluded.is_active,
    is_ad = excluded.is_ad,
    promoted_rank = coalesce(pli.promoted_rank, excluded.promoted_rank),
    deadline_confidence = excluded.deadline_confidence,
    excellence_score = excluded.excellence_score,
    satisfaction_avg = excluded.satisfaction_avg,
    satisfaction_count = excluded.satisfaction_count,
    bayesian_satisfaction = excluded.bayesian_satisfaction,
    review_confidence = excluded.review_confidence,
    deadline_urgency = excluded.deadline_urgency,
    freshness_score = excluded.freshness_score,
    data_completeness = excluded.data_completeness,
    recommended_score = excluded.recommended_score,
    recommendation_reasons = excluded.recommendation_reasons,
    detail_view_count = excluded.detail_view_count,
    detail_view_count_7d = excluded.detail_view_count_7d,
    click_hotness_score = excluded.click_hotness_score,
    last_detail_viewed_at = excluded.last_detail_viewed_at,
    display_categories = excluded.display_categories,
    participation_mode_label = excluded.participation_mode_label,
    participation_time_text = excluded.participation_time_text,
    selection_process_label = excluded.selection_process_label,
    extracted_keywords = excluded.extracted_keywords,
    tags = excluded.tags,
    skills = excluded.skills,
    target_summary = excluded.target_summary,
    compare_meta = excluded.compare_meta,
    search_text = excluded.search_text,
    days_left = excluded.days_left,
    browse_rank = pli.browse_rank,
    updated_at = excluded.updated_at,
    indexed_at = excluded.indexed_at;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.refresh_program_list_browse_pool(pool_limit integer default 300)
returns integer
language plpgsql
set search_path = public
as $$
declare
  affected integer;
begin
  with candidates as (
    select
      i.id,
      i.source,
      i.recommended_score,
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
          end
        order by
          i.recommended_score desc nulls last,
          coalesce(i.updated_at, i.indexed_at) desc nulls last,
          i.id asc
      ) as source_rank_calc
    from public.program_list_index i
    where i.is_open
      and not coalesce(i.is_ad, false)
  ),
  diversified as (
    select
      c.id,
      row_number() over (
        order by
          case
            when c.source_group = 'work24'
              and c.source_rank_calc <= ceil(greatest(pool_limit, 1)::numeric * 0.70)
              then c.source_rank_calc * 10 + 1
            when c.source_group <> 'work24'
              then c.source_rank_calc * 10 + 2
            else ceil(greatest(pool_limit, 1)::numeric * 20) + c.source_rank_calc
          end asc,
          c.recommended_score desc nulls last,
          c.id asc
      ) as new_browse_rank
    from candidates c
  ),
  selected as materialized (
    select id, new_browse_rank
    from diversified
    where new_browse_rank <= greatest(pool_limit, 1)
  ),
  click_activity as materialized (
    select
      d.program_id,
      sum(d.view_count)::bigint as detail_view_count,
      sum(case when d.bucket_date >= current_date - 6 then d.view_count else 0 end)::bigint as detail_view_count_7d,
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
        ) >= current_date
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
        ) - current_date
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
    pool_limit,
    jsonb_build_object(
      'category', coalesce((select jsonb_agg(jsonb_build_object('value', category, 'count', count) order by count desc, category) from (select category, count(*) from public.program_list_index where browse_rank <= pool_limit and is_open and category is not null group by category) s), '[]'::jsonb),
      'region', coalesce((select jsonb_agg(jsonb_build_object('value', region, 'count', count) order by count desc, region) from (select region, count(*) from public.program_list_index where browse_rank <= pool_limit and is_open and region is not null group by region) s), '[]'::jsonb),
      'teaching_method', coalesce((select jsonb_agg(jsonb_build_object('value', teaching_method, 'count', count) order by count desc, teaching_method) from (select teaching_method, count(*) from public.program_list_index where browse_rank <= pool_limit and is_open and teaching_method is not null group by teaching_method) s), '[]'::jsonb),
      'cost_type', coalesce((select jsonb_agg(jsonb_build_object('value', cost_type, 'count', count) order by count desc, cost_type) from (select cost_type, count(*) from public.program_list_index where browse_rank <= pool_limit and is_open and cost_type is not null group by cost_type) s), '[]'::jsonb),
      'participation_time', coalesce((select jsonb_agg(jsonb_build_object('value', participation_time, 'count', count) order by count desc, participation_time) from (select participation_time, count(*) from public.program_list_index where browse_rank <= pool_limit and is_open and participation_time is not null group by participation_time) s), '[]'::jsonb),
      'source', coalesce((select jsonb_agg(jsonb_build_object('value', source, 'count', count) order by count desc, source) from (select source, count(*) from public.program_list_index where browse_rank <= pool_limit and is_open and source is not null group by source) s), '[]'::jsonb)
    );

  return affected;
end;
$$;

create or replace function public.refresh_program_list_index(pool_limit integer default 300)
returns integer
language plpgsql
set search_path = public
as $$
declare
  effective_batch_limit integer := greatest(greatest(coalesce(pool_limit, 300), 1) * 4, 1000);
  batch_affected integer := 0;
  synced_rows integer := 0;
  browse_rows integer := 0;
  loop_guard integer := 0;
begin
  loop
    loop_guard := loop_guard + 1;
    batch_affected := public.refresh_program_list_delta(effective_batch_limit);
    synced_rows := synced_rows + batch_affected;
    exit when batch_affected < effective_batch_limit or loop_guard >= 1000;
  end loop;

  browse_rows := public.refresh_program_list_browse_pool(pool_limit);
  return greatest(synced_rows, browse_rows);
end;
$$;

create index if not exists idx_program_list_index_runtime_popular
on public.program_list_index (is_open, click_hotness_score desc, deadline asc nulls last, id)
where not coalesce(is_ad, false);
