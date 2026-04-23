from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for path in (REPO_ROOT, BACKEND_ROOT):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from backend.rag.collector.quality_validator import (  # noqa: E402
    summarize_program_quality,
    validate_program_row,
)


PROGRAM_SELECT_FIELDS = ",".join(
    (
        "id",
        "title",
        "source",
        "source_unique_key",
        "deadline",
        "start_date",
        "end_date",
        "provider",
        "location",
        "region",
        "source_url",
        "link",
        "cost",
        "subsidy_amount",
        "compare_meta",
    )
)


def load_backend_env() -> None:
    env_path = BACKEND_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", maxsplit=1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def configure_stdout() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        return


def fetch_program_rows(*, limit: int, source_query: str | None = None) -> list[dict[str, Any]]:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.")

    params = {
        "select": PROGRAM_SELECT_FIELDS,
        "limit": str(limit),
    }
    if source_query:
        params["source"] = f"ilike.*{_sanitize_ilike_value(source_query)}*"

    response = requests.get(
        f"{supabase_url}/rest/v1/programs",
        params=params,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, list) else []


def build_quality_report(
    rows: list[dict[str, Any]],
    *,
    sample_limit: int = 20,
) -> dict[str, Any]:
    row_reports = [validate_program_row(row) for row in rows]
    issue_samples: list[dict[str, Any]] = []
    for row, row_report in zip(rows, row_reports):
        if not row_report.issues:
            continue
        issue_samples.append(
            {
                "id": row.get("id"),
                "title": row_report.title,
                "source": row_report.source,
                "issues": [asdict(issue) for issue in row_report.issues],
            }
        )
        if len(issue_samples) >= sample_limit:
            break

    return {
        "mode": "read-only",
        "row_count": len(rows),
        "quality": summarize_program_quality(rows),
        "issue_samples": issue_samples,
    }


def write_report(report: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a read-only quality report for normalized program rows stored in Supabase."
    )
    parser.add_argument("--limit", type=int, default=100, help="Maximum DB rows to inspect.")
    parser.add_argument("--source-query", help="Optional source ilike filter, e.g. work24 or K-Startup.")
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=20,
        help="Maximum rows with issues to include as samples.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "reports" / "program-quality-report.json",
        help="JSON report path.",
    )
    return parser


def main() -> int:
    configure_stdout()
    load_backend_env()
    args = build_parser().parse_args()
    rows = fetch_program_rows(limit=args.limit, source_query=args.source_query)
    report = build_quality_report(rows, sample_limit=args.sample_limit)
    write_report(report, args.output)
    print(f"Wrote quality report: {args.output}")
    print(json.dumps(report["quality"], ensure_ascii=False, sort_keys=True))
    return 0


def _sanitize_ilike_value(value: str) -> str:
    return value.replace("*", "").strip()


if __name__ == "__main__":
    raise SystemExit(main())
