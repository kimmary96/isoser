-- Draft migration for the final program canonical refactor.
-- Purpose: split raw/source provenance from public.programs into a dedicated source-record table.

create or replace function public.program_source_code_from_label(p_source_label text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized text := lower(regexp_replace(coalesce(btrim(p_source_label), ''), '\s+', '', 'g'));
  slug text;
begin
  if normalized = '' then
    return 'unknown';
  end if;

  if normalized in ('고용24', 'work24', 'hrdnet', 'hrd-net') or normalized like '%고용24%' or normalized like '%work24%' then
    return 'work24';
  end if;

  if normalized like '%k-startup%' or normalized like '%kstartup%' or normalized like '%startup%' then
    return 'kstartup';
  end if;

  if normalized like '%sesac%' then
    return 'sesac';
  end if;

  if normalized like '%fastcampus%' or normalized like '%패스트캠퍼스%' then
    return 'fastcampus';
  end if;

  slug := regexp_replace(lower(coalesce(btrim(p_source_label), '')), '[^a-z0-9가-힣]+', '-', 'g');
  slug := regexp_replace(slug, '(^-+|-+$)', '', 'g');
  return coalesce(nullif(slug, ''), 'unknown');
end;
$$;

create table if not exists public.program_source_records (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  source_code text not null,
  source_label text not null,
  source_family text,
  source_record_key text not null,
  external_program_id text,
  source_url text,
  detail_url text,
  application_url text,
  collect_method text,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_snapshot jsonb not null default '{}'::jsonb,
  field_evidence jsonb not null default '{}'::jsonb,
  source_specific jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  collected_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_source_records_source_code_check
    check (length(btrim(source_code)) > 0),
  constraint program_source_records_source_label_check
    check (length(btrim(source_label)) > 0),
  constraint program_source_records_source_record_key_check
    check (length(btrim(source_record_key)) > 0)
);

comment on table public.program_source_records is
  '프로그램 원천 raw payload, source-specific 식별자, field evidence를 저장하는 provenance 정본';

comment on column public.program_source_records.source_record_key is
  'source 내부의 안정 고유 키. 현재 programs.source_unique_key/hrd_id를 이관할 대상';

comment on column public.program_source_records.raw_payload is
  'collector/admin sync가 받은 원천 raw payload';

comment on column public.program_source_records.field_evidence is
  '필드별 원천 evidence. 현재 compare_meta.field_sources를 이관할 대상';

comment on column public.program_source_records.source_specific is
  '정본 컬럼으로 승격하지 않은 source 전용 메타';

create index if not exists idx_program_source_records_program_id
on public.program_source_records(program_id, source_code);

create unique index if not exists idx_program_source_records_source_key
on public.program_source_records(source_code, source_record_key);

create unique index if not exists idx_program_source_records_primary_program
on public.program_source_records(program_id)
where is_primary;

create index if not exists idx_program_source_records_external_program_id
on public.program_source_records(external_program_id)
where external_program_id is not null;

drop trigger if exists trg_program_source_records_updated_at on public.program_source_records;
create trigger trg_program_source_records_updated_at
before update on public.program_source_records
for each row execute function public.set_updated_at();

alter table public.program_source_records enable row level security;

drop policy if exists "program_source_records_service_role_all" on public.program_source_records;
create policy "program_source_records_service_role_all"
on public.program_source_records
for all
to service_role
using (true)
with check (true);
