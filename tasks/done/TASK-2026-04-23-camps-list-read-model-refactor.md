---
id: TASK-2026-04-23-camps-list-read-model-refactor
status: queued
type: refactor
title: Camps and programs list read model performance refactor
planned_at: 2026-04-23T00:00:00+09:00
planned_against_commit: b16f55cd6a4fd2131446f69921227870675926b8
auto_recovery_attempts: 1
planned_files: backend/routers/programs.py, backend/services/program_list_scoring.py, scripts/refresh_program_list_index.py, supabase/migrations/20260423170000_add_program_list_read_model.sql, frontend/app/(landing)/programs/page.tsx, frontend/app/(landing)/programs/program-utils.ts, frontend/lib/api/backend.ts, frontend/lib/types/index.ts, frontend/app/(landing)/programs/programs-filter-bar.tsx, backend/tests/test_programs_router.py, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-23-camps-list-read-model-refactor-result.md
planned_worktree_fingerprint: 165f707f60ef2a59c4068fd42c902d873570e13f2c713fe2a6491f5da412d010
---

# Task

Refactor the public camps/programs listing flow so default browsing no longer scans the full source/detail dataset for every request.

## Scope

- Analyze current `/programs` list API, filters, pagination, and frontend URL state.
- Add a list read model or equivalent materialized structure for summary list responses.
- Split default browse, full search, and archive/recent closed modes.
- Add cursor pagination with stable tie breakers.
- Add recommended score calculation and tests.
- Add browse pool and facet snapshot support.
- Keep changes minimally invasive and compatible with existing frontend callers.

## Constraints

- Preserve existing behavior where possible.
- Do not introduce Elasticsearch, Meilisearch, or another external search engine.
- Do not return heavy long text fields from the new list read path.
- Do not mix promoted ranking into organic recommended score.

## Recovery baseline

Automatic recovery inspected the drift report and the current directly relevant `/programs` worktree changes. The prior stop condition was not caused by missing credentials, missing approvals, or an unresolved product decision. It was caused by partial uncommitted implementation work in the same touched area without packet fingerprint metadata.

The retry should treat the current planned-file snapshot as the baseline, reuse or revise the existing partial implementation instead of duplicating it, and keep the original refactor intent. Current partial work includes read-model list helpers and scoring fields in `backend/routers/programs.py`, a new `backend/services/program_list_scoring.py` scoring helper, a refresh script, a Supabase migration for the read-model tables/functions, frontend API/type/score utility additions, focused backend tests, and a small `/programs` table presentation change in `frontend/app/(landing)/programs/page.tsx`.

The next watcher run must still validate the implementation normally, including duplicate detection, tests, result reporting, and docs updates for any behavior or structure changes.
