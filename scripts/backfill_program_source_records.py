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


SOURCE_RECORDS_SAMPLE_BACKFILL_RPC = "backfill_program_source_records_sample"
RETRYABLE_SOURCE_RECORDS_ERROR_TOKENS = (
    "canceling statement due to statement timeout",
    "deadlock detected",
    "lock not available",
    "could not obtain lock",
    "program source records sample backfill already running",
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
    return await request_supabase(
        method="POST",
        path=f"/rest/v1/rpc/{function_name}",
        payload=payload,
    )


def _elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000, 2)


def _is_retryable_source_records_error(detail: str) -> bool:
    lowered = detail.lower()
    return any(token in lowered for token in RETRYABLE_SOURCE_RECORDS_ERROR_TOKENS)


def _coerce_json_result(result: object) -> dict[str, object]:
    if isinstance(result, dict):
        return result
    if isinstance(result, str):
        try:
            parsed = json.loads(result)
        except json.JSONDecodeError:
            return {"raw_result": result}
        if isinstance(parsed, dict):
            return parsed
        return {"raw_result": parsed}
    return {"raw_result": result}


def _build_attempt_payloads(
    *,
    batch_limit: int,
    max_rows: int,
    min_batch_limit: int,
) -> list[dict[str, int]]:
    requested_batch_limit = max(1, batch_limit)
    requested_max_rows = max(1, max_rows)
    effective_min_batch_limit = max(1, min_batch_limit)

    attempts: list[dict[str, int]] = []
    seen: set[tuple[int, int]] = set()

    def add_attempt(candidate_batch_limit: int, candidate_max_rows: int) -> None:
        normalized = (
            max(1, candidate_batch_limit),
            max(1, candidate_max_rows),
        )
        if normalized in seen:
            return
        seen.add(normalized)
        attempts.append(
            {
                "batch_limit": normalized[0],
                "max_rows": normalized[1],
            }
        )

    add_attempt(requested_batch_limit, requested_max_rows)

    current_batch_limit = requested_batch_limit
    while current_batch_limit > effective_min_batch_limit:
        next_batch_limit = max(effective_min_batch_limit, current_batch_limit // 2)
        next_max_rows = min(requested_max_rows, next_batch_limit)
        add_attempt(next_batch_limit, next_max_rows)
        if next_batch_limit == effective_min_batch_limit:
            break
        current_batch_limit = next_batch_limit

    return attempts


async def backfill_sample(
    *,
    batch_limit: int,
    max_rows: int,
    min_batch_limit: int = 10,
) -> dict[str, object]:
    started_at = time.perf_counter()
    attempt_payloads = _build_attempt_payloads(
        batch_limit=batch_limit,
        max_rows=max_rows,
        min_batch_limit=min_batch_limit,
    )
    stages: list[dict[str, object]] = []
    last_error: str | None = None

    for attempt_number, payload in enumerate(attempt_payloads, start=1):
        attempt_started_at = time.perf_counter()
        stage: dict[str, object] = {
            "function": SOURCE_RECORDS_SAMPLE_BACKFILL_RPC,
            "attempt": attempt_number,
            "payload": payload,
        }

        try:
            result = await _call_rpc(SOURCE_RECORDS_SAMPLE_BACKFILL_RPC, payload)
        except Exception as exc:
            error_detail = _exception_detail(exc)
            stage.update(
                {
                    "status": "failed",
                    "elapsed_ms": _elapsed_ms(attempt_started_at),
                    "status_code": getattr(exc, "status_code", None),
                    "error": error_detail,
                }
            )
            stages.append(stage)
            last_error = error_detail
            if attempt_number < len(attempt_payloads) and _is_retryable_source_records_error(error_detail):
                continue
            return {
                "status": "failed",
                "batch_limit": attempt_payloads[0]["batch_limit"],
                "max_rows": attempt_payloads[0]["max_rows"],
                "error": error_detail,
                "elapsed_ms": _elapsed_ms(started_at),
                "stages": stages,
            }

        parsed = _coerce_json_result(result)
        stage.update(
            {
                "status": "succeeded",
                "elapsed_ms": _elapsed_ms(attempt_started_at),
                "result": parsed,
            }
        )
        stages.append(stage)
        return {
            "status": "sample_backfill",
            "batch_limit": attempt_payloads[0]["batch_limit"],
            "max_rows": attempt_payloads[0]["max_rows"],
            "effective_batch_limit": payload["batch_limit"],
            "effective_max_rows": payload["max_rows"],
            "attempt_count": attempt_number,
            "used_fallback_batch": attempt_number > 1,
            "affected_rows": parsed.get("remaining_rows", parsed.get("upserted_rows", 0)),
            "sample_result": parsed,
            "elapsed_ms": _elapsed_ms(started_at),
            "stages": stages,
        }

    return {
        "status": "failed",
        "batch_limit": attempt_payloads[0]["batch_limit"],
        "max_rows": attempt_payloads[0]["max_rows"],
        "error": last_error or "source-records sample backfill failed without an error detail",
        "elapsed_ms": _elapsed_ms(started_at),
        "stages": stages,
    }


def main() -> int:
    load_backend_env()
    parser = argparse.ArgumentParser(
        description="Backfill a bounded sample of program_source_records for free-plan-safe provenance validation."
    )
    parser.add_argument(
        "--batch-limit",
        type=int,
        default=50,
        help="Maximum programs rows to sample for the source-record backfill.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        help="Maximum program_source_records rows to keep after trimming. Defaults to --batch-limit.",
    )
    parser.add_argument(
        "--fallback-min-batch-limit",
        type=int,
        default=10,
        help="Smallest batch_limit/max_rows fallback to try when a retryable timeout or lock error occurs.",
    )
    args = parser.parse_args()

    effective_max_rows = args.max_rows if args.max_rows is not None else args.batch_limit

    try:
        report = asyncio.run(
            backfill_sample(
                batch_limit=args.batch_limit,
                max_rows=effective_max_rows,
                min_batch_limit=args.fallback_min_batch_limit,
            )
        )
    except Exception as exc:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "batch_limit": args.batch_limit,
                    "max_rows": effective_max_rows,
                    "fallback_min_batch_limit": args.fallback_min_batch_limit,
                    "status_code": getattr(exc, "status_code", None),
                    "error": _exception_detail(exc),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report.get("status") == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())
