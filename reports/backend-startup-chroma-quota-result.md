# Backend Startup Chroma Quota Result

## Changed files
- `backend/main.py`
- `backend/rag/chroma_client.py`
- `backend/tests/test_chroma_client.py`
- `backend/tests/test_main_chroma_startup.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- Local backend startup was blocked by Chroma seed insertion in `CHROMA_MODE=ephemeral`.
- Ephemeral Chroma starts empty on every process start, so startup seed attempted Gemini embedding calls each time.
- When Gemini embedding quota was exhausted, each batch waited through retry delays before local fallback, causing long startup and repeated delays during `uvicorn --reload`.

## Preserved behaviors
- Persistent Chroma still seeds on startup by default.
- `ISOSER_SKIP_CHROMA_INIT` still disables startup Chroma initialization.
- Chroma search/sync still uses Gemini embeddings when quota is available.
- Existing local deterministic embedding fallback remains the failure path for quota exhaustion.

## Risks / possible regressions
- In `CHROMA_MODE=ephemeral`, local startup no longer preloads seed collections unless `ISOSER_CHROMA_SEED_ON_STARTUP=true` is set.
- Coach/RAG quality in ephemeral development mode may be lower until collections are seeded manually or startup seed is explicitly enabled.
- After one process-local 429, the process keeps using local fallback until restart to avoid repeated quota retries.

## Follow-up refactoring candidates
- Add a dedicated Chroma seed CLI/runbook for local development that makes the seed/no-seed choice explicit.
- Add configurable retry count/delay env vars for embedding calls.
- Consider separating health collection checks from lazy collection initialization.

## Verification
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_chroma_client.py backend/tests/test_main_chroma_startup.py -q` passed: 10 passed.
- Started `uvicorn main:app --host 127.0.0.1 --port 8010` and verified `GET /health` returned 200 without Gemini embedding HTTP calls or 429 retry logs.
