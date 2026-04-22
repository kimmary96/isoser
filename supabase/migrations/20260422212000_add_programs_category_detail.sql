alter table public.programs
add column if not exists category_detail text;

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
      compare_meta_value::text
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

create or replace function public.update_programs_category_detail()
returns trigger
language plpgsql
as $$
begin
  if new.category_detail is null or length(trim(new.category_detail)) = 0 then
    new.category_detail := public.infer_program_category_detail(
      new.title,
      new.category,
      new.description,
      new.summary,
      new.tags,
      new.skills,
      new.compare_meta
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_programs_category_detail on public.programs;
create trigger trg_programs_category_detail
before insert or update on public.programs
for each row execute function public.update_programs_category_detail();

update public.programs
set category_detail = public.infer_program_category_detail(
  title,
  category,
  description,
  summary,
  tags,
  skills,
  compare_meta
)
where category_detail is null or length(trim(category_detail)) = 0;

create index if not exists idx_programs_category_detail
on public.programs (category_detail);
