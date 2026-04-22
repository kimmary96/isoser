from datetime import datetime
from typing import Any, Dict, Optional
import re

ALLOWED_CATEGORIES = {
    "AI",
    "IT",
    "디자인",
    "경영",
    "교육",
    "취업",
    "창업",
    "훈련",
    "네트워킹",
    "행사/네트워킹",
    "보육",
    "오픈이노베이션",
    "초격차",
    "예비창업",
    "글로벌",
    "공간",
    "기타",
}


def normalize(raw_item: Dict) -> Optional[Dict]:
    meta = raw_item.get("source_meta", {})
    title = raw_item.get("title", "").strip()
    if not title:
        return None
    category_hint = raw_item.get("category_hint")

    row = {
        "source": meta.get("source_key") or meta.get("source_name", ""),
        "source_type": meta.get("source_type", "national_api"),
        "collection_method": meta.get("collection_method", "public_api"),
        "scope": meta.get("scope", "national"),
        "title": title,
        "category": _normalize_category(category_hint, title),
        "target": raw_item.get("target") or _extract_targets(title),
        "region": meta.get("region", "전국"),
        "region_detail": meta.get("region_detail", ""),
        "deadline": _parse_deadline(raw_item.get("raw_deadline", "")),
        "link": raw_item.get("link", ""),
        "is_ad": False,
        "sponsor_name": raw_item.get("sponsor_name"),
    }
    optional_fields = {
        "hrd_id": _clean_optional(raw_item.get("hrd_id")),
        "location": _clean_optional(raw_item.get("location")),
        "provider": _clean_optional(raw_item.get("provider")),
        "description": _clean_optional(raw_item.get("description")),
        "start_date": _parse_deadline(raw_item.get("start_date", "")),
        "end_date": _parse_deadline(raw_item.get("end_date", "")),
        "cost": _to_int(raw_item.get("cost")),
        "subsidy_amount": _to_int(raw_item.get("subsidy_amount")),
        "source_url": _clean_optional(raw_item.get("source_url")),
        "source_unique_key": _clean_optional(raw_item.get("source_unique_key")),
        "compare_meta": _clean_compare_meta(raw_item.get("compare_meta")),
    }
    for key, value in optional_fields.items():
        if value not in (None, "", {}, []):
            row[key] = value
    return row


def _clean_optional(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _to_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    text = re.sub(r"[^\d-]", "", str(value))
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _clean_compare_meta(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    cleaned = {
        str(key): entry
        for key, entry in value.items()
        if entry not in (None, "", [], {})
    }
    return cleaned or None


def _classify_category(title: str) -> str:
    if any(kw in title for kw in ["교육", "과정", "세미나", "아카데미"]):
        return "교육"
    if any(kw in title for kw in ["채용", "취업", "일자리", "인턴"]):
        return "취업"
    if any(kw in title for kw in ["훈련", "자격", "시험", "매니저"]):
        return "훈련"
    if any(kw in title for kw in ["네트워킹", "설명회", "경진대회", "데모데이", "행사"]):
        return "행사/네트워킹"
    for keyword in ("오픈이노베이션", "초격차", "예비창업", "글로벌", "공간", "보육"):
        if keyword in title:
            return keyword
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


def _normalize_category(category_hint: Optional[str], title: str) -> str:
    normalized_hint = (category_hint or "").strip()
    if normalized_hint in ALLOWED_CATEGORIES:
        return normalized_hint
    return _classify_category(title)


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
    compact_match = re.search(r"\b(\d{4})(\d{2})(\d{2})\b", raw)
    if compact_match:
        try:
            return datetime(
                int(compact_match.group(1)),
                int(compact_match.group(2)),
                int(compact_match.group(3))
            ).strftime("%Y-%m-%d")
        except ValueError:
            pass
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
