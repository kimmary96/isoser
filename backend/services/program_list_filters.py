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
PROGRAM_TARGETS = {"청년", "여성", "창업", "재직자", "대학생"}
PROGRAM_SELECTION_PROCESSES = {"서류", "면접", "테스트", "선착순", "추첨"}
PROGRAM_EMPLOYMENT_LINKS = {"채용연계", "인턴십", "취업지원", "멘토링"}
KST = timezone(timedelta(hours=9))
NCS_MAJOR_CATEGORY_LABELS: dict[str, str] = {
    "ncs-01": "사업관리",
    "ncs-02": "경영·회계·사무",
    "ncs-03": "금융·보험",
    "ncs-04": "교육·자연·사회과학",
    "ncs-05": "법률·경찰·소방·교도·국방",
    "ncs-06": "보건·의료",
    "ncs-07": "사회복지·종교",
    "ncs-08": "문화·예술·디자인·방송",
    "ncs-09": "운전·운송",
    "ncs-10": "영업판매",
    "ncs-11": "경비·청소",
    "ncs-12": "이용·숙박·여행·오락·스포츠",
    "ncs-13": "음식서비스",
    "ncs-14": "건설",
    "ncs-15": "기계",
    "ncs-16": "재료",
    "ncs-17": "화학·바이오",
    "ncs-18": "섬유·의복",
    "ncs-19": "전기·전자",
    "ncs-20": "정보통신",
    "ncs-21": "식품가공",
    "ncs-22": "인쇄·목재·가구·공예",
    "ncs-23": "환경·에너지·안전",
    "ncs-24": "농림어업",
}
NCS_MAJOR_LABEL_TO_ID = {label: key for key, label in NCS_MAJOR_CATEGORY_LABELS.items()}
PROGRAM_CATEGORY_LABELS: dict[str, str] = {
    "web-development": "웹·백엔드",
    "mobile": "모바일·프론트엔드",
    "data-ai": "데이터·AI",
    "cloud-security": "클라우드·보안",
    "iot-embedded-semiconductor": "임베디드·반도체",
    "game-blockchain": "게임·블록체인",
    "planning-marketing-other": "기획·마케팅",
    "design-3d": "디자인·3D",
    "project-career-startup": "창업·커리어",
}
PROGRAM_CATEGORY_SEARCH_ALIASES: dict[str, tuple[str, ...]] = {
    "web-development": ("웹개발", "웹 개발", "웹·백엔드", "웹백엔드", "백엔드", "fullstack"),
    "mobile": ("모바일", "앱", "모바일·프론트엔드", "모바일프론트엔드", "프론트엔드"),
    "data-ai": ("ai", "데이터", "데이터AI", "데이터 AI", "데이터·AI", "인공지능", "llm", "rag"),
    "cloud-security": ("클라우드", "보안", "클라우드보안", "클라우드·보안"),
    "iot-embedded-semiconductor": ("IoT", "임베디드", "반도체", "임베디드·반도체"),
    "game-blockchain": ("게임", "블록체인"),
    "planning-marketing-other": ("기획", "마케팅", "PM", "기획·마케팅"),
    "design-3d": ("디자인", "3D", "UX", "UI", "디자인·3D"),
    "project-career-startup": ("프로젝트", "취준", "창업", "스타트업", "창업·커리어"),
}
PROGRAM_CATEGORY_DETAIL_DISPLAY_MATCHES: dict[str, tuple[str, ...]] = {
    "web-development": ("웹·백엔드", "웹 풀스택", "백엔드"),
    "mobile": ("모바일·프론트엔드", "프론트엔드"),
    "data-ai": ("데이터·AI", "AI서비스", "AI역량강화", "데이터분석", "데이터엔지니어링"),
    "cloud-security": ("클라우드·보안", "클라우드", "보안", "인프라"),
    "iot-embedded-semiconductor": ("임베디드·반도체", "반도체", "임베디드"),
    "game-blockchain": ("게임", "블록체인"),
    "planning-marketing-other": ("기획·마케팅", "PM/기획"),
    "design-3d": ("디자인·3D", "UX/UI/디자인"),
    "project-career-startup": ("창업·커리어", "PM/기획"),
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
PROGRAM_CATEGORY_FILTER_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("web-development", ("웹개발", "웹 개발", "풀스택", "fullstack", "백엔드", "backend", "응용sw", "응용 소프트웨어", "응용sw엔지니어링", "소프트웨어개발", "프론트엔드", "frontend", "react", "next.js", "spring", "django", "api", "서버")),
    ("mobile", ("모바일", "앱", "android", "ios", "flutter", "react native", "reactnative")),
    ("data-ai", ("데이터", "빅데이터", "데이터분석", "데이터 분석", "ai", "인공지능", "llm", "rag", "머신러닝", "딥러닝", "ml")),
    ("cloud-security", ("클라우드", "aws", "azure", "gcp", "보안", "security", "정보보안", "devops", "쿠버네티스", "kubernetes", "docker", "인프라", "네트워크", "시스템관리")),
    ("iot-embedded-semiconductor", ("iot", "임베디드", "펌웨어", "아두이노", "라즈베리", "반도체", "fpga", "soc", "rtl", "verilog", "전자", "사물인터넷")),
    ("game-blockchain", ("게임", "game", "블록체인", "blockchain", "web3")),
    ("planning-marketing-other", ("기획", "pm", "서비스기획", "프로덕트", "마케팅", "브랜딩", "광고", "홍보", "경영기획")),
    ("design-3d", ("디자인", "ux", "ui", "uxui", "uiux", "figma", "피그마", "3d", "블렌더", "그래픽", "시각디자인", "영상")),
    ("project-career-startup", ("포트폴리오", "취준", "취업준비", "커리어", "창업", "스타트업", "startup", "k-startup", "kstartup", "예비창업", "프로젝트관리", "취업지원")),
)
PROGRAM_NCS_CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("web-development", ("응용sw엔지니어링", "응용 소프트웨어", "소프트웨어개발", "웹개발", "백엔드")),
    ("mobile", ("모바일", "앱개발", "모바일콘텐츠")),
    ("data-ai", ("빅데이터", "인공지능", "데이터분석", "데이터베이스", "데이터 아키텍처")),
    ("cloud-security", ("정보보안", "클라우드", "네트워크", "시스템관리", "인프라")),
    ("iot-embedded-semiconductor", ("임베디드", "반도체", "전자응용", "사물인터넷")),
    ("game-blockchain", ("게임", "블록체인")),
    ("planning-marketing-other", ("마케팅", "홍보", "경영기획")),
    ("design-3d", ("디자인", "시각디자인", "영상그래픽", "3d")),
    ("project-career-startup", ("창업", "프로젝트관리", "취업지원")),
)
NCS_MAJOR_TEXT_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("ncs-01", ("사업관리", "프로젝트관리", "창업", "스타트업", "사업계획")),
    ("ncs-02", ("경영", "회계", "사무", "마케팅", "홍보", "인사", "총무", "재무", "세무", "전산회계", "전산세무", "컴활", "컴퓨터활용능력", "엑셀", "엑세스")),
    ("ncs-03", ("금융", "보험", "투자", "자산관리")),
    ("ncs-05", ("법률", "경찰", "소방", "교도", "국방")),
    ("ncs-06", ("보건", "의료", "간호", "병원")),
    ("ncs-07", ("사회복지", "종교", "요양보호")),
    ("ncs-04", ("교육", "자연", "사회과학", "강사", "교수설계")),
    ("ncs-08", ("디자인", "시각디자인", "영상", "방송", "문화", "예술", "3d", "그래픽", "스케치업", "일러스트", "포토샵", "프리미어", "ux", "ui")),
    ("ncs-09", ("운전", "운송", "물류운송", "지게차", "굴착기", "중장비")),
    ("ncs-10", ("영업", "판매", "유통", "무역", "쇼핑몰", "커머스", "카페24")),
    ("ncs-11", ("경비", "청소")),
    ("ncs-12", ("숙박", "여행", "오락", "스포츠", "레저", "관광", "미용", "애견미용", "반려견스타일리스트")),
    ("ncs-13", ("음식", "조리", "식음료", "바리스타", "제과", "제빵")),
    ("ncs-14", ("건설", "건축", "토목", "조경", "타일시공", "시공", "인테리어")),
    ("ncs-15", ("기계", "자동차", "기계설계", "금형")),
    ("ncs-16", ("재료", "금속", "용접")),
    ("ncs-17", ("화학", "바이오", "제약")),
    ("ncs-18", ("섬유", "의복", "패션")),
    ("ncs-19", ("전기", "전자", "반도체", "회로", "fpga", "soc", "verilog", "rtl")),
    ("ncs-20", ("정보통신", "정보기술", "itq", "응용sw", "응용 소프트웨어", "소프트웨어", "웹개발", "백엔드", "프론트엔드", "모바일", "빅데이터", "인공지능", "데이터분석", "클라우드", "정보보안", "네트워크", "시스템관리", "게임", "블록체인", "ai", "llm", "rag")),
    ("ncs-21", ("식품가공", "식품")),
    ("ncs-22", ("인쇄", "목재", "가구", "공예")),
    ("ncs-23", ("환경", "에너지", "안전")),
    ("ncs-24", ("농림", "어업", "농업", "축산", "수산")),
)
PROGRAM_TARGET_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("청년", ("청년", "청년층", "청년구직자", "청년취업사관학교", "만 15", "만15", "34세 이하", "39세 이하")),
    ("여성", ("여성", "여학생", "경력단절여성", "여성가족부")),
    ("창업", ("창업", "스타트업", "startup", "k-startup", "kstartup", "예비창업", "초기창업", "창업자")),
    ("재직자", ("재직자", "근로자", "직장인", "재직중", "고용보험", "근로자원격훈련")),
    ("대학생", ("대학생", "대학 재학생", "대학재학생", "학부생", "휴학생")),
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
PROGRAM_FILTER_REGION_KEYWORDS = (
    "서울",
    "경기",
    "인천",
    "부산",
    "대구",
    "광주",
    "대전",
    "울산",
    "세종",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주",
)
PROGRAM_SOURCE_CANONICAL_LABELS: dict[str, str] = {
    "kstartup": "K-Startup",
    "sesac": "SeSAC",
    "other": "기타 기관",
}
PROGRAM_SOURCE_FILTER_ALIASES: dict[str, tuple[str, ...]] = {
    "고용24": ("고용24", "work24"),
    "kstartup": ("kstartup", "K-Startup", "K-Startup 창업진흥원"),
    "sesac": ("sesac", "SeSAC"),
}
PROGRAM_SOURCE_OTHER_VALUE = "other"
PROGRAM_SOURCE_KNOWN_ALIAS_VALUES: tuple[str, ...] = tuple(
    alias
    for canonical in ("고용24", "kstartup", "sesac")
    for alias in PROGRAM_SOURCE_FILTER_ALIASES[canonical]
)


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


def _program_ncs_text_values(row: dict[str, Any]) -> list[str]:
    raw_data = row.get("raw_data") if isinstance(row.get("raw_data"), dict) else {}
    legacy_meta = _legacy_program_meta(row)
    return (
        _flatten_search_values(row.get("ncs_name"))
        + _flatten_search_values(row.get("ncs_code"))
        + _flatten_search_values(legacy_meta.get("ncs_name"))
        + _flatten_search_values(legacy_meta.get("ncs_code"))
        + _flatten_search_values(raw_data.get("ncs_name"))
        + _flatten_search_values(raw_data.get("ncs_code"))
    )


def _program_ncs_major_source_values(row: dict[str, Any]) -> list[str]:
    raw_data = row.get("raw_data") if isinstance(row.get("raw_data"), dict) else {}
    legacy_meta = _legacy_program_meta(row)
    keys = (
        "NCS_LCLAS_CD",
        "NCS_LCLAS_CDNM",
        "ncsLclasCd",
        "ncsLclasCdnm",
        "ncs_lclas_cd",
        "ncs_lclas_name",
        "ncs_large_code",
        "ncs_large_name",
    )
    values: list[str] = []
    for source in (row, legacy_meta, raw_data):
        for key in keys:
            values.extend(_flatten_search_values(source.get(key)))
    return values


def _normalize_ncs_major_id(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None

    if text in NCS_MAJOR_CATEGORY_LABELS:
        return text
    if text in NCS_MAJOR_LABEL_TO_ID:
        return NCS_MAJOR_LABEL_TO_ID[text]

    ncs_match = re.fullmatch(r"ncs[-_ ]?(\d{1,2})", text, flags=re.IGNORECASE)
    if ncs_match:
        candidate = f"ncs-{int(ncs_match.group(1)):02d}"
        return candidate if candidate in NCS_MAJOR_CATEGORY_LABELS else None

    if re.fullmatch(r"\d{1,2}", text):
        candidate = f"ncs-{int(text):02d}"
        return candidate if candidate in NCS_MAJOR_CATEGORY_LABELS else None

    code_match = re.match(r"\D*(\d{2})(?=[:.\-_ ]|\d)", text)
    if code_match:
        candidate = f"ncs-{code_match.group(1)}"
        return candidate if candidate in NCS_MAJOR_CATEGORY_LABELS else None

    return None


def _derive_ncs_major_filter_tags(row: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    for value in _program_ncs_major_source_values(row) + _program_ncs_text_values(row):
        normalized = _normalize_ncs_major_id(value)
        if normalized:
            tags.append(normalized)

    if tags:
        return _dedupe_preserve_order(tags, limit=2)

    primary_text = " ".join(
        _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("category"))
        + _flatten_search_values(row.get("category_detail"))
        + _flatten_search_values(row.get("skills"))
        + _program_ncs_text_values(row)
    ).casefold()
    for ncs_id, aliases in NCS_MAJOR_TEXT_RULES:
        if any(_text_has_keyword(primary_text, alias) for alias in aliases):
            tags.append(ncs_id)

    if tags:
        return _dedupe_preserve_order(tags, limit=2)

    text = " ".join(_program_category_source_text_values(row)).casefold()
    for ncs_id, aliases in NCS_MAJOR_TEXT_RULES:
        if any(_text_has_keyword(text, alias) for alias in aliases):
            tags.append(ncs_id)
    return _dedupe_preserve_order(tags, limit=2)


def _is_ncs_major_category_filter(value: str | None) -> bool:
    return _normalize_ncs_major_id(value) is not None


def _program_category_search_values(row: dict[str, Any]) -> list[str]:
    values = _flatten_search_values(row.get("category")) + _flatten_search_values(row.get("category_detail"))
    category_detail = str(row.get("category_detail") or "").strip()
    if category_detail:
        values.append(category_detail.replace("-", ""))
        values.extend(PROGRAM_CATEGORY_SEARCH_ALIASES.get(category_detail, ()))
        label = PROGRAM_CATEGORY_LABELS.get(category_detail)
        if label:
            values.extend((label, re.sub(r"[\s·/]+", "", label)))
    values.extend(_program_ncs_text_values(row))
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

    normalized_ncs_target = _normalize_ncs_major_id(target)
    if normalized_ncs_target:
        return normalized_ncs_target in _derive_ncs_major_filter_tags(row)

    if target in _derive_category_filter_tags(row):
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


def _program_ncs_display_name(row: dict[str, Any]) -> str | None:
    for value in _program_ncs_text_values(row):
        normalized = str(value or "").strip()
        if normalized:
            return normalized
    return None


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


def _derive_category_tags_from_text(
    text: str,
    rules: tuple[tuple[str, tuple[str, ...]], ...],
) -> list[str]:
    if not text:
        return []
    tags: list[str] = []
    for category_detail, keywords in rules:
        if any(_text_has_keyword(text, keyword) for keyword in keywords):
            tags.append(category_detail)
    return tags


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


def _program_category_source_text_values(row: dict[str, Any]) -> list[str]:
    legacy_meta = _legacy_program_meta(row)
    return (
        _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("summary"))
        + _flatten_search_values(row.get("description"))
        + _flatten_search_values(row.get("category"))
        + _flatten_search_values(row.get("category_detail"))
        + _flatten_search_values(row.get("skills"))
        + _program_ncs_text_values(row)
        + _searchable_compare_meta_values(legacy_meta)
    )


def _derive_category_filter_tags(row: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    ncs_text = " ".join(_program_ncs_text_values(row)).casefold()
    tags.extend(_derive_category_tags_from_text(ncs_text, PROGRAM_NCS_CATEGORY_RULES))

    explicit_category_detail = str(row.get("category_detail") or "").strip()
    if explicit_category_detail:
        tags.append(explicit_category_detail)

    text = " ".join(_program_category_source_text_values(row)).casefold()
    tags.extend(_derive_category_tags_from_text(text, PROGRAM_CATEGORY_FILTER_RULES))

    return _dedupe_preserve_order(tags, limit=3)


def _derive_target_filter_tags(row: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    text = (_program_text_blob(row) + " " + " ".join(_flatten_search_values(row.get("target")))).casefold()
    for target, keywords in PROGRAM_TARGET_RULES:
        if any(_text_has_keyword(text, keyword) for keyword in keywords):
            tags.append(target)
    return _dedupe_preserve_order(tags, limit=5)


def _derive_region_filter_keyword(row: dict[str, Any]) -> str | None:
    values = (
        _flatten_search_values(row.get("title"))
        + _flatten_search_values(row.get("summary"))
        + _flatten_search_values(row.get("description"))
        + _flatten_search_values(row.get("region"))
        + _flatten_search_values(row.get("region_detail"))
        + _flatten_search_values(row.get("location"))
    )
    text = " ".join(values)
    for region in PROGRAM_FILTER_REGION_KEYWORDS:
        if region in text:
            return region
    return None


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
    ncs_major_labels = [
        NCS_MAJOR_CATEGORY_LABELS[ncs_id]
        for ncs_id in _derive_ncs_major_filter_tags(row)
        if ncs_id in NCS_MAJOR_CATEGORY_LABELS
    ]
    if ncs_major_labels:
        return _dedupe_preserve_order(ncs_major_labels, limit=2)

    category = str(row.get("category") or "").strip()
    inferred_category_details = _derive_category_filter_tags(row)

    for category_detail in inferred_category_details:
        mapped = PROGRAM_CATEGORY_LABELS.get(category_detail)
        if mapped:
            candidates.append(mapped)

    ncs_name = _program_ncs_display_name(row)
    if ncs_name and len(ncs_name) <= 24:
        candidates.append(ncs_name)

    if category and category not in {"IT", "AI", "디자인", "경영", "창업", "기타", "전체"}:
        candidates.append(category)
    elif category == "AI":
        candidates.append("데이터·AI")
    elif category == "디자인":
        candidates.append("디자인·3D")
    elif category == "창업":
        candidates.append("창업·커리어")

    deduped = _dedupe_preserve_order(candidates, limit=2)
    if deduped:
        return deduped
    return ["기타"] if _program_source_text_values(row) else []


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
    return " / ".join(deduped) if deduped else None


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

    keywords.extend(_derive_target_filter_tags(row))

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
    sources: list[str] | None = None,
    teaching_methods: list[str] | None = None,
    cost_types: list[str] | None = None,
    participation_times: list[str] | None = None,
    targets: list[str] | None = None,
    selection_processes: list[str] | None = None,
    employment_links: list[str] | None = None,
) -> list[dict[str, Any]]:
    normalized_sources = set(_normalize_program_source_filters(sources, expand_aliases=True))
    normalized_teaching_methods = set(_normalize_option_param(teaching_methods, PROGRAM_TEACHING_METHODS))
    normalized_cost_types = set(_normalize_option_param(cost_types, PROGRAM_COST_TYPES))
    normalized_participation_times = set(_normalize_option_param(participation_times, PROGRAM_PARTICIPATION_TIMES))
    normalized_targets = set(_normalize_option_param(targets, PROGRAM_TARGETS))
    normalized_selection_processes = set(_normalize_option_param(selection_processes, PROGRAM_SELECTION_PROCESSES))
    normalized_employment_links = set(_normalize_option_param(employment_links, PROGRAM_EMPLOYMENT_LINKS))
    if (
        not normalized_sources
        and not normalized_teaching_methods
        and not normalized_cost_types
        and not normalized_participation_times
        and not normalized_targets
        and not normalized_selection_processes
        and not normalized_employment_links
    ):
        return rows

    filtered_rows: list[dict[str, Any]] = []
    for row in rows:
        if normalized_sources and not _program_matches_source_filters(row, sources):
            continue
        if normalized_teaching_methods and _derive_teaching_method(row) not in normalized_teaching_methods:
            continue
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
    return any(target in _derive_target_filter_tags(row) for target in targets)


def _program_matches_any(row: dict[str, Any], keywords: set[str]) -> bool:
    text = _program_text_blob(row)
    return any(keyword.casefold() in text.casefold() for keyword in keywords)


def _normalize_program_source_value(source: str | None) -> str | None:
    raw = str(source or "").strip()
    if not raw:
        return None

    lookup = _normalize_search_text(raw).replace("-", "").replace("_", "")
    if "고용24" in raw or "work24" in lookup:
        return "고용24"
    if "kstartup" in lookup or "창업진흥원" in raw:
        return "kstartup"
    if "sesac" in lookup or "새싹" in raw or "서울소프트웨어아카데미" in raw:
        return "sesac"
    if lookup in {"other", "etc", "기타", "기타기관"}:
        return PROGRAM_SOURCE_OTHER_VALUE
    return raw


def _source_filter_option_value(source: str | None) -> str | None:
    normalized = _normalize_program_source_value(source)
    if not normalized:
        return None
    if normalized in PROGRAM_SOURCE_CANONICAL_LABELS or normalized == "고용24":
        return normalized
    return PROGRAM_SOURCE_OTHER_VALUE


def _program_source_filter_param(normalized_sources: Sequence[str]) -> str | None:
    if not normalized_sources:
        return None

    source_set = set(normalized_sources)
    has_other = PROGRAM_SOURCE_OTHER_VALUE in source_set
    if has_other:
        return None

    if not has_other:
        quoted_sources = ",".join(f'"{source}"' for source in normalized_sources)
        return f"in.({quoted_sources})"


def _normalize_program_source_filters(
    sources: Sequence[str] | None,
    *,
    expand_aliases: bool = False,
) -> list[str]:
    normalized_filters: list[str] = []
    seen: set[str] = set()

    for source in sources or []:
        canonical = _normalize_program_source_value(source)
        if not canonical:
            continue
        candidates = PROGRAM_SOURCE_FILTER_ALIASES.get(canonical, (canonical,)) if expand_aliases else (canonical,)
        for candidate in candidates:
            if candidate in seen:
                continue
            seen.add(candidate)
            normalized_filters.append(candidate)

    return normalized_filters


def _has_other_program_source_filter(sources: Sequence[str] | None) -> bool:
    return PROGRAM_SOURCE_OTHER_VALUE in _normalize_program_source_filters(sources)


def _program_matches_source_filters(row: Mapping[str, Any], sources: Sequence[str] | None) -> bool:
    normalized_sources = set(_normalize_program_source_filters(sources, expand_aliases=True))
    if not normalized_sources:
        return True

    raw_source = str(row.get("source") or "").strip()
    canonical_source = _normalize_program_source_value(raw_source)
    if raw_source in normalized_sources or (canonical_source and canonical_source in normalized_sources):
        return True

    if PROGRAM_SOURCE_OTHER_VALUE not in normalized_sources:
        return False

    if canonical_source in {"고용24", "sesac"}:
        return False
    if canonical_source == "kstartup":
        provider = str(row.get("provider") or "").strip()
        provider_canonical = _normalize_program_source_value(provider)
        return bool(provider) and provider_canonical not in {"kstartup", "고용24", "sesac"}

    return bool(raw_source or str(row.get("provider") or "").strip())


def _program_source_label(source: str) -> str:
    normalized = _normalize_program_source_value(source)
    if not normalized:
        return ""
    return PROGRAM_SOURCE_CANONICAL_LABELS.get(normalized, normalized)


def _build_named_filter_options(values: list[str], *, source_labels: bool = False) -> list[ProgramFilterOption]:
    seen: set[str] = set()
    options: list[ProgramFilterOption] = []
    for value in values:
        normalized = _source_filter_option_value(value) if source_labels else str(value or "").strip()
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

        targets.extend(_derive_target_filter_tags(row))
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
        sources=_build_named_filter_options([bucket.value for bucket in facets.source if bucket.value], source_labels=True),
        targets=[
            ProgramFilterOption(value=value, label=value)
            for value in ("청년", "여성", "창업", "재직자", "대학생")
        ],
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
    sources: list[str] | None = None,
    teaching_methods: list[str] | None = None,
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
            sources=sources,
            teaching_methods=teaching_methods,
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
