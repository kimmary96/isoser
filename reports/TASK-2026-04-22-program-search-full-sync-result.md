# TASK-2026-04-22 Program Search Full Sync Result

## Changed files
- `backend/rag/collector/base_api_collector.py`
- `backend/rag/collector/work24_collector.py`
- `backend/rag/collector/program_field_mapping.py`
- `backend/rag/collector/normalizer.py`
- `backend/rag/collector/scheduler.py`
- `backend/routers/admin.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `backend/tests/test_scheduler_collectors.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`
- `supabase/migrations/20260422190000_add_programs_source_unique_key.sql`
- `supabase/migrations/20260422201000_fix_programs_source_unique_key_conflict_index.sql`
- `supabase/migrations/20260422203000_add_programs_search_text_index.sql`

## Why changes were made
- Landing/program search used `/programs?q=...`, but backend search only targeted `title`.
- Work24 data outside the first fixed pages was not collected, so provider-name searches such as `패스트캠퍼스` could not return missing DB rows.
- Work24 source uniqueness needs course/session/institution identifiers, not `title,source`.

## Preserved behaviors
- Existing list filters, deadline sorting, and recent-closed behavior remain available.
- Existing environments without `source_unique_key` migration fall back to legacy upsert behavior.
- Existing environments without `programs.search_text` migration fall back to the previous paged backend scan search behavior.
- Raw source-specific metadata remains in `compare_meta`.

## Verification
- Work24 full collect dry-run: `raw_count=5726`, `normalized_count=5726`, `패스트` rows `14`.
- Work24 full sync apply attempted `3167` deduped rows against 운영 Supabase.
- `패스트캠퍼스` search after full sync returned `13` active results from provider matches.
- API page collection now retries transient page failures before marking a collector as `request_failed`.
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_scheduler_collectors.py backend/tests/test_work24_kstartup_field_mapping.py backend/tests/test_program_backfill.py backend/tests/test_admin_router.py -q` passed: `54 passed`.
- Follow-up search index test: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q` passed: `29 passed`.

## Risks / possible regressions
- Until `20260422190000_add_programs_source_unique_key.sql` and `20260422201000_fix_programs_source_unique_key_conflict_index.sql` are applied in 운영 DB, legacy fallback can still collapse some Work24 sessions under existing `hrd_id`/`title,source` constraints.
- Until `20260422203000_add_programs_search_text_index.sql` is applied in 운영 DB, backend search keeps working but uses the previous paged scan fallback.
- Full sync calls all Work24 pages and should run as scheduled/background work, not on a user request path.

## Follow-up refactoring candidates
- If search data grows beyond a single table index, split `program_search_documents` into a dedicated table or materialized view.
- Add resumable sync state per source/page for retrying failed Work24 pages.
- After all production environments have the `source_unique_key` and `search_text` migrations, consider removing legacy fallback branches.
