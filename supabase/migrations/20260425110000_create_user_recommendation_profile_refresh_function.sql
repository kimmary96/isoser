-- Draft migration for the recommendation-profile refactor.
-- Purpose: compute the derived recommendation profile in one deterministic place.

create or replace function public.recommendation_normalize_text(p_value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(p_value, ''))), '\s+', ' ', 'g'), '');
$$;

create or replace function public.recommendation_compact_text_array(p_values text[])
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select distinct normalized
      from (
        select public.recommendation_normalize_text(value) as normalized
        from unnest(coalesce(p_values, '{}'::text[])) as value
      ) normalized_values
      where normalized is not null
      order by normalized
    ),
    '{}'::text[]
  );
$$;

create or replace function public.refresh_user_recommendation_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_pref public.user_program_preferences%rowtype;
  v_resume_target text;
  v_effective_target_job text;
  v_effective_target_job_normalized text;
  v_preferred_regions text[] := '{}'::text[];
  v_profile_keywords text[] := '{}'::text[];
  v_evidence_skills text[] := '{}'::text[];
  v_desired_skills text[] := '{}'::text[];
  v_activity_keywords text[] := '{}'::text[];
  v_profile_completeness_score numeric(5,4) := 0;
  v_recommendation_ready boolean := false;
  v_has_activities boolean := false;
  v_has_self_described_text boolean := false;
  v_source_snapshot jsonb := '{}'::jsonb;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_user_id;

  select *
  into v_pref
  from public.user_program_preferences
  where user_id = p_user_id;

  select r.target_job
  into v_resume_target
  from public.resumes r
  where r.user_id = p_user_id
    and nullif(btrim(coalesce(r.target_job, '')), '') is not null
  order by r.updated_at desc nulls last, r.created_at desc nulls last
  limit 1;

  v_effective_target_job := coalesce(
    nullif(btrim(coalesce(v_pref.target_job, '')), ''),
    nullif(btrim(coalesce(v_profile.target_job, '')), ''),
    nullif(btrim(coalesce(v_resume_target, '')), ''),
    nullif(btrim(coalesce(v_profile.bio, '')), '')
  );
  v_effective_target_job_normalized := public.recommendation_normalize_text(v_effective_target_job);

  if coalesce(array_length(v_pref.preferred_regions, 1), 0) > 0 then
    v_preferred_regions := public.recommendation_compact_text_array(v_pref.preferred_regions);
  else
    v_preferred_regions := public.recommendation_compact_text_array(
      array_remove(
        array[
          nullif(btrim(coalesce(v_profile.region, '')), ''),
          nullif(btrim(coalesce(v_profile.region_detail, '')), '')
        ],
        null
      )
    );
  end if;

  v_desired_skills := public.recommendation_compact_text_array(v_pref.desired_skills);

  select exists(
    select 1
    from public.activities a
    where a.user_id = p_user_id
      and coalesce(a.is_visible, true) is true
  )
  into v_has_activities;

  v_has_self_described_text := (
    nullif(btrim(coalesce(v_profile.self_intro, '')), '') is not null
    or nullif(btrim(coalesce(v_profile.bio, '')), '') is not null
    or coalesce(array_length(v_profile.career, 1), 0) > 0
    or coalesce(array_length(v_profile.education_history, 1), 0) > 0
  );

  select public.recommendation_compact_text_array(array_agg(value))
  into v_evidence_skills
  from (
    select unnest(coalesce(v_profile.skills, '{}'::text[])) as value
    union all
    select unnest(coalesce(a.skills, '{}'::text[]))
    from public.activities a
    where a.user_id = p_user_id
      and coalesce(a.is_visible, true) is true
  ) evidence_terms
  where value is not null;

  select public.recommendation_compact_text_array(array_agg(value))
  into v_activity_keywords
  from (
    select nullif(btrim(a.title), '') as value
    from public.activities a
    where a.user_id = p_user_id
      and coalesce(a.is_visible, true) is true
    union all
    select nullif(btrim(a.role), '') as value
    from public.activities a
    where a.user_id = p_user_id
      and coalesce(a.is_visible, true) is true
    union all
    select nullif(btrim(a.description), '') as value
    from public.activities a
    where a.user_id = p_user_id
      and coalesce(a.is_visible, true) is true
    union all
    select unnest(coalesce(a.skills, '{}'::text[])) as value
    from public.activities a
    where a.user_id = p_user_id
      and coalesce(a.is_visible, true) is true
  ) activity_terms
  where value is not null;

  select public.recommendation_compact_text_array(array_agg(value))
  into v_profile_keywords
  from (
    select v_effective_target_job as value
    union all
    select nullif(btrim(coalesce(v_profile.education, '')), '')
    union all
    select nullif(btrim(coalesce(v_profile.self_intro, '')), '')
    union all
    select nullif(btrim(coalesce(v_profile.bio, '')), '')
    union all
    select unnest(coalesce(v_profile.career, '{}'::text[]))
    union all
    select unnest(coalesce(v_profile.education_history, '{}'::text[]))
    union all
    select unnest(coalesce(v_profile.awards, '{}'::text[]))
    union all
    select unnest(coalesce(v_profile.certifications, '{}'::text[]))
    union all
    select unnest(coalesce(v_profile.languages, '{}'::text[]))
    union all
    select unnest(coalesce(v_evidence_skills, '{}'::text[]))
    union all
    select unnest(coalesce(v_desired_skills, '{}'::text[]))
    union all
    select unnest(coalesce(v_activity_keywords, '{}'::text[]))
  ) profile_terms
  where value is not null;

  v_profile_completeness_score := round(
    (
      case when v_effective_target_job_normalized is not null then 0.30 else 0 end
      + case when coalesce(array_length(v_evidence_skills, 1), 0) > 0 then 0.25 else 0 end
      + case when v_has_activities then 0.20 else 0 end
      + case when coalesce(array_length(v_preferred_regions, 1), 0) > 0 then 0.15 else 0 end
      + case when v_has_self_described_text then 0.10 else 0 end
    )::numeric,
    4
  );

  v_recommendation_ready := (
    v_effective_target_job_normalized is not null
    or coalesce(array_length(v_evidence_skills, 1), 0) > 0
    or v_has_activities
  );

  v_source_snapshot := jsonb_build_object(
    'profile_target_job', nullif(btrim(coalesce(v_profile.target_job, '')), ''),
    'preference_target_job', nullif(btrim(coalesce(v_pref.target_job, '')), ''),
    'resume_target_job', nullif(btrim(coalesce(v_resume_target, '')), ''),
    'legacy_bio_fallback_used',
      case
        when nullif(btrim(coalesce(v_profile.bio, '')), '') is null then false
        when nullif(btrim(coalesce(v_pref.target_job, '')), '') is not null then false
        when nullif(btrim(coalesce(v_profile.target_job, '')), '') is not null then false
        when nullif(btrim(coalesce(v_resume_target, '')), '') is not null then false
        else true
      end,
    'region_fallback_used',
      case
        when coalesce(array_length(v_pref.preferred_regions, 1), 0) > 0 then false
        when nullif(btrim(coalesce(v_profile.region, '')), '') is not null then true
        else false
      end,
    'profile',
      jsonb_build_object(
        'region', nullif(btrim(coalesce(v_profile.region, '')), ''),
        'region_detail', nullif(btrim(coalesce(v_profile.region_detail, '')), ''),
        'skills_count', coalesce(array_length(v_profile.skills, 1), 0),
        'career_count', coalesce(array_length(v_profile.career, 1), 0),
        'education_history_count', coalesce(array_length(v_profile.education_history, 1), 0),
        'certifications_count', coalesce(array_length(v_profile.certifications, 1), 0)
      ),
    'preferences',
      jsonb_build_object(
        'preferred_regions_count', coalesce(array_length(v_pref.preferred_regions, 1), 0),
        'desired_skills_count', coalesce(array_length(v_pref.desired_skills, 1), 0)
      )
  );

  insert into public.user_recommendation_profile (
    user_id,
    effective_target_job,
    effective_target_job_normalized,
    profile_keywords,
    evidence_skills,
    desired_skills,
    activity_keywords,
    preferred_regions,
    profile_completeness_score,
    recommendation_ready,
    recommendation_profile_hash,
    derivation_version,
    source_snapshot,
    updated_at,
    last_derived_at
  )
  values (
    p_user_id,
    v_effective_target_job,
    v_effective_target_job_normalized,
    v_profile_keywords,
    v_evidence_skills,
    v_desired_skills,
    v_activity_keywords,
    v_preferred_regions,
    v_profile_completeness_score,
    v_recommendation_ready,
    md5(
      jsonb_build_object(
        'effective_target_job', v_effective_target_job_normalized,
        'profile_keywords', v_profile_keywords,
        'evidence_skills', v_evidence_skills,
        'desired_skills', v_desired_skills,
        'activity_keywords', v_activity_keywords,
        'preferred_regions', v_preferred_regions,
        'derivation_version', 1
      )::text
    ),
    1,
    v_source_snapshot,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    effective_target_job = excluded.effective_target_job,
    effective_target_job_normalized = excluded.effective_target_job_normalized,
    profile_keywords = excluded.profile_keywords,
    evidence_skills = excluded.evidence_skills,
    desired_skills = excluded.desired_skills,
    activity_keywords = excluded.activity_keywords,
    preferred_regions = excluded.preferred_regions,
    profile_completeness_score = excluded.profile_completeness_score,
    recommendation_ready = excluded.recommendation_ready,
    recommendation_profile_hash = excluded.recommendation_profile_hash,
    derivation_version = excluded.derivation_version,
    source_snapshot = excluded.source_snapshot,
    updated_at = now(),
    last_derived_at = now();
end;
$$;
