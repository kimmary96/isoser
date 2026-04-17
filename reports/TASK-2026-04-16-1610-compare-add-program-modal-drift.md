# TASK-2026-04-16-1610-compare-add-program-modal Drift Report

- task id: `TASK-2026-04-16-1610-compare-add-program-modal`
- checked at: `2026-04-16`
- planned_against_commit: `cb77836d2b61ccbaf784b9fc1188ea10fcfdab2a`
- current_head: `cb77836d2b61ccbaf784b9fc1188ea10fcfdab2a`

## Why implementation was stopped

The task packet assumes the compare page exists at `/programs/compare`, but the current implementation area is `frontend/app/(landing)/compare/page.tsx`, which maps to `/compare`.

Because the requested feature is defined against a specific page path and user flow entry points on that page, this route mismatch is material drift in the touched area. Implementing without reconciling the target route would risk applying the modal flow to the wrong surface.

## What was verified

- Required frontmatter fields are present.
- `planned_against_commit` matches current `HEAD`.
- Existing compare implementation is present at:
  - `frontend/app/(landing)/compare/page.tsx`
  - `frontend/app/(landing)/compare/programs-compare-client.tsx`
- Existing modal shell is present at:
  - `frontend/app/dashboard/_components/modal-shell.tsx`
- Bookmark backend support exists:
  - `backend/routers/bookmarks.py`
- `program_bookmarks` table exists in migrations:
  - `supabase/migrations/20260410120000_create_programs_and_bookmarks.sql`

## Drift details

1. Task packet target route: `/programs/compare`
2. Current code route: `/compare`
3. No current `frontend/app/(landing)/programs/compare` page was found.

## Recommended next step

Confirm whether this task should be implemented on the existing `/compare` page, or whether a new `/programs/compare` route/alias is required first. After that is clarified, the packet should be updated and re-run.

## Run Metadata

- generated_at: `2026-04-16T14:27:52`
- watcher_exit_code: `0`
- codex_tokens_used: `71,119`
