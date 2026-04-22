from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _query_param(value: str, key: str) -> str:
    parsed = urlparse(value)
    values = parse_qs(parsed.query).get(key)
    return str(values[0]).strip() if values else ""


def _extract_label_value(text: str, label: str) -> str:
    pattern = rf"{re.escape(label)}\s+(.+?)(?=\s+(훈련유형|훈련기간|주야구분|주말여부|훈련시간|성과 및 운영 정보|NCS 및 자격정보|훈련기관 및 담당자|주소|담당자 성명|전화번호|이메일|주관부처|관심정보 등록|훈련과정안내|훈련대상 요건|$))"
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


def _compact_meta(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in meta.items()
        if value not in (None, "", [], {})
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
    rating_match = re.search(r"만족도\s*\(([\d.]+)\)", text)
    capacity_match = re.search(r"모집인원\s+(\d+)명", text)
    selected_match = re.search(r"선발인원\s+(\d+)명", text)

    normalized = {
        "provider": _extract_provider(lines, title) or None,
        "location": _extract_label_value(text, "주소") or None,
        "description": _extract_description(text) or None,
        "start_date": start_date,
        "end_date": end_date,
        "source_url": source_url,
        "cost": int(fee_match.group(1).replace(",", "")) if fee_match else None,
        "subsidy_amount": int(fee_match.group(2).replace(",", "")) if fee_match else None,
        "compare_meta": _compact_meta(
            {
                "hrd_id": _query_param(source_url, "tracseId") or None,
                "tracse_tme": _query_param(source_url, "tracseTme") or None,
                "trainst_cstmr_id": _query_param(source_url, "trainstCstmrId") or None,
                "source_url": source_url,
                "satisfaction_score": rating_match.group(1) if rating_match else None,
                "capacity": capacity_match.group(1) if capacity_match else None,
                "registered_count": selected_match.group(1) if selected_match else None,
                "contact_phone": _extract_label_value(text, "전화번호") or None,
                "email": _extract_label_value(text, "이메일") or None,
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
