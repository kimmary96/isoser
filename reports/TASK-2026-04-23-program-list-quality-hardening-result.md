# TASK-2026-04-23 program list quality hardening result

## Changed files
- `supabase/migrations/20260423195000_improve_program_list_browse_pool_quality.sql`
- `supabase/migrations/20260423200000_move_pg_trgm_extension_schema.sql`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- The read model was structurally fast, but the default browse pool could still be dominated by one source because `browse_rank` used only `recommended_score`.
- The live facet snapshot showed empty `cost_type` and `participation_time` buckets even though the backend already had conservative inference rules.
- Supabase linter still reported `pg_trgm` in `public`; leaked password protection is an Auth setting rather than a SQL migration.

## Preserved behaviors
- `refresh_program_list_index(pool_limit)` remains the single idempotent backfill/refresh entry point.
- Browse pool size stays configurable and defaults to 300.
- If other sources are sparse, Work24 overflow still fills the remaining pool slots instead of returning fewer browse rows.
- Detail-heavy fields stay out of the list response.

## Risks / possible regressions
- Source diversity is a soft rank correction, not a hard quota. If only Work24 rows are open, the pool remains Work24-heavy by design.
- Cost/time inference is conservative and text-based; unusual source wording may still remain unclassified.
- Moving `pg_trgm` may require future migrations to create trigram indexes after the extension is already in `extensions`; existing indexes should keep working.
- `auth_leaked_password_protection` must be enabled in the Supabase dashboard and cannot be fully remediated from SQL.

## Follow-up refactoring candidates
- Promote source diversity weights into a small config table if product wants per-source quotas.
- Add operational SQL checks for source mix and facet fill rate after every scheduled refresh.
- Revisit storage bucket public-listing warning by removing broad `storage.objects` SELECT policy if the app only needs public object URLs.

