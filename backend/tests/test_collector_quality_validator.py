from __future__ import annotations

from copy import deepcopy

from backend.rag.collector.quality_validator import (
    summarize_program_field_gaps,
    validate_program_row,
)


def issue_codes(row: dict) -> set[str]:
    return {issue.code for issue in validate_program_row(row).issues}


def test_validator_does_not_mutate_input_row() -> None:
    row = {
        "title": "AI 데이터 분석 과정",
        "source": "고용24",
        "source_unique_key": "work24:AIG202500001:7:500012345678",
        "deadline": "2026-04-22",
        "start_date": "2026-04-22",
        "end_date": "2026-06-29",
        "provider": "테스트 훈련기관",
        "location": "서울 강남구",
        "source_url": "https://www.work24.go.kr/hr/detail",
        "cost": 1000000,
        "subsidy_amount": 300000,
        "compare_meta": {"deadline_source": "traStartDate"},
    }
    original = deepcopy(row)

    validate_program_row(row)

    assert row == original


def test_validator_flags_missing_identity_and_trace_fields() -> None:
    codes = issue_codes({"title": "", "source": "", "region": ""})

    assert "missing_title" in codes
    assert "missing_source" in codes
    assert "missing_source_unique_key" in codes
    assert "missing_source_url" in codes
    assert "missing_location" in codes


def test_validator_flags_work24_deadline_matching_end_date_without_trusted_source() -> None:
    report = validate_program_row(
        {
            "title": "AI 과정",
            "source": "고용24",
            "source_unique_key": "work24:AIG202500001:7:500012345678",
            "deadline": "2026-06-29",
            "start_date": "2026-04-22",
            "end_date": "2026-06-29",
            "provider": "훈련기관",
            "location": "서울 강남구",
            "source_url": "https://www.work24.go.kr/hr/detail",
        }
    )

    assert "work24_deadline_matches_end_date" in {issue.code for issue in report.issues}
    assert report.has_warnings


def test_validator_treats_work24_trastartdate_deadline_as_info() -> None:
    report = validate_program_row(
        {
            "title": "AI 과정",
            "source": "고용24",
            "source_unique_key": "work24:AIG202500001:7:500012345678",
            "deadline": "2026-04-22",
            "start_date": "2026-04-22",
            "end_date": "2026-06-29",
            "provider": "훈련기관",
            "location": "서울 강남구",
            "source_url": "https://www.work24.go.kr/hr/detail",
            "compare_meta": {"deadline_source": "traStartDate"},
        }
    )

    issues = {issue.code: issue for issue in report.issues}
    assert issues["work24_deadline_from_training_start"].severity == "info"
    assert "work24_deadline_matches_end_date" not in issues
    assert not report.has_errors
    assert not report.has_warnings


def test_validator_accepts_kstartup_identity_and_dates_without_errors() -> None:
    report = validate_program_row(
        {
            "title": "코디세이 AI 네이티브 과정",
            "source": "K-Startup",
            "source_unique_key": "kstartup:177296",
            "deadline": "2026-05-14",
            "start_date": "2026-04-15",
            "end_date": "2026-05-14",
            "provider": "(재)이노베이션아카데미",
            "location": "서울",
            "source_url": "https://www.k-startup.go.kr/detail",
        }
    )

    assert not report.has_errors
    assert not report.has_warnings


def test_validator_flags_date_and_cost_sanity_risks() -> None:
    codes = issue_codes(
        {
            "title": "역순 과정",
            "source": "K-Startup",
            "source_unique_key": "kstartup:1",
            "start_date": "2026-06-01",
            "end_date": "2026-05-01",
            "source_url": "https://example.com",
            "region": "서울",
            "cost": "-1000",
        }
    )

    assert "invalid_training_period" in codes
    assert "invalid_cost" in codes


def test_summarize_program_field_gaps_groups_issue_fields_and_samples() -> None:
    summary = summarize_program_field_gaps(
        [
            {
                "title": "AI 과정",
                "source": "고용24",
                "source_unique_key": "work24:AIG202500001:7:500012345678",
                "deadline": "2026-06-29",
                "start_date": "2026-04-22",
                "end_date": "2026-06-29",
                "source_url": "https://www.work24.go.kr/hr/detail",
                "region": "서울",
            }
        ],
        sample_limit=1,
    )

    assert summary["checked_rows"] == 1
    assert summary["rows_with_any_issues"] == 1
    assert summary["rows_with_warning_or_error"] == 1
    assert summary["warning_or_error_follow_up_needed"] is True
    assert summary["field_gap_follow_up_bucket"] == "warning_or_error_follow_up_needed"
    assert summary["issue_codes"]["missing_provider"] == 1
    assert summary["issue_fields"]["provider"] == 1
    assert set(summary["samples"][0]["issue_fields"]) == {"deadline", "provider"}
