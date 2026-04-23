from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for path in (REPO_ROOT, BACKEND_ROOT):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

from backend.rag.collector.kstartup_collector import KstartupApiCollector  # noqa: E402
from backend.rag.collector.normalizer import normalize  # noqa: E402
from backend.rag.collector.regional_html_collectors import SesacCollector  # noqa: E402
from backend.rag.collector.work24_collector import Work24Collector  # noqa: E402
from backend.rag.collector.work24_detail_parser import fetch_work24_detail_fields  # noqa: E402


BACKFILL_FIELDS = (
    "provider",
    "location",
    "description",
    "deadline",
    "close_date",
    "start_date",
    "end_date",
    "source_url",
    "source_unique_key",
    "cost",
    "subsidy_amount",
    "tags",
    "skills",
    "compare_meta",
    "raw_data",
)


@dataclass
class SourceRecord:
    source: str
    match_key: str
    normalized: dict[str, Any]
    raw: dict[str, Any]


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


def compact(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: compact(entry) for key, entry in value.items() if entry not in (None, "", [], {})}
    if isinstance(value, list):
        return [compact(entry) for entry in value if entry not in (None, "", [], {})]
    return value


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


def query_param(value: Any, key: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    parsed = urlparse(text)
    values = parse_qs(parsed.query).get(key)
    return str(values[0]).strip() if values else ""


def work24_key(row: dict[str, Any]) -> str:
    hrd_id = nested_text(row, ("hrd_id", "compare_meta.hrd_id"))
    if hrd_id:
        return f"work24:hrd:{hrd_id}"
    return work24_url_key(row)


def work24_url_key(row: dict[str, Any]) -> str:
    for link_key in ("source_url", "link"):
        link = row.get(link_key)
        tracse_id = query_param(link, "tracseId")
        tracse_tme = query_param(link, "tracseTme")
        customer_id = query_param(link, "trainstCstmrId")
        if tracse_id:
            parts = [tracse_id, tracse_tme, customer_id]
            return "work24:url:" + ":".join(part for part in parts if part)
    return ""


def kstartup_key(row: dict[str, Any]) -> str:
    announcement_id = nested_text(row, ("compare_meta.announcement_id", "compare_meta.pbanc_sn"))
    if announcement_id:
        return f"kstartup:announcement:{announcement_id}"
    return kstartup_url_key(row)


def kstartup_url_key(row: dict[str, Any]) -> str:
    for link_key in ("source_url", "link"):
        pbanc_sn = query_param(row.get(link_key), "pbancSn")
        if pbanc_sn:
            return f"kstartup:announcement:{pbanc_sn}"
    return ""


def source_family(row: dict[str, Any]) -> str:
    source = str(row.get("source") or "").casefold()
    if "k-startup" in source or "kstartup" in source:
        return "kstartup"
    if "고용24" in source or "work24" in source:
        return "work24"
    if "sesac" in source or "새싹" in source or "청년취업사관학교" in source:
        return "sesac"
    return ""


def source_key(row: dict[str, Any]) -> str:
    family = source_family(row)
    if family == "kstartup":
        return kstartup_key(row)
    if family == "work24":
        return work24_key(row)
    if family == "sesac":
        return sesac_key(row)
    return ""


def sesac_key(row: dict[str, Any]) -> str:
    for link_key in ("source_url", "link"):
        course_id = query_param(row.get(link_key), "crsSn") or query_param(row.get(link_key), "courseId")
        if course_id:
            return f"sesac:course:{course_id}"
    title = re.sub(r"\s+", " ", str(row.get("title") or "").strip())
    title = re.sub(r"^(모집중|모집예정|상시모집|마감임박)\s+", "", title)
    title = re.sub(r"\s+모집\s*기간\s+\d{4}[./-]\d{1,2}[./-]\d{1,2}\s*-\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}.*$", "", title)
    title = re.sub(r"\s+\d+$", "", title).strip().casefold()
    return f"sesac:title:{title}" if title else ""


def is_blank(value: Any) -> bool:
    return value in (None, "", [], {})


def merge_compare_meta(current: Any, incoming: Any, *, overwrite: bool) -> dict[str, Any] | None:
    if not isinstance(incoming, dict) or not incoming:
        return current if isinstance(current, dict) and current else None
    merged = dict(current) if isinstance(current, dict) else {}
    for key, value in incoming.items():
        if is_blank(value):
            continue
        if overwrite or is_blank(merged.get(key)):
            merged[key] = value
    return merged or None


def build_patch(db_row: dict[str, Any], normalized: dict[str, Any], *, overwrite: bool) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    for field in BACKFILL_FIELDS:
        incoming = normalized.get(field)
        if field == "compare_meta":
            merged = merge_compare_meta(db_row.get(field), incoming, overwrite=overwrite)
            if merged and merged != db_row.get(field):
                patch[field] = merged
            continue
        if is_blank(incoming):
            continue
        current = db_row.get(field)
        should_replace_copied_work24_deadline = (
            field == "deadline"
            and is_work24_deadline_copied_from_end_date(db_row)
            and _date_prefix(incoming) != _date_prefix(db_row.get("end_date"))
        )
        if overwrite or is_blank(current) or should_replace_copied_work24_deadline:
            if incoming != current:
                patch[field] = incoming
    if (
        source_family(db_row) == "work24"
        and not is_blank(patch.get("deadline"))
        and is_blank(db_row.get("close_date"))
    ):
        patch["close_date"] = patch["deadline"]
    return patch


def build_diff(db_row: dict[str, Any], patch: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        field: {"before": db_row.get(field), "after": value}
        for field, value in patch.items()
    }


def supabase_request(method: str, path: str, *, params: dict[str, str] | None = None, payload: Any = None) -> Any:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.")
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if method.upper() in {"POST", "PATCH"}:
        headers["Prefer"] = "return=representation"
    response = requests.request(
        method,
        f"{supabase_url}{path}",
        params=params,
        json=payload,
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
    if not response.content:
        return None
    return response.json()


def fetch_candidate_rows(limit: int, *, deadline_from: str | None = None) -> list[dict[str, Any]]:
    params = {
        "select": "*",
        "or": "(source.ilike.*고용24*,source.ilike.*work24*,source.ilike.*K-Startup*,source.ilike.*kstartup*,source.ilike.*sesac*,source.ilike.*새싹*,source.ilike.*청년취업사관학교*)",
        "order": "deadline.asc.nullslast",
        "limit": str(limit),
    }
    if deadline_from:
        params["deadline"] = f"gte.{deadline_from}"
    rows = supabase_request(
        "GET",
        "/rest/v1/programs",
        params=params,
    )
    return rows if isinstance(rows, list) else []


def fetch_work24_deadline_audit_rows(limit: int) -> list[dict[str, Any]]:
    rows = supabase_request(
        "GET",
        "/rest/v1/programs",
        params={
            "select": "*",
            "or": "(source.ilike.*고용24*,source.ilike.*work24*)",
            "deadline": "not.is.null",
            "end_date": "not.is.null",
            "order": "deadline.asc.nullslast",
            "limit": str(limit),
        },
    )
    return rows if isinstance(rows, list) else []


def fetch_program_deadline_audit_rows(limit: int) -> list[dict[str, Any]]:
    select_fields = "id,title,source,deadline,close_date,end_date,is_active,created_at"
    query_params = [
        {
            "select": select_fields,
            "deadline": "is.null",
            "order": "created_at.desc.nullslast",
            "limit": str(limit),
        },
        {
            "select": select_fields,
            "close_date": "not.is.null",
            "order": "close_date.asc.nullslast",
            "limit": str(limit),
        },
        {
            "select": select_fields,
            "deadline": "not.is.null",
            "end_date": "not.is.null",
            "order": "deadline.asc.nullslast",
            "limit": str(limit),
        },
    ]
    rows_by_id: dict[str, dict[str, Any]] = {}
    for params in query_params:
        rows = supabase_request("GET", "/rest/v1/programs", params=params)
        if not isinstance(rows, list):
            continue
        for row in rows:
            row_id = str(row.get("id") or "").strip()
            if row_id:
                rows_by_id.setdefault(row_id, row)
    return list(rows_by_id.values())


def is_work24_deadline_copied_from_end_date(row: dict[str, Any]) -> bool:
    source = str(row.get("source") or "").casefold()
    if "고용24" not in source and "work24" not in source:
        return False
    deadline = str(row.get("deadline") or "").strip()
    end_date = str(row.get("end_date") or "").strip()
    return bool(deadline and end_date and deadline[:10] == end_date[:10])


def _date_prefix(value: Any) -> str:
    return str(value or "").strip()[:10]


def _parse_iso_date(value: Any) -> date | None:
    text = _date_prefix(value)
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def classify_program_deadline_issues(
    row: dict[str, Any],
    *,
    today: date | None = None,
) -> list[dict[str, Any]]:
    today = today or date.today()
    deadline_text = _date_prefix(row.get("deadline"))
    close_date_text = _date_prefix(row.get("close_date"))
    end_date_text = _date_prefix(row.get("end_date"))
    deadline = _parse_iso_date(deadline_text)
    close_date = _parse_iso_date(close_date_text)
    issues: list[dict[str, Any]] = []

    if not deadline and close_date:
        issues.append(
            {
                "code": "deadline_missing_with_close_date",
                "reason": "deadline은 비어 있지만 close_date가 있어 모집중 검색 후보에서 누락될 수 있습니다.",
                "recommended_patch": {"deadline": close_date_text},
            }
        )

    if deadline and close_date and deadline < today <= close_date:
        issues.append(
            {
                "code": "deadline_past_but_close_date_active",
                "reason": "deadline은 지났지만 close_date는 아직 유효해 모집중 후보에서 조기 누락될 수 있습니다.",
                "recommended_patch": {"deadline": close_date_text},
            }
        )

    if is_work24_deadline_copied_from_end_date(row):
        issues.append(
            {
                "code": "work24_deadline_copied_from_end_date",
                "reason": "고용24 deadline이 훈련 종료일 end_date와 같아 모집 마감일로 신뢰하기 어렵습니다.",
                "recommended_patch": {"deadline": None},
            }
        )

    if not deadline and not close_date and row.get("is_active") is True:
        issues.append(
            {
                "code": "active_row_without_recruiting_deadline",
                "reason": "is_active는 true지만 모집 마감일 후보가 없어 deadline 기반 모집중 검색에서 제외됩니다.",
                "recommended_patch": {},
            }
        )

    if deadline_text and end_date_text and deadline_text == end_date_text and not issues:
        issues.append(
            {
                "code": "deadline_equals_end_date_review",
                "reason": "deadline과 end_date가 같아 source별 모집 마감일 매핑 확인이 필요합니다.",
                "recommended_patch": {},
            }
        )

    return issues


def build_program_deadline_audit_report(*, limit: int) -> dict[str, Any]:
    db_rows = fetch_program_deadline_audit_rows(limit)
    items: list[dict[str, Any]] = []
    issue_counts: dict[str, int] = {}
    for row in db_rows:
        issues = classify_program_deadline_issues(row)
        if not issues:
            continue
        for issue in issues:
            issue_counts[issue["code"]] = issue_counts.get(issue["code"], 0) + 1
        items.append(
            {
                "id": row.get("id"),
                "title": row.get("title"),
                "source": row.get("source"),
                "deadline": row.get("deadline"),
                "close_date": row.get("close_date"),
                "end_date": row.get("end_date"),
                "is_active": row.get("is_active"),
                "issues": issues,
            }
        )
    return {
        "mode": "dry-run",
        "report": "program-deadline-search-candidate-gaps",
        "candidate_count": len(db_rows),
        "suspect_count": len(items),
        "issue_counts": issue_counts,
        "items": items,
    }


def build_work24_deadline_audit_report(*, limit: int) -> dict[str, Any]:
    db_rows = fetch_work24_deadline_audit_rows(limit)
    suspects = [row for row in db_rows if is_work24_deadline_copied_from_end_date(row)]
    return {
        "mode": "dry-run",
        "report": "work24-deadline-end-date-conflicts",
        "candidate_count": len(db_rows),
        "suspect_count": len(suspects),
        "items": [
            {
                "id": row.get("id"),
                "title": row.get("title"),
                "source": row.get("source"),
                "deadline": row.get("deadline"),
                "end_date": row.get("end_date"),
                "reason": "고용24 deadline이 훈련 종료일 end_date와 같아 모집 마감일로 신뢰하기 어렵습니다.",
                "recommended_patch": {"deadline": None},
            }
            for row in suspects
        ],
    }


def collect_source_records(max_pages: int) -> dict[str, SourceRecord]:
    records: dict[str, SourceRecord] = {}
    collectors = [Work24Collector(), KstartupApiCollector(), SesacCollector()]
    for collector in collectors:
        if hasattr(collector, "max_pages"):
            collector.max_pages = max_pages
        for mapped in collector.collect():
            normalized = normalize(mapped)
            if not normalized:
                continue
            key = source_key(normalized)
            if not key:
                continue
            record = SourceRecord(
                source=str(normalized.get("source") or ""),
                match_key=key,
                normalized=normalized,
                raw=mapped.get("raw") if isinstance(mapped.get("raw"), dict) else {},
            )
            records[key] = record
            if source_family(normalized) == "work24":
                url_key = work24_url_key(normalized)
                if url_key:
                    records[url_key] = record
            if source_family(normalized) == "kstartup":
                url_key = kstartup_url_key(normalized)
                if url_key:
                    records[url_key] = record
            if source_family(normalized) == "sesac":
                key = sesac_key(normalized)
                if key:
                    records[key] = record
    return records


def fetch_work24_record_from_detail_url(db_row: dict[str, Any]) -> SourceRecord | None:
    link = str(db_row.get("link") or db_row.get("source_url") or "").strip()
    if not link or "work24.go.kr" not in link:
        return None
    normalized = fetch_work24_detail_fields(
        source_url=link,
        title=str(db_row.get("title") or ""),
    )
    if not normalized:
        return None
    return SourceRecord(
        source="고용24 상세페이지",
        match_key=work24_key(db_row),
        normalized=normalized,
        raw={"source_url": link},
    )


def fetch_kstartup_record_by_announcement_id(announcement_id: str) -> SourceRecord | None:
    api_key = os.getenv("KSTARTUP_API_KEY", "").strip()
    if not api_key or not announcement_id:
        return None
    collector = KstartupApiCollector()
    response = requests.get(
        collector.endpoint,
        params={
            "serviceKey": api_key,
            "returnType": "json",
            "page": "1",
            "perPage": "5",
            "cond[pbanc_sn::EQ]": announcement_id,
        },
        timeout=collector.timeout_seconds,
    )
    response.raise_for_status()
    items = collector.extract_items(response.json())
    if not items:
        return None
    mapped = collector.map_item(items[0], collector.get_source_meta())
    normalized = normalize(mapped)
    if not normalized:
        return None
    key = source_key(normalized)
    if not key:
        return None
    return SourceRecord(
        source=str(normalized.get("source") or ""),
        match_key=key,
        normalized=normalized,
        raw=items[0],
    )


def build_report(*, limit: int, max_pages: int, overwrite: bool, deadline_from: str | None) -> dict[str, Any]:
    db_rows = fetch_candidate_rows(limit, deadline_from=deadline_from)
    source_records = collect_source_records(max_pages)
    items: list[dict[str, Any]] = []
    for db_row in db_rows:
        key = source_key(db_row)
        record = source_records.get(key)
        if record is None and key.startswith("kstartup:announcement:"):
            announcement_id = key.rsplit(":", maxsplit=1)[-1]
            record = fetch_kstartup_record_by_announcement_id(announcement_id)
            if record is not None:
                source_records[record.match_key] = record
        if record is None and source_family(db_row) == "work24":
            record = fetch_work24_record_from_detail_url(db_row)
        patch = build_patch(db_row, record.normalized, overwrite=overwrite) if record else {}
        items.append(
            {
                "id": db_row.get("id"),
                "title": db_row.get("title"),
                "source": db_row.get("source"),
                "match_key": key,
                "matched": record is not None,
                "patch": compact(patch),
                "diff": compact(build_diff(db_row, patch)),
            }
        )
    return {
        "mode": "dry-run",
        "policy": "overwrite" if overwrite else "fill-null-only",
        "deadline_from": deadline_from,
        "candidate_count": len(db_rows),
        "source_record_count": len(source_records),
        "patch_count": sum(1 for item in items if item["patch"]),
        "items": items,
    }


def apply_report(report: dict[str, Any]) -> dict[str, Any]:
    applied: list[dict[str, Any]] = []
    for item in report.get("items", []):
        patch = item.get("patch")
        program_id = str(item.get("id") or "").strip()
        if not program_id or not patch:
            continue
        rows = supabase_request(
            "PATCH",
            "/rest/v1/programs",
            params={"id": f"eq.{program_id}"},
            payload=patch,
        )
        applied.append(
            {
                "id": program_id,
                "title": item.get("title"),
                "updated_fields": sorted(patch.keys()),
                "updated": bool(rows),
            }
        )
    return {**report, "mode": "apply", "applied": applied, "applied_count": len(applied)}


def print_markdown_table(report: dict[str, Any], *, sample: int) -> None:
    print("| 프로그램 | source | match key | null -> 값 변경 |")
    print("|---|---|---|---|")
    shown = 0
    for item in report["items"]:
        if not item["patch"]:
            continue
        changes = []
        for field, diff in item["diff"].items():
            after = diff.get("after")
            if isinstance(after, dict):
                after_text = "JSON 메타 추가"
            else:
                after_text = str(after).replace("\n", " ")[:80]
            changes.append(f"{field}: {after_text}")
        print(
            "| "
            + " | ".join(
                [
                    str(item["title"] or "").replace("|", "/")[:60],
                    str(item["source"] or "").replace("|", "/"),
                    str(item["match_key"] or "").replace("|", "/"),
                    "<br>".join(changes).replace("|", "/"),
                ]
            )
            + " |"
        )
        shown += 1
        if shown >= sample:
            break


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Backfill Work24/K-Startup program detail fields from source APIs.")
    parser.add_argument("--limit", type=int, default=50, help="DB rows to inspect, ordered by deadline.")
    parser.add_argument("--max-pages", type=int, default=5, help="Source API pages to scan.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing values. Default fills blank fields only.")
    parser.add_argument("--deadline-from", default=None, help="Only inspect DB rows with deadline >= this YYYY-MM-DD value.")
    parser.add_argument("--apply", action="store_true", help="Apply patches to Supabase. Default is dry-run.")
    parser.add_argument(
        "--work24-deadline-audit",
        action="store_true",
        help="Dry-run report for Work24 rows whose deadline appears copied from training end_date.",
    )
    parser.add_argument(
        "--deadline-audit",
        action="store_true",
        help="Dry-run report for rows likely missing from recruiting-only deadline searches.",
    )
    parser.add_argument("--format", choices=("json", "markdown"), default="json")
    parser.add_argument("--sample", type=int, default=3, help="Rows to print in markdown mode.")
    return parser


def main() -> int:
    configure_stdout()
    load_backend_env()
    args = build_parser().parse_args()
    if args.deadline_audit:
        report = build_program_deadline_audit_report(limit=args.limit)
    elif args.work24_deadline_audit:
        report = build_work24_deadline_audit_report(limit=args.limit)
    else:
        report = build_report(
            limit=args.limit,
            max_pages=args.max_pages,
            overwrite=args.overwrite,
            deadline_from=args.deadline_from,
        )
    if args.apply and not args.work24_deadline_audit and not args.deadline_audit:
        report = apply_report(report)
    if args.format == "markdown":
        print_markdown_table(report, sample=args.sample)
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
