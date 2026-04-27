-- Draft migration for the final program canonical refactor.
-- Purpose: seed public.program_source_records from the current mixed public.programs structure.

insert into public.program_source_records (
  program_id,
  source_code,
  source_label,
  source_family,
  source_record_key,
  external_program_id,
  source_url,
  detail_url,
  application_url,
  collect_method,
  raw_payload,
  normalized_snapshot,
  field_evidence,
  source_specific,
  is_primary,
  collected_at,
  last_seen_at,
  created_at,
  updated_at
)
select
  p.id as program_id,
  public.program_source_code_from_label(coalesce(nullif(btrim(coalesce(p.source, '')), ''), 'unknown')) as source_code,
  coalesce(nullif(btrim(coalesce(p.source, '')), ''), '미분류') as source_label,
  case
    when public.program_source_code_from_label(coalesce(nullif(btrim(coalesce(p.source, '')), ''), 'unknown')) in ('work24', 'kstartup', 'sesac', 'fastcampus')
      then public.program_source_code_from_label(coalesce(nullif(btrim(coalesce(p.source, '')), ''), 'unknown'))
    else null
  end as source_family,
  coalesce(
    optional_values.source_unique_key_text,
    optional_values.hrd_id_text,
    optional_values.source_url_text,
    md5(
      concat_ws(
        '||',
        p.id::text,
        coalesce(p.title, ''),
        coalesce(p.source, ''),
        coalesce(p.provider, ''),
        coalesce(optional_values.source_url_text, ''),
        coalesce(optional_values.application_url_text, '')
      )
    )
  ) as source_record_key,
  optional_values.hrd_id_text as external_program_id,
  optional_values.source_url_text as source_url,
  case
    when optional_values.link_text is not null
      and optional_values.link_text <> optional_values.application_url_text
      then optional_values.link_text
    else optional_values.source_url_text
  end as detail_url,
  coalesce(
    optional_values.application_url_text,
    nullif(btrim(coalesce((optional_values.compare_meta_json ->> 'application_url'), '')), '')
  ) as application_url,
  'legacy-programs-backfill' as collect_method,
  optional_values.raw_data_json as raw_payload,
  jsonb_strip_nulls(
    jsonb_build_object(
      'program_id', p.id,
      'title', p.title,
      'provider', p.provider,
      'category', p.category,
      'category_detail', p.category_detail,
      'region', p.region,
      'region_detail', p.region_detail,
      'location', p.location,
      'start_date', p.start_date,
      'end_date', p.end_date,
      'deadline', p.deadline,
      'application_url', optional_values.application_url_text,
      'source_url', optional_values.source_url_text
    )
  ) as normalized_snapshot,
  case
    when jsonb_typeof(optional_values.compare_meta_json) = 'object'
      then coalesce((optional_values.compare_meta_json -> 'field_sources'), '{}'::jsonb)
    else '{}'::jsonb
  end as field_evidence,
  jsonb_strip_nulls(
    case
      when jsonb_typeof(optional_values.compare_meta_json) = 'object'
        then optional_values.compare_meta_json - 'field_sources'
      when optional_values.compare_meta_json = '{}'::jsonb
        then '{}'::jsonb
      else jsonb_build_object('legacy_compare_meta_scalar', optional_values.compare_meta_json)
    end
    || jsonb_build_object(
      'legacy_link', optional_values.link_text,
      'legacy_source_unique_key', optional_values.source_unique_key_text,
      'legacy_hrd_id', optional_values.hrd_id_text
    )
  ) as source_specific,
  true as is_primary,
  coalesce(p.updated_at, p.created_at, now()) as collected_at,
  coalesce(p.updated_at, p.created_at, now()) as last_seen_at,
  coalesce(p.created_at, now()) as created_at,
  coalesce(p.updated_at, p.created_at, now()) as updated_at
from public.programs p
cross join lateral (
  select
    coalesce((to_jsonb(p) -> 'compare_meta'), '{}'::jsonb) as compare_meta_json,
    coalesce((to_jsonb(p) -> 'raw_data'), '{}'::jsonb) as raw_data_json,
    nullif(btrim(coalesce(to_jsonb(p) ->> 'source_unique_key', '')), '') as source_unique_key_text,
    nullif(btrim(coalesce(to_jsonb(p) ->> 'hrd_id', '')), '') as hrd_id_text,
    nullif(btrim(coalesce(to_jsonb(p) ->> 'source_url', '')), '') as source_url_text,
    nullif(btrim(coalesce(to_jsonb(p) ->> 'link', '')), '') as link_text,
    nullif(btrim(coalesce(to_jsonb(p) ->> 'application_url', '')), '') as application_url_text
) as optional_values
on conflict (source_code, source_record_key) do update
set
  program_id = excluded.program_id,
  source_label = excluded.source_label,
  source_family = excluded.source_family,
  external_program_id = coalesce(public.program_source_records.external_program_id, excluded.external_program_id),
  source_url = coalesce(excluded.source_url, public.program_source_records.source_url),
  detail_url = coalesce(excluded.detail_url, public.program_source_records.detail_url),
  application_url = coalesce(excluded.application_url, public.program_source_records.application_url),
  raw_payload = case
    when public.program_source_records.raw_payload = '{}'::jsonb then excluded.raw_payload
    else public.program_source_records.raw_payload
  end,
  normalized_snapshot = excluded.normalized_snapshot,
  field_evidence = case
    when public.program_source_records.field_evidence = '{}'::jsonb then excluded.field_evidence
    else public.program_source_records.field_evidence
  end,
  source_specific = excluded.source_specific,
  is_primary = excluded.is_primary,
  collected_at = coalesce(public.program_source_records.collected_at, excluded.collected_at),
  last_seen_at = greatest(coalesce(public.program_source_records.last_seen_at, 'epoch'::timestamptz), excluded.last_seen_at),
  updated_at = now();

update public.programs p
set
  primary_source_record_id = psr.id,
  primary_source_code = psr.source_code,
  primary_source_label = psr.source_label
from public.program_source_records psr
where psr.program_id = p.id
  and psr.is_primary;
