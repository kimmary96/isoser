from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Mapping, Sequence

try:
    from backend.schemas.programs import (
        ProgramFacetSnapshot,
        ProgramFilterOption,
        ProgramFilterOptionsResponse,
    )
except ImportError:
    from schemas.programs import (
        ProgramFacetSnapshot,
        ProgramFilterOption,
        ProgramFilterOptionsResponse,
    )

PROGRAM_DEADLINE_SORTS = {"default", "deadline"}
PROGRAM_TEACHING_METHODS = {"온라인", "오프라인", "혼합"}
PROGRAM_COST_TYPES = {"naeil-card", "free-no-card", "paid"}
PROGRAM_PARTICIPATION_TIMES = {"part-time", "full-time"}
PROGRAM_TARGETS = {"청년", "여성", "중장년", "창업", "재직자", "구직자", "대학생"}
PROGRAM_SELECTION_PROCESSES = {"서류", "면접", "테스트", "선착순", "추첨"}
PROGRAM_EMPLOYMENT_LINKS = {"채용연계", "인턴십", "취업지원", "멘토링"}
KST = timezone(timedelta(hours=9))
PROGRAM_CATEGORY_LABELS: dict[str, str] = {
    "web-development": "웹 풀스택",
    "mobile": "프론트엔드",
    "data-ai": "AI서비스",
    "cloud-security": "클라우드",
    "iot-embedded-semiconductor": "반도체",
    "game-blockchain": "기타",
    "planning-marketing-other": "PM/기획",
    "design-3d": "UX/UI/디자인",
    "project-career-startup": "PM/기획",
}
PROGRAM_CATEGORY_SEARCH_ALIASES: dict[str, tuple[str, ...]] = {
    "web-development": ("웹개발", "웹 개발", "웹 풀스택", "fullstack"),
    "mobile": ("모바일", "앱", "프론트엔드"),
    "data-ai": ("ai", "데이터", "데이터AI", "데이터 AI", "AI서비스", "인공지능", "llm", "rag"),
    "cloud-security": ("클라우드", "보안", "클라우드보안"),
    "iot-embedded-semiconductor": ("IoT", "임베디드", "반도체"),
    "game-blockchain": ("게임", "블록체인"),
    "planning-marketing-other": ("기획", "마케팅", "PM", "기타"),
    "design-3d": ("디자인", "3D", "UX", "UI"),
    "project-career-startup": ("프로젝트", "취준", "창업", "스타트업"),
}
PROGRAM_CATEGORY_DETAIL_DISPLAY_MATCHES: dict[str, tuple[str, ...]] = {
    "web-development": ("웹 풀스택", "백엔드", "프론트엔드"),
    "mobile": ("프론트엔드",),
    "data-ai": ("AI서비스", "AI역량강화", "데이터분석", "데이터엔지니어링"),
    "cloud-security": ("클라우드", "보안", "인프라"),
    "iot-embedded-semiconductor": ("반도체", "임베디드"),
    "game-blockchain": ("게임", "블록체인"),
    "planning-marketing-other": ("PM/기획",),
    "design-3d": ("UX/UI/디자인",),
    "project-career-startup": ("PM/기획",),
}
PROGRAM_CATEGORY_DETAIL_BROAD_FALLBACKS: dict[str, tuple[str, ...]] = {
    "data-ai": ("AI",),
    "planning-marketing-other": ("경영",),
    "design-3d": ("디자인",),
    "project-career-startup": ("창업",),
}
PROGRAM_CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("AI서비스", ("ai", "인공지능", "llm", "rag", "생성형", "챗봇", "머신러닝", "딥러닝", "mcp")),
    ("AI역량강화", ("ai 활용", "ai 역량", "프롬프트", "업무자동화", "노코드", "로우코드")),
    ("웹 풀스택", ("풀스택", "fullstack", "웹개발", "웹 개발", "spring", "django", "react", "next.js", "node")),
    ("백엔드", ("백엔드", "backend", "java", "spring", "api", "서버", "restapi")),
    ("프론트엔드", ("프론트엔드", "frontend", "react", "vue", "next.js", "javascript", "typescript", "모바일", "앱")),
    ("데이터분석", ("데이터분석", "데이터 분석", "시각화", "bi", "sql", "통계", "pandas")),
    ("데이터엔지니어링", ("데이터엔지니어링", "데이터 엔지니어링", "데이터 파이프라인", "etl", "spark", "airflow", "db")),
    ("UX/UI/디자인", ("ux", "ui", "uxui", "디자인", "figma", "피그마", "와이어프레임", "프로토타입")),
    ("PM/기획", ("pm", "기획", "서비스기획", "프로덕트", "마케팅", "사업계획", "창업")),
    ("클라우드", ("클라우드", "aws", "azure", "gcp", "devops", "쿠버네티스", "kubernetes", "docker")),
    ("반도체", ("반도체", "fpga", "soc", "rtl", "verilog", "회로", "반도체설계")),
    ("임베디드", ("임베디드", "iot", "arm", "펌웨어", "라즈베리", "아두이노")),
    ("보안", ("정보보안", "보안 실무", "보안 엔지니어", "클라우드 보안", "사이버보안", "security", "해킹", "모의해킹", "침해대응", "침해 사고", "정보보호")),
    ("인프라", ("인프라", "네트워크 인프라", "네트워크 관리", "네트워크 엔지니어", "linux", "리눅스", "ccna", "서버관리")),
)
PROGRAM_KEYWORD_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("AI", ("ai", "인공지능")),
    ("Python", ("python", "파이썬")),
    ("Java", ("java", "자바")),
    ("JavaScript", ("javascript", "자바스크립트")),
    ("TypeScript", ("typescript", "타입스크립트")),
    ("React", ("react", "리액트")),
    ("Next.js", ("next.js", "nextjs")),
    ("FastAPI", ("fastapi",)),
    ("Spring", ("spring", "스프링")),
    ("SQL", ("sql",)),
    ("DB", ("db", "database", "데이터베이스")),
    ("데이터분석", ("데이터분석", "데이터 분석")),
    ("머신러닝", ("머신러닝", "machine learning", "ml")),
    ("딥러닝", ("딥러닝", "deep learning")),
    ("RAG", ("rag",)),
    ("LLM", ("llm", "대규모 언어모델")),
    ("MCP", ("mcp",)),
    ("ChatGPT", ("chatgpt", "chat gpt")),
    ("Vibe Coding", ("vibe coding", "바이브코딩", "바이브 코딩")),
    ("PRD", ("prd",)),
    ("UXUI", ("ux/ui", "uxui", "ux ui")),
    ("UIUX", ("ui/ux", "uiux", "ui ux")),
    ("와이어프레임", ("와이어프레임", "wireframe")),
    ("Figma", ("figma", "피그마")),
    ("HTML5", ("html5",)),
    ("CSS3", ("css3",)),
    ("Bootstrap", ("bootstrap", "부트스트랩")),
    ("PremierePro", ("premierepro", "premiere pro", "프리미어 프로", "프리미어프로")),
    ("AfterEffect", ("aftereffect", "after effect", "애프터 이펙트", "에프터 이펙트", "에프터이펙트")),
    ("Blender", ("blender", "블렌더")),
    ("영상 편집", ("영상 편집", "영상편집")),
    ("클라우드", ("클라우드", "cloud")),
    ("AWS", ("aws",)),
    ("Docker", ("docker", "도커")),
    ("Kubernetes", ("kubernetes", "쿠버네티스", "k8s")),
    ("FPGA", ("fpga",)),
    ("SoC", ("soc",)),
    ("RTL", ("rtl",)),
    ("Verilog", ("verilog",)),
    ("반도체설계", ("반도체설계", "반도체 설계")),
    ("NVIDIA", ("nvidia", "엔비디아")),
    ("Jetson", ("jetson",)),
    ("Physical AI", ("physical ai",)),
    ("Sim-to-Real", ("sim-to-real", "sim to real")),
    ("OpenUSD", ("openusd",)),
    ("Omniverse", ("omniverse",)),
    ("Isaac Sim", ("isaac sim",)),
    ("CCNA", ("ccna",)),
    ("포트폴리오", ("포트폴리오", "portfolio")),
    ("면접", ("면접", "인터뷰")),
    ("현직자멘토링", ("현직자", "멘토링")),
    ("취업지원", ("취업지원", "취업 지원")),
    ("채용연계", ("채용연계", "채용 연계")),
)
PROGRAM_SEARCHABLE_COMPARE_META_KEYS = {
    "address",
    "application_deadline",
    "application_end_date",
    "business_type",
    "certificate",
    "curriculum",
    "day_night",
    "day_night_type",
    "delivery_method",
    "employment_connection",
    "location",
    "ncs_code",
    "ncs_name",
    "region",
    "recruitment_deadline",
    "schedule_text",
    "selection_process",
    "target_detail",
    "target_group",
    "target_job",
    "teaching_method",
    "training_schedule",
    "training_institution",
    "training_time",
    "training_type",
    "weekend_text",
    "weekend_yn",
    "weekday_text",
}
PROGRAM_SHORT_ASCII_SEARCH_MAX_LENGTH = 2
ONLINE_KEYWORDS = ("온라인", "비대면", "원격")
HYBRID_KEYWORDS = ("혼합", "블렌디드", "온오프", "온·오프")
OFFLINE_KEYWORDS = ("오프라인", "대면", "현장")


def _normalize_search_text(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").lower())


def _parse_program_deadline(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _normalize_text_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    if not text:
        return []
    return [item.strip() for item in text.split(",") if item.strip()]


def _first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value not in (None, "", [], {}) and not isinstance(value, (dict, list)):
            return str(value).strip()
    return None


def _int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    text = "".join(ch for ch in str(value) if ch.isdigit() or ch == "-")
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _legacy_program_meta(program: Mapping[str, Any]) -> dict[str, Any]:
    compare_meta = program.get("compare_meta") if isinstance(program.get("compare_meta"), dict) else {}
    service_meta = program.get("service_meta") if isinstance(program.get("service_meta"), dict) else {}

    merged: dict[str, Any] = {
        str(key): value
        for key, value in compare_meta.items()
        if key != "field_sources" and value not in (None, "", [], {})
    }
    for key, value in service_meta.items():
        if value in (None, "", [], {}):
            continue
        merged[str(key)] = value
    return merged


def _program_search_index_filter(q: str | None) -> str | None:
    needle = _normalize_search_text(q)
    if not needle:
        return None
    return f"ilike.*{needle}*"


def _can_use_program_search_index(q: str | None) -> bool:
    needle = _normalize_search_text(q)
    if not needle:
        return False
    if len(needle) <= PROGRAM_SHORT_ASCII_SEARCH_MAX_LENGTH and re.fullmatch(r"[a-z0-9]+", needle):
        return False
    return True


def _flatten_search_values(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, dict):
        values: list[str] = []
        for item in value.values():
            values.extend(_flatten_search_values(item))
        return values
    if isinstance(value, list):
        values = []
        for item in value:
            values.extend(_flatten_search_values(item))
        return values
    text = str(value).strip()
    return [text] if text else []


def _searchable_compare_meta_values(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return []
    values: list[str] = []
    for key, item in value.items():
        if key in PROGRAM_SEARCHABLE_COMPARE_META_KEYS:
            values.extend(_flatten_search_values(item))
    return values


def _program_category_search_values(row: dict[str, Any]) -> list[str]:
    values = _flatten_search_values(row.get("category")) + _flatten_search_values(row.get("category_detail"))
    category_detail = str(row.get("category_detail") or "").strip()
    if category_detail:
        values.append(category_detail.replace("-", ""))
        values.extend(PROGRAM_CATEGORY_SEARCH_ALIASES.get(category_detail, ()))
        label = PROGRAM_CATEGORY_LABELS.get(category_detail)
        if label:
            values.extend((label, re.sub(r"[\s·/]+", "", label)))
    return values


def _program_search_groups(row: dict[str, Any]) -> list[tuple[int, list[str]]]:
    legacy_meta = _legacy_program_meta(row)
    return [
        (0, _flatten_search_values(row.get("title"))),
        (1, _flatten_search_values(row.get("provider"))),
        (2, _program_category_search_values(row)),
        (3, _flatten_search_values(row.get("description")) + _flatten_search_values(row.get("summary"))),
        (4, _flatten_search_values(row.get("location")) + _flatten_search_values(row.get("region_detail")) + _flatten_search_values(row.get("region"))),
        (5, _flatten_search_values(row.get("tags")) + _flatten_search_values(row.get("skills"))),
        (6, _searchable_compare_meta_values(legacy_meta)),
    ]


def _program_search_match_rank(row: dict[str, Any], q: str | None) -> int | None:
    needle = _normalize_search_text(q)
    if not needle:
        return None
    for rank, values in _program_search_groups(row):
        if any(needle in _normalize_search_text(value) for value in values):
            return rank
    return None


def _filter_program_rows_by_query(rows: list[dict[str, Any]], q: str | None) -> list[dict[str, Any]]:
    if not _normalize_search_text(q):
        return rows
    return [row for row in rows if _program_search_match_rank(row, q) is not None]


def _row_matches_category_detail(row: dict[str, Any], category_detail: str | None) -> bool:
    target = str(category_detail or "").strip()
    if not target:
        return True

    if str(row.get("category_detail") or "").strip() == target:
        return True

    display_labels = _flatten_search_values(row.get("display_categories"))
    if any(label in PROGRAM_CATEGORY_DETAIL_DISPLAY_MATCHES.get(target, ()) for label in display_labels):
        return True

    broad_categories = PROGRAM_CATEGORY_DETAIL_BROAD_FALLBACKS.get(target, ())
    if broad_categories and str(row.get("category") or "").strip() in broad_categories:
        return True

    values = _program_source_text_values(row) + _flatten_search_values(row.get("category")) + display_labels
    text = " ".join(values).casefold()
    aliases = (
        PROGRAM_CATEGORY_SEARCH_ALIASES.get(target, ())
        + PROGRAM_CATEGORY_DETAIL_DISPLAY_MATCHES.get(target, ())
        + ((PROGRAM_CATEGORY_LABELS[target],) if target in PROGRAM_CATEGORY_LABELS else ())
    )
    return any(_text_has_keyword(text, alias) for alias in aliases)


def _filter_program_rows_by_category_detail(
    rows: list[dict[str, Any]],
    category_detail: str | None,
) -> list[dict[str, Any]]:
    if not str(category_detail or "").strip():
        return rows
    return [row for row in rows if _row_matches_category_detail(row, category_detail)]


def _program_text_blob(row: dict[str, Any]) -> str:
    legacy_meta = _legacy_program_meta(row)
    values = (
        _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("provider"))
        + _flatten_search_values(row.get("summary"))
        + _flatten_search_values(row.get("description"))
        + _flatten_search_values(row.get("support_type"))
        + _flatten_search_values(row.get("teaching_method"))
        + _flatten_search_values(row.get("tags"))
        + _flatten_search_values(row.get("skills"))
        + _searchable_compare_meta_values(legacy_meta)
    )
    return " ".join(values).casefold()


def _dedupe_preserve_order(values: list[str], *, limit: int | None = None) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = str(value or "").strip()
        if not cleaned:
            continue
        key = re.sub(r"\s+", "", cleaned).casefold()
        if not key or key in seen:
            continue
        seen.add(key)
        items.append(cleaned)
        if limit is not None and len(items) >= limit:
            break
    return items


def _program_source_text_values(row: dict[str, Any]) -> list[str]:
    raw_data = row.get("raw_data") if isinstance(row.get("raw_data"), dict) else {}
    legacy_meta = _legacy_program_meta(row)
    return (
        _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("summary"))
        + _flatten_search_values(row.get("description"))
        + _flatten_search_values(row.get("target"))
        + _flatten_search_values(row.get("tags"))
        + _flatten_search_values(row.get("skills"))
        + _flatten_search_values(row.get("support_type"))
        + _flatten_search_values(row.get("teaching_method"))
        + _flatten_search_values(raw_data.get("trainTarget"))
        + _searchable_compare_meta_values(legacy_meta)
    )


def _text_has_keyword(text: str, keyword: str) -> bool:
    normalized_keyword = keyword.casefold()
    if re.fullmatch(r"[a-z0-9.+#/-]+", normalized_keyword):
        escaped = re.escape(normalized_keyword)
        return re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", text) is not None
    return normalized_keyword in text


def _derive_teaching_method(row: dict[str, Any]) -> str | None:
    explicit = str(row.get("teaching_method") or "").strip()
    if explicit in PROGRAM_TEACHING_METHODS:
        return explicit

    raw_data = row.get("raw_data") if isinstance(row.get("raw_data"), dict) else {}
    legacy_meta = _legacy_program_meta(row)
    values = (
        _flatten_search_values(explicit)
        + _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("summary"))
        + _flatten_search_values(row.get("description"))
        + _flatten_search_values(row.get("target"))
        + _flatten_search_values(raw_data.get("trainTarget"))
        + _flatten_search_values(legacy_meta.get("training_type"))
        + _flatten_search_values(legacy_meta.get("teaching_method"))
    )
    text = " ".join(values).casefold()
    if not text:
        return explicit or None

    online_keywords = ONLINE_KEYWORDS + ("원격훈련", "원격 교육", "원격교육", "이러닝", "e-learning")
    offline_keywords = OFFLINE_KEYWORDS + ("집체훈련", "집체 교육", "집체교육")
    has_online = any(keyword.casefold() in text for keyword in online_keywords)
    has_offline = any(keyword.casefold() in text for keyword in offline_keywords)
    has_hybrid = any(keyword.casefold() in text for keyword in HYBRID_KEYWORDS)

    if has_hybrid or (has_online and has_offline):
        return "혼합"
    if has_online:
        return "온라인"
    if has_offline:
        return "오프라인"
    return explicit or None


def _infer_display_categories(row: dict[str, Any]) -> list[str]:
    candidates: list[str] = []
    category_detail = str(row.get("category_detail") or "").strip()
    category = str(row.get("category") or "").strip()

    if category_detail in PROGRAM_CATEGORY_LABELS:
        mapped = PROGRAM_CATEGORY_LABELS[category_detail]
        if mapped != "기타":
            candidates.append(mapped)

    text = " ".join(_program_source_text_values(row)).casefold()
    for label, keywords in PROGRAM_CATEGORY_RULES:
        if any(_text_has_keyword(text, keyword) for keyword in keywords):
            candidates.append(label)

    if category and category not in {"IT", "AI", "디자인", "경영", "창업", "기타", "전체"}:
        candidates.append(category)
    elif category == "AI":
        candidates.append("AI서비스")
    elif category == "디자인" and any(_text_has_keyword(text, keyword) for keyword in ("디자인", "ux", "ui", "figma", "피그마")):
        candidates.append("UX/UI/디자인")
    elif category == "창업":
        candidates.append("PM/기획")

    deduped = _dedupe_preserve_order(candidates, limit=2)
    return deduped if deduped else ["기타"]


def _extract_time_detail(text_values: list[str]) -> str | None:
    source = " / ".join(text_values)
    weekday_match = re.search(r"(월\s*[,~·/ ]\s*화\s*[,~·/ ]\s*수\s*[,~·/ ]\s*목\s*[,~·/ ]\s*금|월\s*[~-]\s*금|평일)", source)
    weekday_broad_match = re.search(r"주중", source)
    weekend_match = re.search(r"(토\s*[,~·/ ]\s*일|주말)", source)
    time_match = re.search(r"([01]?\d|2[0-3])[:시]\s*([0-5]\d)?\s*(?:~|-|부터|에서)\s*([01]?\d|2[0-3])[:시]\s*([0-5]\d)?", source)
    weekly_hours_match = re.search(r"주\s*(\d{1,2})\s*시간", source)
    daily_hours_match = re.search(r"(?:일|하루)\s*(\d{1,2})\s*시간", source)
    total_hours_match = re.search(r"(?:(\d{1,3})\s*일\s*[·,/]?\s*)?총\s*(\d{1,4})\s*시간", source)

    day_text = None
    if weekend_match:
        day_text = "주말"
    elif weekday_match:
        day_text = "월,화,수,목,금"
    elif weekday_broad_match:
        day_text = "주중"

    if time_match:
        start_hour = int(time_match.group(1))
        start_minute = time_match.group(2) or "00"
        end_hour = int(time_match.group(3))
        end_minute = time_match.group(4) or "00"
        time_text = f"{start_hour:02d}:{start_minute} ~ {end_hour:02d}:{end_minute}"
        return f"{day_text} / {time_text}" if day_text else time_text
    if weekly_hours_match:
        return f"주 {weekly_hours_match.group(1)}시간 학습 권장"
    if daily_hours_match:
        return f"일 {daily_hours_match.group(1)}시간 학습 권장"
    if total_hours_match:
        duration_text = (
            f"{total_hours_match.group(1)}일 · 총 {total_hours_match.group(2)}시간"
            if total_hours_match.group(1)
            else f"총 {total_hours_match.group(2)}시간"
        )
        return f"{day_text} / {duration_text}" if day_text else duration_text
    if day_text:
        return day_text
    return None


def _extract_time_hours(text_values: list[str]) -> tuple[int | None, int | None]:
    source = " ".join(text_values)
    time_match = re.search(r"([01]?\d|2[0-3])[:시]\s*(?:[0-5]\d)?\s*(?:~|-|부터|에서)\s*([01]?\d|2[0-3])", source)
    if not time_match:
        return None, None
    return int(time_match.group(1)), int(time_match.group(2))


def _time_span_hours(start_hour: int | None, end_hour: int | None) -> int | None:
    if start_hour is None or end_hour is None:
        return None
    span = end_hour - start_hour
    if span < 0:
        span += 24
    return span


def _program_participation_time(row: dict[str, Any]) -> str | None:
    explicit_participation_time = str(row.get("participation_time") or "").strip()
    if explicit_participation_time in PROGRAM_PARTICIPATION_TIMES:
        return explicit_participation_time

    text_values = _program_source_text_values(row)
    text = " ".join(text_values).casefold()
    start_hour, end_hour = _extract_time_hours(text_values)
    span_hours = _time_span_hours(start_hour, end_hour)

    if any(keyword in text for keyword in ("풀타임", "full-time", "전일", "종일")):
        return "full-time"
    if start_hour is not None and end_hour is not None and start_hour <= 10 and end_hour >= 17:
        return "full-time"

    if any(keyword in text for keyword in ("파트타임", "part-time", "야간", "저녁", "주말", "특강", "세미나")):
        return "part-time"
    if start_hour is not None and start_hour >= 18:
        return "part-time"
    if span_hours is not None and 0 < span_hours <= 5:
        return "part-time"
    return None


def _derive_participation_display(row: dict[str, Any]) -> tuple[str | None, str | None]:
    explicit = str(row.get("participation_time") or "").strip()
    text_values = _program_source_text_values(row)
    text = " ".join(text_values).casefold()
    time_detail = _extract_time_detail(text_values)
    start_hour, end_hour = _extract_time_hours(text_values)
    span_hours = _time_span_hours(start_hour, end_hour)

    if "주말" in text or re.search(r"토\s*[,~·/ ]\s*일", " ".join(text_values)):
        label = "주말반"
    elif "야간" in text or "저녁" in text or (start_hour is not None and start_hour >= 18):
        label = "저녁반"
    elif "자율" in text or "자유 학습" in text or "개별 자유" in text:
        label = "자율학습"
    elif explicit == "full-time" or "풀타임" in text or "전일" in text or (start_hour is not None and end_hour is not None and start_hour <= 10 and end_hour >= 17):
        label = "풀타임"
    elif explicit == "part-time" or any(keyword in text for keyword in ("파트타임", "part-time", "특강", "세미나")) or (span_hours is not None and 0 < span_hours <= 5):
        label = "파트타임"
    else:
        inferred = _program_participation_time(row)
        label = {"full-time": "풀타임", "part-time": "파트타임"}.get(inferred or "")

    if label and time_detail:
        return label, time_detail
    if label:
        return label, None
    return None, time_detail


def _derive_selection_process_label(row: dict[str, Any]) -> str | None:
    legacy_meta = _legacy_program_meta(row)
    candidates: list[str] = []
    if legacy_meta.get("coding_skill_required") in (True, "pass", "warn") or "코딩테스트" in _program_text_blob(row):
        candidates.append("코딩 테스트")
    if legacy_meta.get("portfolio_required") is True:
        candidates.append("포트폴리오")
    if legacy_meta.get("interview_required") is True:
        candidates.append("면접")

    text = _program_text_blob(row)
    selection_map = (
        ("서류", ("서류", "신청서", "자기소개서")),
        ("면접", ("면접", "인터뷰")),
        ("테스트", ("테스트", "코딩테스트", "역량평가")),
        ("선착순", ("선착순",)),
        ("추첨", ("추첨",)),
    )
    for label, keywords in selection_map:
        if any(keyword.casefold() in text for keyword in keywords):
            candidates.append(label)

    deduped = _dedupe_preserve_order(candidates, limit=3)
    return " / ".join(deduped) if deduped else "선발 절차 없음"


def _is_useful_keyword(value: str) -> bool:
    cleaned = value.strip(" #[](){}·,./")
    if len(cleaned) < 2 or len(cleaned) > 18:
        return False
    generic = {
        "교육",
        "과정",
        "프로그램",
        "모집",
        "무료",
        "오프라인",
        "온라인",
        "혼합",
        "서울",
        "경기",
        "청년",
        "구직자",
        "재직자",
    }
    return cleaned not in generic


def _extract_program_keywords(row: dict[str, Any]) -> list[str]:
    keywords: list[str] = []
    text = " ".join(_program_source_text_values(row)).casefold()

    for label, aliases in PROGRAM_KEYWORD_RULES:
        if any(_text_has_keyword(text, alias) for alias in aliases):
            keywords.append(label)

    for value in _normalize_text_list(row.get("skills")) + _normalize_text_list(row.get("tags")):
        cleaned = value.strip(" #[](){}·,./")
        if _is_useful_keyword(cleaned):
            keywords.append(cleaned)

    for value in _flatten_search_values(_legacy_program_meta(row).get("target_job")):
        cleaned = value.strip()
        if _is_useful_keyword(cleaned):
            keywords.append(cleaned)

    return _dedupe_preserve_order(keywords, limit=8)


def _normalize_option_param(values: list[str] | None, allowed_values: set[str]) -> list[str]:
    if not values:
        return []
    normalized_values: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if not text or text not in allowed_values or text in seen:
            continue
        seen.add(text)
        normalized_values.append(text)
    return normalized_values


def _program_cost_type(row: dict[str, Any]) -> str | None:
    explicit_cost_type = str(row.get("cost_type") or "").strip()
    if explicit_cost_type in PROGRAM_COST_TYPES:
        return explicit_cost_type

    text = _program_text_blob(row)
    legacy_meta = _legacy_program_meta(row)
    card_required = legacy_meta.get("naeilbaeumcard_required")
    has_card_keyword = "내일배움" in text or "내배카" in text or "국민내일배움" in text
    if card_required is True or card_required == "pass" or has_card_keyword:
        return "naeil-card"

    cost = _int_or_none(row.get("cost"))
    if cost is not None:
        return "paid" if cost > 0 else "free-no-card"

    if "무료" in text or "전액 지원" in text or "자부담 0" in text:
        return "free-no-card"
    if "유료" in text or "자부담" in text or "수강료" in text:
        return "paid"
    return None


def _program_sort_date(
    row: dict[str, Any],
    *,
    row_keys: Sequence[str],
    meta_keys: Sequence[str],
) -> date | None:
    legacy_meta = _legacy_program_meta(row)
    for key in row_keys:
        parsed = _parse_program_deadline(_first_text(row.get(key)))
        if parsed:
            return parsed
    for key in meta_keys:
        parsed = _parse_program_deadline(_first_text(legacy_meta.get(key)))
        if parsed:
            return parsed
    return None


def _program_start_sort_date(row: dict[str, Any]) -> date | None:
    return _program_sort_date(
        row,
        row_keys=("program_start_date", "start_date"),
        meta_keys=("program_start_date", "training_start_date", "tra_start_date", "traStartDate", "course_start_date"),
    )


def _program_end_sort_date(row: dict[str, Any]) -> date | None:
    return _program_sort_date(
        row,
        row_keys=("program_end_date", "end_date"),
        meta_keys=("program_end_date", "training_end_date", "tra_end_date", "traEndDate", "course_end_date"),
    )


def _program_sort_duration_days(row: dict[str, Any]) -> int | None:
    start = _program_start_sort_date(row)
    end = _program_end_sort_date(row)
    if start is None or end is None or end < start:
        return None
    return (end - start).days + 1


def _program_sort_cost_amount(row: dict[str, Any]) -> int | None:
    direct_cost = _int_or_none(row.get("cost"))
    if direct_cost is not None:
        return max(0, direct_cost)

    legacy_meta = _legacy_program_meta(row)
    for key in ("cost", "fee", "tuition", "course_fee", "training_fee", "self_payment", "out_of_pocket"):
        parsed = _int_or_none(legacy_meta.get(key))
        if parsed is not None:
            return max(0, parsed)

    cost_type = _program_cost_type(row)
    if cost_type in {"free-no-card", "naeil-card"}:
        return 0
    return None


def _filter_program_rows_by_extra_filters(
    rows: list[dict[str, Any]],
    *,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    selection_processes: list[str] | None = None,
    employment_links: list[str] | None = None,
) -> list[dict[str, Any]]:
    normalized_cost_types = set(_normalize_option_param(cost_types, PROGRAM_COST_TYPES))
    normalized_participation_times = set(_normalize_option_param(participation_times, PROGRAM_PARTICIPATION_TIMES))
    normalized_targets = set(_normalize_option_param(targets, PROGRAM_TARGETS))
    normalized_selection_processes = set(_normalize_option_param(selection_processes, PROGRAM_SELECTION_PROCESSES))
    normalized_employment_links = set(_normalize_option_param(employment_links, PROGRAM_EMPLOYMENT_LINKS))
    if (
        not normalized_cost_types
        and not normalized_participation_times
        and not normalized_targets
        and not normalized_selection_processes
        and not normalized_employment_links
    ):
        return rows

    filtered_rows: list[dict[str, Any]] = []
    for row in rows:
        if normalized_cost_types and _program_cost_type(row) not in normalized_cost_types:
            continue
        if normalized_participation_times and _program_participation_time(row) not in normalized_participation_times:
            continue
        if normalized_targets and not _program_matches_targets(row, normalized_targets):
            continue
        if normalized_selection_processes and not _program_matches_any(row, normalized_selection_processes):
            continue
        if normalized_employment_links and not _program_matches_any(row, normalized_employment_links):
            continue
        filtered_rows.append(row)
    return filtered_rows


def _program_matches_targets(row: dict[str, Any], targets: set[str]) -> bool:
    text = _program_text_blob(row) + " " + " ".join(_flatten_search_values(row.get("target")))
    return any(target.casefold() in text.casefold() for target in targets)


def _program_matches_any(row: dict[str, Any], keywords: set[str]) -> bool:
    text = _program_text_blob(row)
    return any(keyword.casefold() in text.casefold() for keyword in keywords)


def _program_source_label(source: str) -> str:
    normalized = source.strip()
    labels = {
        "kstartup": "K-Startup",
        "K-Startup": "K-Startup",
        "sesac": "SeSAC",
        "SeSAC": "SeSAC",
    }
    return labels.get(normalized, normalized)


def _build_named_filter_options(values: list[str], *, source_labels: bool = False) -> list[ProgramFilterOption]:
    seen: set[str] = set()
    options: list[ProgramFilterOption] = []
    for value in values:
        normalized = str(value or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        options.append(
            ProgramFilterOption(
                value=normalized,
                label=_program_source_label(normalized) if source_labels else normalized,
            )
        )
    return options


def _extract_program_filter_options(rows: list[dict[str, Any]]) -> ProgramFilterOptionsResponse:
    sources: list[str] = []
    targets: list[str] = []
    selection_processes: list[str] = []
    employment_links: list[str] = []

    for row in rows:
        source = str(row.get("source") or "").strip()
        if source:
            sources.append(source)

        target_text = (_program_text_blob(row) + " " + " ".join(_flatten_search_values(row.get("target")))).casefold()
        targets.extend(target for target in sorted(PROGRAM_TARGETS) if target.casefold() in target_text)
        selection_processes.extend(
            process for process in sorted(PROGRAM_SELECTION_PROCESSES) if _program_matches_any(row, {process})
        )
        employment_links.extend(
            link for link in sorted(PROGRAM_EMPLOYMENT_LINKS) if _program_matches_any(row, {link})
        )

    return ProgramFilterOptionsResponse(
        sources=_build_named_filter_options(sorted(sources, key=str.casefold), source_labels=True),
        targets=_build_named_filter_options(targets),
        selection_processes=_build_named_filter_options(selection_processes),
        employment_links=_build_named_filter_options(employment_links),
    )


def _filter_options_from_facet_snapshot(facets: ProgramFacetSnapshot) -> ProgramFilterOptionsResponse:
    return ProgramFilterOptionsResponse(
        sources=[
            ProgramFilterOption(value=bucket.value, label=_program_source_label(bucket.value))
            for bucket in facets.source
            if bucket.value
        ],
        targets=[ProgramFilterOption(value=value, label=value) for value in sorted(PROGRAM_TARGETS)],
        selection_processes=[],
        employment_links=[],
    )


def _program_detail_view_count(row: Mapping[str, Any], *, recent_only: bool = False) -> int:
    key = "detail_view_count_7d" if recent_only else "detail_view_count"
    return _int_or_none(row.get(key)) or 0


def _sort_program_list_rows(
    rows: list[dict[str, Any]],
    *,
    sort: str,
    include_closed_recent: bool,
) -> list[dict[str, Any]]:
    if sort == "latest":
        return rows

    def deadline_sort_key(row: dict[str, Any]) -> tuple[int, int]:
        parsed_deadline = _parse_program_deadline(str(row.get("deadline") or ""))
        is_active = bool(row.get("is_active"))
        if include_closed_recent and not is_active:
            return (2, -(parsed_deadline.toordinal() if parsed_deadline else date.min.toordinal()))
        if parsed_deadline is None:
            return (1, date.max.toordinal())
        return (0, parsed_deadline.toordinal())

    if sort in PROGRAM_DEADLINE_SORTS:
        return sorted(rows, key=deadline_sort_key)

    if sort == "start_soon":
        return sorted(
            rows,
            key=lambda row: (
                1 if _program_start_sort_date(row) is None else 0,
                (_program_start_sort_date(row) or date.max).toordinal(),
                deadline_sort_key(row),
            ),
        )

    if sort in {"cost_low", "cost_high"}:
        reverse_cost = sort == "cost_high"
        return sorted(
            rows,
            key=lambda row: (
                1 if _program_sort_cost_amount(row) is None else 0,
                -(_program_sort_cost_amount(row) or 0) if reverse_cost else (_program_sort_cost_amount(row) or 0),
                deadline_sort_key(row),
            ),
        )

    if sort in {"duration_short", "duration_long"}:
        reverse_duration = sort == "duration_long"
        return sorted(
            rows,
            key=lambda row: (
                1 if _program_sort_duration_days(row) is None else 0,
                -(_program_sort_duration_days(row) or 0)
                if reverse_duration
                else (_program_sort_duration_days(row) or 0),
                deadline_sort_key(row),
            ),
        )

    if sort == "popular":
        return sorted(
            rows,
            key=lambda row: (
                -_program_detail_view_count(row, recent_only=True),
                -_program_detail_view_count(row),
                -(float(row.get("recommended_score") or 0.0)),
                deadline_sort_key(row),
                str(row.get("id") or ""),
            ),
        )

    return sorted(rows, key=deadline_sort_key)


def _today_kst() -> date:
    return datetime.now(KST).date()


def _filter_program_rows_by_deadline_window(
    rows: list[dict[str, Any]],
    *,
    recruiting_only: bool,
    include_closed_recent: bool,
    sort: str,
    is_active_work24_with_unknown_deadline: Callable[[Mapping[str, Any]], bool],
) -> list[dict[str, Any]]:
    if include_closed_recent:
        recent_cutoff = _today_kst() - timedelta(days=90)
        return [
            row
            for row in rows
            if (
                (parsed_deadline := _parse_program_deadline(str(row.get("deadline") or "")))
                and parsed_deadline >= recent_cutoff
            )
        ]
    if not recruiting_only and sort not in PROGRAM_DEADLINE_SORTS:
        return rows
    return [
        row
        for row in rows
        if (isinstance(row.get("days_left"), int) and row["days_left"] >= 0)
        or is_active_work24_with_unknown_deadline(row)
    ]


def _postprocess_program_list_rows(
    rows: list[dict[str, Any]],
    *,
    category_detail: str | None = None,
    q: str | None = None,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    selection_processes: list[str] | None = None,
    employment_links: list[str] | None = None,
    recruiting_only: bool = False,
    sort: str,
    include_closed_recent: bool,
    limit: int,
    offset: int,
    prefer_work24_default_mix: bool = False,
    serialize_program_list_row: Callable[[dict[str, Any]], dict[str, Any]],
    is_active_work24_with_unknown_deadline: Callable[[Mapping[str, Any]], bool],
    mix_work24_default_rows: Callable[[list[dict[str, Any]]], list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    serialized_rows = _filter_program_rows_by_deadline_window(
        _filter_program_rows_by_extra_filters(
            _filter_program_rows_by_category_detail(
                _filter_program_rows_by_query(
                    [serialize_program_list_row(row) for row in rows],
                    q,
                ),
                category_detail,
            ),
            cost_types=cost_types,
            participation_times=participation_times,
            targets=targets,
            selection_processes=selection_processes,
            employment_links=employment_links,
        ),
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=sort,
        is_active_work24_with_unknown_deadline=is_active_work24_with_unknown_deadline,
    )
    if _normalize_search_text(q) and sort == "default":
        sorted_rows = sorted(
            serialized_rows,
            key=lambda row: (
                _program_search_match_rank(row, q) if _program_search_match_rank(row, q) is not None else 99,
                (_parse_program_deadline(str(row.get("deadline") or "")) or date.max).toordinal(),
            ),
        )
    else:
        sorted_rows = _sort_program_list_rows(
            serialized_rows,
            sort=sort,
            include_closed_recent=include_closed_recent,
        )
    if prefer_work24_default_mix:
        sorted_rows = mix_work24_default_rows(sorted_rows)
    return sorted_rows[offset : offset + limit]
