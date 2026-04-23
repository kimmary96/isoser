alter function public.update_programs_search_text() set search_path = public;
alter function public.programs_searchable_compare_meta_text(jsonb) set search_path = public;
alter function public.infer_program_category_detail(text, text, text, text, text[], text[], jsonb) set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.program_list_try_date(text) set search_path = public;
alter function public.program_list_text_array(jsonb) set search_path = public;
alter function public.refresh_program_list_index(integer) set search_path = public;
