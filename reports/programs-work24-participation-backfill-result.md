# programs-work24-participation-backfill Result

## Changed files
- `backend/routers/programs.py`
- `backend/rag/collector/work24_detail_parser.py`
- `scripts/program_backfill.py`
- `scripts/refresh_program_list_index.py`
- `supabase/migrations/20260423203000_conservative_program_participation_display.sql`
- `frontend/lib/types/index.ts`
- `backend/tests/test_programs_router.py`
- `backend/tests/test_program_backfill.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/programs-work24-participation-backfill-*.json`
- `reports/programs-work24-browse-pool-participation-backfill-*.json`
- `reports/programs-work24-participation-read-model-*.json`

## Why changes were made
- Work24 목록/상세 데이터에는 `주야구분`, `주말여부`, `훈련시간` 같은 보조 정보가 있고, 날짜 기간만으로 `풀타임/파트타임`을 단정하면 오분류 위험이 컸다.
- `/programs` read model rows had empty participation display fields, so the table no longer showed participation time information.
- The Work24 detail parser could extract useful fields but needed guardrails before broad apply because some pages produced malformed values such as `일, 총 0시간 시간표 보기` or mislabeled contacts.

## Applied behavior
- Participation classification no longer uses start/end date span alone.
- Explicit `풀타임/파트타임`, clear time ranges, `야간/저녁`, `주말`, short exact time spans, and total training hours are used conservatively.
- Work24 detail backfill can be limited with `scripts/program_backfill.py --source-family work24`.
- `scripts/refresh_program_list_index.py` now loads `backend/.env` and emits JSON on failure.
- New SQL migration adds conservative participation helper functions and a `program_list_index` trigger that fills participation display fields during future refreshes.

## Operational results
- Current Work24 candidates: `reports/programs-work24-participation-backfill-current-apply.json`
  - candidate_count: 80
  - applied_count: 80
- Default browse pool: `reports/programs-work24-browse-pool-participation-backfill-apply.json`
  - candidate_count: 300
  - program_applied_count: 297
  - read_model_patched_count: 300
- Post-check for `program_list_index browse_rank <= 300`:
  - pool_count: 300
  - missing participation display: 0
  - detail_count: 300

## Preserved behaviors
- Existing `/programs` response fields and frontend rendering contract are unchanged.
- Existing cost, category, recommendation, pagination, and bookmark behavior was not touched.
- `풀타임/파트타임` filters still accept the same API values, but fewer rows are classified without strong evidence.

## Risks / possible regressions
- Full `refresh_program_list_index(300)` still fails in the current operating DB with `canceling statement due to statement timeout`; see `reports/programs-work24-participation-read-model-refresh.json`.
- Until `20260423203000_conservative_program_participation_display.sql` is applied in the DB, future broad refreshes may not automatically use the new trigger/function behavior.
- Some Work24 rows only expose total training hours, so they display details such as `총 23시간` rather than a `풀타임/파트타임` tag.

## Follow-up refactoring candidates
- Extract the direct read-model participation patch used during this operation into a reusable script command.
- Optimize or split `refresh_program_list_index(pool_limit)` so a full 300-row refresh no longer hits statement timeout.
- Add a Work24 schedule popup/detail parser if exact daily time ranges are required beyond total training hours.

## Verification
- Passed: `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py backend\rag\collector\work24_detail_parser.py scripts\program_backfill.py scripts\refresh_program_list_index.py`
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py backend\tests\test_program_backfill.py -q` (`115 passed`)
- Passed: `git diff --check` for touched code/test/doc/migration paths.
