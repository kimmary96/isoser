# TASK-2026-04-20-1730-assistant-preview-harness Result

## Changed Files

- `backend/main.py`
- `backend/routers/assistant.py`
- `backend/tests/test_assistant_router.py`
- `backend/tests/test_ai_smoke.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/api/preview/assistant/route.ts`
- `frontend/app/preview/page.tsx`
- `frontend/app/preview/assistant/page.tsx`
- `frontend/app/preview/assistant/assistant-preview-client.tsx`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `docs/recommendation/ai-harness-plan.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made

- add a minimal unified assistant route that reuses the existing coach and recommendation implementations
- provide a fast local preview path for chatbot and recommendation work without dashboard login
- add executable smoke coverage for the assistant path and keep existing recommendation calendar tests aligned with the current contract
- restore the dashboard calendar function/type aliases needed for a clean frontend production build

## Preserved Behaviors

- `/coach/feedback` remains the existing coaching implementation
- `/programs/recommend` remains the existing recommendation implementation
- `/programs/recommend/calendar` remains the existing calendar recommendation implementation
- signed-in dashboard flows were not rewritten
- preview traffic stays separate from dashboard BFF traffic

## Risks / Possible Regressions

- assistant intent routing is heuristic and can misclassify borderline messages
- preview requests are anonymous, so they do not prove signed-in coach-session persistence or personalized recommendation cache behavior
- the new assistant entry point is not yet wired into the dashboard activity and cover-letter UX

## Follow-up Refactoring Candidates

- replace keyword routing with a stricter intent contract or model-backed classifier once the assistant surface becomes production-facing
- unify dashboard activity and cover-letter coaching entry points with the assistant route if product direction holds
- add browser-level verification for the preview page or a signed-in dashboard assistant flow

## Verification

- `.\backend\.venv310\Scripts\python.exe -m pytest backend\tests\test_assistant_router.py backend\tests\test_ai_smoke.py -q`
  - `8 passed`
- `.\backend\.venv310\Scripts\python.exe -m pytest backend\tests\test_programs_router.py backend\tests\test_coach_e2e.py backend\tests\test_coach_sessions_api.py -q`
  - `37 passed`
- `cmd /c npm run build` in `frontend`
  - `next build` passed
