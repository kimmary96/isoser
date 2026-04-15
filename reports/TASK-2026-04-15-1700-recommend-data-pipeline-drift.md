# Drift Report

- task id: `TASK-2026-04-15-1700-recommend-data-pipeline`
- planned against: `750fba4f766f86739e94368afa8474e2edbdc6b4`
- current head: `81a5b37d3bb31937166247e4dc086fec2e786d4c`
- status: stopped due to material drift in the touched area

## Why this is drift

The packet assumes the recommendation data-pipeline prerequisites are still missing in the repository, but the current codebase already contains multiple changes in that exact area:

- `backend/utils/supabase_admin.py` already requires `SUPABASE_SERVICE_ROLE_KEY` and is wired into the admin sync path.
- `backend/routers/admin.py` already exposes `POST /sync/programs`, validates `ADMIN_SECRET_KEY`, and upserts by `hrd_id`.
- `backend/routers/programs.py` already contains recommendation fallback behavior and newer program-field handling that depends on the current sync payload shape.
- `supabase/migrations/20260415_create_recommendations.sql` already exists.
- `supabase/migrations/20260410133000_add_work24_sync_columns_to_programs.sql` already adds the core Work24 sync columns.
- `supabase/migrations/20260415170000_add_programs_hub_fields.sql` already adds newer program fields beyond the original packet.

The packet also claims `backend/.env` is missing the required admin/Supabase values, but the local repository state already has those keys present. That makes the packet's primary implementation assumption stale.

There is also contract drift inside the packet itself versus current code:

- the packet references `WORK24_OPEN_API_AUTH_KEY`, while current code checks `WORK24_TRAINING_AUTH_KEY`
- the packet describes several manual Supabase SQL Editor and live sync verification steps that cannot be safely re-derived from repository code alone

Because the repository already moved ahead in the targeted implementation area, continuing from this packet would risk redundant edits or incorrect manual-state assumptions.

## Evidence checked

- `tasks/running/TASK-2026-04-15-1700-recommend-data-pipeline.md`
- `backend/routers/admin.py`
- `backend/routers/programs.py`
- `backend/utils/supabase_admin.py`
- `supabase/migrations/20260415_create_recommendations.sql`
- `supabase/migrations/20260410133000_add_work24_sync_columns_to_programs.sql`
- `supabase/migrations/20260415170000_add_programs_hub_fields.sql`
- `backend/.env`

## Decision

No implementation edits were made. No migration files were changed. No commit or push was performed.

Re-plan this task against the current repository and split repo changes from external/manual validation work if the remaining goal is still needed.

## Run Metadata

- generated_at: `2026-04-15T18:14:00`
- watcher_exit_code: `0`
- codex_tokens_used: `current-session`
