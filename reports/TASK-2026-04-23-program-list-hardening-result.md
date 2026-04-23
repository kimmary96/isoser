# Result: TASK-2026-04-23-program-list-hardening

## Changed files

- `tasks/done/TASK-2026-04-23-program-list-hardening.md`
- `backend/routers/programs.py`
- `backend/services/program_list_scoring.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/lib/types/index.ts`
- `scripts/benchmark_program_list_performance.py`
- `docs/camps-list-refactor.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/program-list-hardening-performance-20260423.json`
- `reports/TASK-2026-04-23-program-list-hardening-result.md`

## Why changes were made

The current-state audit found that promoted/ad support existed mostly as `is_ad` / `promoted_rank` columns and indexes, while the API and UI still lacked a separate promoted layer. The audit also found remaining read-model hardening gaps around cursor/filter `or` composition, score field-name consistency, and repeatable performance validation.

## What changed

- Added `promoted_items` to `GET /programs/list` while preserving the existing organic `items` contract.
- Organic read-model queries now include `is_ad=false`, so promoted rows do not mix with recommended organic rows.
- First-page browse requests fetch promoted rows separately:
  - explicit `is_ad=true` rows first
  - configurable sponsored fallback from `PROGRAM_PROMOTED_PROVIDER_MATCHES`
  - default fallback assumes Fast Campus / 패스트캠퍼스 as requested
- Sponsored fallback uses the indexed read-model `search_text` instead of broad provider/title/source `ilike` scans.
- Promoted ids are removed from the organic page to prevent duplicate exposure.
- Frontend `/programs` renders `promoted_items` in a separate `스폰서 추천` layer above the organic table.
- Read-model cursor and region filters are composed as `and=(or(...),or(...))` so one `or` condition does not overwrite the other.
- Recommended score data completeness now recognizes read-model fields `cost_type` and `participation_time` in addition to legacy aliases.
- Added `scripts/benchmark_program_list_performance.py` for repeatable read-model-vs-legacy timing comparisons.

## Preserved behaviors

- Existing `/programs` plain array response remains compatible.
- Existing `/programs/list.items` remains the organic list.
- Existing `ENABLE_PROGRAM_LIST_READ_MODEL` fallback remains.
- Existing offset-based page query UI remains, because current product UX expects numbered pagination over the bounded browse pool.
- Detail pages still read long/detail fields from `programs`.

## Performance validation

Command:

```powershell
backend\venv\Scripts\python.exe scripts\benchmark_program_list_performance.py --runs 3 --limit 20 --query AI --output reports\program-list-hardening-performance-20260423.json
```

Measured from local shell to the configured Supabase project:

| Case | Avg ms | Items | Count | Notes |
| --- | ---: | ---: | ---: | --- |
| after read-model default browse | 1135.36 | 20 | 300 | Includes 15 promoted Fast Campus fallback rows and organic de-dupe |
| before legacy default browse | 234.47 | 0 | 0 | Current live data is not functionally equivalent under legacy fallback, so latency is not a valid win/loss comparison |
| after read-model `scope=all` search | 1605.52 | 20 | 1000 | Uses read model, no `program_list_index.scope` filter |
| before legacy `scope=all` search | 227.84 | 0 | 0 | Current live data is not functionally equivalent under legacy fallback |
| after facet snapshot filter-options | 222.85 | n/a | n/a | Snapshot path |
| before legacy filter-options | 12287.24 | n/a | n/a | Source scan path |

The most reliable direct before/after comparison is filter-options: snapshot path averages about `0.22s`, while legacy source-scan derivation averages about `12.29s`.

The listing comparison is recorded but not treated as a direct latency win/loss because the current legacy fallback returns 0 rows/count for the same live-data conditions, while the read model returns populated browse/search results.

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`: `99 passed`
- `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py backend\services\program_list_scoring.py scripts\benchmark_program_list_performance.py`: passed
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit`: passed
- `npx --prefix frontend vitest run frontend/lib/programs-page-layout.test.ts`: `2 passed`
- `npm --prefix frontend run lint`: passed, with Next.js `next lint` deprecation notice only

## Risks / possible regressions

- `PROGRAM_PROMOTED_PROVIDER_MATCHES` is a config fallback, not a real campaign booking model. It is suitable for the requested Fast Campus assumption but should be replaced before real multi-ad operations.
- Promoted rows are shown only on first-page browse requests. Search/archive modes intentionally keep promoted rows out of the result layer.
- The frontend still uses offset-based numbered pagination over the bounded 300-row browse pool. This preserves current UX but remains a deliberate exception to cursor-only pagination.
- The benchmark uses live network calls from this local shell, so absolute timings include network variance.

## Follow-up refactoring candidates

- Add a real `program_promotions` or campaign table with provider, date range, slot rank, budget/status, and audit fields.
- Replace list count row fetches with exact count headers or a count snapshot for large `scope=all` searches.
- Move read-model query construction into a small module with table-driven tests for PostgREST expressions.
- Add a staging `EXPLAIN` report for the promoted fallback and search paths after campaign schema is finalized.
