from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from backend.rag.collector.quality_validator import (
    summarize_program_quality,
    validate_program_row,
)


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "program_quality_golden.json"


def load_cases() -> list[dict[str, Any]]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", load_cases(), ids=lambda case: case["name"])
def test_program_quality_golden_case_matches_expected_issue_codes(case: dict[str, Any]) -> None:
    report = validate_program_row(case["row"])
    issues_by_severity = {
        "error": sorted(issue.code for issue in report.issues if issue.severity == "error"),
        "warning": sorted(issue.code for issue in report.issues if issue.severity == "warning"),
        "info": sorted(issue.code for issue in report.issues if issue.severity == "info"),
    }

    assert issues_by_severity["error"] == sorted(case["expected"]["error_codes"])
    assert issues_by_severity["warning"] == sorted(case["expected"]["warning_codes"])
    assert issues_by_severity["info"] == sorted(case["expected"]["info_codes"])


def test_program_quality_golden_summary_stays_stable() -> None:
    rows = [case["row"] for case in load_cases()]

    summary = summarize_program_quality(rows)

    assert summary == {
        "checked_rows": 4,
        "rows_with_errors": 0,
        "rows_with_warnings": 1,
        "issue_counts": {
            "error": 0,
            "warning": 1,
            "info": 2,
        },
        "issue_codes": {
            "missing_provider": 1,
            "work24_deadline_from_training_start": 1,
            "work24_deadline_matches_end_date": 1,
        },
    }
