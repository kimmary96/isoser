-- Draft migration for the final program canonical refactor.
-- Purpose: add a free-plan-safe helper that backfills only a bounded sample of public.program_source_records.

create or replace function public.backfill_program_source_records_sample(
  batch_limit integer default 100,
  max_rows integer default 100
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  effective_batch_limit integer := greatest(coalesce(batch_limit, 100), 1);
  effective_max_rows integer := greatest(coalesce(max_rows, coalesce(batch_limit, 100)), 1);
  candidate_program_ids uuid[] := '{}'::uuid[];
  selected_candidate_rows integer := 0;
  indexed_candidate_rows integer := 0;
  upserted_rows integer := 0;
  linked_program_rows integer := 0;
  trimmed_program_links integer := 0;
  trimmed_rows integer := 0;
  remaining_rows integer := 0;
  remaining_linked_programs integer := 0;
begin
  effective_batch_limit := least(effective_batch_limit, effective_max_rows);

  if not pg_try_advisory_xact_lock(hashtextextended('program_source_records_sample_backfill', 0)) then
    raise exception 'program source records sample backfill already running' using errcode = '55P03';
  end if;

  with indexed_candidates as materialized (
    select
      i.id as program_id,
      'program_list_index'::text as candidate_source,
      0 as candidate_group,
      row_number() over (
        order by
          case when i.browse_rank is not null then 0 else 1 end asc,
          coalesce(i.browse_rank, 2147483647) asc,
          coalesce(i.click_hotness_score, 0) desc,
          coalesce(i.recommended_score, 0) desc,
          coalesce(i.last_detail_viewed_at, i.updated_at, i.indexed_at, 'epoch'::timestamptz) desc,
          i.id asc
      ) as candidate_rank
    from public.program_list_index i
  ),
  fallback_candidates as materialized (
    select
      p.id as program_id,
      'programs'::text as candidate_source,
      1 as candidate_group,
      row_number() over (
        order by
          case when p.primary_source_record_id is null then 0 else 1 end asc,
          coalesce(p.updated_at, p.created_at, 'epoch'::timestamptz) desc,
          p.id asc
      ) as candidate_rank
    from public.programs p
    where not exists (
      select 1
      from public.program_list_index i
      where i.id = p.id
    )
  ),
  candidate_programs as materialized (
    select
      ranked.program_id,
      ranked.candidate_source,
      ranked.candidate_group,
      ranked.candidate_rank
    from (
      select * from indexed_candidates
      union all
      select * from fallback_candidates
    ) ranked
    order by
      ranked.candidate_group asc,
      ranked.candidate_rank asc,
      ranked.program_id asc
    limit effective_batch_limit
  )
  select
    coalesce(
      array_agg(program_id order by candidate_group asc, candidate_rank asc, program_id asc),
      '{}'::uuid[]
    ),
    count(*),
    count(*) filter (where candidate_source = 'program_list_index')
  into
    candidate_program_ids,
    selected_candidate_rows,
    indexed_candidate_rows
  from candidate_programs;

  if selected_candidate_rows = 0 then
    return jsonb_build_object(
      'batch_limit', effective_batch_limit,
      'max_rows', effective_max_rows,
      'selected_candidate_rows', 0,
      'candidate_rows_from_program_list_index', 0,
      'candidate_rows_from_programs', 0,
      'upserted_rows', 0,
      'linked_program_rows', 0,
      'trimmed_program_links', 0,
      'trimmed_rows', 0,
      'remaining_rows', 0,
      'remaining_linked_programs', 0,
      'generated_at', now()
    );
  end if;

  with upserted as (
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
      'legacy-programs-sample-backfill' as collect_method,
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
    where p.id = any(candidate_program_ids)
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
      updated_at = now()
    returning program_id
  )
  select count(*) into upserted_rows
  from upserted;

  update public.programs p
  set
    primary_source_record_id = psr.id,
    primary_source_code = psr.source_code,
    primary_source_label = psr.source_label
  from public.program_source_records psr
  where p.id = psr.program_id
    and p.id = any(candidate_program_ids)
    and psr.is_primary;
  get diagnostics linked_program_rows = row_count;

  with ranked as materialized (
    select
      psr.id,
      psr.program_id,
      row_number() over (
        order by
          case
            when psr.program_id = any(candidate_program_ids) then 0
            when pli.id is not null and pli.browse_rank is not null then 1
            when pli.id is not null then 2
            else 3
          end asc,
          case when pli.browse_rank is not null then pli.browse_rank else 2147483647 end asc,
          psr.is_primary desc,
          coalesce(pli.click_hotness_score, 0) desc,
          coalesce(psr.last_seen_at, psr.updated_at, psr.created_at, 'epoch'::timestamptz) desc,
          psr.id asc
      ) as keep_rank
    from public.program_source_records psr
    left join public.program_list_index pli
      on pli.id = psr.program_id
  ),
  cleared as (
    update public.programs p
    set
      primary_source_record_id = null,
      primary_source_code = null,
      primary_source_label = null
    from ranked r
    where p.id = r.program_id
      and p.primary_source_record_id = r.id
      and r.keep_rank > effective_max_rows
    returning 1
  )
  select count(*) into trimmed_program_links
  from cleared;

  with ranked as materialized (
    select
      psr.id,
      row_number() over (
        order by
          case
            when psr.program_id = any(candidate_program_ids) then 0
            when pli.id is not null and pli.browse_rank is not null then 1
            when pli.id is not null then 2
            else 3
          end asc,
          case when pli.browse_rank is not null then pli.browse_rank else 2147483647 end asc,
          psr.is_primary desc,
          coalesce(pli.click_hotness_score, 0) desc,
          coalesce(psr.last_seen_at, psr.updated_at, psr.created_at, 'epoch'::timestamptz) desc,
          psr.id asc
      ) as keep_rank
    from public.program_source_records psr
    left join public.program_list_index pli
      on pli.id = psr.program_id
  ),
  deleted as (
    delete from public.program_source_records psr
    using ranked r
    where psr.id = r.id
      and r.keep_rank > effective_max_rows
    returning 1
  )
  select count(*) into trimmed_rows
  from deleted;

  select count(*) into remaining_rows
  from public.program_source_records;

  select count(*) into remaining_linked_programs
  from public.programs p
  join public.program_source_records psr
    on psr.id = p.primary_source_record_id;

  return jsonb_build_object(
    'batch_limit', effective_batch_limit,
    'max_rows', effective_max_rows,
    'selected_candidate_rows', selected_candidate_rows,
    'candidate_rows_from_program_list_index', indexed_candidate_rows,
    'candidate_rows_from_programs', selected_candidate_rows - indexed_candidate_rows,
    'upserted_rows', upserted_rows,
    'linked_program_rows', linked_program_rows,
    'trimmed_program_links', trimmed_program_links,
    'trimmed_rows', trimmed_rows,
    'remaining_rows', remaining_rows,
    'remaining_linked_programs', remaining_linked_programs,
    'generated_at', now()
  );
end;
$$;

comment on function public.backfill_program_source_records_sample(integer, integer) is
  'Free-plan-safe helper for SQL Editor validation. Backfills a bounded sample of program_source_records, prioritizes current program_list_index sample rows, then trims extra source rows and clears trimmed primary links.';
