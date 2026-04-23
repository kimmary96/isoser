alter table public.programs
add column if not exists cost_type text,
add column if not exists participation_time text;

create or replace function public.infer_program_cost_type(
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
as $$
declare
  haystack text;
begin
  haystack := lower(
    concat_ws(
      ' ',
      p_support_type,
      p_compare_meta::text,
      p_title,
      p_summary,
      p_description
    )
  );

  if lower(coalesce(p_compare_meta ->> 'naeilbaeumcard_required', '')) in ('true', 'pass')
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
    or haystack like '%전액 지원%'
    or haystack like '%자부담 0%' then
    return 'free-no-card';
  end if;

  if haystack like '%유료%'
    or haystack like '%자부담%'
    or haystack like '%수강료%' then
    return 'paid';
  end if;

  return null;
end;
$$;

create or replace function public.infer_program_participation_time(
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
      p_compare_meta::text,
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
    or haystack like '%특강%'
    or haystack like '%세미나%' then
    return 'part-time';
  end if;

  if haystack like '%풀타임%'
    or haystack like '%full-time%'
    or haystack like '%전일%'
    or haystack like '%종일%' then
    return 'full-time';
  end if;

  if coalesce(p_start_date, '') ~ '^\d{4}-\d{2}-\d{2}$'
    and coalesce(p_end_date, '') ~ '^\d{4}-\d{2}-\d{2}$' then
    parsed_start_date := p_start_date::date;
    parsed_end_date := p_end_date::date;
  end if;

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

create or replace function public.update_programs_cost_time_filters()
returns trigger
language plpgsql
as $$
begin
  new.cost_type := public.infer_program_cost_type(
    new.cost,
    new.support_type,
    new.compare_meta,
    new.title,
    new.summary,
    new.description
  );
  new.participation_time := public.infer_program_participation_time(
    new.start_date,
    new.end_date,
    new.compare_meta,
    new.title,
    new.summary,
    new.description
  );
  return new;
end;
$$;

drop trigger if exists trg_programs_cost_time_filters on public.programs;
create trigger trg_programs_cost_time_filters
before insert or update on public.programs
for each row execute function public.update_programs_cost_time_filters();

update public.programs
set
  cost_type = public.infer_program_cost_type(
    cost,
    support_type,
    compare_meta,
    title,
    summary,
    description
  ),
  participation_time = public.infer_program_participation_time(
    start_date,
    end_date,
    compare_meta,
    title,
    summary,
    description
  );

create index if not exists idx_programs_cost_type
on public.programs (cost_type);

create index if not exists idx_programs_participation_time
on public.programs (participation_time);
