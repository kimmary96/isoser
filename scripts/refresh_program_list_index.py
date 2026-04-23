from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from utils.supabase_admin import request_supabase  # noqa: E402


def load_backend_env() -> None:
    env_path = BACKEND / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", maxsplit=1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


async def refresh(pool_limit: int) -> dict[str, object]:
    result = await request_supabase(
        method="POST",
        path="/rest/v1/rpc/refresh_program_list_index",
        payload={"pool_limit": pool_limit},
    )
    return {
        "pool_limit": pool_limit,
        "affected_rows": result,
    }


def main() -> int:
    load_backend_env()
    parser = argparse.ArgumentParser(description="Refresh the programs list read model and browse facet snapshot.")
    parser.add_argument("--pool-limit", type=int, default=int(os.getenv("PROGRAM_BROWSE_POOL_LIMIT", "300")))
    args = parser.parse_args()
    report = asyncio.run(refresh(args.pool_limit))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
