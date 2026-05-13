# SESSION-2026-05-13 Landing Date Refresh Result

## Changed files

- `frontend/lib/server/public-programs-fallback.ts`
- `frontend/lib/server/public-program-snapshot-utils.ts`
- `frontend/lib/server/public-programs-fallback.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- The deployed landing page still showed the same Live Board and Opportunity feed candidates.
- Live DB inspection showed `program_landing_chip_snapshots` only had `generated_for=2026-04-26`, while the landing loader accepted the most recent past snapshot for `2026-05-13`.
- Live Board direct reads could also spend the first result window on rows that still had `is_open=true` but `deadline < 2026-05-13`.

## What changed

- Landing chip snapshot reads now require `generated_for = today(KST)` instead of reusing older snapshots.
- Landing snapshot/live-board cache keys were versioned and revalidate was lowered from 3600 seconds to 300 seconds.
- Live Board direct reads now require `deadline >= today(KST)`.
- Open-row filtering now treats an explicit past deadline as closed before trusting a stale non-negative `days_left`.

## Preserved behaviors

- If today's landing snapshot is present, the page still uses the precomputed snapshot first.
- If today's snapshot is missing, the existing read-model/legacy fallback path still builds landing candidates.
- Program card rendering, chip labels, detail/compare links, and public route paths are unchanged.

## Verification

- `npm --prefix frontend test -- lib/server/public-programs-fallback.test.ts` passed.
- `npm run build` in `frontend` passed.
- Supabase inspection confirmed `2026-05-13` snapshot rows are currently absent, and the new fallback candidate queries return `deadline >= 2026-05-13` rows.
- Local production `GET /landing-c?verify=20260513` returned 200 and did not include `2026-04-26` or the stale `스케치업` title.

## Risks / possible regressions

- Until `refresh_program_landing_chip_snapshots` is optimized, today's snapshot may still be absent and the landing page will depend on fallback reads.
- The fallback path is heavier than reading a snapshot, but it is bounded and cached for 300 seconds.

## Follow-up refactoring candidates

- Optimize `refresh_program_landing_chip_snapshots` so it can generate today's snapshot without DB statement timeout.
- Add a small operator command for refreshing only landing snapshots after `program_list_index` changes.
