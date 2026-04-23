from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for path in (REPO_ROOT, BACKEND_ROOT):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from backend.rag.collector.kstartup_collector import KstartupApiCollector  # noqa: E402
from backend.rag.collector.normalizer import normalize  # noqa: E402
from backend.rag.collector.work24_collector import Work24Collector  # noqa: E402


TRACKED_FIELDS = (
    "title",
    "provider",
    "location",
    "description",
    "start_date",
    "end_date",
    "deadline",
    "target",
    "link",
    "source_url",
    "cost",
    "subsidy_amount",
    "compare_meta",
    "raw_data",
)

UI_FIELDS = (
    "title",
    "provider",
    "location",
    "description",
    "start_date",
    "end_date",
    "deadline",
    "source",
    "link",
    "source_url",
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


def compact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: compact(entry)
            for key, entry in value.items()
            if entry not in (None, "", [], {})
        }
    if isinstance(value, list):
        return [compact(entry) for entry in value if entry not in (None, "", [], {})]
    return value


def subset(row: dict[str, Any] | None, fields: tuple[str, ...] = TRACKED_FIELDS) -> dict[str, Any]:
    if not row:
        return {}
    return compact({field: row.get(field) for field in fields})


def build_ui_snapshot(row: dict[str, Any] | None) -> dict[str, str]:
    if not row:
        return {}
    return {
        "title": str(row.get("title") or "제목 미정"),
        "provider": str(row.get("provider") or "기관 정보 없음"),
        "location": str(row.get("location") or "지역 정보 없음"),
        "description": str(row.get("description") or row.get("summary") or "프로그램 소개가 아직 등록되지 않았습니다."),
        "period": _format_period(row.get("start_date"), row.get("end_date")),
        "deadline": str(row.get("deadline") or row.get("end_date") or "정보 없음"),
        "source": str(row.get("source") or "출처 미상"),
        "link_state": "바로가기 가능" if first_present(row, ("application_url", "source_url", "link")) else "링크 없음",
    }


def _format_period(start_date: Any, end_date: Any) -> str:
    start = str(start_date or "").strip()
    end = str(end_date or "").strip()
    if start and end:
        return f"{start} ~ {end}"
    if start:
        return f"{start} 시작"
    if end:
        return f"{end} 종료"
    return "데이터 미수집"


def first_present(row: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = row.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def compare_snapshots(
    *,
    normalized: dict[str, Any] | None,
    db_row: dict[str, Any] | None,
    api_row: dict[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    for field in TRACKED_FIELDS:
        normalized_value = normalized.get(field) if normalized else None
        db_value = db_row.get(field) if db_row else None
        api_value = api_row.get(field) if api_row else None
        values = {
            "normalized": normalized_value,
            "db": db_value,
            "api": api_value,
        }
        present_values = [json.dumps(value, ensure_ascii=False, sort_keys=True) for value in values.values() if value not in (None, "", [], {})]
        if len(set(present_values)) > 1 or any(value in (None, "", [], {}) for value in values.values()):
            results[field] = values
    return results


def fetch_db_program(program_id: str) -> dict[str, Any] | None:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.")
    response = requests.get(
        f"{supabase_url}/rest/v1/programs",
        params={"select": "*", "id": f"eq.{program_id}", "limit": "1"},
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        timeout=20,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def fetch_backend_program(program_id: str, backend_url: str) -> dict[str, Any] | None:
    response = requests.get(f"{backend_url.rstrip('/')}/programs/{program_id}", timeout=20)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, dict) else None


def collect_matching_source_row(db_row: dict[str, Any], max_pages: int) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    source = str(db_row.get("source") or "").lower()
    if "k-startup" in source:
        collector = KstartupApiCollector()
    elif "고용24" in source or "work24" in source:
        collector = Work24Collector()
    else:
        return None, None

    collector.max_pages = max_pages
    mapped_rows = collector.collect()
    for mapped in mapped_rows:
        normalized = normalize(mapped)
        if normalized and is_same_program(db_row, normalized):
            return mapped, normalized
    return None, None


def is_same_program(db_row: dict[str, Any], normalized: dict[str, Any]) -> bool:
    db_hrd_id = nested_text(db_row, ("hrd_id", "compare_meta.hrd_id"))
    normalized_hrd_id = nested_text(normalized, ("hrd_id", "compare_meta.hrd_id"))
    if db_hrd_id and normalized_hrd_id and db_hrd_id == normalized_hrd_id:
        return True

    db_link = nested_text(db_row, ("source_url", "link"))
    normalized_link = nested_text(normalized, ("source_url", "link"))
    if db_link and normalized_link and db_link == normalized_link:
        return True

    return str(db_row.get("title") or "").strip() == str(normalized.get("title") or "").strip()


def nested_text(row: dict[str, Any], paths: tuple[str, ...]) -> str:
    for path in paths:
        value: Any = row
        for part in path.split("."):
            if not isinstance(value, dict):
                value = None
                break
            value = value.get(part)
        text = str(value or "").strip()
        if text:
            return text
    return ""


def build_report(program_id: str, *, backend_url: str, max_pages: int) -> dict[str, Any]:
    db_row = fetch_db_program(program_id)
    api_row = fetch_backend_program(program_id, backend_url)
    raw_mapped, normalized = collect_matching_source_row(db_row or {}, max_pages) if db_row else (None, None)
    raw_item = raw_mapped.get("raw") if raw_mapped else None
    return {
        "program_id": program_id,
        "source": db_row.get("source") if db_row else None,
        "raw_keys": sorted(raw_item.keys()) if isinstance(raw_item, dict) else [],
        "raw": compact(raw_item) if isinstance(raw_item, dict) else None,
        "normalized": subset(normalized),
        "db": subset(db_row),
        "api": subset(api_row),
        "ui_snapshot_from_api": build_ui_snapshot(api_row),
        "diff": compare_snapshots(normalized=normalized, db_row=db_row, api_row=api_row),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Trace one program from live source raw to normalized, DB, API, and UI-facing values.")
    parser.add_argument("--program-id", required=True, help="Supabase programs.id UUID")
    parser.add_argument("--backend-url", default=os.getenv("NEXT_PUBLIC_BACKEND_URL", "http://localhost:8000"))
    parser.add_argument("--max-pages", type=int, default=3, help="Live source pages to scan for a matching raw row")
    return parser


def main() -> int:
    load_backend_env()
    args = build_parser().parse_args()
    report = build_report(args.program_id, backend_url=args.backend_url, max_pages=args.max_pages)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
