from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal


QualitySeverity = Literal["error", "warning", "info"]


@dataclass(frozen=True)
class CollectorQualityIssue:
    code: str
    severity: QualitySeverity
    field: str
    message: str


@dataclass(frozen=True)
class CollectorQualityReport:
    source: str
    title: str
    issues: tuple[CollectorQualityIssue, ...]

    @property
    def has_errors(self) -> bool:
        return any(issue.severity == "error" for issue in self.issues)

    @property
    def has_warnings(self) -> bool:
        return any(issue.severity == "warning" for issue in self.issues)


TRUSTED_DEADLINE_SOURCES = {
    "application_deadline",
    "detail_application_deadline",
    "source_application_deadline",
    "traStartDate",
}


def validate_program_row(row: Mapping[str, Any]) -> CollectorQualityReport:
    issues: list[CollectorQualityIssue] = []
    source = _text(row.get("source"))
    title = _text(row.get("title"))
    compare_meta = row.get("compare_meta") if isinstance(row.get("compare_meta"), Mapping) else {}

    _require_text(issues, row, "title")
    _require_text(issues, row, "source")
    _require_text(issues, row, "source_unique_key", severity="warning")

    if not _text(row.get("source_url")) and not _text(row.get("link")):
        issues.append(
            CollectorQualityIssue(
                code="missing_source_url",
                severity="warning",
                field="source_url",
                message="source_url/link is empty, so operators cannot trace the original posting.",
            )
        )

    if not _text(row.get("provider")):
        issues.append(
            CollectorQualityIssue(
                code="missing_provider",
                severity="info",
                field="provider",
                message="provider is empty; card/detail UI may show a fallback label.",
            )
        )

    if not _text(row.get("location")) and not _text(row.get("region")):
        issues.append(
            CollectorQualityIssue(
                code="missing_location",
                severity="warning",
                field="location",
                message="location and region are both empty.",
            )
        )

    _check_date_order(issues, row, "start_date", "end_date")
    _check_work24_deadline(issues, row, compare_meta)
    _check_cost(issues, row, "cost")
    _check_cost(issues, row, "subsidy_amount")

    return CollectorQualityReport(source=source, title=title, issues=tuple(issues))


def summarize_program_quality(rows: list[Mapping[str, Any]]) -> dict[str, Any]:
    reports = [validate_program_row(row) for row in rows]
    severity_counts: dict[str, int] = {"error": 0, "warning": 0, "info": 0}
    issue_codes: dict[str, int] = {}

    for report in reports:
        for issue in report.issues:
            severity_counts[issue.severity] += 1
            issue_codes[issue.code] = issue_codes.get(issue.code, 0) + 1

    return {
        "checked_rows": len(reports),
        "rows_with_errors": sum(1 for report in reports if report.has_errors),
        "rows_with_warnings": sum(1 for report in reports if report.has_warnings),
        "issue_counts": {
            "error": severity_counts["error"],
            "warning": severity_counts["warning"],
            "info": severity_counts["info"],
        },
        "issue_codes": dict(sorted(issue_codes.items())),
    }


def _require_text(
    issues: list[CollectorQualityIssue],
    row: Mapping[str, Any],
    field: str,
    *,
    severity: QualitySeverity = "error",
) -> None:
    if _text(row.get(field)):
        return
    issues.append(
        CollectorQualityIssue(
            code=f"missing_{field}",
            severity=severity,
            field=field,
            message=f"{field} is required for stable collector identity.",
        )
    )


def _check_date_order(
    issues: list[CollectorQualityIssue],
    row: Mapping[str, Any],
    start_field: str,
    end_field: str,
) -> None:
    start_date = _text(row.get(start_field))
    end_date = _text(row.get(end_field))
    if start_date and end_date and start_date > end_date:
        issues.append(
            CollectorQualityIssue(
                code="invalid_training_period",
                severity="warning",
                field=start_field,
                message="start_date is later than end_date.",
            )
        )


def _check_work24_deadline(
    issues: list[CollectorQualityIssue],
    row: Mapping[str, Any],
    compare_meta: Mapping[str, Any],
) -> None:
    source = _text(row.get("source")).casefold()
    if "work24" not in source and "고용24" not in source:
        return

    deadline = _text(row.get("deadline"))
    end_date = _text(row.get("end_date"))
    deadline_source = _text(row.get("deadline_source")) or _text(compare_meta.get("deadline_source"))

    if deadline_source == "traStartDate":
        issues.append(
            CollectorQualityIssue(
                code="work24_deadline_from_training_start",
                severity="info",
                field="deadline",
                message="Work24 deadline uses traStartDate fallback because the list API has no separate application deadline.",
            )
        )
        return

    if deadline and end_date and deadline == end_date and deadline_source not in TRUSTED_DEADLINE_SOURCES:
        issues.append(
            CollectorQualityIssue(
                code="work24_deadline_matches_end_date",
                severity="warning",
                field="deadline",
                message="Work24 deadline matches training end_date without a trusted deadline_source.",
            )
        )


def _check_cost(
    issues: list[CollectorQualityIssue],
    row: Mapping[str, Any],
    field: str,
) -> None:
    value = row.get(field)
    if value in (None, ""):
        return
    if not isinstance(value, int):
        issues.append(
            CollectorQualityIssue(
                code=f"invalid_{field}",
                severity="warning",
                field=field,
                message=f"{field} should be an integer when present.",
            )
        )
        return
    if value < 0:
        issues.append(
            CollectorQualityIssue(
                code=f"negative_{field}",
                severity="warning",
                field=field,
                message=f"{field} should not be negative.",
            )
        )


def _text(value: Any) -> str:
    return str(value or "").strip()
