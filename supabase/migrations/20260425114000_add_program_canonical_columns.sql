-- Draft migration for the final program canonical refactor.
-- Purpose: add canonical service-detail columns to public.programs without dropping legacy fields yet.

alter table public.programs
  add column if not exists primary_source_record_id uuid references public.program_source_records(id) on delete set null,
  add column if not exists primary_source_code text,
  add column if not exists primary_source_label text,
  add column if not exists provider_name text,
  add column if not exists organizer_name text,
  add column if not exists summary_text text,
  add column if not exists business_type text,
  add column if not exists location_text text,
  add column if not exists application_start_date date,
  add column if not exists application_end_date date,
  add column if not exists program_start_date date,
  add column if not exists program_end_date date,
  add column if not exists deadline_confidence text not null default 'low',
  add column if not exists detail_url text,
  add column if not exists fee_amount integer,
  add column if not exists support_amount integer,
  add column if not exists target_summary text[] not null default '{}'::text[],
  add column if not exists target_detail text,
  add column if not exists eligibility_labels text[] not null default '{}'::text[],
  add column if not exists selection_process_label text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists capacity_total integer,
  add column if not exists capacity_current integer,
  add column if not exists rating_value numeric,
  add column if not exists curriculum_items text[] not null default '{}'::text[],
  add column if not exists certifications text[] not null default '{}'::text[],
  add column if not exists service_meta jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.programs'::regclass
      and conname = 'programs_deadline_confidence_check'
  ) then
    alter table public.programs
      add constraint programs_deadline_confidence_check
      check (deadline_confidence in ('high', 'medium', 'low'));
  end if;
end;
$$;

comment on column public.programs.primary_source_record_id is
  '대표 원천 source record. raw/source provenance는 program_source_records를 통해 접근한다.';

comment on column public.programs.summary_text is
  '화면 요약/상세 진입 공통 요약에 사용하는 정본 텍스트';

comment on column public.programs.application_end_date is
  '모집/접수 마감일 정본. program_end_date와 의미를 분리한다.';

comment on column public.programs.program_end_date is
  '교육/운영 종료일 정본. 모집 마감일처럼 쓰지 않는다.';

comment on column public.programs.service_meta is
  'compare_meta를 바로 지우지 않고 정본 컬럼 외 잔여 메타를 점진 이관하기 위한 보조 JSON';

create index if not exists idx_programs_primary_source_record_id
on public.programs(primary_source_record_id)
where primary_source_record_id is not null;

create index if not exists idx_programs_primary_source_code
on public.programs(primary_source_code)
where primary_source_code is not null;

create index if not exists idx_programs_application_end_date
on public.programs(application_end_date)
where application_end_date is not null;

create index if not exists idx_programs_program_dates
on public.programs(program_start_date, program_end_date)
where program_start_date is not null or program_end_date is not null;
