# SESSION-2026-04-24 activity-images upload upsert removal result

## Changed files
- `frontend/app/api/dashboard/activities/images/route.ts`
- `frontend/app/api/dashboard/profile/route.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- Live Supabase inspection showed that `activity-images` storage policies are still narrower than the repo corrective migration expects.
- The app upload routes were passing `upsert: true`, but both routes already generate unique object keys under `<user-id>/...`, so overwrite semantics were unnecessary.
- Removing `upsert` reduces dependence on broader Storage permissions while preserving the current upload/public-URL flow.

## Preserved behaviors
- Activity image uploads still validate file count, size, and mime rules exactly as before.
- Profile avatar uploads still generate a fresh object path and return a public URL exactly as before.
- The bucket remains public, and callers still receive `getPublicUrl(...)` results with no response-shape change.

## Risks / possible regressions
- Re-uploading the exact same logical image no longer attempts overwrite semantics, but the route already used timestamp-based unique paths, so this is not expected to change runtime behavior.
- Old avatar/image files are still not garbage-collected by this change; this was already true before and remains a follow-up concern.
- The live storage policy drift itself is not fully closed yet; this change only reduces runtime dependence on the missing permissions.

## Follow-up refactoring candidates
- Apply `supabase/migrations/20260425121000_align_activity_images_storage_policies.sql` through SQL Editor and then verify upload/list/update/delete behavior again.
- Add a small unit test around storage upload options so `upsert: true` does not silently reappear on unique-path uploads.
- Consider a cleanup path for stale avatar/activity image objects if storage growth becomes meaningful.
