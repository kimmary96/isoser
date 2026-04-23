from __future__ import annotations

import argparse
import json
import re
import sys
import time
from time import perf_counter
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for path in (REPO_ROOT, BACKEND_ROOT):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

try:
    from rag.collector.base_html_collector import BaseHtmlCollector  # type: ignore  # noqa: E402
    from rag.collector.normalizer import normalize  # type: ignore  # noqa: E402
    from rag.collector.scheduler import COLLECTORS, _deduplicate_rows  # type: ignore  # noqa: E402
except ModuleNotFoundError:
    from backend.rag.collector.base_html_collector import BaseHtmlCollector  # noqa: E402
    from backend.rag.collector.normalizer import normalize  # noqa: E402
    from backend.rag.collector.scheduler import COLLECTORS, _deduplicate_rows  # noqa: E402


PLAYWRIGHT_PROBE_CLASSIFICATIONS = {
    "playwright_probe_candidate",
    "selector_or_dynamic_probe_candidate",
}


def configure_stdout() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        return


def html_collectors(collectors: Iterable[Any] | None = None) -> list[BaseHtmlCollector]:
    source_collectors = collectors if collectors is not None else COLLECTORS
    return [
        collector
        for collector in sorted(
            source_collectors,
            key=lambda item: (getattr(item, "tier", 99), getattr(item, "source_name", "")),
        )
        if isinstance(collector, BaseHtmlCollector)
    ]


def build_html_collector_report(
    collectors: Iterable[Any] | None = None,
    *,
    source_filters: Iterable[str] | None = None,
) -> dict[str, Any]:
    started = perf_counter()
    filters = [value.lower() for value in (source_filters or []) if value]
    rows = []
    for collector in html_collectors(collectors):
        if filters and not _matches_filters(collector, filters):
            continue
        rows.append(build_source_diagnostic(collector))

    summary: dict[str, int] = {}
    for row in rows:
        classification = str(row["classification"])
        summary[classification] = summary.get(classification, 0) + 1

    return {
        "mode": "read-only-live-diagnostic",
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "duration_ms": round((perf_counter() - started) * 1000, 2),
        "collector_count": len(rows),
        "summary": dict(sorted(summary.items())),
        "playwright_probe_candidates": [
            row
            for row in rows
            if row["classification"] in PLAYWRIGHT_PROBE_CLASSIFICATIONS
        ],
        "sources": rows,
    }


def build_source_diagnostic(collector: BaseHtmlCollector) -> dict[str, Any]:
    started = perf_counter()
    row: dict[str, Any] = {
        "class_name": collector.__class__.__name__,
        "source": getattr(collector, "source_name", ""),
        "source_key": getattr(collector, "source_key", ""),
        "tier": getattr(collector, "tier", None),
        "collection_method": getattr(collector, "collection_method", ""),
        "source_type": getattr(collector, "source_type", ""),
        "list_urls": list(getattr(collector, "list_urls", []) or []),
    }

    try:
        raw_items = collector.collect()
        normalized_rows = []
        normalize_failed = 0
        for raw_item in raw_items:
            try:
                normalized = normalize(raw_item)
            except Exception:
                normalize_failed += 1
                continue
            if normalized is None:
                normalize_failed += 1
                continue
            normalized_rows.append(normalized)

        row["raw_count"] = len(raw_items)
        row["normalized_count"] = len(_deduplicate_rows(normalized_rows))
        row["normalize_failed"] = normalize_failed
        row["last_collect_status"] = getattr(
            collector,
            "last_collect_status",
            "success" if raw_items else "empty",
        )
        row["last_collect_message"] = getattr(collector, "last_collect_message", "")
    except Exception as exc:
        row["raw_count"] = 0
        row["normalized_count"] = 0
        row["normalize_failed"] = 0
        row["last_collect_status"] = "collector_exception"
        row["last_collect_message"] = f"{type(exc).__name__}: {exc}"
    finally:
        row["duration_ms"] = round((perf_counter() - started) * 1000, 2)

    classification, evidence, recommendation = classify_source(
        status=str(row.get("last_collect_status") or ""),
        message=str(row.get("last_collect_message") or ""),
        raw_count=int(row.get("raw_count") or 0),
        normalized_count=int(row.get("normalized_count") or 0),
        normalize_failed=int(row.get("normalize_failed") or 0),
    )
    row["classification"] = classification
    row["evidence"] = evidence
    row["recommendation"] = recommendation
    row["playwright_probe_candidate"] = classification in PLAYWRIGHT_PROBE_CLASSIFICATIONS
    return row


def classify_source(
    *,
    status: str,
    message: str,
    raw_count: int,
    normalized_count: int,
    normalize_failed: int,
) -> tuple[str, list[str], str]:
    lowered = message.lower()
    parse_empty = _int_from(r"parse_empty=(\d+)", message)
    request_failed = _int_from(r"request_failed=(\d+)", message)

    evidence = [f"status={status or 'unknown'}", f"raw={raw_count}", f"normalized={normalized_count}"]
    if parse_empty is not None:
        evidence.append(f"parse_empty={parse_empty}")
    if request_failed is not None:
        evidence.append(f"request_failed={request_failed}")
    if normalize_failed:
        evidence.append(f"normalize_failed={normalize_failed}")

    if status in {"request_failed", "collector_exception"} or "all requests failed" in lowered:
        return (
            "request_or_network_issue",
            evidence,
            "HTTP/TLS/차단/네트워크 문제를 먼저 확인한다. Playwright fallback 후보로 보기에는 근거가 부족하다.",
        )

    if raw_count > 0 and normalized_count == 0:
        return (
            "normalization_gap",
            evidence,
            "HTML 파싱은 됐지만 normalizer에서 탈락했다. dynamic retrieve보다 raw item 계약/normalizer를 먼저 점검한다.",
        )

    if raw_count > 0 and parse_empty and parse_empty > 0:
        return (
            "partial_parse_empty_monitor",
            evidence,
            "일부 URL은 비었지만 같은 source에서 수집 성공도 있다. Playwright 도입 전 빈 URL의 HTML snapshot/selector drift를 확인한다.",
        )

    if raw_count == 0 and status == "parsing_failed" and parse_empty and parse_empty > 0:
        return (
            "playwright_probe_candidate",
            evidence,
            "요청은 성공했지만 파싱 결과가 전부 비었다. JS 렌더링인지 selector drift인지 HTML snapshot으로 확인 후 source별 opt-in 후보로 둔다.",
        )

    if raw_count == 0 and status in {"success", "empty", "idle", "dry_run", ""}:
        return (
            "selector_or_dynamic_probe_candidate",
            evidence,
            "collector가 0건을 반환했지만 URL 단위 진단이 부족하다. 먼저 HTML 응답 본문과 selector를 저장 없이 확인한다.",
        )

    if raw_count == 0:
        return (
            "empty_unknown",
            evidence,
            "0건 원인이 불명확하다. collector별 last_collect_message 보강이 우선이다.",
        )

    return (
        "healthy_static_html",
        evidence,
        "현재 정적 HTML 수집으로 동작한다. Playwright fallback 대상에서 제외한다.",
    )


def render_markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# HTML Collector Dynamic Retrieve Diagnostic",
        "",
        "## Summary",
        "",
        f"- Mode: `{report['mode']}`",
        f"- Started at: `{report['started_at']}`",
        f"- Duration: `{report.get('duration_ms', 0)}` ms",
        f"- HTML collectors checked: `{report['collector_count']}`",
        f"- Playwright probe candidates: `{len(report['playwright_probe_candidates'])}`",
        "",
    ]
    for classification, count in report["summary"].items():
        lines.append(f"- `{classification}`: `{count}`")

    lines.extend(
        [
            "",
            "## Sources",
            "",
            "| Source | Class | Raw | Normalized | Duration ms | Status | Classification |",
            "| --- | --- | ---: | ---: | ---: | --- | --- |",
        ]
    )
    for row in report["sources"]:
        lines.append(
            "| {source} | `{class_name}` | {raw_count} | {normalized_count} | {duration_ms} | {status} | {classification} |".format(
                source=_escape_table(str(row["source"])),
                class_name=row["class_name"],
                raw_count=row["raw_count"],
                normalized_count=row["normalized_count"],
                duration_ms=row.get("duration_ms", 0),
                status=_escape_table(str(row["last_collect_status"])),
                classification=row["classification"],
            )
        )

    lines.extend(["", "## Recommendations", ""])
    for row in report["sources"]:
        if row["classification"] == "healthy_static_html":
            continue
        lines.extend(
            [
                f"### {row['source']}",
                "",
                f"- Classification: `{row['classification']}`",
                f"- Evidence: {', '.join(f'`{item}`' for item in row['evidence'])}",
                f"- Recommendation: {row['recommendation']}",
                "",
            ]
        )

    if not report["playwright_probe_candidates"]:
        lines.extend(
            [
                "## Playwright Decision",
                "",
                "No source currently has enough evidence for Playwright fallback. Keep dynamic retrieve behind source-specific opt-in after repeated full parse-empty and HTML snapshot evidence.",
                "",
            ]
        )

    return "\n".join(lines).rstrip() + "\n"


def write_json_report(report: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_markdown_report(report: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_markdown_report(report), encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a read-only diagnostic over HTML collectors and classify dynamic retrieve candidates."
    )
    parser.add_argument(
        "--source",
        action="append",
        default=[],
        help="Optional source filter. Matches source name, source key, or collector class. Can be repeated.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "reports" / "html-collector-diagnostic.json",
        help="JSON report path.",
    )
    parser.add_argument(
        "--markdown-output",
        type=Path,
        help="Optional Markdown report path.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_stdout()
    args = build_parser().parse_args(argv)
    report = build_html_collector_report(source_filters=args.source)
    write_json_report(report, args.output)
    if args.markdown_output:
        write_markdown_report(report, args.markdown_output)
    print(f"Wrote HTML collector diagnostic: {args.output}")
    if args.markdown_output:
        print(f"Wrote Markdown diagnostic: {args.markdown_output}")
    print(json.dumps(report["summary"], ensure_ascii=False, sort_keys=True))
    return 0


def _matches_filters(collector: BaseHtmlCollector, filters: list[str]) -> bool:
    haystack = " ".join(
        [
            collector.__class__.__name__,
            str(getattr(collector, "source_name", "")),
            str(getattr(collector, "source_key", "")),
        ]
    ).lower()
    return any(value in haystack for value in filters)


def _int_from(pattern: str, text: str) -> int | None:
    match = re.search(pattern, text or "")
    return int(match.group(1)) if match else None


def _escape_table(value: str) -> str:
    return value.replace("|", "\\|")


if __name__ == "__main__":
    raise SystemExit(main())
