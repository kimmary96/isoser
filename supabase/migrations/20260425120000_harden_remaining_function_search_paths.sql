-- Corrective migration for remaining Supabase advisor warnings observed on 2026-04-24.
-- These functions are part of the current runtime path and already live in `public`,
-- so the safest fix is to pin their search_path explicitly.

alter function public.recommendation_normalize_text(text) set search_path = public;
alter function public.recommendation_compact_text_array(text[]) set search_path = public;
alter function public.program_list_click_hotness_score(bigint, bigint, numeric) set search_path = public;
