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


def _exception_detail(exc: Exception) -> str:
    return str(getattr(exc, "detail", None) or str(exc) or repr(exc))


async def _refresh_rpc(function_name: str, pool_limit: int) -> object:
    result = await request_supabase(
        method="POST",
        path=f"/rest/v1/rpc/{function_name}",
        payload={"pool_limit": pool_limit},
    )
    return result


async def refresh(pool_limit: int, *, fallback_to_browse: bool = True, browse_only: bool = False) -> dict[str, object]:
    if browse_only:
        result = await _refresh_rpc("refresh_program_list_browse_pool", pool_limit)
        return {
            "pool_limit": pool_limit,
            "status": "browse_fallback_only",
            "affected_rows": result,
        }

    try:
        result = await _refresh_rpc("refresh_program_list_index", pool_limit)
    except Exception as exc:
        if not fallback_to_browse:
            raise
        full_refresh_error = _exception_detail(exc)
        fallback_result = await _refresh_rpc("refresh_program_list_browse_pool", pool_limit)
        return {
            "pool_limit": pool_limit,
            "status": "browse_fallback",
            "full_refresh_error": full_refresh_error,
            "affected_rows": fallback_result,
        }

    return {
        "pool_limit": pool_limit,
        "status": "full_refresh",
        "affected_rows": result,
    }


def main() -> int:
    load_backend_env()
    parser = argparse.ArgumentParser(description="Refresh the programs list read model and browse facet snapshot.")
    parser.add_argument("--pool-limit", type=int, default=int(os.getenv("PROGRAM_BROWSE_POOL_LIMIT", "300")))
    parser.add_argument(
        "--no-fallback",
        action="store_true",
        help="Do not fall back to the bounded browse-pool refresh RPC when the full refresh fails.",
    )
    parser.add_argument(
        "--browse-only",
        action="store_true",
        help="Skip the full refresh and call only refresh_program_list_browse_pool.",
    )
    args = parser.parse_args()
    try:
        report = asyncio.run(
            refresh(
                args.pool_limit,
                fallback_to_browse=not args.no_fallback,
                browse_only=args.browse_only,
            )
        )
    except Exception as exc:
        detail = _exception_detail(exc)
        print(
            json.dumps(
                {
                    "pool_limit": args.pool_limit,
                    "status": "failed",
                    "status_code": getattr(exc, "status_code", None),
                    "error": detail,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
