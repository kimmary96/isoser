# Camps / Programs List Refactor

## Current Problem

The public listing flow is implemented around `GET /programs`, `GET /programs/count`, and frontend server rendering in `frontend/app/(landing)/programs/page.tsx`.

Before this refactor, the backend often requested up to `PROGRAM_SEARCH_SCAN_LIMIT` rows from `programs` with `select=*`, then resolved deadlines, derived display categories, inferred cost/time filters, filtered, sorted, and counted in Python. This preserved correctness for legacy rows but made default page entry and filter changes scale with the full source/detail table.

Current bottlenecks:

- default browsing used a full scan because `default` sort depended on resolved deadline post-processing
- `/programs/count` repeated the same expensive Python filtering path
- filter options were derived from source rows instead of a precomputed list surface
- pagination used `offset`
- list responses could include detail-oriented fields such as `description` and broad `compare_meta`

## Proposed Architecture

Use a list read model, `public.program_list_index`, as the default surface for public browse/search/archive list traffic.

The source table remains `public.programs`. Detail endpoints still read source rows, while list endpoints prefer the read model and fall back to the legacy path if the read model is disabled or unavailable.

Feature flag:

- `ENABLE_PROGRAM_LIST_READ_MODEL=true` by default
- set to `false` to force the previous legacy list path

Config:

- `PROGRAM_BROWSE_POOL_LIMIT`, default `300`
- `PROGRAM_PROMOTED_SLOT_LIMIT`, default `15`

Quality hardening migrations:

- `20260423195000_improve_program_list_browse_pool_quality.sql` redefines the refresh function so cost/time facets are inferred at read-model build time and browse rank uses source diversity interleaving.
- `20260423200000_move_pg_trgm_extension_schema.sql` handles the Supabase linter warning for `pg_trgm` installed in `public`.

## Browse / Search / Archive

- `browse`: no `q`, no `scope=all`, no closed mode. Filters operate inside `browse_rank <= PROGRAM_BROWSE_POOL_LIMIT` and `is_open=true`.
- `search`: `q` is present or `scope=all`. This bypasses the browse pool and uses `program_list_index.search_text` first.
- `archive`: `include_closed_recent=true`, `closed=true` on frontend, or `scope=archive`. This targets closed rows separately.

Browse rank is still score-led, but the pool builder groups sources and applies a Work24 soft cap at 70% of the configured pool before allowing Work24 overflow rows. This means alternative sources are interleaved when available, while sparse source coverage still returns a full 300-row browse pool.

The existing `/programs` response remains a plain array for compatibility. The new paged contract is `GET /programs/list`, returning:

- `items`
- `next_cursor`
- `count`
- `mode`
- `source`
- `cache_hit`

## Read Model

Migration: `supabase/migrations/20260423170000_add_program_list_read_model.sql`

Main table: `program_list_index`

The read model stores summary-only list fields:

- identity/title/provider/source
- category/category_detail
- region/location/on-off/cost/time fields
- resolved deadline and deadline confidence
- normalized satisfaction and review fields
- recommended score components
- recommendation reason badges
- tags/skills/target summaries for filter/search support
- browse rank
- compact `summary`

Heavy detail fields stay on `programs` and detail APIs.

## Recommended Score

Python implementation: `backend/services/program_list_scoring.py`

SQL backfill implementation: `public.refresh_program_list_index(pool_limit integer)`

Weights:

- `excellence_score`: 0.35
- `bayesian_satisfaction`: 0.30
- `review_confidence`: 0.10
- `deadline_urgency`: 0.10
- `freshness_score`: 0.10
- `data_completeness`: 0.05

Deadline urgency is only applied when `deadline_confidence = high`. Work24 rows where a training end date appears to be copied into the deadline remain low confidence unless a close/application deadline source exists.

Recommendation reason badges are derived from actual score components:

- 우수기관
- 만족도 상위
- 마감임박
- 최근 등록
- 상세정보 충실

## Cache / Facet Snapshot

`program_list_facet_snapshots` stores browse facet snapshots by scope and pool limit. The current implementation refreshes browse facets during `refresh_program_list_index`.

`cost_type` and `participation_time` are populated in the read model from explicit source columns first, then conservative SQL inference over support type, selected `compare_meta` keys, title, summary, description, and start/end duration. This keeps browse filters DB-backed even when the source table has sparse normalized fields.

API:

- `GET /programs/facets`

This avoids recomputing common browse facets from source rows on every request.

## Migration / Backfill

Run:

```powershell
backend\venv\Scripts\python.exe scripts\refresh_program_list_index.py --pool-limit 300
```

The script calls the idempotent Supabase RPC:

```sql
select public.refresh_program_list_index(300);
```

The refresh upserts rows by `programs.id`, recomputes scores, rebuilds browse rank, and writes a facet snapshot.

## Rollout / Fallback

The backend uses the read model only when `ENABLE_PROGRAM_LIST_READ_MODEL` is enabled. If the read model query fails, `GET /programs`, `GET /programs/list`, and `GET /programs/count` log a structured fallback event and use the existing legacy path.

Unsupported legacy-only filters, currently selection process and employment link filters, continue through the legacy path.

## API Changes

Added:

- `GET /programs/list`
- `GET /programs/facets`

Extended:

- `GET /programs` accepts `cursor` and uses the read model for first-page compatible array responses.
- `GET /programs/count` prefers the read model.

Frontend:

- `/programs` now calls `listProgramsPage` for the main list.
- URL distinguishes modes with `scope=all` when `q` is present and `scope=archive` when closed mode is active.
- Cursor is stored in `cursor`.
- Cards can render recommendation reason badges.

## Remaining Risks

- The SQL refresh function should be run against staging Supabase before production rollout because production schema drift around `target` and legacy optional columns may still exist.
- Count currently reads matching read-model ids through REST instead of using a `Prefer: count` response path.
- Cursor pagination is forward-only in the first frontend integration; numbered deep paging remains legacy/fallback behavior.
- Promoted slots are stored separately through `promoted_rank`, but the current frontend still uses existing `AdSlot` plus organic rows. A dedicated promoted row layer can be added once product ad inventory rules are finalized.
- Supabase `auth_leaked_password_protection` is not fixable through SQL; enable leaked password protection in Auth settings after database migrations.
