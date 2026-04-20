# AI Harness Plan

## Goal

Provide a fast local harness for the chatbot and recommendation work so a developer can:

- hit the existing backend coach flow
- hit the existing backend recommendation flow
- hit one unified assistant entry point that routes into those flows
- verify the baseline without dashboard login

## Scope

### Backend routes

- `POST /coach/feedback`
- `POST /programs/recommend`
- `GET /programs/recommend/calendar`
- `POST /assistant/message`

### Frontend preview surface

- `POST /api/preview/assistant`
- `GET /preview/assistant`

The preview route is development-only and returns `404` in production.

## Design

### Recommendation 1: unified assistant entry point

`backend/routers/assistant.py` adds a thin orchestration layer. It does not replace the existing coach or recommendation routers.

Instead it:

1. receives one message plus optional context
2. applies deterministic keyword-based intent routing
3. calls the existing coach or recommendation route function
4. returns a plain assistant reply plus structured tool output

Current tool paths:

- `coach_feedback`
- `recommend_programs`
- `recommend_calendar`
- `clarify`

### Recommendation 2: fast harness and smoke coverage

The harness has two parts:

- manual preview: `frontend/app/preview/assistant/*`
- executable smoke tests: `backend/tests/test_ai_smoke.py`

This keeps the fast local loop simple:

1. run backend
2. run frontend
3. open `/preview/assistant`
4. send a coach or recommendation request
5. inspect structured output

## What This Preserves

- existing `/coach/feedback` contract
- existing `/programs/recommend` contract
- existing `/programs/recommend/calendar` contract
- existing signed-in dashboard flows

This harness is additive. It is not yet the production dashboard assistant UX.

## Known Limits

- intent routing is heuristic, not model-based
- preview requests are anonymous and do not represent signed-in dashboard state
- the preview surface is for development only
- offline analytics and dataset reporting are still out of scope

## Verification

### Backend tests

```powershell
.\backend\.venv310\Scripts\python.exe -m pytest `
  backend\tests\test_assistant_router.py `
  backend\tests\test_ai_smoke.py -q
```

```powershell
.\backend\.venv310\Scripts\python.exe -m pytest `
  backend\tests\test_programs_router.py `
  backend\tests\test_coach_e2e.py `
  backend\tests\test_coach_sessions_api.py -q
```

### Frontend build

```powershell
cd frontend
cmd /c npm run build
```

### Manual preview

1. run backend on `http://localhost:8000`
2. run frontend on `http://localhost:3000`
3. open `http://localhost:3000/preview/assistant`
4. test one coach message and one recommendation message
5. confirm the returned `intent`, `tool_call`, and structured payload
