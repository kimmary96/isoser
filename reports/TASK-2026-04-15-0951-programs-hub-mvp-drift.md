id: TASK-2026-04-15-0951-programs-hub-mvp
status: drift
planned_against_commit: d125cd47caeee7055d2d33977e37352377035102
current_head: d125cd47caeee7055d2d33977e37352377035102

# Drift Report

The task packet is materially out of date for the directly touched area, so implementation was stopped before risky edits.

## Confirmed mismatches

- The packet says the `programs` table does not exist and a new migration must be added, but this repository already contains multiple `programs` migrations:
  - `supabase/migrations/20260410120000_create_programs_and_bookmarks.sql`
  - `supabase/migrations/20260410133000_add_work24_sync_columns_to_programs.sql`
  - `supabase/migrations/20260415_create_programs.sql`
- The packet says `/programs/[id]` is out of scope and a `404` is acceptable, but an existing detail page already exists at `frontend/app/programs/[id]/page.tsx`.
- The packet describes `/programs` as a new MVP page, but an existing page already exists at `frontend/app/programs/page.tsx`.
- The backend already has a `programs` router and sync-related endpoints in `backend/routers/programs.py`, plus admin-side sync logic in `backend/routers/admin.py`.
- The task packet assumes root-level Next.js paths such as `middleware.ts`, but the actual frontend app lives under `frontend/` and the middleware is `frontend/middleware.ts`.

## Why this is material

These conflicts affect the exact schema, route, and backend surfaces the task intends to create or change. Proceeding from the packet as written would risk:

- creating duplicate or conflicting `programs` schema changes
- overwriting or misaligning an already-implemented `/programs` flow
- implementing against stale assumptions about the existing detail page and ingestion pipeline

## Safe next step

Refresh the task packet against the current `frontend/app/programs/*`, `backend/routers/programs.py`, and `supabase/migrations/*programs*` state, then reissue a narrowed task describing the delta from the current implementation instead of the original MVP creation scope.

## Run Metadata

- generated_at: `2026-04-15T10:21:56`
- watcher_exit_code: `0`
- codex_tokens_used: `107,096`
