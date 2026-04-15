## Overall assessment

Not ready for promotion.

Frontmatter is complete, the referenced collector and normalizer paths are present, and `planned_against_commit` matches current HEAD (`78e4bf6f260ed0ada3481d4d921e6ee5f4c643f3`), so broad repository drift is low. The blocking issue is packet-to-repository mismatch: several acceptance steps assume execution modes, schema fields, and frontend behavior that do not match the current codebase.

## Findings

- Frontmatter completeness: pass. Required fields from `AGENTS.md` are present: `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`.
- Repository path accuracy: pass. Referenced files exist: `backend/rag/collector/hrd_collector.py`, `work24_collector.py`, `kstartup_collector.py`, `normalizer.py`, `scheduler.py`.
- Execution assumption mismatch: the packet requires `run_all_collectors(upsert=False)` and `run_all_collectors(upsert=True)`, but the live scheduler defines `run_all_collectors()` with no parameters and always upserts when normalization succeeds. See `backend/rag/collector/scheduler.py:60` and `:118`.
- Acceptance ambiguity around "dry run": because there is no non-upserting mode in the current scheduler, criteria 4 and 6 are not separately testable as written. The packet needs either a revised acceptance path or an explicit prerequisite/task dependency to add dry-run support first.
- Schema mismatch: the packet says collector responses should preserve full `raw` JSONB, but the active crawler-oriented migration does not define a `raw` column. See `supabase/migrations/20260415_create_programs.sql`.
- Schema mismatch: the packet uses source-type language that does not fit the current DB constraint set. It refers to crawler-style distinctions, but `20260415_create_programs.sql:22` allows only `national_api`, `seoul_city`, `quasi_public`, `local_gu`.
- Category mismatch: the packet defines target categories as `AI·데이터 / IT·개발 / 디자인 / 경영·마케팅 / 창업 / 기타`, while the DB constraint allows only `AI`, `IT`, `디자인`, `경영`, `창업`, `기타`. See `supabase/migrations/20260415_create_programs.sql:20`.
- Frontend acceptance is not execution-ready: the packet requires `/programs` to show the three API sources, but the current router still filters/query-builds on legacy fields like `location` and `is_active`, not the crawler schema fields described in the packet. See `backend/routers/programs.py:42`, `:56`, `:157`, `:161`, `:186`.
- Prerequisite status is unclear: the packet says Phase 1 must be completed first, but the Phase 1 packet in `cowork/packets/` is still `status: queued`. There is no approval or result artifact referenced here to prove the prerequisite is actually complete.
- Logging acceptance is underspecified against current behavior: criterion 9 expects a skip with a `"키 없음"` log, but current base API collectors log English text (`"... is not configured."`). See `backend/rag/collector/base_api_collector.py:20`.
- Missing references: the packet repeatedly says the runner should verify against official API docs, but it does not provide the specific document links or identifiers for HRD-Net, Work24, or K-Startup. That leaves an avoidable interpretation gap for endpoint correction work.
- Normalizer dependency is real and should be called out more explicitly: current `normalizer.py` still hardcodes `is_ad` and `sponsor_name` and only supports title/category-hint normalization. See `backend/rag/collector/normalizer.py:19`, `:25-26`. That increases risk if this packet is promoted before the prerequisite is actually merged.

## Recommendation

Do not promote yet.

Before promotion, the packet should be updated to make these points exact:

- Reconcile scheduler behavior with the packet. Either change the packet to the current `run_all_collectors()` behavior, or state that adding `upsert`/dry-run support is a prerequisite and not part of this packet.
- Align acceptance and constraints to the actual DB schema. Specifically, remove or justify `raw` JSONB preservation, use only allowed `source_type` values, and use the current category enum names.
- Clarify the `/programs` acceptance. Either remove frontend visibility from this packet, or explicitly note the router/schema dependency that must already be resolved before this can pass.
- Replace the vague Phase 1 dependency with a concrete readiness reference, such as the approved/promoted task artifact or result report proving the normalizer prerequisite is complete.
- Add the exact official API reference links or document identifiers for HRD-Net, Work24, and K-Startup so endpoint validation work is reproducible.
- Normalize the expected missing-key behavior in the packet to the current logging contract, or specify that log wording must be changed as part of a separate task.

After those packet changes, this should be promotable without major re-planning.

## Review Run Metadata

- generated_at: `2026-04-15T14:10:17`
- watcher_exit_code: `0`
- codex_tokens_used: `66,424`
