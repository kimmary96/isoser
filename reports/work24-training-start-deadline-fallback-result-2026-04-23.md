# Work24 Training Start Deadline Fallback Result

## Changed Files
- `backend/rag/collector/hrd_collector.py`
- `backend/rag/collector/program_field_mapping.py`
- `backend/rag/source_adapters/work24_training.py`
- `backend/routers/admin.py`
- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `scripts/program_backfill.py`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/data/work24-training-sync.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- Work24 training list rows do not provide a separate application deadline field.
- `traEndDate` is a training end date and should not be used as a recruitment deadline.
- `traStartDate` is now preserved as a conservative deadline fallback with `compare_meta.deadline_source=traStartDate`.

## Preserved Behaviors
- Existing Work24 rows where `deadline=end_date` remains treated as untrusted unless a training-start marker exists.
- Explicit `close_date` or application/recruitment deadline metadata still takes priority.
- Existing K-Startup and non-Work24 deadline behavior is unchanged.

## Risks / Possible Regressions
- Some Work24 programs may close before `traStartDate` if the source site has an unstated earlier application cutoff.
- Existing rows need backfill or resync to receive `deadline_source=traStartDate`.

## Follow-Up Refactoring Candidates
- Centralize Work24 deadline marker handling in one shared helper.
- Add an operational audit for Work24 rows missing `deadline_source` after resync.
