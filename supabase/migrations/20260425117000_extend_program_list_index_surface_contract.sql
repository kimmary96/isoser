-- Draft migration for the final program canonical refactor.
-- Purpose: extend public.program_list_index so it can directly satisfy ProgramBaseSummary/Card/ListRow surface contracts.

alter table public.program_list_index
  add column if not exists provider_name text,
  add column if not exists source_code text,
  add column if not exists source_label text,
  add column if not exists summary_text text,
  add column if not exists region_label text,
  add column if not exists application_start_date date,
  add column if not exists application_end_date date,
  add column if not exists program_start_date date,
  add column if not exists program_end_date date,
  add column if not exists recruiting_status text not null default 'unknown',
  add column if not exists recruiting_status_label text not null default '모집 정보 확인 필요',
  add column if not exists primary_link text,
  add column if not exists detail_path text not null default '',
  add column if not exists compare_path text not null default '',
  add column if not exists location_label text,
  add column if not exists program_period_label text,
  add column if not exists cost_label text not null default '비용 정보 없음',
  add column if not exists teaching_method_label text,
  add column if not exists participation_label text,
  add column if not exists keyword_labels text[] not null default '{}'::text[],
  add column if not exists badge_labels text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.program_list_index'::regclass
      and conname = 'program_list_index_recruiting_status_check'
  ) then
    alter table public.program_list_index
      add constraint program_list_index_recruiting_status_check
      check (recruiting_status in ('open', 'closing_soon', 'closed', 'unknown'));
  end if;
end;
$$;

create or replace function public.program_surface_recruiting_status(
  p_is_open boolean,
  p_days_left integer,
  p_application_end_date date
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  base_date date := timezone('Asia/Seoul', now())::date;
begin
  if p_application_end_date is not null then
    if p_application_end_date < base_date then
      return 'closed';
    end if;
    if p_application_end_date <= base_date + 7 then
      return 'closing_soon';
    end if;
    return 'open';
  end if;

  if p_days_left is not null then
    if p_days_left < 0 then
      return 'closed';
    end if;
    if p_days_left between 0 and 7 then
      return 'closing_soon';
    end if;
    return 'open';
  end if;

  if p_is_open is true then
    return 'open';
  end if;

  if p_is_open is false then
    return 'closed';
  end if;

  return 'unknown';
end;
$$;

create or replace function public.program_surface_recruiting_status_label(p_status text)
returns text
language sql
immutable
set search_path = public
as $$
  select case coalesce(p_status, 'unknown')
    when 'open' then '모집중'
    when 'closing_soon' then '곧 마감'
    when 'closed' then '마감'
    else '모집 정보 확인 필요'
  end;
$$;

create or replace function public.program_surface_program_period_label(
  p_program_start_date date,
  p_program_end_date date
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_program_start_date is null and p_program_end_date is null then null
    when p_program_start_date is not null and p_program_end_date is not null
      then to_char(p_program_start_date, 'YYYY-MM-DD') || ' ~ ' || to_char(p_program_end_date, 'YYYY-MM-DD')
    when p_program_start_date is not null
      then to_char(p_program_start_date, 'YYYY-MM-DD') || ' 시작'
    else to_char(p_program_end_date, 'YYYY-MM-DD') || ' 종료'
  end;
$$;

create or replace function public.program_surface_cost_label(
  p_fee_amount integer,
  p_cost_type text,
  p_support_type text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  support_text text := lower(coalesce(p_support_type, ''));
begin
  if p_cost_type = 'naeil-card' then
    return '내일배움카드';
  end if;

  if p_fee_amount is not null then
    if p_fee_amount <= 0 then
      return '무료';
    end if;
    return p_fee_amount::text || '원';
  end if;

  if p_cost_type = 'free-no-card' then
    return '무료';
  end if;

  if p_cost_type = 'paid' then
    return '유료';
  end if;

  if support_text like '%전액%' or support_text like '%무료%' then
    return '무료';
  end if;

  return '비용 정보 없음';
end;
$$;

create or replace function public.program_surface_participation_label(
  p_participation_mode_label text,
  p_participation_time_text text,
  p_participation_time text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  fallback_label text;
begin
  if nullif(btrim(coalesce(p_participation_mode_label, '')), '') is not null
    and nullif(btrim(coalesce(p_participation_time_text, '')), '') is not null then
    return btrim(p_participation_mode_label) || ' · ' || btrim(p_participation_time_text);
  end if;

  if nullif(btrim(coalesce(p_participation_time_text, '')), '') is not null then
    return btrim(p_participation_time_text);
  end if;

  if nullif(btrim(coalesce(p_participation_mode_label, '')), '') is not null then
    return btrim(p_participation_mode_label);
  end if;

  fallback_label := case btrim(coalesce(p_participation_time, ''))
    when 'full-time' then '풀타임'
    when 'part-time' then '파트타임'
    else nullif(btrim(coalesce(p_participation_time, '')), '')
  end;

  return fallback_label;
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

drop trigger if exists trg_program_list_index_surface_contract on public.program_list_index;
create trigger trg_program_list_index_surface_contract
before insert or update on public.program_list_index
for each row execute function public.program_list_index_apply_surface_contract();

update public.program_list_index
set indexed_at = indexed_at;

create index if not exists idx_program_list_index_surface_source_code
on public.program_list_index(source_code, recruiting_status, application_end_date);
