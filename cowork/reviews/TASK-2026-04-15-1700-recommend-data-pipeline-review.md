# Overall assessment

Not ready for promotion. The packet frontmatter is complete, and the promotion target path in Transport Notes is reasonable, but the packet is materially out of date against the current repository state and mixes repo work with manual environment and Supabase console operations in a way that is not execution-safe.

# Findings

- `planned_against_commit` is stale for the touched area. Current `HEAD` is `c4a279ed70e2622f0c62377f9ed40fba6b62f0af`, and both [backend/routers/admin.py](/D:/02_2025_AI_Lab/isoser/backend/routers/admin.py) and [backend/routers/programs.py](/D:/02_2025_AI_Lab/isoser/backend/routers/programs.py) changed after `750fba4f766f86739e94368afa8474e2edbdc6b4`.
- The packet’s schema assumptions are behind the repo. Relevant migrations already exist in [supabase/migrations/20260415_create_recommendations.sql](/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260415_create_recommendations.sql), [supabase/migrations/20260410133000_add_work24_sync_columns_to_programs.sql](/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260410133000_add_work24_sync_columns_to_programs.sql), and [supabase/migrations/20260415170000_add_programs_hub_fields.sql](/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260415170000_add_programs_hub_fields.sql). The packet still frames these as missing setup.
- The packet uses the wrong Work24 env key. Current code checks `WORK24_TRAINING_AUTH_KEY` in [backend/routers/admin.py](/D:/02_2025_AI_Lab/isoser/backend/routers/admin.py) and [backend/rag/source_adapters/work24_training.py](/D:/02_2025_AI_Lab/isoser/backend/rag/source_adapters/work24_training.py), but the packet says `WORK24_OPEN_API_AUTH_KEY`.
- Acceptance criteria are misaligned with runtime behavior. Current recommendation flow in [frontend/app/api/dashboard/recommended-programs/route.ts](/D:/02_2025_AI_Lab/isoser/frontend/app/api/dashboard/recommended-programs/route.ts) and [backend/routers/programs.py](/D:/02_2025_AI_Lab/isoser/backend/routers/programs.py) reads from `/programs/recommend` and computes results from `programs` plus user/profile context. It does not read from or persist to the `recommendations` table, so table creation and RLS do not prove the user-visible outcome.
- The schema checklist is incomplete for the current sync path. `_normalize_program_row` in [backend/routers/admin.py](/D:/02_2025_AI_Lab/isoser/backend/routers/admin.py) now writes `support_type`, `teaching_method`, `is_certified`, and `raw_data` in addition to the older fields listed in the packet.
- The migration instructions are not reproducible as written. The packet says existing migration files should not be edited and new schema changes should be added as new files, but then instructs running SQL manually in Supabase SQL Editor instead of naming the migration path that should be applied or created.
- Validation steps are underspecified. “추천 카드 1개 이상 노출” depends on at least these external preconditions: valid `SUPABASE_SERVICE_ROLE_KEY`, valid `ADMIN_SECRET_KEY`, valid `WORK24_TRAINING_AUTH_KEY`, valid `GOOGLE_API_KEY`, reachable Supabase project, successful admin sync, and a logged-in user with enough profile/activity context for meaningful recommendations. The packet does not define the minimum validation fixture.
- The packet references `admin.py` generically instead of the actual repo path [backend/routers/admin.py](/D:/02_2025_AI_Lab/isoser/backend/routers/admin.py), and it omits the directly relevant files that currently drive the dashboard verification flow: [frontend/app/dashboard/page.tsx](/D:/02_2025_AI_Lab/isoser/frontend/app/dashboard/page.tsx), [frontend/app/api/dashboard/recommended-programs/route.ts](/D:/02_2025_AI_Lab/isoser/frontend/app/api/dashboard/recommended-programs/route.ts), and [backend/utils/supabase_admin.py](/D:/02_2025_AI_Lab/isoser/backend/utils/supabase_admin.py).

# Recommendation

Do not promote this packet yet.

Before promotion, the packet must be revised to:

- rebase `planned_against_commit` to current `HEAD` and refresh the task narrative against the current admin sync and recommendation code paths
- correct the environment variable names, especially `WORK24_TRAINING_AUTH_KEY`
- replace manual SQL Editor instructions with repo-tracked migration instructions that match the migrations already present, or explicitly scope the task as external/manual ops only
- either remove the `recommendations` table requirement from acceptance, or explicitly add repo work that actually persists and reads recommendation rows
- update schema acceptance to match the fields the current sync code writes
- make dashboard verification preconditions explicit, including required keys, required login state, and the minimum user/profile/activity data needed for a non-empty recommendation result

Verdict: not promotable until the packet is updated. This is not a minor wording pass; the packet needs substantive correction before promotion.

## Review Run Metadata

- generated_at: `2026-04-15T18:15:28`
- watcher_exit_code: `0`
- codex_tokens_used: `46,462`
