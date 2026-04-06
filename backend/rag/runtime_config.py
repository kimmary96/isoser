from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CHROMA_PERSIST_DIR = "./chroma_store"
DEFAULT_CHROMA_MODE = "persistent"


def load_backend_dotenv() -> Path:
    """Load backend/.env so local scripts and app startup share the same config."""
    dotenv_path = BACKEND_DIR / ".env"
    load_dotenv(dotenv_path=dotenv_path, override=False)
    return dotenv_path


def resolve_backend_path(raw_value: str | None, default_relative_path: str) -> Path:
    """Resolve relative env paths from the backend directory instead of the caller cwd."""
    candidate = (raw_value or default_relative_path).strip()
    path = Path(candidate)
    if not path.is_absolute():
        path = (BACKEND_DIR / path).resolve()
    return path


def resolve_chroma_persist_dir() -> Path:
    """Resolve and create the local Chroma persistence directory."""
    persist_dir = resolve_backend_path(
        os.getenv("CHROMA_PERSIST_DIR"),
        DEFAULT_CHROMA_PERSIST_DIR,
    )
    persist_dir.mkdir(parents=True, exist_ok=True)
    return persist_dir


def resolve_chroma_mode() -> str:
    """Resolve the Chroma client mode from env."""

    mode = (os.getenv("CHROMA_MODE") or DEFAULT_CHROMA_MODE).strip().lower()
    if mode not in {"persistent", "ephemeral"}:
        return DEFAULT_CHROMA_MODE
    return mode
