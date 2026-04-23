alter table public.programs
add column if not exists support_type text,
add column if not exists cost_type text,
add column if not exists participation_time text;

create or replace function public.program_list_infer_cost_type(
  p_cost numeric,
  p_support_type text,
  p_compare_meta jsonb,
  p_title text,
  p_summary text,
  p_description text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  haystack text;
begin
  haystack := lower(
    concat_ws(
      ' ',
      p_support_type,
      p_compare_meta ->> 'support_type',
      p_compare_meta ->> 'subsidy_rate',
      p_compare_meta ->> 'business_type',
      p_compare_meta ->> 'training_fee',
      p_compare_meta ->> 'self_payment',
      p_compare_meta ->> 'course_content',
      p_compare_meta ->> 'description',
      p_compare_meta ->> 'summary',
      p_title,
      p_summary,
      p_description
    )
  );

  if lower(coalesce(p_compare_meta ->> 'naeilbaeumcard_required', '')) in ('true', 'pass', 'yes', '1')
    or haystack like '%내일배움%'
    or haystack like '%내배카%'
    or haystack like '%국민내일배움%' then
    return 'naeil-card';
  end if;

  if p_cost is not null then
    if p_cost > 0 then
      return 'paid';
    end if;
    return 'free-no-card';
  end if;

  if haystack like '%무료%'
    or haystack like '%전액지원%'
    or haystack like '%전액 지원%'
    or haystack like '%교육비 지원%'
    or haystack like '%자부담 0%'
    or haystack like '%자비부담액 0%' then
    return 'free-no-card';
  end if;

  if haystack like '%유료%'
    or haystack like '%자부담%'
    or haystack like '%자비부담%'
    or haystack like '%수강료%'
    or haystack like '%훈련비%' then
    return 'paid';
  end if;

  return null;
end;
$$;

create or replace function public.program_list_infer_participation_time(
  p_start_date text,
  p_end_date text,
  p_compare_meta jsonb,
  p_title text,
  p_summary text,
  p_description text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  haystack text;
  parsed_start_date date;
  parsed_end_date date;
  duration_days integer;
begin
  haystack := lower(
    concat_ws(
      ' ',
      p_compare_meta ->> 'training_type',
      p_compare_meta ->> 'training_time',
      p_compare_meta ->> 'training_schedule',
      p_compare_meta ->> 'day_night_type',
      p_compare_meta ->> 'weekend_yn',
      p_compare_meta ->> 'course_content',
      p_compare_meta ->> 'description',
      p_compare_meta ->> 'summary',
      p_title,
      p_summary,
      p_description
    )
  );

  if haystack like '%파트타임%'
    or haystack like '%part-time%'
    or haystack like '%야간%'
    or haystack like '%저녁%'
    or haystack like '%주말%'
    or haystack like '%단기%'
    or haystack like '%특강%'
    or haystack like '%세미나%' then
    return 'part-time';
  end if;

  if haystack like '%풀타임%'
    or haystack like '%full-time%'
    or haystack like '%전일%'
    or haystack like '%종일%'
    or haystack like '%부트캠프%' then
    return 'full-time';
  end if;

  parsed_start_date := public.program_list_try_date(p_start_date);
  parsed_end_date := public.program_list_try_date(p_end_date);

  if parsed_start_date is not null and parsed_end_date is not null and parsed_end_date >= parsed_start_date then
    duration_days := parsed_end_date - parsed_start_date + 1;
    if duration_days <= 14 then
      return 'part-time';
    end if;
    if duration_days >= 28 then
      return 'full-time';
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.refresh_program_list_index(pool_limit integer default 300)
returns integer
language plpgsql
set search_path = public
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
  ),
  eligible as (
    select
      p.*,
      case
        when lower(coalesce(p.source, '')) in ('고용24', 'work24', 'hrd-net', 'hrdnet') then 'work24'
        when lower(coalesce(p.source, '')) like '%고용24%' then 'work24'
        when lower(coalesce(p.source, '')) like '%work24%' then 'work24'
        when lower(coalesce(p.source, '')) like '%k-startup%' then 'kstartup'
        when lower(coalesce(p.source, '')) like '%kstartup%' then 'kstartup'
        when lower(coalesce(p.source, '')) like '%startup%' then 'kstartup'
        when lower(coalesce(p.source, '')) like '%sesac%' then 'sesac'
        when nullif(p.source, '') is not null then lower(p.source)
        else 'unknown'
      end as source_group,
      row_number() over (
        partition by
          case
            when lower(coalesce(p.source, '')) in ('고용24', 'work24', 'hrd-net', 'hrdnet') then 'work24'
            when lower(coalesce(p.source, '')) like '%고용24%' then 'work24'
            when lower(coalesce(p.source, '')) like '%work24%' then 'work24'
            when lower(coalesce(p.source, '')) like '%k-startup%' then 'kstartup'
            when lower(coalesce(p.source, '')) like '%kstartup%' then 'kstartup'
            when lower(coalesce(p.source, '')) like '%startup%' then 'kstartup'
            when lower(coalesce(p.source, '')) like '%sesac%' then 'sesac'
            when nullif(p.source, '') is not null then lower(p.source)
            else 'unknown'
          end
        order by
          case
            when not coalesce(p.is_ad, false)
              and coalesce(p.is_active, p.resolved_deadline is null or p.resolved_deadline >= current_date)
              then 0
            else 1
          end,
          p.recommended_calc desc nulls last,
          p.id asc
      ) as source_rank_calc
    from projected p
  ),
  diversified as (
    select
      e.*,
      row_number() over (
        order by
          case
            when not coalesce(e.is_ad, false)
              and coalesce(e.is_active, e.resolved_deadline is null or e.resolved_deadline >= current_date)
              and e.source_group = 'work24'
              and e.source_rank_calc <= ceil(greatest(pool_limit, 1)::numeric * 0.70)
              then e.source_rank_calc * 10 + 1
            when not coalesce(e.is_ad, false)
              and coalesce(e.is_active, e.resolved_deadline is null or e.resolved_deadline >= current_date)
              and e.source_group <> 'work24'
              then e.source_rank_calc * 10 + 2
            when not coalesce(e.is_ad, false)
              and coalesce(e.is_active, e.resolved_deadline is null or e.resolved_deadline >= current_date)
              then ceil(greatest(pool_limit, 1)::numeric * 20) + e.source_rank_calc
            else null
          end asc nulls last,
          e.recommended_calc desc nulls last,
          e.id asc
      ) as organic_browse_rank
    from eligible e
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
    case when not coalesce(is_ad, false) and coalesce(is_active, resolved_deadline is null or resolved_deadline >= current_date) then organic_browse_rank else null end,
    coalesce(updated_at, created_at, now()),
    now()
  from diversified
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
