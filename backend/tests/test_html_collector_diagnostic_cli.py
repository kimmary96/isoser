from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts.html_collector_diagnostic import (
    BaseHtmlCollector,
    build_html_collector_report,
    classify_source,
    classify_ocr_probe,
    render_markdown_report,
    write_json_report,
    write_markdown_report,
)

SCHEDULER_SUMMARY_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "schemas"
    / "html-collector-scheduler-summary.schema.json"
)


class _FixtureHtmlCollector(BaseHtmlCollector):
    tier = 2
    source_key = "fixture_html"
    source_name = "Fixture HTML"
    list_urls = ["https://example.com/list"]

    def __init__(
        self,
        *,
        status: str,
        message: str,
        items: list[dict] | None = None,
        detail_html_by_url: dict[str, str] | None = None,
        url_diagnostics: list[dict] | None = None,
    ) -> None:
        self.fixture_status = status
        self.fixture_message = message
        self.fixture_items = items or []
        self.detail_html_by_url = detail_html_by_url or {}
        self.fixture_url_diagnostics = url_diagnostics or []

    def collect_items(self):
        self.last_collect_status = self.fixture_status
        self.last_collect_message = self.fixture_message
        self.last_collect_url_diagnostics = list(self.fixture_url_diagnostics)
        return self.fixture_items

    def fetch_html(self, url: str) -> str:
        return self.detail_html_by_url[url]


def _raw_item(title: str = "HTML 취업 과정") -> dict:
    return {
        "title": title,
        "link": "https://example.com/program/1",
        "raw_deadline": "2026-05-01",
        "category_hint": "교육",
        "source_meta": {
            "tier": 2,
            "source_key": "fixture_html",
            "source_type": "seoul_city",
            "source_name": "Fixture HTML",
            "collection_method": "web_crawl",
            "scope": "seoul",
            "region": "서울",
            "region_detail": "서울",
        },
        "raw": {"id": "1"},
    }


def _load_scheduler_schema_defs() -> dict[str, Any]:
    return json.loads(SCHEDULER_SUMMARY_SCHEMA_PATH.read_text(encoding="utf-8"))["$defs"]


def _resolve_schema(schema_defs: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    ref = schema.get("$ref")
    if isinstance(ref, str) and ref.startswith("#/$defs/"):
        return schema_defs[ref.split("/")[-1]]
    return schema


def _assert_matches_schema(
    schema_defs: dict[str, Any],
    schema: dict[str, Any],
    value: Any,
    *,
    path: str,
) -> None:
    schema = _resolve_schema(schema_defs, schema)
    if "oneOf" in schema:
        errors: list[str] = []
        for option in schema["oneOf"]:
            try:
                _assert_matches_schema(schema_defs, option, value, path=path)
                return
            except AssertionError as exc:
                errors.append(str(exc))
        raise AssertionError(f"{path} did not match any allowed schema: {errors}")

    if "const" in schema:
        assert value == schema["const"], f"{path} expected const {schema['const']!r}, got {value!r}"

    schema_type = schema.get("type")
    if schema_type == "object":
        assert isinstance(value, dict), f"{path} expected object, got {type(value).__name__}"
        required = set(schema.get("required") or [])
        missing = required - set(value)
        assert not missing, f"{path} missing required keys: {sorted(missing)}"

        properties = schema.get("properties") or {}
        additional_properties = schema.get("additionalProperties", True)
        if additional_properties is False:
            unexpected = set(value) - set(properties)
            assert not unexpected, f"{path} has unexpected keys: {sorted(unexpected)}"

        for key, item in value.items():
            property_schema = properties.get(key)
            if property_schema is not None:
                _assert_matches_schema(schema_defs, property_schema, item, path=f"{path}.{key}")
                continue
            if isinstance(additional_properties, dict):
                _assert_matches_schema(
                    schema_defs,
                    additional_properties,
                    item,
                    path=f"{path}.{key}",
                )
        return

    if schema_type == "integer":
        assert isinstance(value, int) and not isinstance(
            value, bool
        ), f"{path} expected integer, got {type(value).__name__}"
        minimum = schema.get("minimum")
        if minimum is not None:
            assert value >= minimum, f"{path} expected >= {minimum}, got {value}"
        return

    if schema_type == "string":
        assert isinstance(value, str), f"{path} expected string, got {type(value).__name__}"
        return

    if schema_type == "boolean":
        assert isinstance(value, bool), f"{path} expected boolean, got {type(value).__name__}"
        return

    if schema_type == "null":
        assert value is None, f"{path} expected null, got {value!r}"
        return


def test_classify_source_marks_full_parse_empty_as_playwright_probe_candidate() -> None:
    classification, evidence, recommendation = classify_source(
        status="parsing_failed",
        message="목록 0건; urls=2/2; request_failed=0; parse_empty=2",
        raw_count=0,
        normalized_count=0,
        normalize_failed=0,
    )

    assert classification == "playwright_probe_candidate"
    assert "parse_empty=2" in evidence
    assert "source별 opt-in" in recommendation


def test_classify_source_keeps_partial_parse_empty_as_monitoring_target() -> None:
    classification, evidence, recommendation = classify_source(
        status="success",
        message="collected 1 items from 2/2 urls; request_failed=0; parse_empty=1",
        raw_count=1,
        normalized_count=1,
        normalize_failed=0,
    )

    assert classification == "partial_parse_empty_monitor"
    assert "request_failed=0" in evidence
    assert "Playwright 도입 전" in recommendation


def test_build_html_collector_report_summarizes_html_sources_only() -> None:
    healthy = _FixtureHtmlCollector(
        status="success",
        message="Fixture HTML collected 1 items from 1/1 urls; request_failed=0; parse_empty=0",
        items=[_raw_item()],
    )
    empty = _FixtureHtmlCollector(
        status="parsing_failed",
        message="Fixture HTML 목록 0건; urls=1/1; request_failed=0; parse_empty=1",
    )

    report = build_html_collector_report([healthy, object(), empty])

    assert report["mode"] == "read-only-live-diagnostic"
    assert report["collector_count"] == 2
    assert report["duration_ms"] >= 0
    assert report["summary"] == {
        "healthy_static_html": 1,
        "playwright_probe_candidate": 1,
    }
    assert len(report["playwright_probe_candidates"]) == 1
    assert report["sources"][0]["repeated_parse_empty_in_run"] is False
    assert report["sources"][1]["repeated_parse_empty_in_run"] is False
    assert report["sources"][0]["normalized_count"] == 1


def test_build_html_collector_report_marks_repeated_parse_empty_in_run_for_current_run() -> None:
    collector = _FixtureHtmlCollector(
        status="success",
        message="Fixture HTML collected 1 items from 3/3 urls; request_failed=0; parse_empty=2",
        items=[_raw_item()],
        url_diagnostics=[
            {
                "url": "https://example.com/list-a",
                "request_status": "success",
                "parse_status": "parse_empty",
                "item_count": 0,
            },
            {
                "url": "https://example.com/list-b",
                "request_status": "success",
                "parse_status": "parse_failed",
                "item_count": 0,
                "error": "selector drift",
            },
            {
                "url": "https://example.com/list-c",
                "request_status": "success",
                "parse_status": "success",
                "item_count": 1,
            },
        ],
    )

    report = build_html_collector_report([collector])

    assert report["summary"] == {"partial_parse_empty_monitor": 1}
    assert report["sources"][0]["classification"] == "partial_parse_empty_monitor"
    assert report["sources"][0]["repeated_parse_empty_in_run"] is True


def test_build_html_collector_report_can_attach_scheduler_summary() -> None:
    collector = _FixtureHtmlCollector(
        status="success",
        message="Fixture HTML collected 1 items from 1/1 urls; request_failed=0; parse_empty=0",
        items=[_raw_item()],
    )

    report = build_html_collector_report(
        [collector],
        include_scheduler_summary=True,
    )

    assert report["scheduler_dry_run"]["enabled"] is True
    assert report["schemas"]["scheduler_summary_bundle"]["schema_path"] == "docs/schemas/html-collector-scheduler-summary.schema.json"
    assert report["scheduler_dry_run"]["schema_id"] == "scheduler_dry_run_summary_v1"
    assert report["scheduler_dry_run"]["quality"]["checked_rows"] == 1
    assert report["scheduler_dry_run"]["quality"]["issue_counts"]["info"] == 1
    assert report["sources"][0]["scheduler_dry_run"]["schema_id"] == "scheduler_source_summary_v1"
    assert report["sources"][0]["scheduler_dry_run"]["status"] == "dry_run"


def test_scheduler_summary_bundle_schema_smoke_validates_written_report_payloads(
    tmp_path: Path,
) -> None:
    collector = _FixtureHtmlCollector(
        status="success",
        message="Fixture HTML collected 1 items from 1/1 urls; request_failed=0; parse_empty=0",
        items=[_raw_item()],
    )

    report = build_html_collector_report(
        [collector],
        include_scheduler_summary=True,
    )
    output_path = tmp_path / "diagnostic.json"
    write_json_report(report, output_path)

    written_report = json.loads(output_path.read_text(encoding="utf-8"))
    schema_defs = _load_scheduler_schema_defs()
    schema_bundle = written_report["schemas"]["scheduler_summary_bundle"]
    assert schema_bundle["schema_path"] == "docs/schemas/html-collector-scheduler-summary.schema.json"

    _assert_matches_schema(
        schema_defs,
        schema_defs[schema_bundle["scheduler_dry_run_summary_schema"]],
        written_report["scheduler_dry_run"],
        path="scheduler_dry_run",
    )
    _assert_matches_schema(
        schema_defs,
        schema_defs[schema_bundle["program_quality_summary_schema"]],
        written_report["scheduler_dry_run"]["quality"],
        path="scheduler_dry_run.quality",
    )
    _assert_matches_schema(
        schema_defs,
        schema_defs[schema_bundle["scheduler_source_summary_schema"]],
        written_report["sources"][0]["scheduler_dry_run"],
        path="sources[0].scheduler_dry_run",
    )
    _assert_matches_schema(
        schema_defs,
        schema_defs[schema_bundle["program_quality_summary_schema"]],
        written_report["sources"][0]["scheduler_dry_run"]["quality"],
        path="sources[0].scheduler_dry_run.quality",
    )


def test_classify_ocr_probe_marks_attachment_signal_candidate() -> None:
    classification, evidence, recommendation = classify_ocr_probe(
        item_count=3,
        short_list_text_count=2,
        attachment_signal_count=1,
        image_signal_count=0,
        detail_checked=0,
        detail_fetch_failed=0,
        detail_attachment_count=0,
        detail_low_text_image_count=0,
        detail_text_sufficient_count=0,
    )

    assert classification == "poster_or_attachment_candidate"
    assert "attachment_signals=1" in evidence
    assert "source별 opt-in" in recommendation


def test_classify_ocr_probe_marks_short_detail_without_text_as_inconclusive() -> None:
    classification, evidence, recommendation = classify_ocr_probe(
        item_count=2,
        short_list_text_count=2,
        attachment_signal_count=0,
        image_signal_count=0,
        detail_checked=2,
        detail_fetch_failed=0,
        detail_attachment_count=0,
        detail_low_text_image_count=0,
        detail_text_sufficient_count=0,
    )

    assert classification == "detail_probe_inconclusive"
    assert "detail_checked=2" in evidence
    assert "detail parser/selector" in recommendation


def test_build_html_collector_report_can_include_ocr_preflight() -> None:
    collector = _FixtureHtmlCollector(
        status="success",
        message="Fixture HTML collected 1 items from 1/1 urls; request_failed=0; parse_empty=0",
        items=[_raw_item()],
        detail_html_by_url={
            "https://example.com/program/1": "<html><body><img src='/poster.png'><p>짧은 안내</p></body></html>"
        },
    )

    report = build_html_collector_report(
        [collector],
        include_ocr_probe=True,
        ocr_sample_limit=1,
    )

    assert report["ocr_probe"]["enabled"] is True
    assert report["ocr_summary"] == {"ocr_probe_candidate": 1}
    assert len(report["ocr_probe_candidates"]) == 1
    assert report["field_gap_summary"]["source_count_with_any_issues"] == 1
    assert report["field_gap_summary"]["source_count_with_warning_or_error_follow_up"] == 0
    assert report["field_gap_summary"]["source_count_with_only_info_issues"] == 1
    assert report["field_gap_summary"]["issue_fields"]["provider"] == 1
    assert report["sources"][0]["ocr_probe"]["detail_low_text_image_count"] == 1
    assert report["sources"][0]["field_gap_audit"]["rows_with_any_issues"] == 1
    assert report["sources"][0]["field_gap_audit"]["rows_with_warning_or_error"] == 0
    assert report["sources"][0]["field_gap_audit"]["warning_or_error_follow_up_needed"] is False
    assert report["sources"][0]["field_gap_audit"]["field_gap_follow_up_bucket"] == "info_only"
    assert report["sources"][0]["field_gap_audit"]["issue_codes"]["missing_provider"] == 1
    assert report["sources"][0]["ocr_probe"]["source_image_url_samples"] == [
        "https://example.com/poster.png"
    ]
    assert report["sources"][0]["ocr_probe"]["samples"][0]["image_urls"] == [
        "https://example.com/poster.png"
    ]


def test_ocr_preflight_keeps_text_sufficient_attachments_out_of_runtime_candidates() -> None:
    collector = _FixtureHtmlCollector(
        status="success",
        message="Fixture HTML collected 1 items from 1/1 urls; request_failed=0; parse_empty=0",
        items=[_raw_item()],
        detail_html_by_url={
            "https://example.com/program/1": (
                "<html><body>"
                "<a href='/files/poster.pdf'>첨부파일</a>"
                f"<p>{'상세 본문 ' * 120}</p>"
                "</body></html>"
            )
        },
    )

    report = build_html_collector_report(
        [collector],
        include_ocr_probe=True,
        ocr_sample_limit=1,
    )

    assert report["ocr_summary"] == {"poster_or_attachment_candidate": 1}
    assert report["ocr_probe_candidates"] == []
    assert len(report["poster_or_attachment_candidates"]) == 1
    assert report["sources"][0]["field_gap_audit"]["issue_fields"]["provider"] == 1
    assert report["sources"][0]["ocr_probe"]["source_attachment_url_samples"] == [
        "https://example.com/files/poster.pdf"
    ]
    assert report["sources"][0]["ocr_probe"]["samples"][0]["attachment_urls"] == [
        "https://example.com/files/poster.pdf"
    ]


def test_build_html_collector_report_can_write_parse_empty_snapshots(tmp_path: Path) -> None:
    collector = _FixtureHtmlCollector(
        status="success",
        message="Fixture HTML collected 1 items from 2/2 urls; request_failed=0; parse_empty=1",
        items=[_raw_item()],
        url_diagnostics=[
            {
                "url": "https://example.com/list-a",
                "request_status": "success",
                "parse_status": "parse_empty",
                "item_count": 0,
                "html_snapshot": {
                    "html_length": 64,
                    "html_preview": "<html><head><title>Fixture</title></head><body><script>app()</script></body></html>",
                    "html_preview_truncated": False,
                    "body_text_preview": "",
                    "body_text_preview_truncated": False,
                    "title_text": "Fixture",
                    "script_tag_count": 1,
                    "noscript_tag_count": 0,
                    "iframe_tag_count": 0,
                    "form_tag_count": 0,
                    "selector_matches": [
                        {"selector": ".board-list-item", "match_count": 0},
                        {"selector": "a[href]", "match_count": 0},
                    ],
                    "selectors_checked": 2,
                    "selectors_with_matches": 0,
                },
            },
            {
                "url": "https://example.com/list-b",
                "request_status": "success",
                "parse_status": "success",
                "item_count": 1,
            },
        ],
    )

    report = build_html_collector_report(
        [collector],
        snapshot_output_dir=tmp_path / "snapshots",
    )

    assert report["snapshot_capture"]["saved_count"] == 1
    snapshot_path = Path(report["sources"][0]["url_diagnostics"][0]["snapshot_path"])
    assert snapshot_path.exists()
    snapshot_text = snapshot_path.read_text(encoding="utf-8")
    assert "Fixture" in snapshot_text
    assert "selectors_checked=2" in snapshot_text
    assert "selector_matches=.board-list-item:0; a[href]:0" in snapshot_text


def test_render_and_write_reports(tmp_path: Path) -> None:
    report = {
        "mode": "read-only-live-diagnostic",
        "started_at": "2026-04-23T22:00:00+0900",
        "collector_count": 1,
        "summary": {"healthy_static_html": 1},
        "playwright_probe_candidates": [],
        "scheduler_dry_run": {
            "schema_id": "scheduler_dry_run_summary_v1",
            "schema_path": "docs/schemas/html-collector-scheduler-summary.schema.json",
            "enabled": True,
            "source_count": 1,
            "status_counts": {"dry_run": 1},
            "sources_with_quality_errors": 0,
            "sources_with_quality_warnings": 0,
            "quality": {
                "checked_rows": 1,
                "rows_with_errors": 0,
                "rows_with_warnings": 0,
                "issue_counts": {"error": 0, "warning": 0, "info": 1},
                "issue_codes": {"missing_provider": 1},
            },
        },
        "snapshot_capture": {
            "enabled": True,
            "output_dir": str(tmp_path / "snapshots"),
            "saved_count": 1,
            "saved_paths": [str(tmp_path / "snapshots" / "fixture.html")],
        },
        "schemas": {
            "scheduler_summary_bundle": {
                "schema_path": "docs/schemas/html-collector-scheduler-summary.schema.json",
                "program_quality_summary_schema": "program_quality_summary_v1",
                "scheduler_source_summary_schema": "scheduler_source_summary_v1",
                "scheduler_dry_run_summary_schema": "scheduler_dry_run_summary_v1",
            }
        },
        "ocr_probe": {
            "enabled": True,
            "sample_limit": 1,
            "mode": "read-only-detail-html-preflight",
        },
        "ocr_summary": {"poster_or_attachment_candidate": 1},
        "ocr_probe_candidates": [],
        "poster_or_attachment_candidates": [],
        "detail_probe_inconclusive_sources": [],
        "field_gap_summary": {
            "enabled": True,
            "source_count_with_any_issues": 1,
            "source_count_with_warning_or_error_follow_up": 0,
            "source_count_with_only_info_issues": 1,
            "issue_codes": {"missing_provider": 1},
            "issue_fields": {"provider": 1},
        },
        "sources": [
            {
                "source": "Fixture HTML",
                "class_name": "_FixtureHtmlCollector",
                "raw_count": 1,
                "normalized_count": 1,
                "duration_ms": 12.3,
                "last_collect_status": "success",
                "classification": "healthy_static_html",
                "repeated_parse_empty_in_run": False,
                "evidence": ["status=success"],
                "recommendation": "ok",
                "scheduler_dry_run": {
                    "schema_id": "scheduler_source_summary_v1",
                    "schema_path": "docs/schemas/html-collector-scheduler-summary.schema.json",
                    "status": "dry_run",
                    "raw_count": 1,
                    "deduped_row_count": 1,
                    "message": "Collected 1 rows; upsert skipped",
                    "quality": {
                        "checked_rows": 1,
                        "rows_with_errors": 0,
                        "rows_with_warnings": 0,
                        "issue_counts": {"error": 0, "warning": 0, "info": 1},
                        "issue_codes": {"missing_provider": 1},
                    },
                },
                "snapshot_capture": {
                    "saved_count": 1,
                    "saved_paths": [str(tmp_path / "snapshots" / "fixture.html")],
                },
                "ocr_probe": {
                    "classification": "poster_or_attachment_candidate",
                    "evidence": ["items=1", "detail_attachments=1"],
                    "samples": [
                        {
                            "status": "fetched",
                            "link": "https://example.com/program/1",
                            "visible_text_length": 1200,
                            "image_count": 0,
                            "attachment_link_count": 1,
                            "attachment_urls": ["https://example.com/files/poster.pdf"],
                            "image_urls": [],
                        }
                    ],
                    "source_attachment_url_samples": ["https://example.com/files/poster.pdf"],
                    "source_image_url_samples": [],
                },
                "field_gap_audit": {
                    "checked_rows": 1,
                    "rows_with_any_issues": 1,
                    "rows_with_info_only": 1,
                    "rows_with_warning_or_error": 0,
                    "warning_or_error_follow_up_needed": False,
                    "field_gap_follow_up_bucket": "info_only",
                    "issue_codes": {"missing_provider": 1},
                    "issue_fields": {"provider": 1},
                    "sample_limit": 1,
                    "samples": [
                        {
                            "title": "Fixture HTML",
                            "source": "Fixture HTML",
                            "source_unique_key": "fixture_html:1",
                            "issue_codes": ["missing_provider"],
                            "issue_fields": ["provider"],
                            "issues": [
                                {
                                    "code": "missing_provider",
                                    "severity": "info",
                                    "field": "provider",
                                    "message": "provider is empty; card/detail UI may show a fallback label.",
                                }
                            ],
                        }
                    ],
                },
                "url_diagnostics": [
                    {
                        "url": "https://example.com/list-a",
                        "request_status": "success",
                        "parse_status": "parse_empty",
                        "item_count": 0,
                        "html_snapshot": {
                            "html_length": 64,
                            "html_preview_truncated": False,
                            "body_text_preview": "",
                            "body_text_preview_truncated": False,
                            "title_text": "Fixture",
                            "script_tag_count": 1,
                            "noscript_tag_count": 0,
                            "iframe_tag_count": 0,
                            "form_tag_count": 0,
                            "selector_matches": [
                                {"selector": ".board-list-item", "match_count": 0}
                            ],
                            "selectors_checked": 1,
                            "selectors_with_matches": 0,
                        },
                        "snapshot_path": str(tmp_path / "snapshots" / "fixture.html"),
                    }
                ],
            }
        ],
    }
    json_path = tmp_path / "diagnostic.json"
    markdown_path = tmp_path / "diagnostic.md"

    write_json_report(report, json_path)
    write_markdown_report(report, markdown_path)

    assert json.loads(json_path.read_text(encoding="utf-8"))["collector_count"] == 1
    markdown = markdown_path.read_text(encoding="utf-8")
    assert "| Fixture HTML | `_FixtureHtmlCollector` | 1 | 1 | 12.3 | success | healthy_static_html | false |" in markdown
    assert "## HTML Snapshots" in markdown
    assert "## Scheduler Dry-Run Summary" in markdown
    assert "## OCR / Image Preflight" in markdown
    assert "Sources with any field gaps: `1`" in markdown
    assert "Sources with warning/error follow-up needed: `0`" in markdown
    assert "repeated_parse_empty_in_run" in markdown
    assert "info_only" in markdown
    assert "field gap sample: `Fixture HTML` issues=missing_provider" in markdown
    assert "Schema path: `docs/schemas/html-collector-scheduler-summary.schema.json`" in markdown
    assert render_markdown_report(report).startswith("# HTML Collector Dynamic Retrieve Diagnostic")
