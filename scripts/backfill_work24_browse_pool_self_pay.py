from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for path in (REPO_ROOT, BACKEND_ROOT):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from scripts import program_backfill, refresh_program_list_index


SELF_PAY_META_KEYS = (
    "self_payment",
    "selfPayment",
    "out_of_pocket",
    "outOfPocket",
    "out_of_pocket_amount",
    "outOfPocketAmount",
)


def _clean_id(value: Any) -> str:
    return str(value or "").strip()


def fetch_browse_pool_work24_rows(pool_limit: int) -> list[dict[str, Any]]:
    rows = program_backfill.supabase_request(
        "GET",
        "/rest/v1/program_list_index",
        params={
            "select": "id,title,source,browse_rank",
            "or": "(source.ilike.*고용24*,source.ilike.*work24*)",
            "browse_rank": f"lte.{max(pool_limit, 1)}",
            "order": "browse_rank.asc.nullslast",
            "limit": str(max(pool_limit, 1)),
        },
    )
    return rows if isinstance(rows, list) else []


def fetch_program_rows_by_ids(program_ids: list[str]) -> list[dict[str, Any]]:
    if not program_ids:
        return []
    rows = program_backfill.supabase_request(
        "GET",
        "/rest/v1/programs",
        params={
            "select": "*",
            "id": "in.(" + ",".join(program_ids) + ")",
        },
    )
    return rows if isinstance(rows, list) else []


def _int_or_none(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        text = value.replace(",", "").strip()
        return int(text) if text.isdigit() else None
    return None


def _meta_dict(row: dict[str, Any], key: str) -> dict[str, Any]:
    value = row.get(key)
    return value if isinstance(value, dict) else {}


def _has_verified_self_pay_signal(row: dict[str, Any]) -> bool:
    return _verified_self_pay_amount(row) is not None


def _verified_self_pay_amount(row: dict[str, Any]) -> int | None:
    compare_meta = _meta_dict(row, "compare_meta")
    service_meta = _meta_dict(row, "service_meta")
    for meta in (compare_meta, service_meta):
        for key in SELF_PAY_META_KEYS:
            amount = _int_or_none(meta.get(key))
            if amount is not None:
                return amount

    cost = _int_or_none(row.get("cost") or row.get("fee_amount"))
    for key in ("verified_self_pay_amount", "support_amount", "subsidy_amount"):
        amount = _int_or_none(row.get(key))
        if amount is None:
            continue
        if cost is None or amount < cost:
            return amount
    return None


def build_existing_self_pay_patch(row: dict[str, Any], *, overwrite: bool) -> dict[str, Any]:
    if program_backfill.source_family(row) != "work24":
        return {}
    self_pay = _verified_self_pay_amount(row)
    cost = _int_or_none(row.get("cost") or row.get("fee_amount"))
    if self_pay is None:
        return {}
    if cost is not None and cost > 0 and self_pay >= cost:
        return {}

    patch: dict[str, Any] = {}
    for key in ("support_amount", "subsidy_amount"):
        current = _int_or_none(row.get(key))
        should_patch = (
            overwrite
            or current is None
            or (current != self_pay and cost is not None and current >= cost)
        )
        if should_patch and current != self_pay:
            patch[key] = self_pay
    return patch


def build_self_pay_patch(db_row: dict[str, Any], normalized: dict[str, Any], *, overwrite: bool) -> dict[str, Any]:
    patch = program_backfill.build_patch(db_row, normalized, overwrite=overwrite)
    merged_row = {**db_row, **patch}
    if "compare_meta" in patch and isinstance(patch["compare_meta"], dict):
        merged_row["compare_meta"] = patch["compare_meta"]
    canonical_patch = build_existing_self_pay_patch(merged_row, overwrite=overwrite)
    patch.update(canonical_patch)
    return patch


def should_fetch_work24_self_pay_detail(row: dict[str, Any]) -> bool:
    if program_backfill.source_family(row) != "work24":
        return False
    if _has_verified_self_pay_signal(row):
        return False
    source_url = program_backfill.nested_text(row, ("source_url", "link", "compare_meta.source_url"))
    return source_url.startswith(("http://", "https://")) and "work24.go.kr" in source_url.lower()


def build_report(
    *,
    pool_limit: int,
    overwrite: bool,
) -> dict[str, Any]:
    browse_rows = fetch_browse_pool_work24_rows(pool_limit)
    ordered_ids = [_clean_id(row.get("id")) for row in browse_rows if _clean_id(row.get("id"))]
    program_rows = fetch_program_rows_by_ids(ordered_ids)
    program_rows_by_id = {
        _clean_id(row.get("id")): row
        for row in program_rows
        if _clean_id(row.get("id"))
    }

    items: list[dict[str, Any]] = []
    suspicious_count = 0

    for browse_row in browse_rows:
        program_id = _clean_id(browse_row.get("id"))
        db_row = program_rows_by_id.get(program_id)
        if db_row is None:
            continue

        existing_patch = build_existing_self_pay_patch(db_row, overwrite=overwrite)
        if existing_patch:
            record = None
            patch = existing_patch
        elif should_fetch_work24_self_pay_detail(db_row):
            record = program_backfill.fetch_work24_record_from_detail_url(db_row)
            patch = build_self_pay_patch(db_row, record.normalized, overwrite=overwrite) if record else {}
        else:
            continue
        suspicious_count += 1
        items.append(
            {
                "id": program_id,
                "title": browse_row.get("title") or db_row.get("title"),
                "source": browse_row.get("source") or db_row.get("source"),
                "browse_rank": browse_row.get("browse_rank"),
                "matched": record is not None or bool(existing_patch),
                "patch": program_backfill.compact(patch),
                "diff": program_backfill.compact(program_backfill.build_diff(db_row, patch)),
            }
        )

    return {
        "mode": "dry-run",
        "report": "work24-browse-pool-self-pay-backfill",
        "pool_limit": max(pool_limit, 1),
        "policy": "overwrite" if overwrite else "fill-null-only",
        "candidate_rows_from_program_list_index": len(browse_rows),
        "candidate_rows_from_programs": len(program_rows_by_id),
        "suspicious_count": suspicious_count,
        "patch_count": sum(1 for item in items if item["patch"]),
        "items": items,
    }


def apply_report(report: dict[str, Any]) -> dict[str, Any]:
    applied: list[dict[str, Any]] = []
    for item in report.get("items", []):
        patch = item.get("patch")
        program_id = _clean_id(item.get("id"))
        if not program_id or not patch:
            continue
        rows = program_backfill.supabase_request(
            "PATCH",
            "/rest/v1/programs",
            params={"id": f"eq.{program_id}"},
            payload=patch,
        )
        applied.append(
            {
                "id": program_id,
                "title": item.get("title"),
                "browse_rank": item.get("browse_rank"),
                "updated_fields": sorted(patch.keys()),
                "updated": bool(rows),
            }
        )
    return {
        **report,
        "mode": "apply",
        "applied": applied,
        "applied_count": len(applied),
    }


async def refresh_browse_pool(
    *,
    pool_limit: int,
    browse_candidate_limit: int | None,
    fallback_attempts: int,
    retry_delay_seconds: float,
) -> dict[str, Any]:
    return await refresh_program_list_index.refresh(
        max(pool_limit, 1),
        browse_only=True,
        fallback_attempts=max(fallback_attempts, 1),
        retry_delay_seconds=max(retry_delay_seconds, 0.0),
        browse_candidate_limit=browse_candidate_limit,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill verified self-pay for Work24 browse-pool rows from detail pages."
    )
    parser.add_argument("--pool-limit", type=int, default=300, help="Browse pool window to inspect.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing program values.")
    parser.add_argument("--apply", action="store_true", help="Apply patches to Supabase.")
    parser.add_argument(
        "--refresh-after-apply",
        action="store_true",
        help="Run browse-only program_list_index refresh after apply.",
    )
    parser.add_argument(
        "--browse-candidate-limit",
        type=int,
        default=None,
        help="Optional browse refresh candidate limit forwarded to refresh_program_list_index.py.",
    )
    parser.add_argument("--fallback-attempts", type=int, default=3)
    parser.add_argument("--retry-delay-seconds", type=float, default=2.0)
    return parser


def main() -> int:
    program_backfill.configure_stdout()
    program_backfill.load_backend_env()
    args = build_parser().parse_args()
    report = build_report(pool_limit=args.pool_limit, overwrite=args.overwrite)
    if args.apply:
        report = apply_report(report)
        if args.refresh_after_apply:
            report["refresh_report"] = asyncio.run(
                refresh_browse_pool(
                    pool_limit=args.pool_limit,
                    browse_candidate_limit=args.browse_candidate_limit,
                    fallback_attempts=args.fallback_attempts,
                    retry_delay_seconds=args.retry_delay_seconds,
                )
            )
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
