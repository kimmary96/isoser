from __future__ import annotations

import json
from pathlib import Path

from scripts.html_collector_diagnostic import (
    BaseHtmlCollector,
    build_html_collector_report,
    classify_source,
    render_markdown_report,
    write_json_report,
    write_markdown_report,
)


class _FixtureHtmlCollector(BaseHtmlCollector):
    tier = 2
    source_key = "fixture_html"
    source_name = "Fixture HTML"
    list_urls = ["https://example.com/list"]

    def __init__(self, *, status: str, message: str, items: list[dict] | None = None) -> None:
        self.fixture_status = status
        self.fixture_message = message
        self.fixture_items = items or []

    def collect_items(self):
        self.last_collect_status = self.fixture_status
        self.last_collect_message = self.fixture_message
        return self.fixture_items


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
    assert report["sources"][0]["normalized_count"] == 1


def test_render_and_write_reports(tmp_path: Path) -> None:
    report = {
        "mode": "read-only-live-diagnostic",
        "started_at": "2026-04-23T22:00:00+0900",
        "collector_count": 1,
        "summary": {"healthy_static_html": 1},
        "playwright_probe_candidates": [],
        "sources": [
            {
                "source": "Fixture HTML",
                "class_name": "_FixtureHtmlCollector",
                "raw_count": 1,
                "normalized_count": 1,
                "duration_ms": 12.3,
                "last_collect_status": "success",
                "classification": "healthy_static_html",
                "evidence": ["status=success"],
                "recommendation": "ok",
            }
        ],
    }
    json_path = tmp_path / "diagnostic.json"
    markdown_path = tmp_path / "diagnostic.md"

    write_json_report(report, json_path)
    write_markdown_report(report, markdown_path)

    assert json.loads(json_path.read_text(encoding="utf-8"))["collector_count"] == 1
    markdown = markdown_path.read_text(encoding="utf-8")
    assert "| Fixture HTML | `_FixtureHtmlCollector` | 1 | 1 | 12.3 | success | healthy_static_html |" in markdown
    assert render_markdown_report(report).startswith("# HTML Collector Dynamic Retrieve Diagnostic")
