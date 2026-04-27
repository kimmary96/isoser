from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _query_param(value: str, key: str) -> str:
    parsed = urlparse(value)
    values = parse_qs(parsed.query).get(key)
    return str(values[0]).strip() if values else ""


def _extract_label_value(text: str, label: str) -> str:
    labels = (
        "훈련유형",
        "훈련기간",
        "주야구분",
        "주말여부",
        "훈련시간",
        "수강신청기간",
        "신청기간",
        "모집기간",
        "접수기간",
        "모집마감",
        "신청마감",
        "접수마감",
        "성과 및 운영 정보",
        "NCS 및 자격정보",
        "훈련기관 및 담당자",
        "주소",
        "담당자 성명",
        "전화번호",
        "이메일",
        "주관부처",
        "관심정보 등록",
        "훈련과정안내",
        "훈련대상 요건",
    )
    lookahead = "|".join(re.escape(item) for item in labels)
    pattern = rf"{re.escape(label)}\s+(.+?)(?=\s+({lookahead})|$)"
    match = re.search(pattern, text)
    return _clean_text(match.group(1)).replace(" 지도 보기", "").strip() if match else ""


def _extract_provider(lines: list[str], title: str) -> str:
    title_text = _clean_text(title)
    for index, line in enumerate(lines):
        if _clean_text(line) != title_text:
            continue
        candidates = lines[max(0, index - 4):index]
        for candidate in reversed(candidates):
            cleaned = _clean_text(candidate)
            if not cleaned or "인증" in cleaned or "선발" in cleaned or "훈련과정" in cleaned:
                continue
            return cleaned
    return ""


def _extract_description(text: str) -> str:
    match = re.search(r"훈련목표\s+(.+?)(?=\s+훈련대상 요건|$)", text)
    return _clean_text(match.group(1)) if match else ""


def _normalize_date_text(value: str) -> str | None:
    match = re.search(r"(\d{4})[.-](\d{1,2})[.-](\d{1,2})", value)
    if not match:
        return None
    return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"


def _extract_period_end_date(value: str) -> str | None:
    matches = re.findall(r"(\d{4})[.-](\d{1,2})[.-](\d{1,2})", value)
    if not matches:
        return None
    year, month, day = matches[-1]
    return f"{year}-{int(month):02d}-{int(day):02d}"


def _extract_application_deadline(text: str) -> str | None:
    for label in ("수강신청기간", "신청기간", "모집기간", "접수기간"):
        deadline = _extract_period_end_date(_extract_label_value(text, label))
        if deadline:
            return deadline
    for label in ("모집마감", "신청마감", "접수마감"):
        deadline = _normalize_date_text(_extract_label_value(text, label))
        if deadline:
            return deadline
    return None


def _compact_meta(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in meta.items()
        if value not in (None, "", [], {})
    }


def _dedupe_preserve_order(values: list[str], *, limit: int | None = None) -> list[str]:
    seen: set[str] = set()
    items: list[str] = []
    for value in values:
        cleaned = _clean_text(value)
        key = cleaned.casefold()
        if not key or key in seen:
            continue
        seen.add(key)
        items.append(cleaned)
        if limit is not None and len(items) >= limit:
            break
    return items


def _format_date_key(value: str | None) -> str | None:
    cleaned = _clean_text(value or "")
    match = re.fullmatch(r"(\d{4})(\d{2})(\d{2})", cleaned)
    if not match:
        return None
    return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"


def _normalize_choice(value: str, allowed: set[str]) -> str | None:
    cleaned = _clean_text(value)
    return cleaned if cleaned in allowed else None


def _normalize_training_type(value: str) -> str | None:
    cleaned = _clean_text(value)
    if (
        not cleaned
        or cleaned == "-"
        or len(cleaned) > 40
        or "훈련기간" in cleaned
        or "(회차)" in cleaned
        or "자비부담액" in cleaned
        or "기본정보" in cleaned
    ):
        return None
    return cleaned


def _normalize_training_time(value: str) -> str | None:
    cleaned = _clean_text(value).replace(" 시간표 보기", "").replace("시간표 보기", "").strip()
    if not cleaned or cleaned == "-":
        return None
    if re.search(r"총\s*0\s*시간", cleaned):
        return None
    total_match = re.search(r"(?:(\d+)\s*일,\s*)?총\s*(\d+)\s*시간", cleaned)
    if total_match:
        days = total_match.group(1)
        hours = total_match.group(2)
        return f"{days}일 · 총 {hours}시간" if days else f"총 {hours}시간"
    return cleaned if re.search(r"\d", cleaned) else None


def _normalize_phone(value: str) -> str | None:
    cleaned = _clean_text(value)
    return cleaned if re.search(r"\d{2,}", cleaned) else None


def _normalize_email(value: str) -> str | None:
    cleaned = _clean_text(value)
    return cleaned if re.search(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned) else None


def _is_training_timetable_table(table: Any) -> bool:
    caption = table.find("caption")
    caption_text = _clean_text(caption.get_text(" ", strip=True) if caption else "")
    return "훈련과정정보 시간표 요일" in caption_text


def _cell_has_class(cell: Any, prefix: str) -> bool:
    classes = cell.get("class") or []
    return any(str(item).startswith(prefix) for item in classes)


def _extract_timetable_form_fields(html: str, source_url: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    form = soup.select_one("#searchForm1") or soup.find("form", {"name": "searchForm1"})
    fields: dict[str, str] = {}
    if form:
        for tag in form.find_all(["input", "select", "textarea"]):
            name = tag.get("name")
            if not name:
                continue
            fields[str(name)] = str(tag.get("value", ""))

    csrf = soup.select_one('input[name="_csrf"]')
    if csrf and "_csrf" not in fields:
        fields["_csrf"] = str(csrf.get("value", ""))

    for key in ("tracseId", "tracseTme", "crseTracseSe", "trainstCstmrId"):
        if fields.get(key):
            continue
        value = _query_param(source_url, key)
        if value:
            fields[key] = value

    return fields


def parse_work24_timetable_html(html: str) -> dict[str, Any] | None:
    soup = BeautifulSoup(html, "html.parser")
    table = next((item for item in soup.find_all("table") if _is_training_timetable_table(item)), None)
    if table is None:
        return None

    entries_by_date: dict[str, dict[str, Any]] = {}
    pending_labels: dict[str, str] = {}

    for row in table.find_all("tr"):
        row_classes = row.get("class") or []
        cells = row.find_all(["th", "td"])
        if "notice3" in row_classes:
            for cell in cells:
                date_key = _format_date_key(cell.get("data-itemtype"))
                if not date_key:
                    continue
                text = _clean_text(cell.get_text(" ", strip=True))
                duration_match = re.search(r"(\d+)\s*시간", text)
                if not duration_match:
                    continue
                entry = entries_by_date.setdefault(
                    date_key,
                    {
                        "date": date_key,
                        "duration_hours": None,
                        "training_times": [],
                        "break_times": [],
                    },
                )
                entry["duration_hours"] = int(duration_match.group(1))
            continue

        if "notice4" not in row_classes:
            continue

        for cell in cells:
            date_key = _format_date_key(cell.get("data-itemtype"))
            if not date_key:
                continue
            text = _clean_text(cell.get_text(" ", strip=True))
            if _cell_has_class(cell, "dt2"):
                pending_labels[date_key] = text
                continue
            if not _cell_has_class(cell, "dt3"):
                continue

            time_match = re.search(r"(\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2})", text)
            if not time_match:
                continue
            label = pending_labels.get(date_key, "")
            slot = re.sub(r"\s+", "", time_match.group(1))
            entry = entries_by_date.setdefault(
                date_key,
                {
                    "date": date_key,
                    "duration_hours": None,
                    "training_times": [],
                    "break_times": [],
                },
            )
            if label == "훈련":
                entry["training_times"].append(slot)
            elif label:
                entry["break_times"].append(f"{label} {slot}")

    entries = [
        entry
        for _, entry in sorted(entries_by_date.items())
        if entry["duration_hours"] is not None or entry["training_times"] or entry["break_times"]
    ]
    if not entries:
        return None

    training_times = _dedupe_preserve_order(
        [slot for entry in entries for slot in entry.get("training_times", [])],
        limit=5,
    )
    total_hours = sum(
        int(entry["duration_hours"])
        for entry in entries
        if isinstance(entry.get("duration_hours"), int)
    )
    summary_parts = [f"{len(entries)}일"]
    if total_hours:
        summary_parts.append(f"총 {total_hours}시간")
    if training_times:
        summary_parts.append(", ".join(training_times))

    return {
        "training_schedule": entries,
        "training_schedule_summary": " · ".join(summary_parts),
    }


def parse_work24_detail_html(html: str, *, title: str, source_url: str) -> dict[str, Any] | None:
    soup = BeautifulSoup(html, "html.parser")
    lines = [_clean_text(line) for line in soup.get_text("\n", strip=True).splitlines()]
    lines = [line for line in lines if line]
    text = _clean_text("\n".join(lines))

    period_match = re.search(r"훈련기간\s+(\d{4})-(\d{2})-(\d{2})\s*~\s*(\d{4})-(\d{2})-(\d{2})", text)
    start_date = f"{period_match.group(1)}-{period_match.group(2)}-{period_match.group(3)}" if period_match else None
    end_date = f"{period_match.group(4)}-{period_match.group(5)}-{period_match.group(6)}" if period_match else None
    fee_match = re.search(r"훈련비\s+([\d,]+)\s*원\s+([\d,]+)\s*원", text)
    total_fee = int(fee_match.group(1).replace(",", "")) if fee_match else None
    self_payment = int(fee_match.group(2).replace(",", "")) if fee_match else None
    rating_match = re.search(r"만족도\s*\(([\d.]+)\)", text)
    capacity_match = re.search(r"모집인원\s+(\d+)명", text)
    selected_match = re.search(r"선발인원\s+(\d+)명", text)
    application_deadline = _extract_application_deadline(text)
    training_type = _normalize_training_type(_extract_label_value(text, "훈련유형"))
    day_night = _normalize_choice(_extract_label_value(text, "주야구분"), {"주간", "야간"})
    weekend_text = _normalize_choice(_extract_label_value(text, "주말여부"), {"주중", "주말"})
    training_time = _normalize_training_time(_extract_label_value(text, "훈련시간"))

    normalized = {
        "provider": _extract_provider(lines, title) or None,
        "location": _extract_label_value(text, "주소") or None,
        "description": _extract_description(text) or None,
        "deadline": application_deadline,
        "start_date": start_date,
        "end_date": end_date,
        "source_url": source_url,
        "cost": total_fee,
        "subsidy_amount": self_payment,
        "compare_meta": _compact_meta(
            {
                "hrd_id": _query_param(source_url, "tracseId") or None,
                "tracse_tme": _query_param(source_url, "tracseTme") or None,
                "trainst_cstmr_id": _query_param(source_url, "trainstCstmrId") or None,
                "source_url": source_url,
                "satisfaction_score": rating_match.group(1) if rating_match else None,
                "capacity": capacity_match.group(1) if capacity_match else None,
                "registered_count": selected_match.group(1) if selected_match else None,
                "application_deadline": application_deadline,
                "training_type": training_type,
                "day_night": day_night,
                "weekend_text": weekend_text,
                "training_time": training_time,
                "training_fee_total": total_fee,
                "self_payment": self_payment,
                "out_of_pocket": self_payment,
                "contact_phone": _normalize_phone(_extract_label_value(text, "전화번호")),
                "email": _normalize_email(_extract_label_value(text, "이메일")),
            }
        ),
    }
    return normalized if any(value for value in normalized.values()) else None


def fetch_work24_detail_fields(
    *,
    source_url: str,
    title: str,
    timeout_seconds: int = 20,
) -> dict[str, Any] | None:
    response = requests.get(
        source_url,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    return parse_work24_detail_html(response.text, title=title, source_url=source_url)


def fetch_work24_timetable_fields(
    *,
    source_url: str,
    timeout_seconds: int = 20,
) -> dict[str, Any] | None:
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": source_url,
        "X-Requested-With": "XMLHttpRequest",
    }
    response = session.get(source_url, headers=headers, timeout=timeout_seconds)
    response.raise_for_status()

    fields = _extract_timetable_form_fields(response.text, source_url)
    if not fields.get("tracseId") or not fields.get("tracseTme"):
        return None

    timetable_url = urljoin(source_url, "/hr/a/a/3100/selectTracseTimeTable.do")
    timetable_response = session.post(
        timetable_url,
        data=fields,
        headers=headers,
        timeout=timeout_seconds,
    )
    timetable_response.raise_for_status()
    return parse_work24_timetable_html(timetable_response.text)
