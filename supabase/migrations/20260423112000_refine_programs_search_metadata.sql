create extension if not exists pg_trgm;

alter table public.programs
add column if not exists provider text,
add column if not exists summary text,
add column if not exists description text,
add column if not exists location text,
add column if not exists region text,
add column if not exists region_detail text,
add column if not exists category_detail text,
add column if not exists support_type text,
add column if not exists teaching_method text,
add column if not exists is_certified boolean not null default false,
add column if not exists raw_data jsonb,
add column if not exists tags text[] default '{}'::text[],
add column if not exists skills text[] default '{}'::text[],
add column if not exists target text[] default '{}'::text[],
add column if not exists compare_meta jsonb,
add column if not exists search_text text;

create or replace function public.programs_searchable_compare_meta_text(p_compare_meta jsonb)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(value, ' '), '')
  from jsonb_each_text(coalesce(p_compare_meta, '{}'::jsonb))
  where key in (
    'address',
    'application_deadline',
    'application_end_date',
    'business_type',
    'certificate',
    'curriculum',
    'delivery_method',
    'employment_connection',
    'location',
    'ncs_code',
    'ncs_name',
    'region',
    'recruitment_deadline',
    'recruitment_end_date',
    'schedule_text',
    'selection_process',
    'target_detail',
    'target_group',
    'target_job',
    'teaching_method',
    'training_institution',
    'training_time',
    'training_type',
    'weekday_text'
  );
$$;

create or replace function public.update_programs_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := regexp_replace(
    lower(
      concat_ws(
        ' ',
        new.title,
        new.provider,
        new.description,
        new.summary,
        new.location,
        new.region_detail,
        new.category,
        new.category_detail,
        new.support_type,
        new.teaching_method,
        array_to_string(new.tags, ' '),
        array_to_string(new.skills, ' '),
        public.programs_searchable_compare_meta_text(new.compare_meta)
      )
    ),
    '\s+',
    '',
    'g'
  );
  return new;
end;
$$;

update public.programs
set search_text = regexp_replace(
  lower(
    concat_ws(
      ' ',
      title,
      provider,
      description,
      summary,
      location,
      region_detail,
      category,
      category_detail,
      support_type,
      teaching_method,
      array_to_string(tags, ' '),
      array_to_string(skills, ' '),
      public.programs_searchable_compare_meta_text(compare_meta)
    )
  ),
  '\s+',
  '',
  'g'
);

create or replace function public.infer_program_category_detail(
  title_value text,
  category_value text,
  description_value text,
  summary_value text,
  tags_value text[],
  skills_value text[],
  compare_meta_value jsonb
)
returns text
language plpgsql
as $$
declare
  haystack text;
begin
  haystack := lower(
    concat_ws(
      ' ',
      title_value,
      category_value,
      description_value,
      summary_value,
      array_to_string(tags_value, ' '),
      array_to_string(skills_value, ' '),
      public.programs_searchable_compare_meta_text(compare_meta_value)
    )
  );

  if haystack ~ '(데이터|data|ai|인공지능|머신러닝|machine|딥러닝|python|파이썬)' then
    return 'data-ai';
  end if;

  if haystack ~ '(클라우드|cloud|aws|azure|gcp|보안|security|secops|인프라|devops)' then
    return 'cloud-security';
  end if;

  if haystack ~ '(모바일|mobile|android|ios|앱|app|flutter|react native)' then
    return 'mobile';
  end if;

  if haystack ~ '(iot|임베디드|embedded|반도체|semiconductor|펌웨어|firmware)' then
    return 'iot-embedded-semiconductor';
  end if;

  if haystack ~ '(게임|game|블록체인|blockchain|web3|unity|유니티|unreal|언리얼)' then
    return 'game-blockchain';
  end if;

  if haystack ~ '(디자인|design|ui|ux|3d|모델링|영상|그래픽|photoshop|포토샵|일러스트)' then
    return 'design-3d';
  end if;

  if haystack ~ '(창업|startup|스타트업|프로젝트|취준|취업|포트폴리오|공모전|액셀러레이팅|보육센터)' then
    return 'project-career-startup';
  end if;

  if haystack ~ '(기획|마케팅|marketing|pm|서비스기획|경영|회계|사무|erp)' then
    return 'planning-marketing-other';
  end if;

  if haystack ~ '(웹|web|프론트|front|백엔드|backend|자바|java|javascript|react|next|node|개발|코딩|프로그래밍)' then
    return 'web-development';
  end if;

  if category_value = 'AI' then
    return 'data-ai';
  elsif category_value = '디자인' then
    return 'design-3d';
  elsif category_value = '창업' then
    return 'project-career-startup';
  elsif category_value = '경영' then
    return 'planning-marketing-other';
  elsif category_value = 'IT' then
    return 'web-development';
  end if;

  return null;
end;
$$;
