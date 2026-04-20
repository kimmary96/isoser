# Supervisor Verification: TASK-2026-04-20-1501-recommend-calendar-rerank-recovery

## Verification Summary

- `AGENTS.md` was read first and the task packet frontmatter is complete.
- Current `HEAD` is still `b994efe8e9ba084b7a73e601bec0a3e7a8b7872f`, matching `planned_against_commit`, so no implementation-area drift was found.
- The implementation matches the inspection handoff in the directly relevant area:
  - `backend/rag/programs_rag.py` now centralizes the recommendation formula and uses `0.6 / 0.4` in both fallback and main recommendation paths.
  - `backend/routers/programs.py` adds `GET /programs/recommend/calendar`, recalculates cached `final_score`, treats missing component scores as stale, keeps calendar-only expiry filtering and `final_score desc, deadline asc` ordering isolated to the calendar path, and preserves anonymous calendar responses with `relevance_score = 0`.
  - `frontend/app/api/dashboard/recommend-calendar/route.ts`, `frontend/lib/api/app.ts`, and `frontend/lib/types/index.ts` add the expected calendar BFF, helper, and response types.
  - `docs/current-state.md` and `docs/refactoring-log.md` include task-scoped notes for the recovered ranking and calendar contract.

## Checks Reviewed

- Recorded backend check rerun successfully:
  - `backend/venv/Scripts/python.exe -m pytest backend/tests/test_programs_router.py`
  - Result: `10 passed`
- The recorded frontend typecheck command in the result report is not executable from the `frontend` working directory as written (`frontend/node_modules/.bin/tsc.cmd --noEmit`), but the equivalent valid command was rerun successfully:
  - `.\node_modules\.bin\tsc.cmd --noEmit`
  - Result: pass
- Coverage reviewed from code and tests:
  - recovered `0.6 / 0.4` score formula
  - stale-cache detection and recompute path
  - cached-row `final_score` recalculation
  - anonymous calendar response contract
  - calendar sorting and expired-program exclusion

## Result Report Consistency

- The result report's changed-file list matches the task-scoped implementation changes present in the worktree.
- The reported behavior changes match the code:
  - cache reads no longer trust stored `final_score`
  - stale cache rows with missing component scores fall back to fresh recommendation generation
  - the calendar backend/BFF contract is `{ items: [...] }`
  - calendar-only expiry filtering and ordering are implemented
- The preserved-behavior statements are consistent with the current code:
  - `POST /programs/recommend` still returns `ProgramRecommendResponse`
  - `frontend/app/api/dashboard/recommended-programs/route.ts` was not altered
- One check-recording nuance remains:
  - the frontend typecheck recorded in the result report needed an equivalent corrected invocation during verification

## Residual Risks

- `backend/tests/test_programs_router.py` covers router helpers and endpoint behavior well for this task, but there is still no dedicated frontend test around the new BFF route beyond successful typechecking.
- `docs/current-state.md` and `docs/refactoring-log.md` had unrelated local edits in the wider worktree; the task-scoped documentation additions are present, but future merges still need care.
- `d_day_label` for missing deadlines remains `"정보 없음"`, which is consistent with the implementation but broader UI consumers may still require explicit confirmation if they expect only `마감` / `D-Day` / `D-{n}` labels.

## Final Verdict

- verdict: pass
