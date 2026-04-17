# TASK-2026-04-17-1510-dashboard-ai-calendar-view drift report

## Summary
- `planned_against_commit` in the task packet is `5206453`.
- Current `HEAD` is `fc27188`.
- The touched implementation area changed materially after `5206453`, so this task should be replanned against current `HEAD` before safe implementation.

## Drift evidence
- `frontend/app/dashboard/page.tsx` currently already contains an `AI 맞춤 취업 지원 캘린더` section, but its implementation shape does not match the packet's requested hook/component split and uses the older recommended-programs flow.
- `frontend/app/api/dashboard/recommend-calendar/route.ts` was added after the planned commit and now proxies `GET /recommend/calendar` using `apiOk` / `apiError`.
- `frontend/lib/api/app.ts` was extended after the planned commit with `getRecommendedCalendar(...)`.
- `frontend/lib/types/index.ts` was extended after the planned commit with `ProgramCalendarRecommendItem` and `ProgramCalendarRecommendResponse`.
- `backend/routers/programs.py` and `backend/rag/programs_rag.py` changed materially after the planned commit to support the calendar recommendation response and hybrid reranking behavior this task depends on.

## Relevant git comparison
```text
git diff --stat 5206453..HEAD -- frontend/app/dashboard frontend/app/api/dashboard/recommend-calendar frontend/lib/api/app.ts frontend/lib/types/index.ts backend/routers/programs.py backend/rag/programs_rag.py

backend/rag/programs_rag.py                        |  36 ++--
backend/routers/programs.py                        | 232 +++++++++++++++++++--
frontend/app/api/dashboard/recommend-calendar/route.ts  |  49 +++++
frontend/lib/api/app.ts                            |  15 ++
frontend/lib/types/index.ts                        |  15 ++
```

## Packet metadata check
- Required frontmatter fields are present.
- Optional `planned_files` metadata is not present.
- Optional `planned_worktree_fingerprint` metadata is not present.

## Files inspected
- `AGENTS.md`
- `tasks/running/TASK-2026-04-17-1510-dashboard-ai-calendar-view.md`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `reports/TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar-result.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why implementation was stopped
- The packet explicitly says to replace `planned_against_commit` with the latest `HEAD` before execution.
- The dependency task for calendar recommendations landed after planning and changed both the backend contract and the relevant dashboard frontend area.
- Proceeding now would mix implementation work with implicit replanning, which violates the repo rule to stop on significant drift.

## Run Metadata

- generated_at: `2026-04-17T12:41:43`
- watcher_exit_code: `0`
- codex_tokens_used: `71,973`
