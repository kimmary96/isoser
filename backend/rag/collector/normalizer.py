from datetime import datetime
from typing import Dict, Optional
import re


def normalize(raw_item: Dict) -> Optional[Dict]:
    meta = raw_item.get("source_meta", {})
    title = raw_item.get("title", "").strip()
    if not title:
        return None
    category_hint = str(raw_item.get("category_hint") or raw_item.get("raw", {}).get("category_hint") or "").strip()

    return {
        "source": meta.get("source_name", ""),
        "source_type": meta.get("source_type", "national_api"),
        "collection_method": meta.get("collection_method", "public_api"),
        "scope": meta.get("scope", "national"),
        "title": title,
        "category": category_hint or _classify_category(title),
        "target": _extract_targets(title),
        "region": meta.get("region", "전국"),
        "region_detail": meta.get("region_detail", ""),
        "deadline": _parse_deadline(raw_item.get("raw_deadline", "")),
        "link": raw_item.get("link", ""),
        "is_ad": False,
        "sponsor_name": None,
    }


def _classify_category(title: str) -> str:
    if any(kw in title for kw in ["창업", "스타트업", "보육", "예비창업"]):
        return "창업"
    if any(kw in title for kw in ["AI", "인공지능", "LLM", "ChatGPT", "생성형", "머신러닝", "딥러닝"]):
        return "AI"
    if any(kw in title for kw in ["개발", "코딩", "프로그래밍", "SW", "소프트웨어", "클라우드", "데이터"]):
        return "IT"
    if any(kw in title for kw in ["디자인", "영상", "콘텐츠", "그래픽", "UX", "UI"]):
        return "디자인"
    if any(kw in title for kw in ["경영", "마케팅", "회계", "사무", "HR", "세무"]):
        return "경영"
    return "기타"


def _extract_targets(title: str) -> list:
    targets = []
    if "청년" in title:
        targets.append("청년")
    if "여성" in title:
        targets.append("여성")
    if "경력단절" in title:
        targets.append("경력단절여성")
    if "중장년" in title or "4050" in title:
        targets.append("중장년")
    if not targets:
        targets.append("일반")
    return targets


def _parse_deadline(raw: str) -> Optional[str]:
    if not raw:
        return None
    # YYYY-MM-DD 또는 YYYYMMDD 처리
    raw = raw.strip().replace("/", "-").replace(".", "-")
    match = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", raw)
    if match:
        try:
            return datetime(
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3))
            ).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None
