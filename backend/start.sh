#!/usr/bin/env bash
set -euo pipefail

export PYTHONPATH="..:.:${PYTHONPATH:-}"

python -m backend.rag.seed
exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
