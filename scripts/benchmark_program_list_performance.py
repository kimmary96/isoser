from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from routers import programs  # noqa: E402


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


def summarize_response(response: Any) -> dict[str, Any]:
    if hasattr(response, "model_dump"):
        data = response.model_dump()
    elif isinstance(response, list):
        data = {"items": response}
    else:
        data = response if isinstance(response, dict) else {"value": str(type(response).__name__)}

    items = data.get("items") if isinstance(data, dict) else None
    promoted_items = data.get("promoted_items") if isinstance(data, dict) else None
    return {
        "item_count": len(items) if isinstance(items, list) else None,
        "promoted_count": len(promoted_items) if isinstance(promoted_items, list) else 0,
        "count": data.get("count") if isinstance(data, dict) else None,
        "mode": data.get("mode") if isinstance(data, dict) else None,
        "source": data.get("source") if isinstance(data, dict) else None,
        "cache_hit": data.get("cache_hit") if isinstance(data, dict) else None,
    }


async def measure(
    name: str,
    runs: int,
    action: Callable[[], Awaitable[Any]],
) -> dict[str, Any]:
    timings: list[float] = []
    last_summary: dict[str, Any] = {}
    errors: list[str] = []
    for _ in range(runs):
        started = time.perf_counter()
        try:
            response = await action()
            elapsed_ms = (time.perf_counter() - started) * 1000
            timings.append(elapsed_ms)
            last_summary = summarize_response(response)
        except Exception as exc:  # noqa: BLE001
            elapsed_ms = (time.perf_counter() - started) * 1000
            timings.append(elapsed_ms)
            errors.append(str(exc))
            break

    result: dict[str, Any] = {
        "name": name,
        "runs": len(timings),
        "errors": errors,
        **last_summary,
    }
    if timings:
        result.update(
            {
                "min_ms": round(min(timings), 2),
                "avg_ms": round(statistics.fmean(timings), 2),
                "max_ms": round(max(timings), 2),
            }
        )
    return result


async def with_read_model(enabled: bool, action: Callable[[], Awaitable[Any]]) -> Any:
    previous = os.environ.get("ENABLE_PROGRAM_LIST_READ_MODEL")
    os.environ["ENABLE_PROGRAM_LIST_READ_MODEL"] = "true" if enabled else "false"
    try:
        return await action()
    finally:
        if previous is None:
            os.environ.pop("ENABLE_PROGRAM_LIST_READ_MODEL", None)
        else:
            os.environ["ENABLE_PROGRAM_LIST_READ_MODEL"] = previous


async def run_benchmark(runs: int, limit: int, query: str) -> dict[str, Any]:
    async def list_page(**overrides: Any) -> programs.ProgramListPageResponse:
        params = {
            "regions": None,
            "sources": None,
            "teaching_methods": None,
            "cost_types": None,
            "participation_times": None,
            "targets": None,
            "limit": limit,
            "offset": 0,
        }
        params.update(overrides)
        return await programs.list_programs_page(**params)

    async def filter_options() -> programs.ProgramFilterOptionsResponse:
        return await programs.get_program_filter_options(regions=None, teaching_methods=None)

    cases = [
        (
            "after_read_model_default_browse",
            lambda: with_read_model(True, lambda: list_page(recruiting_only=True, scope="default")),
        ),
        (
            "before_legacy_default_browse",
            lambda: with_read_model(False, lambda: list_page(recruiting_only=True, scope="default")),
        ),
        (
            "after_read_model_scope_all_search",
            lambda: with_read_model(True, lambda: list_page(q=query, scope="all", recruiting_only=True)),
        ),
        (
            "before_legacy_scope_all_search",
            lambda: with_read_model(False, lambda: list_page(q=query, scope="all", recruiting_only=True)),
        ),
        (
            "after_facet_snapshot_filter_options",
            lambda: with_read_model(True, filter_options),
        ),
        (
            "before_legacy_filter_options",
            lambda: with_read_model(False, filter_options),
        ),
    ]

    results = [await measure(name, runs, action) for name, action in cases]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "runs_per_case": runs,
        "limit": limit,
        "query": query,
        "results": results,
    }


def main() -> int:
    load_backend_env()
    parser = argparse.ArgumentParser(description="Benchmark programs list read-model paths against legacy fallback paths.")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--query", default="AI")
    parser.add_argument("--output", type=Path, default=ROOT / "reports" / "program-list-hardening-performance-20260423.json")
    args = parser.parse_args()

    report = asyncio.run(run_benchmark(max(1, args.runs), max(1, args.limit), args.query))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
