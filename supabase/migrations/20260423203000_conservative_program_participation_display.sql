create or replace function public.program_list_participation_haystack(
  p_compare_meta jsonb,
  p_title text,
  p_summary text,
  p_description text
)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(
    concat_ws(
      ' ',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'training_type',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'training_time',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'training_schedule',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'schedule_text',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'weekday_text',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'day_night',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'day_night_type',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'weekend_text',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'weekend_yn',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'course_content',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'description',
      coalesce(p_compare_meta, '{}'::jsonb) ->> 'summary',
      p_title,
      p_summary,
      p_description
    )
  );
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
  time_match text[];
  start_hour integer;
  end_hour integer;
  span_hours integer;
begin
  haystack := public.program_list_participation_haystack(p_compare_meta, p_title, p_summary, p_description);
  time_match := regexp_match(
    haystack,
    '([01]?[0-9]|2[0-3])\s*[:시]\s*(?:[0-5][0-9])?\s*(?:~|-|부터|에서)\s*([01]?[0-9]|2[0-3])'
  );

  if time_match is not null then
    start_hour := time_match[1]::integer;
    end_hour := time_match[2]::integer;
    span_hours := end_hour - start_hour;
    if span_hours < 0 then
      span_hours := span_hours + 24;
    end if;
  end if;

  if haystack like '%파트타임%'
    or haystack like '%part-time%'
    or haystack like '%야간%'
    or haystack like '%저녁%'
    or haystack like '%주말%'
    or haystack like '%단기%'
    or haystack like '%특강%'
    or haystack like '%세미나%'
    or (start_hour is not null and start_hour >= 18)
    or (span_hours is not null and span_hours > 0 and span_hours <= 5) then
    return 'part-time';
  end if;

  if haystack like '%풀타임%'
    or haystack like '%full-time%'
    or haystack like '%전일%'
    or haystack like '%종일%'
    or (start_hour is not null and end_hour is not null and start_hour <= 10 and end_hour >= 17) then
    return 'full-time';
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
language sql
immutable
set search_path = public
as $$
  select public.program_list_infer_participation_time(
    p_start_date,
    p_end_date,
    p_compare_meta,
    p_title,
    p_summary,
    p_description
  );
$$;

create or replace function public.program_list_participation_mode_label(
  p_participation_time text,
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
  time_match text[];
  start_hour integer;
begin
  haystack := public.program_list_participation_haystack(p_compare_meta, p_title, p_summary, p_description);
  time_match := regexp_match(
    haystack,
    '([01]?[0-9]|2[0-3])\s*[:시]\s*(?:[0-5][0-9])?\s*(?:~|-|부터|에서)\s*([01]?[0-9]|2[0-3])'
  );
  if time_match is not null then
    start_hour := time_match[1]::integer;
  end if;

  if haystack like '%주말%' then
    return '주말반';
  end if;
  if haystack like '%야간%' or haystack like '%저녁%' or (start_hour is not null and start_hour >= 18) then
    return '저녁반';
  end if;
  if haystack like '%자율%' or haystack like '%자유 학습%' or haystack like '%개별 자유%' then
    return '자율학습';
  end if;
  if p_participation_time = 'full-time' then
    return '풀타임';
  end if;
  if p_participation_time = 'part-time' then
    return '파트타임';
  end if;
  return null;
end;
$$;

create or replace function public.program_list_participation_time_text(
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
  meta jsonb;
  schedule_text text;
  day_text text;
  night_text text;
begin
  meta := coalesce(p_compare_meta, '{}'::jsonb);
  schedule_text := nullif(
    coalesce(
      meta ->> 'training_time',
      meta ->> 'training_schedule',
      meta ->> 'schedule_text',
      meta ->> 'weekday_text'
    ),
    ''
  );
  day_text := nullif(coalesce(meta ->> 'weekend_text', meta ->> 'weekend_yn'), '');
  night_text := nullif(coalesce(meta ->> 'day_night', meta ->> 'day_night_type'), '');
  if schedule_text is not null then
    if day_text is not null and schedule_text not like '%' || day_text || '%' then
      return concat_ws(' / ', day_text, schedule_text);
    end if;
    return schedule_text;
  end if;

  if day_text is not null and night_text is not null then
    return concat_ws(' · ', day_text, night_text);
  end if;
  return coalesce(day_text, night_text);
end;
$$;

create or replace function public.program_list_apply_participation_display()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_row record;
  inferred_participation_time text;
begin
  select
    p.start_date::text as start_date,
    p.end_date::text as end_date,
    coalesce(p.compare_meta, '{}'::jsonb) as compare_meta,
    p.title,
    p.summary,
    p.description,
    nullif(p.participation_time, '') as participation_time
  into source_row
  from public.programs p
  where p.id = new.id;

  if found then
    inferred_participation_time := coalesce(
      source_row.participation_time,
      public.program_list_infer_participation_time(
        source_row.start_date,
        source_row.end_date,
        source_row.compare_meta,
        source_row.title,
        source_row.summary,
        source_row.description
      )
    );
    new.participation_time := inferred_participation_time;
    new.participation_mode_label := public.program_list_participation_mode_label(
      inferred_participation_time,
      source_row.compare_meta,
      source_row.title,
      source_row.summary,
      source_row.description
    );
    new.participation_time_text := public.program_list_participation_time_text(
      source_row.compare_meta,
      source_row.title,
      source_row.summary,
      source_row.description
    );
  else
    new.participation_mode_label := public.program_list_participation_mode_label(
      new.participation_time,
      '{}'::jsonb,
      new.title,
      new.summary,
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_program_list_apply_participation_display on public.program_list_index;
create trigger trg_program_list_apply_participation_display
before insert or update on public.program_list_index
for each row
execute function public.program_list_apply_participation_display();

update public.programs p
set participation_time = public.infer_program_participation_time(
  p.start_date::text,
  p.end_date::text,
  coalesce(p.compare_meta, '{}'::jsonb),
  p.title,
  p.summary,
  p.description
)
where p.participation_time is distinct from public.infer_program_participation_time(
  p.start_date::text,
  p.end_date::text,
  coalesce(p.compare_meta, '{}'::jsonb),
  p.title,
  p.summary,
  p.description
);

select public.refresh_program_list_index(300);
