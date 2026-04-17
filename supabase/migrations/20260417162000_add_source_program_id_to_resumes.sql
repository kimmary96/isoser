alter table public.resumes
add column if not exists source_program_id uuid references public.programs(id) on delete set null;

create index if not exists idx_resumes_source_program_id on public.resumes(source_program_id);
