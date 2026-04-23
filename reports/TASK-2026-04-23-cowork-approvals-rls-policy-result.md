# TASK-2026-04-23 cowork approvals RLS policy result

## Changed files
- `supabase/migrations/20260423201000_add_cowork_approvals_service_role_policy.sql`
- `backend/tests/test_slack_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- Supabase linter reported `rls_enabled_no_policy_public_cowork_approvals`.
- `cowork_approvals` is an internal Slack approval queue used through backend service-role Supabase requests.
- A service-role-only policy documents the intended access path without exposing queue rows to browser clients.

## Preserved behaviors
- Slack slash command and interactivity paths still write approval rows through `SUPABASE_SERVICE_ROLE_KEY`.
- `anon` and `authenticated` roles remain unable to access `cowork_approvals` through PostgREST.
- Existing table shape, constraints, and indexes are unchanged.

## Risks / possible regressions
- If any future client-side feature tries to read approvals directly with user JWTs, it will still be blocked by RLS.
- The policy assumes Supabase service role bypass/role semantics are the only intended automation access path.

## Follow-up refactoring candidates
- Add a short runbook query for checking remaining Supabase linter findings after migrations.
- Keep Auth leaked password protection as accepted risk while the project remains on the Free plan.

