## Overall assessment

Not ready for promotion. Frontmatter is complete and `planned_against_commit` matches current `HEAD` (`94b50fda406587a4fd6afa1879f296546f5bed67`), so this is not blocked by packet metadata or general repo drift. The packet is still execution-risky because its data-shape, category, deduplication, and sync-path assumptions do not match the current repository closely enough.

## Findings

- Frontmatter completeness: complete. Required fields `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit` are present.
- Repository path accuracy: generally accurate for `backend/rag/collector/`, but the packet understates the actual integration surface. Current execution also depends on [backend/routers/programs.py](/D:/02_2025_AI_Lab/isoser/backend/routers/programs.py:428), [backend/rag/collector/scheduler.py](/D:/02_2025_AI_Lab/isoser/backend/rag/collector/scheduler.py:53), and the live `programs` table schema in [supabase/migrations/20260415_create_programs.sql](/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260415_create_programs.sql:1).
- Drift risk: material in the touched area even though commit drift is zero. The packet says not to change `BaseCollector`, `normalizer`, or `scheduler`, but current code likely requires at least `scheduler.py` updates to register six new collectors and may also require `normalizer.py` or schema work because current category and source type constraints do not fit the packet.
- Category mismatch: packet requires direct use of `취업`, `교육`, `창업`, `네트워킹`, but current DB constraint only allows `AI`, `IT`, `디자인`, `경영`, `창업`, `기타` in [20260415_create_programs.sql](/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260415_create_programs.sql:1). As written, `취업`, `교육`, `네트워킹` rows would fail unless packet scope explicitly includes schema and consumer updates.
- Source type mismatch: packet requires `source_type = 'regional_crawl'`, but current DB constraint only allows `national_api`, `seoul_city`, `quasi_public`, `local_gu` in [20260415_create_programs.sql](/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260415_create_programs.sql:1). This is a hard blocker unless the packet changes the required value or explicitly includes a migration.
- Raw field mismatch: packet says `raw` is a required collected field, but current normalized row shape does not persist `raw`; the schema currently exposes `raw_data jsonb` in [20260415170000_add_programs_hub_fields.sql](/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260415170000_add_programs_hub_fields.sql:1). The packet does not say whether collector `raw` should stay transient, map to `raw_data`, or require schema change.
- Deduplication mismatch: packet defines `source + title + deadline` as primary and `source + link` as secondary, but current collector scheduler upserts with `on_conflict=title,source` in [scheduler.py](/D:/02_2025_AI_Lab/isoser/backend/rag/collector/scheduler.py:23) and the DB unique constraint is `UNIQUE (title, source)` in [20260415_create_programs.sql](/D:/02_2025_AI_Lab/isoser/supabase/migrations/20260415_create_programs.sql:1). The packet’s acceptance criteria therefore cannot be met as written.
- Acceptance clarity gap: “각각 1건 이상의 데이터를 Supabase `programs` 테이블에 적재” depends on live remote site availability and local environment secrets, but the packet does not define a fallback verification method when sites are unavailable or keys/env are missing. That makes readiness dependent on external conditions not controlled by the task.
- Sync-path ambiguity: the packet talks about batch Tier 1 then Tier 2 ordering, and current `/programs/sync` does call `run_all_collectors()` via [backend/routers/programs.py](/D:/02_2025_AI_Lab/isoser/backend/routers/programs.py:428), but there is also a separate admin sync path in [backend/routers/admin.py](/D:/02_2025_AI_Lab/isoser/backend/routers/admin.py:188) built around `Work24TrainingAdapter`, not the collector scheduler. The packet does not specify which operational path is authoritative after implementation.
- Collector contract ambiguity: current collectors emit `title`, `raw_deadline`, `link`, optional `category_hint`, `source_meta`, and `raw`; `normalize()` then maps only a subset into DB rows. The packet asks for optional `start_date`, `end_date`, `target`, `sponsor_name`, but current normalizer discards `start_date` and `end_date` entirely and hardcodes `sponsor_name = None` in [normalizer.py](/D:/02_2025_AI_Lab/isoser/backend/rag/collector/normalizer.py:1). The packet does not state whether those fields are intentionally out of current DB scope.
- Missing references: the packet cites `isoser-tier2-seoul-crawling-validated.md` and `isoser-tier2-seoul-crawling-detailed.md`, but no repository path is given. Execution readiness is weaker because the implementer cannot verify those documents are present or authoritative from the packet alone.
- Missing touched-file list: the packet names the collector directory broadly but does not identify the likely concrete files to touch for registration and persistence behavior. For this repo, that omission matters because `scheduler.py`, `normalizer.py`, `programs.py`, and possibly Supabase migrations are all implicated.

## Recommendation

Do not promote yet.

Before promotion, the packet should be updated to make these points explicit:

- Decide and state the allowed `source_type` to match the current schema, or explicitly include a migration to add `regional_crawl`.
- Decide and state the allowed category values for Seoul Tier 2 rows, or explicitly include schema and downstream consumer changes for `취업`, `교육`, `네트워킹`.
- Reconcile deduplication requirements with the actual DB uniqueness and scheduler upsert key. The packet must either adopt `title + source` or require the exact migration and code changes needed for the new dedupe rule.
- Clarify whether `raw` is only an in-memory collector field or must be persisted as `raw_data`.
- Clarify the authoritative execution path: `POST /programs/sync` collector scheduler, admin sync route, or both.
- Clarify whether `start_date`, `end_date`, `target`, and `sponsor_name` are required persisted outputs, best-effort normalized outputs, or only collector-local extraction targets.
- Add concrete repository paths for the referenced validation documents, or remove them from the readiness basis.
- Replace the live-site acceptance of “each collector must insert at least 1 row” with a repo-executable acceptance condition, or explicitly mark external availability/env setup as a precondition.

After those changes, the packet would be promotable. In its current form, it is close in intent but not safe enough for direct execution in this repository.

## Review Run Metadata

- generated_at: `2026-04-15T17:18:05`
- watcher_exit_code: `0`
- codex_tokens_used: `63,894`
