from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from utils.supabase_admin import request_supabase  # noqa: E402


LEGACY_FULL_REFRESH_RPC = "refresh_program_list_index"
DELTA_REFRESH_RPC = "refresh_program_list_delta"
BROWSE_REFRESH_RPC = "refresh_program_list_browse_pool"
RETRYABLE_REFRESH_ERROR_TOKENS = (
    "canceling statement due to statement timeout",
    "deadlock detected",
    "lock not available",
    "could not obtain lock",
    "program list refresh delta already running",
)


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


async def _call_rpc(function_name: str, payload: dict[str, object]) -> object:
    result = await request_supabase(
        method="POST",
        path=f"/rest/v1/rpc/{function_name}",
        payload=payload,
    )
    return result


def _elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000, 2)


def _coerce_int_result(result: object) -> int:
    if isinstance(result, bool):
        return int(result)
    if isinstance(result, int):
        return result
    if isinstance(result, float):
        return int(result)
    if isinstance(result, str):
        try:
            return int(result)
        except ValueError:
            return 0
    return 0


def _is_retryable_refresh_error(detail: str) -> bool:
    lowered = detail.lower()
    return any(token in lowered for token in RETRYABLE_REFRESH_ERROR_TOKENS)


async def _run_rpc_stage(
    function_name: str,
    payload: dict[str, object],
    *,
    attempt: int | None = None,
) -> tuple[bool, object | None, dict[str, object]]:
    started_at = time.perf_counter()
    stage: dict[str, object] = {
        "function": function_name,
    }
    if attempt is not None:
        stage["attempt"] = attempt

    try:
        result = await _call_rpc(function_name, payload)
    except Exception as exc:
        stage.update(
            {
                "status": "failed",
                "elapsed_ms": _elapsed_ms(started_at),
                "status_code": getattr(exc, "status_code", None),
                "error": _exception_detail(exc),
            }
        )
        return False, None, stage

    stage.update(
        {
            "status": "succeeded",
            "elapsed_ms": _elapsed_ms(started_at),
        }
    )
    return True, result, stage


async def _run_delta_refresh_batches(
    *,
    batch_limit: int,
    max_batches: int,
) -> tuple[bool, int, list[dict[str, object]], str | None]:
    effective_batch_limit = max(1, batch_limit)
    effective_max_batches = max(1, max_batches)
    stages: list[dict[str, object]] = []
    total_affected = 0

    for attempt in range(1, effective_max_batches + 1):
        succeeded, result, stage = await _run_rpc_stage(
            DELTA_REFRESH_RPC,
            {"batch_limit": effective_batch_limit},
            attempt=attempt,
        )
        stage["batch_limit"] = effective_batch_limit
        stages.append(stage)
        if not succeeded:
            return False, total_affected, stages, str(stage.get("error") or "")

        affected = _coerce_int_result(result)
        stage["affected_rows"] = affected
        total_affected += affected
        if affected < effective_batch_limit:
            break

    return True, total_affected, stages, None


async def _run_browse_refresh_with_retries(
    pool_limit: int,
    *,
    max_attempts: int,
    retry_delay_seconds: float,
) -> tuple[bool, object | None, list[dict[str, object]], str | None]:
    attempts = max(1, max_attempts)
    delay = max(0.0, retry_delay_seconds)
    stages: list[dict[str, object]] = []
    last_error: str | None = None

    for attempt in range(1, attempts + 1):
        succeeded, result, stage = await _run_rpc_stage(
            BROWSE_REFRESH_RPC,
            {"pool_limit": pool_limit},
            attempt=attempt,
        )
        stages.append(stage)
        if succeeded:
            return True, result, stages, None

        last_error = str(stage.get("error") or "")
        if attempt >= attempts or not _is_retryable_refresh_error(last_error):
            break
        if delay > 0:
            await asyncio.sleep(delay)

    return False, None, stages, last_error


async def refresh(
    pool_limit: int,
    *,
    fallback_to_browse: bool = True,
    browse_only: bool = False,
    fallback_attempts: int = 3,
    retry_delay_seconds: float = 2.0,
    delta_batch_limit: int = 500,
    max_delta_batches: int = 20,
    legacy_full_refresh: bool = False,
) -> dict[str, object]:
    started_at = time.perf_counter()
    stages: list[dict[str, object]] = []

    if browse_only:
        succeeded, result, browse_stages, browse_error = await _run_browse_refresh_with_retries(
            pool_limit,
            max_attempts=fallback_attempts,
            retry_delay_seconds=retry_delay_seconds,
        )
        stages.extend(browse_stages)
        if not succeeded:
            return {
                "pool_limit": pool_limit,
                "status": "failed",
                "error": browse_error,
                "fallback_attempts": len(browse_stages),
                "elapsed_ms": _elapsed_ms(started_at),
                "stages": stages,
            }
        return {
            "pool_limit": pool_limit,
            "status": "browse_fallback_only",
            "affected_rows": result,
            "fallback_attempts": len(browse_stages),
            "elapsed_ms": _elapsed_ms(started_at),
            "stages": stages,
        }

    if not legacy_full_refresh:
        delta_succeeded, delta_affected, delta_stages, delta_error = await _run_delta_refresh_batches(
            batch_limit=delta_batch_limit,
            max_batches=max_delta_batches,
        )
        stages.extend(delta_stages)
        if not delta_succeeded:
            if not fallback_to_browse:
                return {
                    "pool_limit": pool_limit,
                    "status": "failed",
                    "delta_refresh_error": delta_error,
                    "delta_synced_rows": delta_affected,
                    "delta_batches": len(delta_stages),
                    "elapsed_ms": _elapsed_ms(started_at),
                    "stages": stages,
                }

            fallback_succeeded, fallback_result, browse_stages, fallback_error = await _run_browse_refresh_with_retries(
                pool_limit,
                max_attempts=fallback_attempts,
                retry_delay_seconds=retry_delay_seconds,
            )
            stages.extend(browse_stages)
            if not fallback_succeeded:
                return {
                    "pool_limit": pool_limit,
                    "status": "failed",
                    "delta_refresh_error": delta_error,
                    "fallback_error": fallback_error,
                    "delta_synced_rows": delta_affected,
                    "delta_batches": len(delta_stages),
                    "fallback_attempts": len(browse_stages),
                    "elapsed_ms": _elapsed_ms(started_at),
                    "stages": stages,
                }
            return {
                "pool_limit": pool_limit,
                "status": "browse_fallback",
                "delta_refresh_error": delta_error,
                "delta_synced_rows": delta_affected,
                "delta_batches": len(delta_stages),
                "affected_rows": fallback_result,
                "fallback_attempts": len(browse_stages),
                "elapsed_ms": _elapsed_ms(started_at),
                "stages": stages,
            }

        browse_succeeded, browse_result, browse_stages, browse_error = await _run_browse_refresh_with_retries(
            pool_limit,
            max_attempts=fallback_attempts,
            retry_delay_seconds=retry_delay_seconds,
        )
        stages.extend(browse_stages)
        if not browse_succeeded:
            return {
                "pool_limit": pool_limit,
                "status": "failed",
                "delta_synced_rows": delta_affected,
                "delta_batches": len(delta_stages),
                "fallback_error": browse_error,
                "fallback_attempts": len(browse_stages),
                "elapsed_ms": _elapsed_ms(started_at),
                "stages": stages,
            }
        return {
            "pool_limit": pool_limit,
            "status": "incremental_refresh",
            "delta_synced_rows": delta_affected,
            "delta_batches": len(delta_stages),
            "affected_rows": browse_result,
            "fallback_attempts": len(browse_stages),
            "elapsed_ms": _elapsed_ms(started_at),
            "stages": stages,
        }

    succeeded, result, full_stage = await _run_rpc_stage(
        LEGACY_FULL_REFRESH_RPC,
        {"pool_limit": pool_limit},
    )
    stages.append(full_stage)
    if not succeeded:
        full_refresh_error = str(full_stage.get("error") or "")
        if not fallback_to_browse:
            return {
                "pool_limit": pool_limit,
                "status": "failed",
                "error": full_refresh_error,
                "elapsed_ms": _elapsed_ms(started_at),
                "stages": stages,
            }

        fallback_succeeded, fallback_result, browse_stages, fallback_error = await _run_browse_refresh_with_retries(
            pool_limit,
            max_attempts=fallback_attempts,
            retry_delay_seconds=retry_delay_seconds,
        )
        stages.extend(browse_stages)
        if not fallback_succeeded:
            return {
                "pool_limit": pool_limit,
                "status": "failed",
                "full_refresh_error": full_refresh_error,
                "fallback_error": fallback_error,
                "fallback_attempts": len(browse_stages),
                "elapsed_ms": _elapsed_ms(started_at),
                "stages": stages,
            }
        return {
            "pool_limit": pool_limit,
            "status": "browse_fallback",
            "full_refresh_error": full_refresh_error,
            "affected_rows": fallback_result,
            "fallback_attempts": len(browse_stages),
            "elapsed_ms": _elapsed_ms(started_at),
            "stages": stages,
        }

    return {
        "pool_limit": pool_limit,
        "status": "full_refresh",
        "affected_rows": result,
        "fallback_attempts": 0,
        "elapsed_ms": _elapsed_ms(started_at),
        "stages": stages,
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
    parser.add_argument(
        "--fallback-attempts",
        type=int,
        default=3,
        help="Maximum browse-pool fallback attempts for retryable timeout, deadlock, or lock errors.",
    )
    parser.add_argument(
        "--retry-delay-seconds",
        type=float,
        default=2.0,
        help="Delay between retryable browse-pool fallback attempts.",
    )
    parser.add_argument(
        "--delta-batch-limit",
        type=int,
        default=500,
        help="Maximum programs rows to sync per refresh_program_list_delta RPC call.",
    )
    parser.add_argument(
        "--max-delta-batches",
        type=int,
        default=20,
        help="Maximum refresh_program_list_delta batches to run before refreshing the browse pool.",
    )
    parser.add_argument(
        "--legacy-full-refresh",
        action="store_true",
        help="Use the legacy single refresh_program_list_index RPC before falling back to the browse-pool refresh.",
    )
    args = parser.parse_args()
    try:
        report = asyncio.run(
            refresh(
                args.pool_limit,
                fallback_to_browse=not args.no_fallback,
                browse_only=args.browse_only,
                fallback_attempts=args.fallback_attempts,
                retry_delay_seconds=args.retry_delay_seconds,
                delta_batch_limit=args.delta_batch_limit,
                max_delta_batches=args.max_delta_batches,
                legacy_full_refresh=args.legacy_full_refresh,
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
    if report.get("status") == "failed":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
