"""Repository-root ASGI entrypoint for local Uvicorn runs.

Allows `uvicorn main:app` from the repository root by adding the backend
directory to `sys.path` before importing the real FastAPI app.
"""

from __future__ import annotations

import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.main import app

