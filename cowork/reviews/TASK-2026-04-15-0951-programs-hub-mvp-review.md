## Overall assessment

Not ready for promotion. The frontmatter is complete and `planned_against_commit` matches current `HEAD`, and the cited draft file `cowork/drafts/isoser-programs.html` exists. The packet is still not execution-ready because its core assumptions drift from the current repository in schema, routing scope, and ingestion flow.

## Findings

- Frontmatter completeness is acceptable. Required fields are present: `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit`.
- Repository path accuracy is mixed. The draft reference path is correct, and the transport targets under `tasks/inbox/` and `tasks/remote/` are plausible. But the packet describes `/programs` and the `programs` table as if they are mostly greenfield, while both already exist in the repo.
- Drift risk is high around the database schema. The packet says the `programs` table does not exist and requires a new migration to create it, but the repo already has `supabase/migrations/20260410120000_create_programs_and_bookmarks.sql`, `supabase/migrations/20260410133000_add_work24_sync_columns_to_programs.sql`, and `supabase/migrations/20260415_create_programs.sql`. Those migrations define overlapping but incompatible `programs` shapes.
- Drift risk is high around the UI surface. `frontend/app/programs/page.tsx` and `frontend/app/programs/[id]/page.tsx` already implement list and detail pages. The packet allows `/programs/[id]` to return 404, but the current repo already serves a detail page there. That makes the stated acceptance target stale.
- The packet’s assumption about public access is accurate today. `frontend/middleware.ts` still protects only `/onboarding` and `/dashboard*`, so `/programs` is public. That criterion is clear and low risk.
- The packet does not define the authoritative ingestion path. The current repo already has `POST /sync/programs` in `backend/routers/admin.py`, `POST /programs/sync` in `backend/routers/programs.py`, a Work24 adapter using `WORK24_TRAINING_AUTH_KEY`, and an HRD collector using `HRD_API_KEY`. The packet introduces `HRD_NET_API_KEY` but does not say whether the task replaces, coexists with, or consolidates the existing flows.
- Acceptance clarity is insufficient because several criteria describe end states without specifying the required delta from the current implementation. That is especially true for `/programs` page behavior, detail-link behavior, table shape, and data-fetch architecture.
- Missing references remain for safe execution. The packet leaves the exact HRD-Net endpoint, auth contract, pagination parameter names, and category-mapping source of truth to runtime investigation. That is workable for implementation research, but not enough for a packet that also prescribes concrete schema and UI behavior.
- There is a schema-language mismatch that should be resolved before promotion. The current frontend/backend types use fields such as `title`, `location`, `deadline`, and `is_active`, while the packet centers acceptance on `name`, `recruit_end_date`, `is_recruiting`, `teaching_method`, `support_type`, and `is_certified`. The packet does not state whether existing names are to be migrated, aliased, or replaced.

## Recommendation

Do not promote this packet yet. Before promotion, the packet should be revised to:

- Reframe the task as a delta against the current implementation, explicitly naming the existing `/programs` list page, existing `/programs/[id]` page, and existing `programs` schema as in-scope starting points.
- Resolve the schema target. The packet must say whether the implementation extends the current `programs` table, migrates it to a new shape, or introduces compatibility fields while preserving existing readers.
- Resolve the ingestion contract. Pick one authoritative sync route and one env var contract, or explicitly define how HRD-Net and existing Work24-based collection coexist.
- Update acceptance criteria to match current reality. In particular, decide whether `/programs/[id]` should continue working, be intentionally downgraded, or remain untouched and out of scope.
- Add the missing authoritative references for HRD-Net field mapping and category mapping, or narrow the packet so those decisions are not left ambiguous at execution time.

After those changes, the packet should be promotable. In its current form, it is not ready for safe execution.

## Review Run Metadata

- generated_at: `2026-04-15T10:13:12`
- watcher_exit_code: `0`
- codex_tokens_used: `132,821`
