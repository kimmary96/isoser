-- Corrective migration for the `activity-images` bucket policy drift observed on 2026-04-24.
-- The bucket itself is public, so asset serving does not need a broad SELECT policy.
-- The app writes files under `<user-id>/...` and uses `upload(..., { upsert: true })`,
-- so the minimum safe metadata policies are own-folder SELECT/INSERT/UPDATE/DELETE.
--
-- Note:
-- - `storage.objects` is owned by the storage subsystem, so some automation paths may
--   reject this migration with `must be owner of table objects`. Keep this file as the
--   repo source of truth and apply it through an owner-capable path such as SQL Editor
--   if your current runner cannot mutate storage policies.

alter table storage.objects enable row level security;

drop policy if exists "activity_images_public_read" on storage.objects;
drop policy if exists "activity_images_auth_upload" on storage.objects;
drop policy if exists "activity_images_owner_update" on storage.objects;
drop policy if exists "activity_images_owner_delete" on storage.objects;
drop policy if exists "activity_images_select_own" on storage.objects;
drop policy if exists "activity_images_insert_own" on storage.objects;
drop policy if exists "activity_images_update_own" on storage.objects;
drop policy if exists "activity_images_delete_own" on storage.objects;

create policy "activity_images_select_own" on storage.objects
for select
to authenticated
using (
  bucket_id = 'activity-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "activity_images_insert_own" on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'activity-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "activity_images_update_own" on storage.objects
for update
to authenticated
using (
  bucket_id = 'activity-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'activity-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "activity_images_delete_own" on storage.objects
for delete
to authenticated
using (
  bucket_id = 'activity-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
