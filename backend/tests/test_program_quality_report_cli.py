from __future__ import annotations

from pathlib import Path

from scripts.program_quality_report import (
    build_quality_report,
    fetch_program_rows,
    write_report,
)


def test_build_quality_report_summarizes_and_samples_issues() -> None:
    report = build_quality_report(
        [
            {
                "id": "program-1",
                "title": "정상 과정",
                "source": "K-Startup",
                "source_unique_key": "kstartup:1",
                "deadline": "2026-05-01",
                "start_date": "2026-04-01",
                "end_date": "2026-05-01",
                "provider": "기관",
                "location": "서울",
                "source_url": "https://example.com/1",
            },
            {
                "id": "program-2",
                "title": "의심 과정",
                "source": "고용24",
                "deadline": "2026-06-01",
                "end_date": "2026-06-01",
                "source_url": "https://example.com/2",
            },
        ],
        sample_limit=1,
    )

    assert report["mode"] == "read-only"
    assert report["row_count"] == 2
    assert report["quality"]["checked_rows"] == 2
    assert report["quality"]["rows_with_warnings"] == 1
    assert report["quality"]["issue_codes"]["work24_deadline_matches_end_date"] == 1
    assert len(report["issue_samples"]) == 1
    assert report["issue_samples"][0]["id"] == "program-2"


def test_fetch_program_rows_uses_read_only_supabase_query(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> list[dict[str, str]]:
            return [{"id": "program-1"}]

    def fake_get(url: str, *, params, headers, timeout: int) -> FakeResponse:
        captured["url"] = url
        captured["params"] = params
        captured["headers"] = headers
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setattr("scripts.program_quality_report.requests.get", fake_get)

    rows = fetch_program_rows(limit=5, source_query="work24*")

    assert rows == [{"id": "program-1"}]
    assert captured["url"] == "https://example.supabase.co/rest/v1/programs"
    assert captured["params"]["limit"] == "5"
    assert captured["params"]["source"] == "ilike.*work24*"
    assert captured["headers"]["Authorization"] == "Bearer service-key"
    assert captured["timeout"] == 30


def test_write_report_creates_json_file(tmp_path: Path) -> None:
    output = tmp_path / "nested" / "quality.json"

    write_report({"mode": "read-only", "row_count": 0}, output)

    assert output.read_text(encoding="utf-8").strip() == '{\n  "mode": "read-only",\n  "row_count": 0\n}'
