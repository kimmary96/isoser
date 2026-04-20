# TASK-2026-04-20-1935-dashboard-assistant-wiring Result

## Changed Files

- `backend/routers/assistant.py`
- `backend/tests/test_assistant_router.py`
- `frontend/app/api/dashboard/activities/coach/route.ts`
- `frontend/app/api/dashboard/cover-letters/coach/route.ts`
- `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
- `frontend/app/dashboard/cover-letter/_hooks/use-cover-letter-detail.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made

- wire the real signed-in dashboard coach inputs through `/assistant/message`
- let dashboard coach surfaces force `preferred_intent="coach"` so assistant routing cannot drift into recommendation mode there
- make mixed prompt routing more conservative for generic assistant usage
- keep the existing dashboard coach UI contract by returning `coach_result` from the dashboard BFF routes

## Preserved Behaviors

- activity and cover-letter coach panels still consume `CoachFeedbackResponse`
- `/coach/feedback` remains the underlying coaching implementation
- recommendation and preview assistant routes are unchanged from a user-facing contract perspective

## Risks / Possible Regressions

- dashboard coach validation is still build-and-API-test based; there is no automated signed-in browser run in this turn
- generic assistant routing is safer than before but still deterministic, so future prompt variants may need more pattern coverage
- the legacy `/api/dashboard/activities/coach-session` path still exists even though normal activity coach sends no longer depend on it

## Follow-up Refactoring Candidates

- add an authenticated browser smoke for `/dashboard/activities/[id]` and `/dashboard/cover-letter/[id]`
- consolidate duplicated dashboard coach BFF logic into a shared helper if assistant usage expands
- decide whether the legacy activity coach-session BFF should be removed after live verification

## Verification

- `.\backend\.venv310\Scripts\python.exe -m pytest backend\tests\test_assistant_router.py backend\tests\test_ai_smoke.py backend\tests\test_programs_router.py backend\tests\test_coach_e2e.py backend\tests\test_coach_sessions_api.py -q`
  - `47 passed`
- `cmd /c npm run build` in `frontend`
  - `next build` passed
