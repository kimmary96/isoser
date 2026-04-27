-- Draft migration for the final program canonical refactor.
-- Purpose: backfill canonical public.programs columns from legacy mixed columns.

create or replace function public.program_try_integer(p_value text)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized text;
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;

  normalized := regexp_replace(p_value, '[^0-9-]+', '', 'g');
  if normalized = '' or normalized = '-' then
    return null;
  end if;

  return normalized::integer;
exception
  when others then
    return null;
end;
$$;

create or replace function public.program_distinct_text_array(p_values text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(
    array(
      select distinct normalized
      from (
        select nullif(btrim(value), '') as normalized
        from unnest(coalesce(p_values, '{}'::text[])) as value
      ) normalized_values
      where normalized is not null
      order by normalized
    ),
    '{}'::text[]
  );
$$;

create or replace function public.program_normalize_rating_value(p_raw_value text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  match_text text;
  score numeric;
begin
  if nullif(btrim(coalesce(p_raw_value, '')), '') is null then
    return null;
  end if;

  match_text := substring(replace(p_raw_value, ',', '') from '(?<![\d.])\d+(?:\.\d+)?(?![\d.])');
  if match_text is null then
    return null;
  end if;

  score := match_text::numeric;
  if score <= 0 or score > 100 then
    return null;
  end if;

  if score <= 5 then
    return round(score, 2);
  end if;

  return round(score / 20.0, 2);
exception
  when others then
    return null;
end;
$$;

update public.programs p
set
  primary_source_record_id = coalesce(p.primary_source_record_id, psr.id),
  primary_source_code = coalesce(nullif(btrim(coalesce(p.primary_source_code, '')), ''), psr.source_code),
  primary_source_label = coalesce(nullif(btrim(coalesce(p.primary_source_label, '')), ''), psr.source_label)
from public.program_source_records psr
where psr.program_id = p.id
  and psr.is_primary;

update public.programs p
set
  provider_name = coalesce(nullif(btrim(coalesce(provider_name, '')), ''), nullif(btrim(coalesce(provider, '')), '')),
  organizer_name = coalesce(
    nullif(btrim(coalesce(organizer_name, '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'organizer_name'), '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'organization'), '')), ''),
    nullif(btrim(coalesce(provider, '')), '')
  ),
  summary_text = coalesce(
    nullif(btrim(coalesce(summary_text, '')), ''),
    nullif(btrim(coalesce(summary, '')), ''),
    nullif(btrim(left(coalesce(description, ''), 280)), '')
  ),
  business_type = coalesce(
    nullif(btrim(coalesce(business_type, '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'business_type'), '')), '')
  ),
  location_text = coalesce(nullif(btrim(coalesce(location_text, '')), ''), nullif(btrim(coalesce(location, '')), '')),
  application_start_date = coalesce(
    application_start_date,
    public.program_list_try_date(coalesce(
      (coalesce(compare_meta, '{}'::jsonb) ->> 'application_start_date'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'recruitment_start_date'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'registration_start_date')
    ))
  ),
  application_end_date = coalesce(
    application_end_date,
    public.program_list_try_date(coalesce(
      close_date::text,
      (coalesce(compare_meta, '{}'::jsonb) ->> 'application_deadline'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'recruitment_deadline'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'application_end_date'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'recruitment_end_date'),
      deadline::text
    ))
  ),
  program_start_date = coalesce(program_start_date, public.program_list_try_date(start_date::text)),
  program_end_date = coalesce(program_end_date, public.program_list_try_date(end_date::text)),
  deadline_confidence = case
    when application_end_date is not null then deadline_confidence
    when public.program_list_try_date(coalesce(
      close_date::text,
      (coalesce(compare_meta, '{}'::jsonb) ->> 'application_deadline'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'recruitment_deadline'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'application_end_date'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'recruitment_end_date'),
      deadline::text
    )) is not null
      and (
        close_date is not null
        or coalesce(compare_meta, '{}'::jsonb) ? 'application_deadline'
        or coalesce(compare_meta, '{}'::jsonb) ? 'recruitment_deadline'
        or coalesce(compare_meta, '{}'::jsonb) ? 'application_end_date'
        or coalesce(compare_meta, '{}'::jsonb) ? 'recruitment_end_date'
      ) then 'high'
    when lower(replace(replace(concat_ws(' ',
      coalesce(compare_meta, '{}'::jsonb) ->> 'deadline_source',
      coalesce(compare_meta, '{}'::jsonb) ->> 'application_deadline_source',
      coalesce(compare_meta, '{}'::jsonb) ->> 'recruitment_deadline_source'
    ), '_', ''), '-', '')) in ('trastartdate', 'trainingstartdate', 'trainingstart')
      then 'medium'
    else coalesce(deadline_confidence, 'low')
  end,
  detail_url = coalesce(
    nullif(btrim(coalesce(detail_url, '')), ''),
    case
      when nullif(btrim(coalesce((to_jsonb(p) ->> 'link'), '')), '') is not null
        and nullif(btrim(coalesce((to_jsonb(p) ->> 'link'), '')), '') <> nullif(btrim(coalesce((to_jsonb(p) ->> 'application_url'), '')), '')
        then nullif(btrim(coalesce((to_jsonb(p) ->> 'link'), '')), '')
      else nullif(btrim(coalesce((to_jsonb(p) ->> 'source_url'), '')), '')
    end
  ),
  fee_amount = coalesce(fee_amount, cost),
  support_amount = coalesce(support_amount, subsidy_amount),
  target_summary = case
    when coalesce(array_length(target_summary, 1), 0) > 0 then target_summary
    else public.program_list_text_array(to_jsonb(target))
  end,
  target_detail = coalesce(
    nullif(btrim(coalesce(target_detail, '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'target'), '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'trainTarget'), '')), ''),
    nullif(array_to_string(public.program_list_text_array(to_jsonb(target)), ', '), '')
  ),
  eligibility_labels = case
    when coalesce(array_length(eligibility_labels, 1), 0) > 0 then eligibility_labels
    else public.program_distinct_text_array(
      array[
        nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'target_group'), '')), ''),
        nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'age_restriction'), '')), ''),
        nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'education_requirement'), '')), ''),
        nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'employment_restriction'), '')), ''),
        nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'experience_requirement'), '')), '')
      ]
    )
  end,
  selection_process_label = coalesce(
    nullif(btrim(coalesce(selection_process_label, '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'selection_process'), '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'selection_method'), '')), '')
  ),
  contact_phone = coalesce(
    nullif(btrim(coalesce(contact_phone, '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'contact_phone'), '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'phone'), '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'manager_phone'), '')), '')
  ),
  contact_email = coalesce(
    nullif(btrim(coalesce(contact_email, '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'contact_email'), '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'email'), '')), ''),
    nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'manager_email'), '')), '')
  ),
  capacity_total = coalesce(
    capacity_total,
    public.program_try_integer(coalesce(
      (coalesce(compare_meta, '{}'::jsonb) ->> 'capacity_total'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'capacity'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'quota')
    ))
  ),
  capacity_current = coalesce(
    capacity_current,
    public.program_try_integer(coalesce(
      (coalesce(compare_meta, '{}'::jsonb) ->> 'capacity_current'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'remaining_capacity'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'current_capacity')
    ))
  ),
  rating_value = coalesce(
    rating_value,
    public.program_normalize_rating_value(coalesce(
      (coalesce(compare_meta, '{}'::jsonb) ->> 'satisfaction_score'),
      (coalesce(compare_meta, '{}'::jsonb) ->> 'rating')
    ))
  ),
  curriculum_items = case
    when coalesce(array_length(curriculum_items, 1), 0) > 0 then curriculum_items
    when jsonb_typeof(coalesce(compare_meta, '{}'::jsonb) -> 'curriculum_items') = 'array'
      then public.program_list_text_array((coalesce(compare_meta, '{}'::jsonb) -> 'curriculum_items'))
    when jsonb_typeof(coalesce(compare_meta, '{}'::jsonb) -> 'curriculum') = 'array'
      then public.program_list_text_array((coalesce(compare_meta, '{}'::jsonb) -> 'curriculum'))
    else public.program_distinct_text_array(
      array[
        nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'course_content'), '')), ''),
        nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'training_content'), '')), ''),
        nullif(btrim(coalesce((coalesce(compare_meta, '{}'::jsonb) ->> 'education_content'), '')), '')
      ]
    )
  end,
  certifications = case
    when coalesce(array_length(certifications, 1), 0) > 0 then certifications
    when jsonb_typeof(coalesce(compare_meta, '{}'::jsonb) -> 'certifications') = 'array'
      then public.program_list_text_array((coalesce(compare_meta, '{}'::jsonb) -> 'certifications'))
    else '{}'::text[]
  end,
  service_meta = case
    when service_meta = '{}'::jsonb then
      case
        when jsonb_typeof(coalesce(compare_meta, '{}'::jsonb)) = 'object'
          then coalesce(compare_meta, '{}'::jsonb) - 'field_sources'
        when coalesce(compare_meta, '{}'::jsonb) = '{}'::jsonb
          then '{}'::jsonb
        else jsonb_build_object('legacy_compare_meta_scalar', compare_meta)
      end
    else service_meta
  end;
