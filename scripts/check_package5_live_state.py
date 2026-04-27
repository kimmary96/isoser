from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from utils.supabase_admin import build_service_headers, get_supabase_admin_settings  # noqa: E402


READ_ONLY_CHECKS: list[dict[str, str]] = [
    {
        "name": "program_list_index_table",
        "kind": "table",
        "path": "/rest/v1/program_list_index?select=id&limit=1",
    },
    {
        "name": "program_source_records_table",
        "kind": "table",
        "path": "/rest/v1/program_source_records?select=id&limit=1",
    },
    {
        "name": "programs_canonical_columns",
        "kind": "columns",
        "path": "/rest/v1/programs?select=id,primary_source_record_id,primary_source_code,primary_source_label,application_end_date,program_start_date&limit=1",
    },
    {
        "name": "program_list_index_surface_columns",
        "kind": "columns",
        "path": "/rest/v1/program_list_index?select=id,source_code,source_label,application_end_date,program_start_date,recruiting_status,recruiting_status_label,primary_link&limit=1",
    },
    {
        "name": "user_program_preferences_table",
        "kind": "table",
        "path": "/rest/v1/user_program_preferences?select=user_id&limit=1",
    },
    {
        "name": "user_recommendation_profile_table",
        "kind": "table",
        "path": "/rest/v1/user_recommendation_profile?select=user_id&limit=1",
    },
    {
        "name": "recommendations_aligned_cache_columns",
        "kind": "columns",
        "path": "/rest/v1/recommendations?select=id,query_hash,profile_hash,expires_at,fit_keywords&limit=1",
    },
]


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


def _response_body(response: httpx.Response) -> dict[str, Any] | None:
    try:
        body = response.json()
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def _response_message(response: httpx.Response) -> str:
    body = _response_body(response)
    if isinstance(body, dict):
        return str(body.get("message") or body.get("hint") or body.get("details") or response.text)
    return response.text


def _classify_response(response: httpx.Response) -> tuple[str, str]:
    message = _response_message(response)

    if response.status_code == 200:
        return "present", message
    if response.status_code == 404 and (
        "Could not find the table" in message or "schema cache" in message
    ):
        return "missing", message
    if response.status_code == 400 and "does not exist" in message:
        return "column_missing", message
    return "error", message


def _summarize_environment() -> dict[str, bool]:
    return {
        "supabase_url_configured": bool(os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")),
        "service_role_configured": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
        "supabase_cli_present": shutil.which("supabase") is not None,
        "direct_db_url_configured": bool(os.getenv("SUPABASE_DB_URL")),
        "project_ref_configured": bool(os.getenv("SUPABASE_PROJECT_REF")),
        "access_token_configured": bool(os.getenv("SUPABASE_ACCESS_TOKEN")),
    }


def _build_summary(checks: list[dict[str, Any]], environment: dict[str, bool]) -> dict[str, Any]:
    status_by_name = {check["name"]: check["status"] for check in checks}

    program_axis_ready = all(
        status_by_name.get(name) == "present"
        for name in (
            "program_list_index_table",
            "program_source_records_table",
            "programs_canonical_columns",
            "program_list_index_surface_columns",
        )
    )
    user_recommendation_ready = all(
        status_by_name.get(name) == "present"
        for name in (
            "user_program_preferences_table",
            "user_recommendation_profile_table",
            "recommendations_aligned_cache_columns",
        )
    )

    if program_axis_ready and user_recommendation_ready:
        live_state = "fully_aligned_for_package5_validation"
    elif program_axis_ready and not user_recommendation_ready:
        live_state = "mixed_program_axis_applied_user_recommendation_pending"
    elif not program_axis_ready and user_recommendation_ready:
        live_state = "mixed_user_recommendation_applied_program_axis_pending"
    else:
        live_state = "package5_live_alignment_incomplete"

    if live_state == "fully_aligned_for_package5_validation":
        next_recommended_order = [
            "bounded sample validation 최신 산출물을 확인하거나 `scripts/refresh_program_validation_sample.py --preset free-plan-50`를 다시 실행",
            "그 다음 `program_list_index` / `program_source_records` row count와 sample row를 확인",
            "마지막으로 package-5 문서 정합성과 최소 cleanup 후보만 정리",
        ]
    else:
        next_recommended_order = [
            "schema_migrations에서 20260425103000~20260425112000, 20260425113000~20260425119000 적용 여부를 먼저 확인",
            "user recommendation 축이 비어 있으면 그 묶음을 먼저 적용",
            "적용 직후 user_program_preferences / user_recommendation_profile / recommendations aligned columns를 다시 확인",
            "그 다음에만 bounded sample validation을 진행",
        ]

    if live_state != "fully_aligned_for_package5_validation" and not (
        environment["supabase_cli_present"] or environment["direct_db_url_configured"]
    ):
        next_recommended_order.insert(
            0,
            "이 셸에서는 DDL apply를 직접 실행할 수 없으므로 SQL Editor 또는 migration runner가 필요",
        )

    return {
        "package_code_stage": "package-5",
        "live_state": live_state,
        "program_axis_ready": program_axis_ready,
        "user_recommendation_ready": user_recommendation_ready,
        "ddl_apply_ready_in_this_shell": bool(
            environment["supabase_cli_present"] or environment["direct_db_url_configured"]
        ),
        "next_recommended_order": next_recommended_order,
    }


def _trim_preview(response: httpx.Response) -> str:
    text = response.text.strip()
    return text[:300]


def main() -> int:
    load_backend_env()
    parser = argparse.ArgumentParser(
        description="Read-only package-5 live state checker. Probes key Supabase tables/columns and reports whether package-5 can move from migration apply to validation."
    )
    parser.add_argument(
        "--output",
        help="Write the JSON report to this path as well as printing it to stdout.",
    )
    args = parser.parse_args()

    environment = _summarize_environment()
    checked_at_utc = datetime.now(timezone.utc).isoformat()

    try:
        settings = get_supabase_admin_settings()
    except Exception as exc:
        report = {
            "checked_at_utc": checked_at_utc,
            "status": "failed",
            "environment": environment,
            "error": str(exc),
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    checks: list[dict[str, Any]] = []
    with httpx.Client(timeout=settings.timeout_seconds, trust_env=False) as client:
        headers = build_service_headers(settings.service_role_key)
        for spec in READ_ONLY_CHECKS:
            response = client.get(f"{settings.url}{spec['path']}", headers=headers)
            status, message = _classify_response(response)
            checks.append(
                {
                    "name": spec["name"],
                    "kind": spec["kind"],
                    "path": spec["path"],
                    "http_status": response.status_code,
                    "status": status,
                    "message": message,
                    "response_preview": _trim_preview(response),
                }
            )

    report = {
        "checked_at_utc": checked_at_utc,
        "status": "ok",
        "environment": environment,
        "checks": checks,
        "summary": _build_summary(checks, environment),
    }

    if args.output:
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = ROOT / output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["output_path"] = str(output_path)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
