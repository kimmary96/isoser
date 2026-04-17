# TASK-2026-04-16-1535-seo-metadata-jsonld Recovery Report

- task id: `TASK-2026-04-16-1535-seo-metadata-jsonld`
- checked at: `2026-04-16`
- current HEAD: `2aa310d1960e554268cd8b42b63d382f4f73415b`
- recovery outcome: `safe to retry`

## What Changed In The Packet

- Replaced `planned_against_commit: TODO_CURRENT_HEAD` with the current HEAD commit.
- Set `auto_recovery_attempts: 1`.
- Kept `status: queued` so another watcher run can pick the task up.
- Narrowed the packet assumptions to match the validated worktree:
  - `frontend/app/layout.tsx` still uses old brand metadata and keeps GA wiring.
  - `frontend/app/(landing)/programs/page.tsx` is already locally modified and should receive additive metadata only.
  - `frontend/app/(landing)/landing-a/page.tsx` is already locally modified and should receive additive metadata only.
  - `frontend/app/(landing)/compare/page.tsx` is already locally modified and should receive additive metadata only.
  - `frontend/app/(landing)/programs/[id]/page.tsx` currently uses `getProgram(id)` directly, so metadata and JSON-LD should reuse that existing fetch pattern.
- Relaxed the stale `<head>`-specific JSON-LD wording to require inclusion in server-rendered HTML, which preserves the SEO intent while fitting the current Next.js App Router implementation more safely.

## Why Retry Is Now Safe

The original stop condition was baseline drift, not an external prerequisite. There is no missing credential, approval, or product decision blocking execution.

The refreshed packet is now pinned to the current repository state and explicitly tells the next run to preserve the in-flight landing page changes. That removes the main risk identified in the drift report: treating already-edited pages as if they were untouched.

## Validated Files

- `AGENTS.md`
- `tasks/drifted/TASK-2026-04-16-1535-seo-metadata-jsonld.md`
- `reports/TASK-2026-04-16-1535-seo-metadata-jsonld-drift.md`
- `frontend/app/layout.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/app/(landing)/landing-a/page.tsx`
- `frontend/app/(landing)/compare/page.tsx`

## Run Metadata

- generated_at: `2026-04-16T17:32:20`
- watcher_exit_code: `0`
- codex_tokens_used: `53,124`
