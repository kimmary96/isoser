# SESSION-2026-05-13 Work24 Seoul DB Refresh Result

## Changed files

- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/ops/work24/work24-seoul-sync-20260513-batch50-full-apply.json`

## Why changes were made

- The user asked to update the database from the Work24 source for Seoul only.
- Supabase does not pull Work24 data automatically by itself; the external source sync has to be run by an app process, scheduled job, or manual script.

## What changed

- Ran Seoul-only Work24 partition sync for `20260513~20261113`.
- Used `PROGRAM_UPSERT_BATCH_SIZE=50` to avoid the previous Supabase statement timeout from larger bulk upsert requests.
- Upserted the fetched rows into Supabase `programs`.
- Refreshed the public browse read model in `program_list_index`.

## Results

- Work24 Seoul preview total: `5,890`
- Fetched rows: `5,890`
- Payload rows: `5,890`
- Upserted rows: `5,890`
- Rows using `traStartDate` as deadline fallback: `5,847`
- Sync duration: `2,805.806` seconds
- Report: `reports/ops/work24/work24-seoul-sync-20260513-batch50-full-apply.json`
- Browse refresh: `300` rows regenerated at `2026-05-13T14:02:14.882519+00:00`

## Preserved behaviors

- Nationwide Work24 collection was not run; scope was limited to Seoul.
- Existing admin upsert conflict/fallback behavior was unchanged.
- Landing snapshot generation remains optional; failure does not block browse refresh.

## Verification

- Supabase `programs` sample showed Seoul Work24 rows updated at `2026-05-13T14:00:39Z`.
- `program_list_index` browse top rows showed `indexed_at=2026-05-13T14:02:14.882519+00:00`.
- `program_list_index` browse rank `<= 300` had no sampled `days_left < 0` rows.
- Local production `GET /landing-c?verify=seoul-db-refresh` returned `200` and did not include stale `2026-04-26` snapshot text or the stale `스케치업` title.

## Risks / possible regressions

- `refresh_program_landing_chip_snapshots` still fails with Supabase statement timeout, so the landing page currently depends on the today-filtered fallback path instead of precomputed chip snapshots.
- There is no confirmed deployed scheduler/cron in `backend/render.yaml`; Work24 source updates are manual unless a separate scheduler is configured outside this repo.

## Follow-up refactoring candidates

- Add a scheduled Render Cron/GitHub Action/Supabase-compatible scheduler for Work24 partition sync and read-model refresh.
- Optimize landing snapshot RPC so chip snapshots can refresh without statement timeout.
