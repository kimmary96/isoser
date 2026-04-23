alter function if exists public.update_programs_search_text() set search_path = public;
alter function if exists public.programs_searchable_compare_meta_text(jsonb) set search_path = public;
alter function if exists public.infer_program_category_detail(text, text, text, text, text[], text[], jsonb) set search_path = public;
alter function if exists public.update_programs_category_detail() set search_path = public;
alter function if exists public.set_updated_at() set search_path = public;
alter function if exists public.program_list_try_date(text) set search_path = public;
alter function if exists public.program_list_text_array(jsonb) set search_path = public;
alter function if exists public.refresh_program_list_index(integer) set search_path = public;
