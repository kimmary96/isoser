from __future__ import annotations

from typing import Any

import httpx
from bs4 import BeautifulSoup


def _to_status(value: float) -> tuple[str, str]:
    if value >= 0.67:
        return "good", "좋음"
    if value <= 0.33:
        return "caution", "주의"
    return "normal", "보통"


def _extract_sources_from_duckduckgo(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, str]] = []

    for result in soup.select("div.result")[:8]:
        title_el = result.select_one("h2 a")
        snippet_el = result.select_one(".result__snippet")
        if not title_el:
            continue
        url = title_el.get("href", "").strip()
        title = title_el.get_text(" ", strip=True)
        snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""
        if url:
            rows.append({"url": url, "title": title, "snippet": snippet})
    return rows


async def get_company_insight(company_name: str) -> dict[str, Any]:
    query = f"{company_name} 재무제표 직원수 채용"
    url = "https://duckduckgo.com/html/"
    params = {"q": query}
    headers = {"User-Agent": "Mozilla/5.0"}

    sources: list[dict[str, str]] = []
    note = "웹 검색 기반 요약이며 참고용입니다."
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, params=params, headers=headers)
            res.raise_for_status()
            sources = _extract_sources_from_duckduckgo(res.text)
    except Exception:
        note = "실시간 검색 결과를 불러오지 못해 기본 안내만 제공합니다."

    source_text = " ".join([f"{s.get('title', '')} {s.get('snippet', '')}" for s in sources]).lower()
    finance_score = 0.5
    hiring_score = 0.5
    stability_score = 0.5

    if source_text:
        if any(k in source_text for k in ["흑자", "영업이익", "증가", "성장"]):
            finance_score = 0.75
        if any(k in source_text for k in ["적자", "감소", "부채", "악화"]):
            finance_score = 0.3

        if any(k in source_text for k in ["채용", "확대", "증원", "공개채용"]):
            hiring_score = 0.7
        if any(k in source_text for k in ["축소", "중단", "구조조정"]):
            hiring_score = 0.3

        if any(k in source_text for k in ["정규직", "전환", "복지", "장기근속"]):
            stability_score = 0.7
        if any(k in source_text for k in ["계약종료", "이직", "퇴사율"]):
            stability_score = 0.35

    f_status, f_text = _to_status(finance_score)
    h_status, h_text = _to_status(hiring_score)
    s_status, s_text = _to_status(stability_score)

    return {
        "summary": f"{company_name} 관련 공개 정보 기준으로 재무/채용 신호를 요약했습니다.",
        "signals": [
            {
                "key": "finance",
                "label": "재무 신호",
                "status": f_status,
                "status_text": f_text,
                "reason": "공개 검색 결과의 키워드 기반 추정입니다.",
            },
            {
                "key": "hiring",
                "label": "채용 신호",
                "status": h_status,
                "status_text": h_text,
                "reason": "최근 채용 확대/축소 관련 키워드를 반영했습니다.",
            },
            {
                "key": "stability",
                "label": "고용 안정 신호",
                "status": s_status,
                "status_text": s_text,
                "reason": "정규직/복지/이직 관련 언급을 기준으로 판단했습니다.",
            },
        ],
        "sources": sources[:5],
        "note": note,
    }
