-- Store user-selected resume bullet overrides produced by the job-posting rewrite flow.

alter table public.resumes
  add column if not exists activity_line_overrides jsonb not null default '{}'::jsonb;

comment on column public.resumes.activity_line_overrides is
  'Map of activity_id to resume bullet lines selected for a generated resume draft.';
