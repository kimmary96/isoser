from __future__ import annotations

import re
from typing import Any

import requests
from bs4 import BeautifulSoup

PROGRAM_SCHEDULE_LABELS = (
    "일정",
    "교육일정",
    "행사일정",
    "운영일정",
    "프로그램 일정",
    "진행일시",
    "운영기간",
    "교육기간",
)
PROGRAM_TIME_LABELS = (
    "시간",
    "진행시간",
    "운영시간",
    "교육시간",
)
APPLICATION_PERIOD_LABELS = (
    "신청기간",
    "접수기간",
    "모집기간",
    "신청기한",
)
DATE_PATTERN = re.compile(r"(20\d{2})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})")


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _extract_candidate_lines(soup: BeautifulSoup) -> list[str]:
    lines: list[str] = []
    seen: set[str] = set()
    for node in soup.find_all(["tr", "li", "p", "div", "td", "th", "strong"]):
        text = _clean_text(node.get_text(" ", strip=True))
        if not text or len(text) < 3 or text in seen:
            continue
        seen.add(text)
        lines.append(text)
    return lines


def _extract_label_value(lines: list[str], labels: tuple[str, ...]) -> tuple[str | None, str | None]:
    for label in labels:
        best_value: str | None = None
        for line in lines:
            if label not in line:
                continue
            _, _, suffix = line.partition(label)
            value = re.sub(r"^[\s:：-]+", "", suffix).strip()
            if value:
                if best_value is None or len(value) < len(best_value):
                    best_value = value
        if best_value:
            return label, best_value
    return None, None


def _extract_dates(value: str) -> list[str]:
    dates: list[str] = []
    for year, month, day in DATE_PATTERN.findall(value):
        dates.append(f"{year}-{int(month):02d}-{int(day):02d}")
    return dates


def _extract_date_range(value: str) -> tuple[str | None, str | None]:
    dates = _extract_dates(value)
    if len(dates) >= 2:
        return dates[0], dates[1]
    if len(dates) == 1:
        return dates[0], dates[0]
    return None, None


def parse_external_program_schedule_html(
    html: str,
    *,
    source_url: str,
) -> dict[str, Any] | None:
    soup = BeautifulSoup(html, "html.parser")
    lines = _extract_candidate_lines(soup)
    schedule_label, schedule_value = _extract_label_value(lines, PROGRAM_SCHEDULE_LABELS)
    time_label, time_value = _extract_label_value(lines, PROGRAM_TIME_LABELS)
    application_label, application_value = _extract_label_value(lines, APPLICATION_PERIOD_LABELS)

    program_start_date, program_end_date = _extract_date_range(schedule_value or "")
    application_start_date, application_end_date = _extract_date_range(application_value or "")
    if application_value and application_start_date == application_end_date and application_start_date:
        application_start_date = None

    schedule_parts = [part for part in (schedule_value, time_value) if part]
    schedule_text = " / ".join(schedule_parts) if schedule_parts else None

    field_sources: dict[str, str] = {}
    if program_start_date and schedule_label:
        field_sources["program_start_date"] = f"application_url:{schedule_label}"
    if program_end_date and schedule_label:
        field_sources["program_end_date"] = f"application_url:{schedule_label}"
    if schedule_text and schedule_label:
        field_sources["schedule_text"] = f"application_url:{schedule_label}"
    if application_start_date and application_label:
        field_sources["application_start_date"] = f"application_url:{application_label}"
    if application_end_date and application_label:
        field_sources["application_end_date"] = f"application_url:{application_label}"

    compare_meta = {
        "source_url": source_url,
        "program_start_date": program_start_date,
        "program_end_date": program_end_date,
        "schedule_text": schedule_text,
        "application_start_date": application_start_date,
        "application_end_date": application_end_date,
        "field_sources": field_sources or None,
    }
    cleaned = {
        key: value
        for key, value in compare_meta.items()
        if value not in (None, "", [], {})
    }
    if not cleaned:
        return None
    return {"compare_meta": cleaned}


def fetch_external_program_schedule_fields(
    *,
    source_url: str,
    timeout_seconds: int = 15,
) -> dict[str, Any] | None:
    response = requests.get(
        source_url,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    return parse_external_program_schedule_html(response.text, source_url=source_url)
