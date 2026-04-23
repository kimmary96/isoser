create extension if not exists pg_trgm;

alter table public.programs
add column if not exists close_date text,
add column if not exists thumbnail_url text,
add column if not exists provider text,
add column if not exists summary text,
add column if not exists description text,
add column if not exists location text,
add column if not exists region text,
add column if not exists region_detail text,
add column if not exists category_detail text,
add column if not exists teaching_method text,
add column if not exists cost integer,
add column if not exists cost_type text,
add column if not exists participation_time text,
add column if not exists source_url text,
add column if not exists link text,
add column if not exists start_date text,
add column if not exists end_date text,
add column if not exists is_active boolean,
add column if not exists is_ad boolean default false,
add column if not exists is_certified boolean default false,
add column if not exists tags text[] default '{}'::text[],
add column if not exists skills text[] default '{}'::text[],
add column if not exists target text[] default '{}'::text[],
add column if not exists compare_meta jsonb default '{}'::jsonb;

create table if not exists public.program_list_index (
  id uuid primary key references public.programs(id) on delete cascade,
  title text,
  provider text,
  summary text,
  category text,
  category_detail text,
  region text,
  region_detail text,
  location text,
  teaching_method text,
  cost integer,
  cost_type text,
  participation_time text,
  source text,
  source_url text,
  link text,
  thumbnail_url text,
  deadline date,
  close_date date,
  start_date date,
  end_date date,
  is_open boolean not null default false,
  is_active boolean,
  is_ad boolean not null default false,
  promoted_rank integer,
  deadline_confidence text not null default 'low' check (deadline_confidence in ('high', 'medium', 'low')),
  excellence_score numeric not null default 0,
  satisfaction_avg numeric,
  satisfaction_count integer not null default 0,
  bayesian_satisfaction numeric not null default 0.72,
  review_confidence numeric not null default 0,
  deadline_urgency numeric not null default 0,
  freshness_score numeric not null default 0,
  data_completeness numeric not null default 0,
  recommended_score numeric not null default 0,
  recommendation_reasons text[] not null default '{}'::text[],
  display_categories text[] not null default '{}'::text[],
  participation_mode_label text,
  participation_time_text text,
  selection_process_label text,
  extracted_keywords text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  skills text[] not null default '{}'::text[],
  target_summary text[] not null default '{}'::text[],
  compare_meta jsonb not null default '{}'::jsonb,
  search_text text not null default '',
  days_left integer,
  browse_rank integer,
  updated_at timestamptz not null default now(),
  indexed_at timestamptz not null default now()
);

create table if not exists public.program_list_facet_snapshots (
  id bigserial primary key,
  scope text not null check (scope in ('browse', 'search', 'archive')),
  pool_limit integer not null,
  facets jsonb not null,
  generated_at timestamptz not null default now()
);

create or replace function public.program_list_try_date(value text)
returns date
language plpgsql
immutable
as $$
begin
  if coalesce(value, '') ~ '^\d{4}-\d{2}-\d{2}' then
    return left(value, 10)::date;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

create or replace function public.program_list_text_array(value jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(
    case
      when jsonb_typeof(value) = 'array' then array(select jsonb_array_elements_text(value))
      when jsonb_typeof(value) = 'string' then array[value #>> '{}']
      else '{}'::text[]
    end,
    '{}'::text[]
  );
$$;

create or replace function public.refresh_program_list_index(pool_limit integer default 300)
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  insert into public.program_list_index (
    id, title, provider, summary, category, category_detail, region, region_detail, location,
    teaching_method, cost, cost_type, participation_time, source, source_url, link, thumbnail_url,
    deadline, close_date, start_date, end_date, is_open, is_active, is_ad, promoted_rank,
    deadline_confidence, excellence_score, satisfaction_avg, satisfaction_count,
    bayesian_satisfaction, review_confidence, deadline_urgency, freshness_score, data_completeness,
    recommended_score, recommendation_reasons, display_categories, participation_mode_label,
    participation_time_text, selection_process_label, extracted_keywords, tags, skills, target_summary,
    compare_meta, search_text, days_left, browse_rank, updated_at, indexed_at
  )
  with normalized as (
    select
      p.*,
      coalesce(p.compare_meta, '{}'::jsonb) as meta,
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
      row_number() over (
        partition by case when coalesce(s.is_ad, false) then 'promoted' else 'organic' end
        order by
          case when coalesce(s.is_certified, false) then 1 else 0 end desc,
          coalesce(s.updated_at, s.created_at) desc nulls last,
          s.id asc
      ) as source_rank,
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
    case when coalesce(is_ad, false) then source_rank else null end,
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
    array_remove(array[category_detail, category], null),
    case participation_time when 'full-time' then '풀타임' when 'part-time' then '파트타임' else participation_time end,
    null,
    null,
    '{}'::text[],
    coalesce(tags, '{}'::text[]),
    coalesce(skills, '{}'::text[]),
    public.program_list_text_array(to_jsonb(target)),
    meta,
    regexp_replace(lower(concat_ws(' ', title, provider, summary, category, category_detail, location, region, region_detail, source, array_to_string(tags, ' '), array_to_string(skills, ' '), meta::text)), '\s+', '', 'g'),
    case when resolved_deadline is null then null else resolved_deadline - current_date end,
    case when not coalesce(is_ad, false) and coalesce(is_active, resolved_deadline is null or resolved_deadline >= current_date) then row_number() over (partition by (not coalesce(is_ad, false) and coalesce(is_active, resolved_deadline is null or resolved_deadline >= current_date)) order by recommended_calc desc nulls last, id asc) else null end,
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
    promoted_rank = excluded.promoted_rank,
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
    browse_rank = excluded.browse_rank,
    updated_at = excluded.updated_at,
    indexed_at = excluded.indexed_at;

  get diagnostics affected = row_count;

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

create index if not exists idx_program_list_index_browse
on public.program_list_index (browse_rank, recommended_score desc, id)
where is_open = true and is_ad = false;

create index if not exists idx_program_list_index_promoted
on public.program_list_index (promoted_rank, id)
where is_ad = true;

create index if not exists idx_program_list_index_search_text
on public.program_list_index using gin (search_text gin_trgm_ops);

create index if not exists idx_program_list_index_filters
on public.program_list_index (category, category_detail, region, teaching_method, cost_type, participation_time);

create index if not exists idx_program_list_index_deadline
on public.program_list_index (is_open, deadline, id);

create index if not exists idx_program_list_index_recommended
on public.program_list_index (recommended_score desc, id);

select public.refresh_program_list_index(300);
