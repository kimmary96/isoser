## Overall assessment

Not ready for promotion yet.

The packet has complete required frontmatter and its `planned_against_commit` matches current `HEAD` (`d2dc9fe36272d06812f26781c8659aad98dd6054`), so there is no immediate commit drift. The main blockers are schema-level ambiguity and a few repository-reference gaps that would make execution risky.

## Findings

- Frontmatter completeness: OK. Required fields `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit` are all present.
- Planned commit / drift: OK at repo level. Current `HEAD` matches the packet exactly.
- Direct reference paths: mostly valid, but the packet mixes route paths and repository paths.
  - `frontend/lib/types/index.ts` exists.
  - `cowork/drafts/isoser-compare-v3.html` exists.
  - The referenced route files exist at `frontend/app/programs/page.tsx` and `frontend/app/programs/[id]/page.tsx`, not `/programs/page.tsx` and `/programs/[id]/page.tsx`.
- Public access assumption: supported by current middleware. `frontend/middleware.ts` only guards `/onboarding` and `/dashboard`, so `/programs/compare` would be public without middleware changes.
- API reference clarity: acceptable but incomplete.
  - `frontend/lib/api/backend.ts` does expose `listPrograms` and `getProgram`, matching the packet’s intended data path.
  - The packet does not name the expected repository location for the new compare route or the likely client/server component split points, which increases implementation variance.
- Schema drift / migration risk: blocker.
  - The repo currently contains two different `programs` table creation migrations: `supabase/migrations/20260410120000_create_programs_and_bookmarks.sql` and `supabase/migrations/20260415_create_programs.sql`.
  - Those migrations define materially different schemas. The packet assumes columns such as `provider`, `location`, `skills`, `tags`, `application_url`, `start_date`, `end_date`, `days_left`, and `source` are all part of the active model, but that is not true in both migration branches.
  - Because of that, “add one `compare_meta JSONB` column” is not execution-safe unless the packet first states which migration lineage is authoritative.
- Data-model assumption gap: blocker.
  - The packet says the `programs` table already has `days_left`, but current migration files do not establish that column. The frontend `Program` type has `days_left?: number | null`, so that field may be API-derived rather than persisted.
  - The packet must clarify whether `compare_meta` is a DB column only, an API field only, or both DB + API contract.
- Open Questions section contains execution-critical ambiguity.
  - The badge mapping for `compare_meta` is not optional implementation detail; it determines accepted behavior for several rows and acceptance criterion 7.
  - Leaving the value contract under “Open Questions” makes the packet under-specified. This needs to be promoted into a fixed spec before execution.
- Acceptance clarity: mostly good, but a few items are still loose.
  - Criterion 8 requires `.row { display: contents }`, which is implementation-prescriptive rather than outcome-based. That is acceptable if intentional, but it should be explicit that this is a required DOM/CSS contract, not just a design hint.
  - Criterion 10 allows either disabled or hidden behavior for missing `application_url`; the packet should choose one to avoid review churn.
  - Recommendation API failure behavior also allows two outcomes (“미표시 또는 안내”), which weakens acceptance clarity.
- Missing references:
  - The packet mentions a nav tab for “부트캠프 비교” but does not identify the navigation component or file to update.
  - The packet says to use existing hook + component separation patterns but does not point to a directly relevant example in the repo.

## Recommendation

Do not promote this packet yet.

Before promotion, make these exact changes:

- Replace the route-like file references with repository paths: `frontend/app/programs/page.tsx` and `frontend/app/programs/[id]/page.tsx`.
- Resolve the schema lineage explicitly. State which existing `programs` migration is authoritative for execution, or add a note that the executor must first reconcile the duplicate `programs` table migrations before applying any new migration.
- Clarify whether `days_left` is a persisted database column or an API-computed field. The packet currently treats it as an existing table column, which is not supported by the checked migration files.
- Move the `compare_meta` value contract out of Open Questions into the main spec. The pass/warn/block mapping must be fixed before implementation.
- Choose one behavior for missing `application_url`: disabled button or hidden button.
- Choose one behavior for recommendation API failure: hide the section or show an error notice.
- Add the repository path for the navigation surface if the nav tab is in scope; otherwise remove the nav-tab requirement from the user flow and acceptance criteria.

After those changes, the packet should be promotable with minor risk.

## Review Run Metadata

- generated_at: `2026-04-15T11:24:03`
- watcher_exit_code: `0`
- codex_tokens_used: `56,045`
