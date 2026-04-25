# Backend Development

## Canonical local environment

- Python version: `3.10.x`
- Canonical virtual environment path: `backend/venv`
- This repository does not treat root `.venv` as the backend standard path.

## Setup

```powershell
py -3.10 -m venv backend/venv
.\backend\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

## Recommended checks

```powershell
.\scripts\run-backend-checks.ps1
.\scripts\run-backend-checks.ps1 -Full
```

Default check scope:
- `python -m py_compile backend/routers/programs.py backend/services/program_list_filters.py backend/services/program_list_queries.py backend/schemas/programs.py scripts/refresh_program_list_index.py`
- `pytest backend/tests/test_programs_router.py backend/tests/test_program_list_api_examples.py -q`

Full check scope:
- `pytest backend/tests -q`

## Notes

- Program list/search/filter pure helpers now live in `backend/services/program_list_filters.py`.
- Browse fallback query builder helpers now live in `backend/services/program_list_queries.py`.
- Public API contracts still remain in `backend/schemas/programs.py`.
- `backend/routers/programs.py` should focus on route orchestration and Supabase I/O, not large pure helper blocks.
- If local `127.0.0.1:8000` or `8001` backend listeners look stale, run `.\scripts\repair-local-backend.ps1 -Fix` before restarting `uvicorn`. Add `-StartFresh` to spawn a clean `main:app` process on the preferred port after stale listeners are cleared.
