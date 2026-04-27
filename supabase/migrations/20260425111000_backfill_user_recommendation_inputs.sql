-- Draft migration for the recommendation-profile refactor.
-- Purpose: seed new recommendation tables from existing profile/resume data.

update public.profiles
set
  target_job = nullif(btrim(coalesce(bio, '')), ''),
  target_job_normalized = public.recommendation_normalize_text(bio)
where nullif(btrim(coalesce(target_job, '')), '') is null
  and nullif(btrim(coalesce(bio, '')), '') is not null
  and position(E'\n' in coalesce(bio, '')) = 0
  and char_length(btrim(coalesce(bio, ''))) <= 120;

update public.profiles
set target_job_normalized = public.recommendation_normalize_text(target_job)
where nullif(btrim(coalesce(target_job, '')), '') is not null
  and nullif(btrim(coalesce(target_job_normalized, '')), '') is null;

insert into public.user_program_preferences (
  user_id,
  target_job,
  target_job_normalized,
  preferred_regions,
  preferred_region_details
)
select
  p.id as user_id,
  p.target_job,
  p.target_job_normalized,
  case
    when nullif(btrim(coalesce(p.region, '')), '') is not null then array[p.region]
    else '{}'::text[]
  end as preferred_regions,
  case
    when nullif(btrim(coalesce(p.region_detail, '')), '') is not null then array[p.region_detail]
    else '{}'::text[]
  end as preferred_region_details
from public.profiles p
on conflict (user_id) do update
set
  target_job = coalesce(public.user_program_preferences.target_job, excluded.target_job),
  target_job_normalized = coalesce(public.user_program_preferences.target_job_normalized, excluded.target_job_normalized),
  preferred_regions = case
    when coalesce(array_length(public.user_program_preferences.preferred_regions, 1), 0) > 0
      then public.user_program_preferences.preferred_regions
    else excluded.preferred_regions
  end,
  preferred_region_details = case
    when coalesce(array_length(public.user_program_preferences.preferred_region_details, 1), 0) > 0
      then public.user_program_preferences.preferred_region_details
    else excluded.preferred_region_details
  end,
  updated_at = now();

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct candidate_user_id
    from (
      select p.id as candidate_user_id
      from public.profiles p
      union
      select upp.user_id as candidate_user_id
      from public.user_program_preferences upp
    ) candidates
    where candidate_user_id is not null
  loop
    perform public.refresh_user_recommendation_profile(v_user_id);
  end loop;
end;
$$;
