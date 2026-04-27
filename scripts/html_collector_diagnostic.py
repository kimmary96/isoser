from __future__ import annotations

import argparse
import json
import re
import sys
import time
from time import perf_counter
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for path in (REPO_ROOT, BACKEND_ROOT):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

try:
    from rag.collector.base_html_collector import BaseHtmlCollector  # type: ignore  # noqa: E402
    from rag.collector.normalizer import normalize  # type: ignore  # noqa: E402
    from rag.collector.quality_validator import (  # type: ignore  # noqa: E402
        summarize_program_field_gaps,
        summarize_program_quality,
    )
    from rag.collector.scheduler import (  # type: ignore  # noqa: E402
        COLLECTORS,
        _deduplicate_rows,
        _format_dry_run_message,
    )
except ModuleNotFoundError:
    from backend.rag.collector.base_html_collector import BaseHtmlCollector  # noqa: E402
    from backend.rag.collector.normalizer import normalize  # noqa: E402
    from backend.rag.collector.quality_validator import (  # noqa: E402
        summarize_program_field_gaps,
        summarize_program_quality,
    )
    from backend.rag.collector.scheduler import (  # noqa: E402
        COLLECTORS,
        _deduplicate_rows,
        _format_dry_run_message,
    )


PLAYWRIGHT_PROBE_CLASSIFICATIONS = {
    "playwright_probe_candidate",
    "selector_or_dynamic_probe_candidate",
}
OCR_PROBE_CANDIDATE_CLASSIFICATIONS = {
    "ocr_probe_candidate",
}
POSTER_ATTACHMENT_CLASSIFICATIONS = {
    "poster_or_attachment_candidate",
}
DETAIL_PROBE_INCONCLUSIVE_CLASSIFICATIONS = {
    "detail_probe_inconclusive",
}
SNAPSHOT_RELEVANT_SOURCE_CLASSIFICATIONS = {
    "partial_parse_empty_monitor",
    "playwright_probe_candidate",
    "selector_or_dynamic_probe_candidate",
}
ATTACHMENT_EXTENSIONS = (
    ".pdf",
    ".hwp",
    ".hwpx",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".zip",
)
IMAGE_EXTENSIONS = (
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
)
ATTACHMENT_KEYWORDS = ("첨부", "붙임", "다운로드", "download", "filedown", "파일")
IMAGE_KEYWORDS = ("포스터", "홍보물", "카드뉴스", "이미지", "poster")
SHORT_LIST_TEXT_THRESHOLD = 120
LOW_DETAIL_TEXT_THRESHOLD = 300
SUFFICIENT_DETAIL_TEXT_THRESHOLD = 700
DETAIL_URL_SAMPLE_LIMIT = 3
SOURCE_URL_SAMPLE_LIMIT = 6
SCHEDULER_SUMMARY_SCHEMA_RELATIVE_PATH = "docs/schemas/html-collector-scheduler-summary.schema.json"
SCHEDULER_SOURCE_SUMMARY_SCHEMA_ID = "scheduler_source_summary_v1"
SCHEDULER_DRY_RUN_SUMMARY_SCHEMA_ID = "scheduler_dry_run_summary_v1"
PROGRAM_QUALITY_SUMMARY_SCHEMA_ID = "program_quality_summary_v1"
FIELD_GAP_SAMPLE_LIMIT = 3


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
    include_ocr_probe: bool = False,
    ocr_sample_limit: int = 3,
    include_scheduler_summary: bool = False,
    snapshot_output_dir: Path | None = None,
) -> dict[str, Any]:
    started = perf_counter()
    filters = [value.lower() for value in (source_filters or []) if value]
    all_normalized_rows: list[dict[str, Any]] = []
    rows = []
    for collector in html_collectors(collectors):
        if filters and not _matches_filters(collector, filters):
            continue
        row, normalized_rows = build_source_diagnostic(
            collector,
            include_ocr_probe=include_ocr_probe,
            ocr_sample_limit=ocr_sample_limit,
            include_scheduler_summary=include_scheduler_summary,
        )
        all_normalized_rows.extend(normalized_rows)
        if snapshot_output_dir is not None:
            capture_summary = persist_row_snapshots(
                row,
                snapshot_output_dir=snapshot_output_dir,
            )
            if capture_summary["saved_count"] > 0:
                row["snapshot_capture"] = capture_summary
        row.pop("_url_diagnostics", None)
        rows.append(row)

    summary: dict[str, int] = {}
    ocr_summary: dict[str, int] = {}
    for row in rows:
        classification = str(row["classification"])
        summary[classification] = summary.get(classification, 0) + 1
        ocr_probe = row.get("ocr_probe")
        if isinstance(ocr_probe, dict):
            ocr_classification = str(ocr_probe.get("classification") or "unknown")
            ocr_summary[ocr_classification] = ocr_summary.get(ocr_classification, 0) + 1

    report = {
        "mode": "read-only-live-diagnostic",
        "schema_version": "html_collector_diagnostic_report_v1",
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "duration_ms": round((perf_counter() - started) * 1000, 2),
        "collector_count": len(rows),
        "summary": dict(sorted(summary.items())),
        "playwright_probe_candidates": [
            row
            for row in rows
            if row["classification"] in PLAYWRIGHT_PROBE_CLASSIFICATIONS
        ],
        "partial_parse_empty_sources": [
            row
            for row in rows
            if row["classification"] == "partial_parse_empty_monitor"
        ],
        "sources": rows,
    }
    if include_scheduler_summary:
        report["schemas"] = build_scheduler_schema_refs()
        report["scheduler_dry_run"] = build_scheduler_dry_run_summary(
            rows,
            normalized_rows=all_normalized_rows,
        )
    if snapshot_output_dir is not None:
        report["snapshot_capture"] = build_snapshot_capture_summary(
            rows,
            snapshot_output_dir=snapshot_output_dir,
        )
    if include_ocr_probe:
        report["ocr_probe"] = {
            "enabled": True,
            "sample_limit": ocr_sample_limit,
            "mode": "read-only-detail-html-preflight",
        }
        report["field_gap_summary"] = build_field_gap_summary(rows)
        report["ocr_summary"] = dict(sorted(ocr_summary.items()))
        report["ocr_probe_candidates"] = [
            row
            for row in rows
            if isinstance(row.get("ocr_probe"), dict)
            and row["ocr_probe"].get("classification") in OCR_PROBE_CANDIDATE_CLASSIFICATIONS
        ]
        report["poster_or_attachment_candidates"] = [
            row
            for row in rows
            if isinstance(row.get("ocr_probe"), dict)
            and row["ocr_probe"].get("classification") in POSTER_ATTACHMENT_CLASSIFICATIONS
        ]
        report["detail_probe_inconclusive_sources"] = [
            row
            for row in rows
            if isinstance(row.get("ocr_probe"), dict)
            and row["ocr_probe"].get("classification") in DETAIL_PROBE_INCONCLUSIVE_CLASSIFICATIONS
        ]
    return report


def build_source_diagnostic(
    collector: BaseHtmlCollector,
    *,
    include_ocr_probe: bool = False,
    ocr_sample_limit: int = 3,
    include_scheduler_summary: bool = False,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
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
    normalized_rows: list[dict[str, Any]] = []

    try:
        raw_items = collector.collect()
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
        row["_url_diagnostics"] = list(getattr(collector, "last_collect_url_diagnostics", []))
        row["url_diagnostics"] = sanitize_url_diagnostics(row["_url_diagnostics"])
        if include_ocr_probe:
            row["ocr_probe"] = build_ocr_probe(
                collector,
                raw_items,
                sample_limit=ocr_sample_limit,
            )
            row["field_gap_audit"] = summarize_program_field_gaps(
                normalized_rows,
                sample_limit=FIELD_GAP_SAMPLE_LIMIT,
            )
    except Exception as exc:
        row["raw_count"] = 0
        row["normalized_count"] = 0
        row["normalize_failed"] = 0
        row["last_collect_status"] = "collector_exception"
        row["last_collect_message"] = f"{type(exc).__name__}: {exc}"
        row["_url_diagnostics"] = []
        row["url_diagnostics"] = []
    finally:
        row["duration_ms"] = round((perf_counter() - started) * 1000, 2)

    source_run_counts = summarize_source_run_counts(
        message=str(row.get("last_collect_message") or ""),
        url_diagnostics=row.get("_url_diagnostics"),
    )
    row["repeated_parse_empty_in_run"] = source_run_counts["parse_empty"] >= 2
    classification, evidence, recommendation = classify_source(
        status=str(row.get("last_collect_status") or ""),
        message=str(row.get("last_collect_message") or ""),
        raw_count=int(row.get("raw_count") or 0),
        normalized_count=int(row.get("normalized_count") or 0),
        normalize_failed=int(row.get("normalize_failed") or 0),
        parse_empty_count=source_run_counts["parse_empty"],
        request_failed_count=source_run_counts["request_failed"],
    )
    row["classification"] = classification
    row["evidence"] = evidence
    row["recommendation"] = recommendation
    row["playwright_probe_candidate"] = classification in PLAYWRIGHT_PROBE_CLASSIFICATIONS
    if include_scheduler_summary:
        row["scheduler_dry_run"] = build_scheduler_source_summary(
            raw_count=int(row.get("raw_count") or 0),
            normalized_rows=normalized_rows,
            source_status=str(row.get("last_collect_status") or ""),
            source_message=str(row.get("last_collect_message") or ""),
        )
    return row, normalized_rows


def sanitize_url_diagnostics(url_diagnostics: Iterable[Any]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for diagnostic in url_diagnostics:
        if not isinstance(diagnostic, dict):
            continue
        snapshot = diagnostic.get("html_snapshot")
        cleaned_snapshot = None
        if isinstance(snapshot, dict):
            cleaned_snapshot = {
                key: value
                for key, value in snapshot.items()
                if key != "html_preview"
            }
        cleaned_diagnostic = {
            "url": str(diagnostic.get("url") or ""),
            "request_status": str(diagnostic.get("request_status") or ""),
            "parse_status": str(diagnostic.get("parse_status") or ""),
            "item_count": int(diagnostic.get("item_count") or 0),
        }
        if diagnostic.get("error"):
            cleaned_diagnostic["error"] = str(diagnostic.get("error"))
        if cleaned_snapshot is not None:
            cleaned_diagnostic["html_snapshot"] = cleaned_snapshot
        cleaned.append(cleaned_diagnostic)
    return cleaned


def build_scheduler_schema_refs() -> dict[str, Any]:
    return {
        "scheduler_summary_bundle": {
            "schema_path": SCHEDULER_SUMMARY_SCHEMA_RELATIVE_PATH,
            "program_quality_summary_schema": PROGRAM_QUALITY_SUMMARY_SCHEMA_ID,
            "scheduler_source_summary_schema": SCHEDULER_SOURCE_SUMMARY_SCHEMA_ID,
            "scheduler_dry_run_summary_schema": SCHEDULER_DRY_RUN_SUMMARY_SCHEMA_ID,
        }
    }


def build_scheduler_source_summary(
    *,
    raw_count: int,
    normalized_rows: list[dict[str, Any]],
    source_status: str,
    source_message: str,
) -> dict[str, Any]:
    quality_summary = summarize_program_quality(normalized_rows) if normalized_rows else None
    if normalized_rows:
        return {
            "schema_id": SCHEDULER_SOURCE_SUMMARY_SCHEMA_ID,
            "schema_path": SCHEDULER_SUMMARY_SCHEMA_RELATIVE_PATH,
            "status": "dry_run",
            "raw_count": raw_count,
            "deduped_row_count": len(normalized_rows),
            "message": _format_dry_run_message(
                raw_count,
                len(normalized_rows),
                source_message,
            ),
            "quality": quality_summary,
        }
    return {
        "schema_id": SCHEDULER_SOURCE_SUMMARY_SCHEMA_ID,
        "schema_path": SCHEDULER_SUMMARY_SCHEMA_RELATIVE_PATH,
        "status": source_status or "empty",
        "raw_count": raw_count,
        "deduped_row_count": len(normalized_rows),
        "message": source_message or "No rows to save after normalization",
        "quality": quality_summary,
    }


def build_scheduler_dry_run_summary(
    rows: list[dict[str, Any]],
    *,
    normalized_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    status_counts: dict[str, int] = {}
    sources_with_quality_errors = 0
    sources_with_quality_warnings = 0
    for row in rows:
        scheduler_summary = row.get("scheduler_dry_run")
        if not isinstance(scheduler_summary, dict):
            continue
        status = str(scheduler_summary.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
        quality = scheduler_summary.get("quality")
        if isinstance(quality, dict):
            if int(quality.get("rows_with_errors") or 0) > 0:
                sources_with_quality_errors += 1
            if int(quality.get("rows_with_warnings") or 0) > 0:
                sources_with_quality_warnings += 1
    quality_summary = summarize_program_quality(normalized_rows)
    return {
        "schema_id": SCHEDULER_DRY_RUN_SUMMARY_SCHEMA_ID,
        "schema_path": SCHEDULER_SUMMARY_SCHEMA_RELATIVE_PATH,
        "enabled": True,
        "source_count": len(rows),
        "status_counts": dict(sorted(status_counts.items())),
        "sources_with_quality_errors": sources_with_quality_errors,
        "sources_with_quality_warnings": sources_with_quality_warnings,
        "quality": quality_summary,
    }


def persist_row_snapshots(
    row: dict[str, Any],
    *,
    snapshot_output_dir: Path,
) -> dict[str, Any]:
    saved_paths: list[str] = []
    source_key = str(row.get("source_key") or row.get("class_name") or "source")
    raw_diagnostics = row.get("_url_diagnostics") or row.get("url_diagnostics") or []
    cleaned_diagnostics = row.get("url_diagnostics") or []
    for index, diagnostic in enumerate(raw_diagnostics, start=1):
        if not isinstance(diagnostic, dict):
            continue
        snapshot_meta = diagnostic.get("html_snapshot")
        if not isinstance(snapshot_meta, dict):
            continue
        if str(row.get("classification") or "") not in SNAPSHOT_RELEVANT_SOURCE_CLASSIFICATIONS:
            continue
        saved_path = write_html_snapshot_file(
            snapshot_output_dir=snapshot_output_dir,
            source_key=source_key,
            label=f"list-{index}-{diagnostic.get('parse_status', 'snapshot')}",
            url=str(diagnostic.get("url") or ""),
            html_preview=str(snapshot_meta.get("html_preview") or ""),
            metadata=snapshot_meta,
        )
        if index - 1 < len(cleaned_diagnostics) and isinstance(cleaned_diagnostics[index - 1], dict):
            cleaned_diagnostics[index - 1]["snapshot_path"] = str(saved_path)
        saved_paths.append(str(saved_path))
    return {
        "saved_count": len(saved_paths),
        "saved_paths": saved_paths,
    }


def build_snapshot_capture_summary(
    rows: list[dict[str, Any]],
    *,
    snapshot_output_dir: Path,
) -> dict[str, Any]:
    saved_paths: list[str] = []
    for row in rows:
        capture = row.get("snapshot_capture")
        if not isinstance(capture, dict):
            continue
        for path in capture.get("saved_paths") or []:
            saved_paths.append(str(path))
    return {
        "enabled": True,
        "output_dir": str(snapshot_output_dir),
        "saved_count": len(saved_paths),
        "saved_paths": saved_paths,
    }


def build_field_gap_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    issue_codes: dict[str, int] = {}
    issue_fields: dict[str, int] = {}
    source_count_with_any_issues = 0
    source_count_with_only_info_issues = 0
    source_count_with_warning_or_error_follow_up = 0

    for row in rows:
        field_gap_audit = row.get("field_gap_audit")
        if not isinstance(field_gap_audit, dict):
            continue
        if int(field_gap_audit.get("rows_with_any_issues") or 0) > 0:
            source_count_with_any_issues += 1
        checked_rows = int(field_gap_audit.get("checked_rows") or 0)
        rows_with_info_only = int(field_gap_audit.get("rows_with_info_only") or 0)
        if checked_rows > 0 and checked_rows == rows_with_info_only:
            source_count_with_only_info_issues += 1
        if bool(field_gap_audit.get("warning_or_error_follow_up_needed")):
            source_count_with_warning_or_error_follow_up += 1
        for code, count in (field_gap_audit.get("issue_codes") or {}).items():
            issue_codes[str(code)] = issue_codes.get(str(code), 0) + int(count or 0)
        for field, count in (field_gap_audit.get("issue_fields") or {}).items():
            issue_fields[str(field)] = issue_fields.get(str(field), 0) + int(count or 0)

    return {
        "enabled": True,
        "source_count_with_any_issues": source_count_with_any_issues,
        "source_count_with_only_info_issues": source_count_with_only_info_issues,
        "source_count_with_warning_or_error_follow_up": source_count_with_warning_or_error_follow_up,
        "issue_codes": dict(sorted(issue_codes.items())),
        "issue_fields": dict(sorted(issue_fields.items())),
    }


def write_html_snapshot_file(
    *,
    snapshot_output_dir: Path,
    source_key: str,
    label: str,
    url: str,
    html_preview: str,
    metadata: dict[str, Any],
) -> Path:
    snapshot_output_dir.mkdir(parents=True, exist_ok=True)
    safe_source = _slugify(source_key)
    safe_label = _slugify(label)
    output_path = snapshot_output_dir / f"{safe_source}-{safe_label}.html"
    normalized_html = html_preview.replace("\r\n", "\n").replace("\r", "\n")
    normalized_html = "\n".join(line.rstrip() for line in normalized_html.split("\n"))
    selector_matches = metadata.get("selector_matches") or []
    selector_summary = "; ".join(
        "{selector}:{count}".format(
            selector=str(match.get("selector") or ""),
            count=int(match.get("match_count") or 0),
        )
        for match in selector_matches
        if isinstance(match, dict)
    )
    metadata_lines = [
        f"url={url}",
        f"html_length={metadata.get('html_length', 0)}",
        f"script_tag_count={metadata.get('script_tag_count', 0)}",
        f"noscript_tag_count={metadata.get('noscript_tag_count', 0)}",
        f"iframe_tag_count={metadata.get('iframe_tag_count', 0)}",
        f"form_tag_count={metadata.get('form_tag_count', 0)}",
        f"selectors_checked={metadata.get('selectors_checked', 0)}",
        f"selectors_with_matches={metadata.get('selectors_with_matches', 0)}",
        f"selector_matches={selector_summary}",
        f"title_text={metadata.get('title_text', '')}",
    ]
    output_path.write_text(
        "<!--\n"
        + "\n".join(metadata_lines)
        + "\n-->\n"
        + normalized_html,
        encoding="utf-8",
    )
    return output_path


def build_ocr_probe(
    collector: BaseHtmlCollector,
    raw_items: list[dict[str, Any]],
    *,
    sample_limit: int = 3,
) -> dict[str, Any]:
    profiles = [_build_item_probe_profile(item) for item in raw_items]
    short_list_text_count = sum(
        1 for profile in profiles if profile["list_text_length"] < SHORT_LIST_TEXT_THRESHOLD
    )
    attachment_signal_count = sum(1 for profile in profiles if profile["attachment_signal"])
    image_signal_count = sum(1 for profile in profiles if profile["image_signal"])

    detail_results: list[dict[str, Any]] = []
    should_probe_details = bool(profiles) and (
        short_list_text_count / len(profiles) >= 0.5
        or attachment_signal_count > 0
        or image_signal_count > 0
    )
    if should_probe_details:
        for profile in profiles[: max(sample_limit, 0)]:
            detail_results.append(_probe_detail_html_for_ocr(collector, profile))

    detail_checked = sum(1 for result in detail_results if result["status"] == "fetched")
    detail_fetch_failed = sum(1 for result in detail_results if result["status"] == "fetch_failed")
    detail_attachment_count = sum(
        int(result.get("attachment_link_count") or 0) for result in detail_results
    )
    detail_low_text_image_count = sum(
        1
        for result in detail_results
        if result["status"] == "fetched"
        and int(result.get("visible_text_length") or 0) < LOW_DETAIL_TEXT_THRESHOLD
        and int(result.get("image_count") or 0) > 0
    )
    detail_text_sufficient_count = sum(
        1
        for result in detail_results
        if result["status"] == "fetched"
        and int(result.get("visible_text_length") or 0) >= SUFFICIENT_DETAIL_TEXT_THRESHOLD
    )
    source_attachment_url_samples = _collect_probe_url_samples(
        detail_results,
        key="attachment_urls",
        limit=SOURCE_URL_SAMPLE_LIMIT,
    )
    source_image_url_samples = _collect_probe_url_samples(
        detail_results,
        key="image_urls",
        limit=SOURCE_URL_SAMPLE_LIMIT,
    )

    classification, evidence, recommendation = classify_ocr_probe(
        item_count=len(raw_items),
        short_list_text_count=short_list_text_count,
        attachment_signal_count=attachment_signal_count,
        image_signal_count=image_signal_count,
        detail_checked=detail_checked,
        detail_fetch_failed=detail_fetch_failed,
        detail_attachment_count=detail_attachment_count,
        detail_low_text_image_count=detail_low_text_image_count,
        detail_text_sufficient_count=detail_text_sufficient_count,
    )
    return {
        "classification": classification,
        "evidence": evidence,
        "recommendation": recommendation,
        "item_count": len(raw_items),
        "short_list_text_count": short_list_text_count,
        "attachment_signal_count": attachment_signal_count,
        "image_signal_count": image_signal_count,
        "detail_checked": detail_checked,
        "detail_fetch_failed": detail_fetch_failed,
        "detail_attachment_count": detail_attachment_count,
        "detail_low_text_image_count": detail_low_text_image_count,
        "detail_text_sufficient_count": detail_text_sufficient_count,
        "source_attachment_url_samples": source_attachment_url_samples,
        "source_image_url_samples": source_image_url_samples,
        "samples": detail_results,
    }


def classify_ocr_probe(
    *,
    item_count: int,
    short_list_text_count: int,
    attachment_signal_count: int,
    image_signal_count: int,
    detail_checked: int,
    detail_fetch_failed: int,
    detail_attachment_count: int,
    detail_low_text_image_count: int,
    detail_text_sufficient_count: int,
) -> tuple[str, list[str], str]:
    evidence = [
        f"items={item_count}",
        f"short_list_text={short_list_text_count}",
        f"attachment_signals={attachment_signal_count}",
        f"image_signals={image_signal_count}",
    ]
    if detail_checked or detail_fetch_failed:
        evidence.extend(
            [
                f"detail_checked={detail_checked}",
                f"detail_fetch_failed={detail_fetch_failed}",
                f"detail_attachments={detail_attachment_count}",
                f"detail_low_text_images={detail_low_text_image_count}",
                f"detail_text_sufficient={detail_text_sufficient_count}",
            ]
        )

    if item_count == 0:
        return (
            "no_items_no_ocr_probe",
            evidence,
            "수집 item이 없어 OCR 후보를 판단할 수 없다. 먼저 parse-empty/request failure 원인을 분리한다.",
        )

    if detail_low_text_image_count > 0:
        return (
            "ocr_probe_candidate",
            evidence,
            "detail HTML 본문 텍스트가 짧고 이미지가 있어 포스터형 공고 가능성이 있다. OCR 런타임 도입 전 source별 샘플 snapshot과 필드 누락률을 확인한다.",
        )

    if attachment_signal_count > 0 or image_signal_count > 0 or detail_attachment_count > 0:
        return (
            "poster_or_attachment_candidate",
            evidence,
            "목록 또는 detail HTML에서 이미지/첨부 신호가 있다. OCR은 source별 opt-in으로 두고, 먼저 해당 첨부/이미지에서 필수 필드가 실제로 빠지는지 샘플 검증한다.",
        )

    if short_list_text_count > 0 and detail_checked == 0:
        return (
            "detail_probe_inconclusive",
            evidence,
            "목록 텍스트가 짧지만 detail HTML 확인이 부족하다. OCR보다 detail page text/attachment snapshot 진단을 먼저 보강한다.",
        )

    if short_list_text_count > 0 and detail_checked > 0 and detail_text_sufficient_count == 0:
        return (
            "detail_probe_inconclusive",
            evidence,
            "목록 텍스트가 짧고 샘플 detail에서도 충분한 본문 텍스트를 확인하지 못했다. OCR보다 detail parser/selector 보강 가능성을 먼저 확인한다.",
        )

    if detail_checked > 0 and detail_text_sufficient_count == 0 and detail_fetch_failed:
        return (
            "detail_probe_inconclusive",
            evidence,
            "detail HTML fetch가 실패했거나 충분한 텍스트를 확인하지 못했다. 네트워크/권한/selector drift를 OCR 후보 판단보다 먼저 분리한다.",
        )

    return (
        "text_sufficient_no_ocr",
        evidence,
        "현재 목록/detail HTML 텍스트로 수집 근거가 충분하거나 이미지/첨부 신호가 없다. OCR opt-in 대상에서 제외한다.",
    )


def _build_item_probe_profile(item: dict[str, Any]) -> dict[str, Any]:
    title = _normalize_space(str(item.get("title") or ""))
    link = str(item.get("link") or "").strip()
    raw_text = _raw_to_text(item.get("raw"))
    combined_text = _normalize_space(" ".join([title, raw_text]))
    haystack = " ".join([title, link, raw_text]).lower()
    return {
        "title": title,
        "link": link,
        "list_text_length": len(combined_text),
        "attachment_signal": _has_attachment_signal(haystack),
        "image_signal": _has_image_signal(haystack),
    }


def _probe_detail_html_for_ocr(
    collector: BaseHtmlCollector,
    profile: dict[str, Any],
) -> dict[str, Any]:
    link = str(profile.get("link") or "")
    result: dict[str, Any] = {
        "title": str(profile.get("title") or "")[:120],
        "link": link,
        "list_text_length": profile.get("list_text_length", 0),
        "attachment_signal": bool(profile.get("attachment_signal")),
        "image_signal": bool(profile.get("image_signal")),
        "attachment_urls": [],
        "image_urls": [],
    }
    if not link.startswith(("http://", "https://")):
        return {**result, "status": "skipped_non_http"}
    if _url_has_extension(link, ATTACHMENT_EXTENSIONS):
        return {
            **result,
            "status": "direct_attachment",
            "visible_text_length": 0,
            "image_count": 0,
            "attachment_link_count": 1,
            "attachment_urls": [link],
            "image_urls": [],
        }
    if _url_has_extension(link, IMAGE_EXTENSIONS):
        return {
            **result,
            "status": "direct_image",
            "visible_text_length": 0,
            "image_count": 1,
            "attachment_link_count": 0,
            "attachment_urls": [],
            "image_urls": [link],
        }

    try:
        html = collector.fetch_html(link)
    except Exception as exc:
        return {**result, "status": "fetch_failed", "error": f"{type(exc).__name__}: {exc}"}

    soup = collector.soup_from_html(html)
    for tag in soup.select("script, style, noscript"):
        tag.decompose()
    visible_text = _normalize_space(soup.get_text(" ", strip=True))
    image_urls = _sample_unique_urls(
        [
            urljoin(link, str(node.get("src") or "").strip())
            for node in soup.select("img[src]")
            if str(node.get("src") or "").strip()
        ],
        limit=DETAIL_URL_SAMPLE_LIMIT,
    )
    image_count = len([node for node in soup.select("img[src]") if node.get("src")])
    attachment_links = []
    for anchor in soup.select("a[href]"):
        href = str(anchor.get("href") or "")
        anchor_text = _normalize_space(anchor.get_text(" ", strip=True))
        if _has_attachment_signal(f"{href} {anchor_text}".lower()):
            attachment_links.append(urljoin(link, href.strip()))
    attachment_urls = _sample_unique_urls(
        attachment_links,
        limit=DETAIL_URL_SAMPLE_LIMIT,
    )
    return {
        **result,
        "status": "fetched",
        "visible_text_length": len(visible_text),
        "image_count": image_count,
        "attachment_link_count": len(attachment_links),
        "attachment_urls": attachment_urls,
        "image_urls": image_urls,
    }


def _raw_to_text(raw: Any) -> str:
    if isinstance(raw, dict):
        return _normalize_space(" ".join(str(value or "") for value in raw.values()))
    if isinstance(raw, list):
        return _normalize_space(" ".join(str(value or "") for value in raw))
    return _normalize_space(str(raw or ""))


def _has_attachment_signal(value: str) -> bool:
    lowered = value.lower()
    return any(token in lowered for token in ATTACHMENT_KEYWORDS) or _url_has_extension(
        lowered,
        ATTACHMENT_EXTENSIONS,
    )


def _has_image_signal(value: str) -> bool:
    lowered = value.lower()
    return any(token in lowered for token in IMAGE_KEYWORDS) or _url_has_extension(
        lowered,
        IMAGE_EXTENSIONS,
    )


def _url_has_extension(value: str, extensions: tuple[str, ...]) -> bool:
    lowered = value.lower().split("?", 1)[0].split("#", 1)[0]
    return any(lowered.endswith(extension) for extension in extensions)


def _normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _sample_unique_urls(values: Iterable[str], *, limit: int) -> list[str]:
    unique_values: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = str(value or "").strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        unique_values.append(cleaned)
        if len(unique_values) >= limit:
            break
    return unique_values


def _collect_probe_url_samples(
    detail_results: Iterable[dict[str, Any]],
    *,
    key: str,
    limit: int,
) -> list[str]:
    collected: list[str] = []
    for result in detail_results:
        values = result.get(key) or []
        if not isinstance(values, list):
            continue
        for value in values:
            cleaned = str(value or "").strip()
            if not cleaned or cleaned in collected:
                continue
            collected.append(cleaned)
            if len(collected) >= limit:
                return collected
    return collected


def summarize_source_run_counts(
    *,
    message: str,
    url_diagnostics: Iterable[Any] | None,
) -> dict[str, int]:
    parse_empty_count = 0
    request_failed_count = 0
    has_structured_diagnostics = False

    for diagnostic in url_diagnostics or []:
        if not isinstance(diagnostic, dict):
            continue
        has_structured_diagnostics = True
        if str(diagnostic.get("request_status") or "") == "request_failed":
            request_failed_count += 1
        if str(diagnostic.get("parse_status") or "") in {"parse_empty", "parse_failed"}:
            parse_empty_count += 1

    if has_structured_diagnostics:
        return {
            "parse_empty": parse_empty_count,
            "request_failed": request_failed_count,
        }

    return {
        "parse_empty": _int_from(r"parse_empty=(\d+)", message) or 0,
        "request_failed": _int_from(r"request_failed=(\d+)", message) or 0,
    }


def classify_source(
    *,
    status: str,
    message: str,
    raw_count: int,
    normalized_count: int,
    normalize_failed: int,
    parse_empty_count: int | None = None,
    request_failed_count: int | None = None,
) -> tuple[str, list[str], str]:
    lowered = message.lower()
    parse_empty = parse_empty_count
    if parse_empty is None:
        parse_empty = _int_from(r"parse_empty=(\d+)", message)
    request_failed = request_failed_count
    if request_failed is None:
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
            "| Source | Class | Raw | Normalized | Duration ms | Status | Classification | repeated_parse_empty_in_run |",
            "| --- | --- | ---: | ---: | ---: | --- | --- | --- |",
        ]
    )
    for row in report["sources"]:
        lines.append(
            "| {source} | `{class_name}` | {raw_count} | {normalized_count} | {duration_ms} | {status} | {classification} | {repeated_parse_empty_in_run} |".format(
                source=_escape_table(str(row["source"])),
                class_name=row["class_name"],
                raw_count=row["raw_count"],
                normalized_count=row["normalized_count"],
                duration_ms=row.get("duration_ms", 0),
                status=_escape_table(str(row["last_collect_status"])),
                classification=row["classification"],
                repeated_parse_empty_in_run=str(
                    bool(row.get("repeated_parse_empty_in_run"))
                ).lower(),
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
                "- repeated_parse_empty_in_run: `{}`".format(
                    str(bool(row.get("repeated_parse_empty_in_run"))).lower()
                ),
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

    if report.get("snapshot_capture", {}).get("enabled"):
        lines.extend(
            [
                "## HTML Snapshots",
                "",
                f"- Output directory: `{report['snapshot_capture']['output_dir']}`",
                f"- Saved snapshots: `{report['snapshot_capture']['saved_count']}`",
                "",
            ]
        )
        for row in report["sources"]:
            capture = row.get("snapshot_capture")
            if not isinstance(capture, dict) or not capture.get("saved_paths"):
                continue
            lines.append(f"### {row['source']}")
            lines.append("")
            for diagnostic in row.get("url_diagnostics") or []:
                if not isinstance(diagnostic, dict) or not diagnostic.get("snapshot_path"):
                    continue
                snapshot = diagnostic.get("html_snapshot") or {}
                lines.append(
                    "- `{parse_status}` `{url}` -> `{path}` (title=`{title}`, scripts={scripts}, noscript={noscript}, selector_hits={selector_hits}/{selectors_checked})".format(
                        parse_status=diagnostic.get("parse_status", "snapshot"),
                        url=diagnostic.get("url", ""),
                        path=diagnostic.get("snapshot_path", ""),
                        title=snapshot.get("title_text", ""),
                        scripts=snapshot.get("script_tag_count", 0),
                        noscript=snapshot.get("noscript_tag_count", 0),
                        selector_hits=snapshot.get("selectors_with_matches", 0),
                        selectors_checked=snapshot.get("selectors_checked", 0),
                    )
                )
            lines.append("")

    if report.get("scheduler_dry_run", {}).get("enabled"):
        scheduler_summary = report["scheduler_dry_run"]
        schema_bundle = (report.get("schemas") or {}).get("scheduler_summary_bundle") or {}
        lines.extend(
            [
                "## Scheduler Dry-Run Summary",
                "",
                f"- HTML sources: `{scheduler_summary['source_count']}`",
                f"- Sources with quality warnings: `{scheduler_summary['sources_with_quality_warnings']}`",
                f"- Sources with quality errors: `{scheduler_summary['sources_with_quality_errors']}`",
                f"- Schema path: `{schema_bundle.get('schema_path', '')}`",
                "",
            ]
        )
        for status, count in scheduler_summary.get("status_counts", {}).items():
            lines.append(f"- `{status}`: `{count}`")
        quality = scheduler_summary.get("quality") or {}
        lines.extend(
            [
                "",
                "| Source | Dry-run status | Checked rows | Warnings | Errors |",
                "| --- | --- | ---: | ---: | ---: |",
            ]
        )
        for row in report["sources"]:
            scheduler_source = row.get("scheduler_dry_run") or {}
            source_quality = scheduler_source.get("quality") or {}
            lines.append(
                "| {source} | {status} | {checked_rows} | {warnings} | {errors} |".format(
                    source=_escape_table(str(row["source"])),
                    status=scheduler_source.get("status", ""),
                    checked_rows=(source_quality or {}).get("checked_rows", 0),
                    warnings=(source_quality or {}).get("rows_with_warnings", 0),
                    errors=(source_quality or {}).get("rows_with_errors", 0),
                )
            )
        lines.extend(
            [
                "",
                "- Aggregated quality checked rows: `{}`".format(quality.get("checked_rows", 0)),
                "- Aggregated issue counts: `error={}, warning={}, info={}`".format(
                    (quality.get("issue_counts") or {}).get("error", 0),
                    (quality.get("issue_counts") or {}).get("warning", 0),
                    (quality.get("issue_counts") or {}).get("info", 0),
                ),
                "",
            ]
        )

    if report.get("ocr_probe", {}).get("enabled"):
        ocr_candidates = report.get("ocr_probe_candidates", [])
        poster_or_attachment_candidates = report.get("poster_or_attachment_candidates", [])
        inconclusive_sources = report.get("detail_probe_inconclusive_sources", [])
        field_gap_summary = report.get("field_gap_summary") or {}
        lines.extend(
            [
                "## OCR / Image Preflight",
                "",
                f"- Mode: `{report['ocr_probe']['mode']}`",
                f"- Detail sample limit per source: `{report['ocr_probe']['sample_limit']}`",
                f"- OCR runtime opt-in candidates: `{len(ocr_candidates)}`",
                f"- Poster/attachment review candidates: `{len(poster_or_attachment_candidates)}`",
                f"- Detail/parser follow-up candidates: `{len(inconclusive_sources)}`",
                f"- Sources with any field gaps: `{field_gap_summary.get('source_count_with_any_issues', 0)}`",
                f"- Sources with warning/error follow-up needed: `{field_gap_summary.get('source_count_with_warning_or_error_follow_up', 0)}`",
                f"- Sources with info-only field gaps: `{field_gap_summary.get('source_count_with_only_info_issues', 0)}`",
                "",
            ]
        )
        for classification, count in report.get("ocr_summary", {}).items():
            lines.append(f"- `{classification}`: `{count}`")
        issue_fields = field_gap_summary.get("issue_fields") or {}
        if issue_fields:
            lines.append(
                "- Aggregated field gaps: {}".format(
                    ", ".join(f"`{field}={count}`" for field, count in issue_fields.items())
                )
            )

        lines.extend(
            [
                "",
                "| Source | OCR classification | Field gap rows | Field gap follow-up | Top field gaps | Evidence |",
                "| --- | --- | ---: | --- | --- | --- |",
            ]
        )
        for row in report["sources"]:
            ocr_probe = row.get("ocr_probe") or {}
            if not isinstance(ocr_probe, dict):
                continue
            field_gap_audit = row.get("field_gap_audit") or {}
            gap_fields = field_gap_audit.get("issue_fields") or {}
            gap_summary = ", ".join(
                f"{field}={count}" for field, count in list(gap_fields.items())[:3]
            )
            lines.append(
                "| {source} | {classification} | {gap_rows} | {follow_up_bucket} | {gap_summary} | {evidence} |".format(
                    source=_escape_table(str(row["source"])),
                    classification=ocr_probe.get("classification", "unknown"),
                    gap_rows=field_gap_audit.get("rows_with_any_issues", 0),
                    follow_up_bucket=_escape_table(
                        str(field_gap_audit.get("field_gap_follow_up_bucket") or "none")
                    ),
                    gap_summary=_escape_table(gap_summary or "-"),
                    evidence=_escape_table(", ".join(str(item) for item in ocr_probe.get("evidence", []))),
                )
            )

        lines.extend(["", "### OCR Sample Highlights", ""])
        for row in report["sources"]:
            ocr_probe = row.get("ocr_probe") or {}
            if not isinstance(ocr_probe, dict):
                continue
            if ocr_probe.get("classification") not in (
                *OCR_PROBE_CANDIDATE_CLASSIFICATIONS,
                *POSTER_ATTACHMENT_CLASSIFICATIONS,
                *DETAIL_PROBE_INCONCLUSIVE_CLASSIFICATIONS,
            ):
                continue
            samples = [sample for sample in (ocr_probe.get("samples") or []) if isinstance(sample, dict)]
            if not samples:
                continue
            lines.append(f"#### {row['source']}")
            lines.append("")
            field_gap_audit = row.get("field_gap_audit") or {}
            if isinstance(field_gap_audit, dict) and field_gap_audit.get("checked_rows", 0):
                lines.append(
                    "- Field gap audit: checked_rows={checked}, rows_with_any_issues={rows_with_issues}, rows_with_info_only={rows_with_info_only}, rows_with_warning_or_error={rows_with_warning_or_error}, follow_up_bucket={follow_up_bucket}".format(
                        checked=field_gap_audit.get("checked_rows", 0),
                        rows_with_issues=field_gap_audit.get("rows_with_any_issues", 0),
                        rows_with_info_only=field_gap_audit.get("rows_with_info_only", 0),
                        rows_with_warning_or_error=field_gap_audit.get("rows_with_warning_or_error", 0),
                        follow_up_bucket=field_gap_audit.get("field_gap_follow_up_bucket", "none"),
                    )
                )
                issue_codes = field_gap_audit.get("issue_codes") or {}
                if issue_codes:
                    lines.append(
                        "- Field gap issue codes: {}".format(
                            ", ".join(f"`{code}={count}`" for code, count in issue_codes.items())
                        )
                    )
            attachment_samples = ocr_probe.get("source_attachment_url_samples") or []
            image_samples = ocr_probe.get("source_image_url_samples") or []
            if attachment_samples:
                lines.append(
                    "- Attachment URL samples: {}".format(
                        ", ".join(f"`{value}`" for value in attachment_samples)
                    )
                )
            if image_samples:
                lines.append(
                    "- Image URL samples: {}".format(
                        ", ".join(f"`{value}`" for value in image_samples)
                    )
                )
            for sample in samples:
                lines.append(
                    "- `{status}` `{link}` (text={text_len}, images={images}, attachments={attachments})".format(
                        status=sample.get("status", ""),
                        link=sample.get("link", ""),
                        text_len=sample.get("visible_text_length", 0),
                        images=sample.get("image_count", 0),
                        attachments=sample.get("attachment_link_count", 0),
                    )
                )
                attachment_urls = sample.get("attachment_urls") or []
                image_urls = sample.get("image_urls") or []
                if attachment_urls:
                    lines.append(
                        "  attachment URLs: {}".format(
                            ", ".join(f"`{value}`" for value in attachment_urls)
                        )
                    )
                if image_urls:
                    lines.append(
                        "  image URLs: {}".format(
                            ", ".join(f"`{value}`" for value in image_urls)
                        )
                    )
            for sample in field_gap_audit.get("samples") or []:
                if not isinstance(sample, dict):
                    continue
                lines.append(
                    "  field gap sample: `{title}` issues={issues}".format(
                        title=sample.get("title", ""),
                        issues=", ".join(str(code) for code in sample.get("issue_codes", [])),
                    )
                )
            lines.append("")

        lines.extend(["", "## OCR Decision", ""])
        if ocr_candidates:
            lines.append(
                "Keep OCR behind source-specific opt-in for the listed candidates after confirming field gaps from sampled image or attachment snapshots."
            )
        elif poster_or_attachment_candidates:
            lines.append(
                "No source currently has enough evidence for OCR runtime adoption. Poster/attachment signals exist, but sampled detail HTML still exposes enough text; verify field gaps before proposing source-specific OCR opt-in."
            )
        else:
            lines.append(
                "No source currently has enough evidence for OCR runtime adoption. Keep OCR work at read-only image/attachment preflight until poster or attachment-centered field gaps are confirmed."
            )
        lines.append("")

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
    parser.add_argument(
        "--include-ocr-probe",
        action="store_true",
        help="Also run a read-only image/attachment preflight over sampled detail HTML.",
    )
    parser.add_argument(
        "--ocr-sample-limit",
        type=int,
        default=3,
        help="Maximum detail pages to inspect per source when --include-ocr-probe is set.",
    )
    parser.add_argument(
        "--include-scheduler-summary",
        action="store_true",
        help="Attach scheduler-style dry-run quality summary for the same HTML diagnostic rows.",
    )
    parser.add_argument(
        "--snapshot-output-dir",
        type=Path,
        help="Optional directory where bounded HTML snapshots for parse-empty URLs are written.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_stdout()
    args = build_parser().parse_args(argv)
    report = build_html_collector_report(
        source_filters=args.source,
        include_ocr_probe=args.include_ocr_probe,
        ocr_sample_limit=args.ocr_sample_limit,
        include_scheduler_summary=args.include_scheduler_summary,
        snapshot_output_dir=args.snapshot_output_dir,
    )
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


def _slugify(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z._-]+", "-", value or "").strip("-")
    return slug or "snapshot"


if __name__ == "__main__":
    raise SystemExit(main())
