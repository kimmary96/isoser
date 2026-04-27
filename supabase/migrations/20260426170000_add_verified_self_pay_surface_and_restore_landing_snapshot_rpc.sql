alter table public.program_list_index
  add column if not exists verified_self_pay_amount integer;

create or replace function public.program_surface_verified_self_pay_amount(
  p_support_amount integer,
  p_fee_amount integer,
  p_cost_type text,
  p_support_type text,
  p_source_code text,
  p_compare_meta jsonb
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  compare_meta jsonb := coalesce(p_compare_meta, '{}'::jsonb);
  support_text text := lower(coalesce(p_support_type, ''));
  explicit_amount integer;
begin
  explicit_amount := coalesce(
    public.program_try_integer(compare_meta ->> 'self_payment'),
    public.program_try_integer(compare_meta ->> 'selfPayment'),
    public.program_try_integer(compare_meta ->> 'out_of_pocket'),
    public.program_try_integer(compare_meta ->> 'outOfPocket'),
    public.program_try_integer(compare_meta ->> 'out_of_pocket_amount'),
    public.program_try_integer(compare_meta ->> 'outOfPocketAmount')
  );

  if explicit_amount is not null then
    return greatest(explicit_amount, 0);
  end if;

  if p_support_amount is not null then
    if p_support_amount <= 0 then
      return greatest(p_support_amount, 0);
    end if;

    if coalesce(p_source_code, '') = 'work24'
      and p_fee_amount is not null
      and p_support_amount >= p_fee_amount then
      return null;
    end if;

    return p_support_amount;
  end if;

  if coalesce(p_cost_type, '') = 'free-no-card'
    or support_text like '%전액%'
    or support_text like '%무료%' then
    return 0;
  end if;

  return null;
end;
$$;

create or replace function public.program_list_index_apply_surface_contract()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_program public.programs%rowtype;
  v_program_json jsonb := '{}'::jsonb;
begin
  select *
  into v_program
  from public.programs
  where id = new.id;

  if found then
    v_program_json := to_jsonb(v_program);
  end if;

  new.provider_name := coalesce(
    nullif(btrim(coalesce(new.provider_name, '')), ''),
    nullif(btrim(coalesce(v_program.provider_name, '')), ''),
    nullif(btrim(coalesce(new.provider, '')), '')
  );

  new.source_label := coalesce(
    nullif(btrim(coalesce(new.source_label, '')), ''),
    nullif(btrim(coalesce(v_program.primary_source_label, '')), ''),
    nullif(btrim(coalesce(v_program.source, '')), ''),
    nullif(btrim(coalesce(new.source, '')), ''),
    '미분류'
  );

  new.source_code := coalesce(
    nullif(btrim(coalesce(new.source_code, '')), ''),
    nullif(btrim(coalesce(v_program.primary_source_code, '')), ''),
    public.program_source_code_from_label(coalesce(
      nullif(btrim(coalesce(v_program.primary_source_label, '')), ''),
      nullif(btrim(coalesce(v_program.source, '')), ''),
      nullif(btrim(coalesce(new.source_label, '')), ''),
      nullif(btrim(coalesce(new.source, '')), '')
    ))
  );

  new.summary_text := coalesce(
    nullif(btrim(coalesce(new.summary_text, '')), ''),
    nullif(btrim(coalesce(v_program.summary_text, '')), ''),
    nullif(btrim(coalesce(new.summary, '')), '')
  );

  new.region_label := coalesce(
    nullif(btrim(coalesce(new.region_label, '')), ''),
    nullif(btrim(coalesce(v_program.region, '')), ''),
    nullif(btrim(coalesce(v_program.location_text, '')), ''),
    nullif(btrim(coalesce(new.region, '')), ''),
    nullif(btrim(coalesce(new.location, '')), '')
  );

  new.application_start_date := coalesce(new.application_start_date, v_program.application_start_date);
  new.application_end_date := coalesce(new.application_end_date, v_program.application_end_date, new.deadline);
  new.program_start_date := coalesce(new.program_start_date, v_program.program_start_date, new.start_date);
  new.program_end_date := coalesce(new.program_end_date, v_program.program_end_date, new.end_date);
  new.verified_self_pay_amount := coalesce(
    new.verified_self_pay_amount,
    public.program_surface_verified_self_pay_amount(
      v_program.support_amount,
      coalesce(v_program.fee_amount, new.cost),
      coalesce(v_program.cost_type, new.cost_type),
      v_program.support_type,
      new.source_code,
      coalesce(v_program.compare_meta, '{}'::jsonb)
    )
  );

  new.recruiting_status := public.program_surface_recruiting_status(
    new.is_open,
    new.days_left,
    new.application_end_date
  );
  new.recruiting_status_label := public.program_surface_recruiting_status_label(new.recruiting_status);

  new.primary_link := coalesce(
    nullif(btrim(coalesce(v_program_json ->> 'application_url', '')), ''),
    nullif(btrim(coalesce(v_program.detail_url, '')), ''),
    nullif(btrim(coalesce(v_program.source_url, '')), ''),
    nullif(btrim(coalesce(new.link, '')), ''),
    nullif(btrim(coalesce(new.source_url, '')), '')
  );

  new.detail_path := '/programs/' || new.id::text;
  new.compare_path := '/compare?ids=' || new.id::text;

  new.location_label := coalesce(
    nullif(btrim(coalesce(new.location_label, '')), ''),
    nullif(btrim(coalesce(v_program.location_text, '')), ''),
    nullif(btrim(coalesce(new.location, '')), '')
  );

  new.program_period_label := public.program_surface_program_period_label(
    new.program_start_date,
    new.program_end_date
  );

  new.cost_label := public.program_surface_cost_label(
    coalesce(v_program.fee_amount, new.cost),
    coalesce(v_program.cost_type, new.cost_type),
    v_program.support_type
  );

  new.teaching_method_label := coalesce(
    nullif(btrim(coalesce(new.teaching_method_label, '')), ''),
    nullif(btrim(coalesce(v_program.teaching_method, '')), ''),
    nullif(btrim(coalesce(new.teaching_method, '')), '')
  );

  new.participation_label := public.program_surface_participation_label(
    new.participation_mode_label,
    new.participation_time_text,
    coalesce(v_program.participation_time, new.participation_time)
  );

  new.selection_process_label := coalesce(
    nullif(btrim(coalesce(new.selection_process_label, '')), ''),
    nullif(btrim(coalesce(v_program.selection_process_label, '')), '')
  );

  new.keyword_labels := public.program_distinct_text_array(
    coalesce(new.extracted_keywords, '{}'::text[])
    || coalesce(new.tags, '{}'::text[])
    || coalesce(new.skills, '{}'::text[])
  );

  new.badge_labels := public.program_distinct_text_array(coalesce(new.recommendation_reasons, '{}'::text[]));

  return new;
end;
$$;

comment on function public.program_surface_verified_self_pay_amount(integer, integer, text, text, text, jsonb) is
  'Returns a conservative verified self-pay amount from canonical/support metadata without treating Work24 total tuition as out-of-pocket.';

create table if not exists public.program_landing_chip_snapshots (
  surface text not null default 'landing-c',
  chip text not null,
  generated_for date not null default public.program_list_kst_today(),
  generated_at timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb,
  primary key (surface, chip, generated_for)
);

create index if not exists idx_program_landing_chip_snapshots_latest
on public.program_landing_chip_snapshots (surface, chip, generated_for desc, generated_at desc);

alter table public.program_landing_chip_snapshots enable row level security;

drop policy if exists "program_landing_chip_snapshots_service_role_all" on public.program_landing_chip_snapshots;
create policy "program_landing_chip_snapshots_service_role_all"
on public.program_landing_chip_snapshots
for all
to service_role
using (true)
with check (true);

drop policy if exists "program_landing_chip_snapshots_public_read" on public.program_landing_chip_snapshots;
create policy "program_landing_chip_snapshots_public_read"
on public.program_landing_chip_snapshots
for select
to anon, authenticated
using (true);

drop function if exists public.refresh_program_landing_chip_snapshots(text, integer);

create or replace function public.refresh_program_landing_chip_snapshots(
  surface text default 'landing-c',
  item_limit integer default 24
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  base_date date := public.program_list_kst_today();
  effective_surface text := coalesce(nullif(btrim(surface), ''), 'landing-c');
  effective_item_limit integer := greatest(coalesce(item_limit, 24), 6);
  affected_rows integer := 0;
begin
  with chips as (
    select chip
    from (values
      ('전체'::text),
      ('무료'::text),
      ('AI·데이터'::text),
      ('IT·개발'::text),
      ('디자인'::text),
      ('경영'::text),
      ('창업'::text),
      ('서울'::text),
      ('경기'::text),
      ('온라인'::text)
    ) as landing_chips(chip)
  ),
  source_rows as materialized (
    select
      i.id,
      i.title,
      coalesce(i.provider_name, i.provider, p.provider_name, p.provider) as provider_label,
      coalesce(i.source_label, i.source, p.primary_source_label, p.source, '미분류') as source_label,
      coalesce(i.summary_text, i.summary, p.summary_text, p.summary, '') as summary_text,
      coalesce(i.category, p.category) as category_label,
      coalesce(i.category_detail, p.category_detail) as category_detail_label,
      coalesce(i.location_label, i.location, p.location_text, p.location, i.region_label, i.region, p.region, p.region_detail, '') as location_text,
      coalesce(i.region_label, i.region, p.region, p.region_detail, '') as region_text,
      coalesce(i.teaching_method_label, i.teaching_method, p.teaching_method, '') as teaching_method_text,
      coalesce(i.application_end_date, i.deadline, p.application_end_date) as application_end_date_resolved,
      coalesce(i.program_start_date, i.start_date, p.program_start_date) as program_start_date_resolved,
      coalesce(i.program_end_date, i.end_date, p.program_end_date) as program_end_date_resolved,
      coalesce(i.days_left, case when coalesce(i.application_end_date, i.deadline, p.application_end_date) is not null then coalesce(i.application_end_date, i.deadline, p.application_end_date) - base_date else null end) as days_left_resolved,
      i.browse_rank,
      i.recommended_score,
      i.detail_view_count,
      i.detail_view_count_7d,
      i.click_hotness_score,
      i.display_categories,
      i.participation_mode_label,
      i.participation_time_text,
      i.selection_process_label,
      i.extracted_keywords,
      coalesce(i.badge_labels, i.tags, p.tags, '{}'::text[]) as badge_labels,
      coalesce(i.keyword_labels, i.skills, p.skills, '{}'::text[]) as keyword_labels,
      coalesce(p.fee_amount, i.cost) as cost_value,
      coalesce(p.cost_type, i.cost_type) as cost_type_value,
      coalesce(p.support_type, nullif(btrim(coalesce(p.compare_meta ->> 'training_type', '')), '')) as support_type_value,
      coalesce(
        i.verified_self_pay_amount,
        public.program_surface_verified_self_pay_amount(
          p.support_amount,
          coalesce(p.fee_amount, i.cost),
          coalesce(p.cost_type, i.cost_type),
          coalesce(p.support_type, nullif(btrim(coalesce(p.compare_meta ->> 'training_type', '')), '')),
          coalesce(i.source_code, public.program_source_code_from_label(coalesce(i.source_label, i.source, p.primary_source_label, p.source))),
          coalesce(p.compare_meta, '{}'::jsonb)
        )
      ) as verified_self_pay_amount_value,
      coalesce(
        i.verified_self_pay_amount,
        public.program_surface_verified_self_pay_amount(
          p.support_amount,
          coalesce(p.fee_amount, i.cost),
          coalesce(p.cost_type, i.cost_type),
          coalesce(p.support_type, nullif(btrim(coalesce(p.compare_meta ->> 'training_type', '')), '')),
          coalesce(i.source_code, public.program_source_code_from_label(coalesce(i.source_label, i.source, p.primary_source_label, p.source))),
          coalesce(p.compare_meta, '{}'::jsonb)
        ),
        p.support_amount,
        p.subsidy_amount
      ) as subsidy_amount_value,
      case
        when nullif(regexp_replace(coalesce(p.compare_meta ->> 'review_count', ''), '[^0-9]', '', 'g'), '') is null then greatest(coalesce(i.satisfaction_count, 0), 0)
        else regexp_replace(coalesce(p.compare_meta ->> 'review_count', ''), '[^0-9]', '', 'g')::integer
      end as review_count_value,
      coalesce(
        p.rating_value,
        case
          when nullif(regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g'), '') is null then null
          else regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g')::numeric
        end,
        i.bayesian_satisfaction * 5
      ) as rating_value,
      p.description,
      p.compare_meta,
      lower(
        concat_ws(
          ' ',
          coalesce(i.title, ''),
          coalesce(i.provider_name, i.provider, p.provider_name, p.provider, ''),
          coalesce(i.source_label, i.source, p.primary_source_label, p.source, ''),
          coalesce(i.summary_text, i.summary, p.summary_text, p.summary, ''),
          coalesce(p.description, ''),
          coalesce(i.category, p.category, ''),
          coalesce(i.category_detail, p.category_detail, ''),
          coalesce(i.location_label, i.location, p.location_text, p.location, ''),
          coalesce(i.region_label, i.region, p.region, p.region_detail, ''),
          coalesce(i.teaching_method_label, i.teaching_method, p.teaching_method, ''),
          array_to_string(coalesce(i.tags, p.tags, '{}'::text[]), ' '),
          array_to_string(coalesce(i.skills, p.skills, '{}'::text[]), ' '),
          coalesce(p.compare_meta::text, ''),
          coalesce(p.service_meta::text, '')
        )
      ) as haystack,
      (
        (case when nullif(btrim(coalesce(i.provider_name, i.provider, p.provider_name, p.provider, '')), '') is not null then 3 else 0 end) +
        (case when coalesce(i.program_start_date, i.start_date, p.program_start_date) is not null or coalesce(i.program_end_date, i.end_date, p.program_end_date) is not null then 3 else 0 end) +
        (case when nullif(btrim(coalesce(i.location_label, i.location, p.location_text, p.location, '')), '') is not null then 2 else 0 end) +
        (case when coalesce(p.fee_amount, i.cost, i.verified_self_pay_amount) is not null then 1 else 0 end) +
        (case
          when coalesce(
            p.rating_value,
            case
              when nullif(regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g'), '') is null then null
              else regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g')::numeric
            end,
            i.bayesian_satisfaction * 5
          ) is not null then 1 else 0
        end)
      ) as completeness_score,
      jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'category', coalesce(i.category, p.category),
        'category_detail', coalesce(i.category_detail, p.category_detail),
        'location', nullif(btrim(coalesce(i.location_label, i.location, p.location_text, p.location, i.region_label, i.region, p.region, p.region_detail, '')), ''),
        'provider', nullif(btrim(coalesce(i.provider_name, i.provider, p.provider_name, p.provider, '')), ''),
        'source', nullif(btrim(coalesce(i.source_label, i.source, p.primary_source_label, p.source, '미분류')), ''),
        'source_url', nullif(btrim(coalesce(p.source_url, i.source_url, '')), ''),
        'link', nullif(btrim(coalesce(p.detail_url, p.link, i.link, '')), ''),
        'deadline', case when coalesce(i.application_end_date, i.deadline, p.application_end_date) is null then null else to_char(coalesce(i.application_end_date, i.deadline, p.application_end_date), 'YYYY-MM-DD') end,
        'start_date', case when coalesce(i.program_start_date, i.start_date, p.program_start_date) is null then null else to_char(coalesce(i.program_start_date, i.start_date, p.program_start_date), 'YYYY-MM-DD') end,
        'end_date', case when coalesce(i.program_end_date, i.end_date, p.program_end_date) is null then null else to_char(coalesce(i.program_end_date, i.end_date, p.program_end_date), 'YYYY-MM-DD') end,
        'cost', coalesce(p.fee_amount, i.cost),
        'cost_type', coalesce(p.cost_type, i.cost_type),
        'support_type', coalesce(p.support_type, nullif(btrim(coalesce(p.compare_meta ->> 'training_type', '')), '')),
        'support_amount', coalesce(i.verified_self_pay_amount, public.program_surface_verified_self_pay_amount(
          p.support_amount,
          coalesce(p.fee_amount, i.cost),
          coalesce(p.cost_type, i.cost_type),
          coalesce(p.support_type, nullif(btrim(coalesce(p.compare_meta ->> 'training_type', '')), '')),
          coalesce(i.source_code, public.program_source_code_from_label(coalesce(i.source_label, i.source, p.primary_source_label, p.source))),
          coalesce(p.compare_meta, '{}'::jsonb)
        )),
        'verified_self_pay_amount', coalesce(i.verified_self_pay_amount, public.program_surface_verified_self_pay_amount(
          p.support_amount,
          coalesce(p.fee_amount, i.cost),
          coalesce(p.cost_type, i.cost_type),
          coalesce(p.support_type, nullif(btrim(coalesce(p.compare_meta ->> 'training_type', '')), '')),
          coalesce(i.source_code, public.program_source_code_from_label(coalesce(i.source_label, i.source, p.primary_source_label, p.source))),
          coalesce(p.compare_meta, '{}'::jsonb)
        )),
        'teaching_method', nullif(btrim(coalesce(i.teaching_method_label, i.teaching_method, p.teaching_method, '')), ''),
        'is_active', coalesce(i.is_open, p.is_active),
        'is_ad', false,
        'days_left', coalesce(i.days_left, case when coalesce(i.application_end_date, i.deadline, p.application_end_date) is not null then coalesce(i.application_end_date, i.deadline, p.application_end_date) - base_date else null end),
        'deadline_confidence', i.deadline_confidence,
        'summary', nullif(btrim(coalesce(i.summary_text, i.summary, p.summary_text, p.summary, '')), ''),
        'description', nullif(btrim(coalesce(p.description, '')), ''),
        'tags', coalesce(i.badge_labels, i.tags, p.tags, '{}'::text[]),
        'skills', coalesce(i.keyword_labels, i.skills, p.skills, '{}'::text[]),
        'application_url', nullif(btrim(coalesce(i.primary_link, primary_source.application_url, p.source_url, p.detail_url, p.link, '')), ''),
        'application_method', coalesce(
          nullif(btrim(coalesce(p.service_meta ->> 'application_method', '')), ''),
          nullif(btrim(coalesce(p.compare_meta ->> 'application_method', '')), '')
        ),
        'participation_time', nullif(btrim(coalesce(i.program_period_label, i.participation_label, i.participation_time_text, i.participation_time, '')), ''),
        'subsidy_amount', coalesce(
          i.verified_self_pay_amount,
          public.program_surface_verified_self_pay_amount(
            p.support_amount,
            coalesce(p.fee_amount, i.cost),
            coalesce(p.cost_type, i.cost_type),
            coalesce(p.support_type, nullif(btrim(coalesce(p.compare_meta ->> 'training_type', '')), '')),
            coalesce(i.source_code, public.program_source_code_from_label(coalesce(i.source_label, i.source, p.primary_source_label, p.source))),
            coalesce(p.compare_meta, '{}'::jsonb)
          ),
          p.support_amount,
          p.subsidy_amount
        ),
        'display_categories', coalesce(i.display_categories, '{}'::text[]),
        'participation_mode_label', nullif(btrim(coalesce(i.participation_mode_label, i.recruiting_status_label, '')), ''),
        'participation_time_text', nullif(btrim(coalesce(i.participation_time_text, i.participation_label, '')), ''),
        'selection_process_label', nullif(btrim(coalesce(i.selection_process_label, p.selection_process_label, '')), ''),
        'extracted_keywords', coalesce(i.extracted_keywords, '{}'::text[]),
        'rating', coalesce(
          p.rating_value,
          case
            when nullif(regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g'), '') is null then null
            else regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g')::numeric
          end,
          i.bayesian_satisfaction * 5
        ),
        'rating_display', case
          when coalesce(
            p.rating_value,
            case
              when nullif(regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g'), '') is null then null
              else regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g')::numeric
            end,
            i.bayesian_satisfaction * 5
          ) is null then null
          else to_char(round(coalesce(
            p.rating_value,
            case
              when nullif(regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g'), '') is null then null
              else regexp_replace(coalesce(p.compare_meta ->> 'satisfaction_score', ''), '[^0-9.]', '', 'g')::numeric
            end,
            i.bayesian_satisfaction * 5
          )::numeric, 1), 'FM999999990.0')
        end,
        'review_count', case
          when nullif(regexp_replace(coalesce(p.compare_meta ->> 'review_count', ''), '[^0-9]', '', 'g'), '') is null then greatest(coalesce(i.satisfaction_count, 0), 0)
          else regexp_replace(coalesce(p.compare_meta ->> 'review_count', ''), '[^0-9]', '', 'g')::integer
        end,
        'recommended_score', i.recommended_score,
        'detail_view_count', i.detail_view_count,
        'detail_view_count_7d', i.detail_view_count_7d,
        'click_hotness_score', i.click_hotness_score,
        'compare_meta', coalesce(p.compare_meta, '{}'::jsonb)
      ) as item
    from public.program_list_index i
    join public.programs p on p.id = i.id
    left join lateral (
      select
        nullif(btrim(coalesce(psr.application_url, '')), '') as application_url
      from public.program_source_records psr
      where psr.program_id = p.id
        and (
          psr.id = p.primary_source_record_id
          or coalesce(psr.is_primary, false)
        )
      order by
        case when psr.id = p.primary_source_record_id then 0 else 1 end asc,
        psr.updated_at desc nulls last,
        psr.created_at desc nulls last,
        psr.id asc
      limit 1
    ) as primary_source on true
    where i.is_open
      and not coalesce(i.is_ad, false)
  ),
  matched as (
    select
      c.chip,
      s.item,
      row_number() over (
        partition by c.chip
        order by
          case when c.chip = '전체' then case when s.browse_rank is null then 1 else 0 end else 0 end asc,
          case when c.chip = '전체' then s.browse_rank end asc nulls last,
          case when c.chip <> '전체' then coalesce(s.days_left_resolved, 2147483647) end asc nulls last,
          case when c.chip <> '전체' then case when s.browse_rank is null then 1 else 0 end end asc nulls last,
          case when c.chip <> '전체' then s.browse_rank end asc nulls last,
          s.rating_value desc nulls last,
          s.review_count_value desc nulls last,
          coalesce(s.recommended_score, 0) desc,
          s.completeness_score desc,
          coalesce(s.application_end_date_resolved, '9999-12-31'::date) asc,
          s.id asc
      ) as chip_rank
    from chips c
    join source_rows s
      on (
        c.chip = '전체'
        or (
          c.chip = '무료'
          and (
            coalesce(s.verified_self_pay_amount_value, 2147483647) = 0
            or coalesce(s.cost_type_value, '') in ('free-no-card', 'naeil-card')
            or s.haystack like '%자부담0%'
            or s.haystack like '%본인부담없음%'
            or s.haystack like '%전액지원%'
          )
        )
        or (c.chip = 'AI·데이터' and s.category_label = 'AI')
        or (c.chip = 'IT·개발' and s.category_label = 'IT')
        or (c.chip = '디자인' and s.category_label = '디자인')
        or (c.chip = '경영' and s.category_label = '경영')
        or (
          c.chip = '창업'
          and (
            s.category_label = '창업'
            or s.haystack like '%k-startup%'
            or s.haystack like '%kstartup%'
            or s.haystack like '%창업진흥원%'
            or s.haystack like '%예비창업%'
            or s.haystack like '%스타트업%'
            or s.haystack like '%창업%'
          )
        )
        or (
          c.chip = '서울'
          and (s.location_text like '%서울%' or s.region_text like '%서울%')
        )
        or (
          c.chip = '경기'
          and (s.location_text like '%경기%' or s.region_text like '%경기%')
        )
        or (
          c.chip = '온라인'
          and (
            s.teaching_method_text like '%온라인%'
            or s.teaching_method_text like '%비대면%'
            or s.teaching_method_text like '%원격%'
            or s.haystack like '%온라인%'
            or s.haystack like '%비대면%'
            or s.haystack like '%원격%'
          )
        )
      )
  ),
  aggregated as (
    select
      chip,
      jsonb_agg(item order by chip_rank asc) filter (where chip_rank <= effective_item_limit) as items
    from matched
    group by chip
  )
  insert into public.program_landing_chip_snapshots (
    surface,
    chip,
    generated_for,
    generated_at,
    items
  )
  select
    effective_surface,
    chips.chip,
    base_date,
    now(),
    coalesce(aggregated.items, '[]'::jsonb)
  from chips
  left join aggregated using (chip)
  on conflict on constraint program_landing_chip_snapshots_pkey do update
  set
    generated_at = excluded.generated_at,
    items = excluded.items;

  get diagnostics affected_rows = row_count;

  return jsonb_build_object(
    'surface', effective_surface,
    'generated_for', base_date,
    'item_limit', effective_item_limit,
    'chip_rows', affected_rows,
    'generated_at', now()
  );
end;
$$;

comment on function public.refresh_program_landing_chip_snapshots(text, integer) is
  'Refreshes landing chip snapshot rows from browse-ranked program_list_index rows using explicit verified self-pay when available.';
