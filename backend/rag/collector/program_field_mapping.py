from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import parse_qs, urlparse
import re

SKILL_KEYWORDS = {
    "AI": ["AI", "인공지능", "머신러닝", "딥러닝", "LLM", "ChatGPT", "생성형 AI"],
    "데이터": ["데이터", "빅데이터", "분석", "SQL", "Python", "파이썬", "R", "Tableau", "Power BI"],
    "프론트엔드": ["프론트엔드", "React", "Next.js", "Vue", "JavaScript", "TypeScript"],
    "백엔드": ["백엔드", "Java", "Spring", "Node.js", "Django", "FastAPI", "서버", "API"],
    "클라우드": ["클라우드", "AWS", "Azure", "GCP", "DevOps", "Docker", "Kubernetes", "쿠버네티스"],
    "보안": ["보안", "정보보안", "침해대응", "모의해킹", "보안관제"],
    "모바일": ["모바일", "Android", "안드로이드", "iOS", "Swift", "Kotlin", "Flutter"],
    "게임": ["게임", "Unity", "유니티", "Unreal", "언리얼"],
    "디자인": ["디자인", "UX", "UI", "Figma", "콘텐츠", "영상"],
    "마케팅": ["마케팅", "브랜딩", "SNS", "광고", "SEO", "커머스"],
    "반도체": ["반도체", "임베디드", "IoT", "펌웨어", "회로"],
    "창업": ["창업", "스타트업", "사업계획", "IR", "투자", "멘토링"],
}

NCS_SKILL_PREFIXES = {
    "20": ["IT"],
    "2001": ["소프트웨어"],
    "200102": ["정보기술"],
}

REGION_CODE_PREFIXES = {
    "11": "서울",
    "26": "부산",
    "27": "대구",
    "28": "인천",
    "29": "광주",
    "30": "대전",
    "31": "울산",
    "36": "세종",
    "41": "경기",
    "43": "충북",
    "44": "충남",
    "45": "전북",
    "46": "전남",
    "47": "경북",
    "48": "경남",
    "50": "제주",
    "51": "강원",
}

REGION_ALIASES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("서울", ("서울특별시", "서울시", "서울")),
    ("부산", ("부산광역시", "부산시", "부산")),
    ("대구", ("대구광역시", "대구시", "대구")),
    ("인천", ("인천광역시", "인천시", "인천")),
    ("광주", ("광주광역시", "광주시", "광주")),
    ("대전", ("대전광역시", "대전시", "대전")),
    ("울산", ("울산광역시", "울산시", "울산")),
    ("세종", ("세종특별자치시", "세종시", "세종")),
    ("경기", ("경기도", "경기")),
    ("충북", ("충청북도", "충북")),
    ("충남", ("충청남도", "충남")),
    ("전북", ("전북특별자치도", "전라북도", "전북")),
    ("전남", ("전라남도", "전남")),
    ("경북", ("경상북도", "경북")),
    ("경남", ("경상남도", "경남")),
    ("제주", ("제주특별자치도", "제주도", "제주")),
    ("강원", ("강원특별자치도", "강원도", "강원")),
)


def clean_text(value: object) -> str:
    return str(value or "").strip()


def normalize_date_text(value: object) -> str:
    text = clean_text(value)
    if not text:
        return ""
    digits = re.sub(r"\D", "", text)
    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    return text


def parse_int(value: object) -> int | None:
    text = clean_text(value).replace(",", "")
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def compact_meta(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in meta.items()
        if value not in (None, "", [], {})
    }


def source_field_name(item: Mapping[str, Any], *keys: str) -> str | None:
    for key in keys:
        if clean_text(item.get(key)):
            return key
    return None


def extract_skill_keywords(*values: object) -> list[str]:
    text = " ".join(clean_text(value) for value in values if clean_text(value))
    if not text:
        return []

    skills: list[str] = []
    seen: set[str] = set()
    for skill, aliases in SKILL_KEYWORDS.items():
        if any(alias.casefold() in text.casefold() for alias in aliases):
            if skill not in seen:
                seen.add(skill)
                skills.append(skill)

    return skills


def extract_ncs_skill_keywords(value: object) -> list[str]:
    ncs_code = "".join(ch for ch in clean_text(value) if ch.isdigit())
    if not ncs_code:
        return []

    skills: list[str] = []
    seen: set[str] = set()
    for prefix, prefix_skills in NCS_SKILL_PREFIXES.items():
        if ncs_code.startswith(prefix):
            for skill in prefix_skills:
                if skill not in seen:
                    seen.add(skill)
                    skills.append(skill)
    return skills


def query_param(value: str, key: str) -> str:
    parsed = urlparse(value)
    values = parse_qs(parsed.query).get(key)
    return clean_text(values[0]) if values else ""


RegionCodeMap = Mapping[str, Mapping[str, object] | tuple[object, object] | list[object]]


def derive_korean_region(
    address: object = None,
    region_code: object = None,
    *,
    region_code_map: RegionCodeMap | None = None,
) -> tuple[str | None, str | None]:
    address_text = clean_text(address)
    compact_address = address_text.replace(" ", "")
    mapped_region, mapped_detail = _region_from_code_map(region_code, region_code_map)
    region = _region_from_address(compact_address) or mapped_region or _region_from_code(region_code)
    detail = _region_detail_from_address(address_text, region) if region else None
    if not detail and mapped_region == region:
        detail = mapped_detail
    return region, detail or region


def _region_from_address(compact_address: str) -> str | None:
    if not compact_address:
        return None
    for region, aliases in REGION_ALIASES:
        if any(compact_address.startswith(alias.replace(" ", "")) for alias in aliases):
            return region
    return None


def _region_from_code(value: object) -> str | None:
    digits = "".join(ch for ch in clean_text(value) if ch.isdigit())
    if not digits:
        return None
    return REGION_CODE_PREFIXES.get(digits[:2])


def _region_from_code_map(
    value: object,
    region_code_map: RegionCodeMap | None,
) -> tuple[str | None, str | None]:
    if not region_code_map:
        return None, None
    digits = "".join(ch for ch in clean_text(value) if ch.isdigit())
    if not digits:
        return None, None
    entry = region_code_map.get(digits)
    if not entry:
        return None, None
    if isinstance(entry, Mapping):
        region = clean_text(entry.get("region")) or None
        detail = clean_text(entry.get("region_detail")) or None
        return region, detail
    if isinstance(entry, (tuple, list)):
        region = clean_text(entry[0]) if len(entry) > 0 else ""
        detail = clean_text(entry[1]) if len(entry) > 1 else ""
        return region or None, detail or None
    return None, None


def _region_detail_from_address(address: str, region: str) -> str | None:
    aliases = {
        alias.replace(" ", "")
        for known_region, known_aliases in REGION_ALIASES
        if known_region == region
        for alias in (known_region, *known_aliases)
    }
    detail_tokens: list[str] = []
    for token in address.split():
        normalized = token.strip().replace(",", "").replace("(", "").replace(")", "")
        if not normalized or normalized.replace(" ", "") in aliases:
            continue
        if len(normalized) >= 2 and normalized.endswith(("시", "군", "구")):
            detail_tokens.append(normalized)
    return " ".join(detail_tokens) if detail_tokens else None


def work24_source_unique_key(item: dict[str, Any], source_url: str) -> str | None:
    hrd_id = clean_text(item.get("trprId")) or query_param(source_url, "tracseId")
    degree = clean_text(item.get("trprDegr")) or query_param(source_url, "tracseTme")
    training_institution_id = (
        clean_text(item.get("trainstCstId"))
        or clean_text(item.get("trainstCstmrId"))
        or query_param(source_url, "trainstCstmrId")
    )
    if hrd_id and degree and training_institution_id:
        return f"work24:{hrd_id}:{degree}:{training_institution_id}"
    if hrd_id:
        return f"work24:{hrd_id}"
    return None


def map_work24_training_item(
    item: dict[str, Any],
    *,
    region_code_map: RegionCodeMap | None = None,
) -> dict[str, Any]:
    source_url = clean_text(item.get("titleLink"))
    address = clean_text(item.get("address")) or clean_text(item.get("ADDRESS"))
    provider_name = clean_text(item.get("subTitle"))
    start_date = normalize_date_text(item.get("traStartDate"))
    end_date = normalize_date_text(item.get("traEndDate"))
    description = clean_text(item.get("contents"))
    ncs_code = clean_text(item.get("ncsCd"))
    training_area_code = clean_text(item.get("trngAreaCd")) or clean_text(item.get("TRNG_AREA_CD"))
    region, region_detail = derive_korean_region(
        address,
        training_area_code,
        region_code_map=region_code_map,
    )

    return {
        "title": clean_text(item.get("title")),
        "link": source_url,
        "raw_deadline": start_date or None,
        "target": [clean_text(item.get("trainTarget"))] if clean_text(item.get("trainTarget")) else None,
        "hrd_id": clean_text(item.get("trprId")) or None,
        "source_unique_key": work24_source_unique_key(item, source_url),
        "location": address or None,
        "region": region,
        "region_detail": region_detail,
        "provider": provider_name or None,
        "description": description or provider_name or None,
        "skills": [
            *extract_skill_keywords(item.get("title"), description, provider_name, item.get("trainTarget")),
            *extract_ncs_skill_keywords(ncs_code),
        ],
        "start_date": start_date or None,
        "end_date": end_date or None,
        "cost": parse_int(item.get("courseMan")),
        "subsidy_amount": parse_int(item.get("realMan")),
        "source_url": source_url or None,
        "compare_meta": compact_meta(
            {
                "hrd_id": clean_text(item.get("trprId")) or None,
                "trpr_degr": clean_text(item.get("trprDegr")) or None,
                "trainst_cstmr_id": (
                    clean_text(item.get("trainstCstId"))
                    or clean_text(item.get("trainstCstmrId"))
                    or query_param(source_url, "trainstCstmrId")
                    or None
                ),
                "ncs_code": ncs_code or None,
                "address": address or None,
                "trng_area_code": training_area_code or None,
                "certificate": clean_text(item.get("certificate")) or None,
                "contact_phone": clean_text(item.get("telNo")) or None,
                "weekend_code": clean_text(item.get("wkendSe")) or None,
                "application_deadline": start_date or None,
                "deadline_source": "traStartDate" if start_date else None,
                "training_start_date": start_date or None,
                "training_end_date": end_date or None,
                "satisfaction_score": clean_text(item.get("stdgScor")) or None,
                "employment_rate_3m": clean_text(item.get("eiEmplRate3")) or None,
                "employment_rate_6m": clean_text(item.get("eiEmplRate6")) or None,
                "registered_count": clean_text(item.get("regCourseMan")) or None,
                "capacity": clean_text(item.get("yardMan")) or None,
                "source_url": source_url or None,
                "field_sources": compact_meta(
                    {
                        "provider": source_field_name(item, "subTitle"),
                        "location": source_field_name(item, "address", "ADDRESS"),
                        "region": source_field_name(item, "address", "ADDRESS", "trngAreaCd", "TRNG_AREA_CD"),
                        "region_detail": source_field_name(item, "address", "ADDRESS", "trngAreaCd", "TRNG_AREA_CD"),
                        "description": source_field_name(item, "contents", "subTitle"),
                        "deadline": "traStartDate" if start_date else None,
                        "start_date": "traStartDate" if start_date else None,
                        "end_date": "traEndDate" if end_date else None,
                        "cost": source_field_name(item, "courseMan"),
                        "subsidy_amount": source_field_name(item, "realMan"),
                        "source_url": source_field_name(item, "titleLink"),
                        "source_unique_key": source_field_name(
                            item,
                            "trprId",
                            "trprDegr",
                            "trainstCstId",
                            "trainstCstmrId",
                        )
                        or ("titleLink" if work24_source_unique_key(item, source_url) else None),
                    }
                ),
            }
        ),
    }


def map_kstartup_announcement_item(item: dict[str, Any]) -> dict[str, Any]:
    detail_url = clean_text(item.get("detl_pg_url"))
    apply_url = (
        clean_text(item.get("biz_aply_url"))
        or clean_text(item.get("aply_mthd_onli_rcpt_istc"))
        or clean_text(item.get("aply_mthd_etc_istc"))
        or clean_text(item.get("biz_gdnc_url"))
    )
    target = clean_text(item.get("aply_trgt"))
    description = clean_text(item.get("pbanc_ctnt"))
    business_type = clean_text(item.get("supt_biz_clsfc"))

    return {
        "title": clean_text(item.get("biz_pbanc_nm")),
        "raw_deadline": clean_text(item.get("pbanc_rcpt_end_dt")),
        "link": detail_url or apply_url,
        "category_hint": "창업",
        "target": [target] if target else None,
        "location": clean_text(item.get("supt_regin")) or None,
        "provider": clean_text(item.get("pbanc_ntrp_nm")) or None,
        "description": description or None,
        "skills": extract_skill_keywords(
            item.get("biz_pbanc_nm"),
            description,
            business_type,
            target,
            item.get("aply_trgt_ctnt"),
        ),
        "start_date": clean_text(item.get("pbanc_rcpt_bgng_dt")) or None,
        "end_date": clean_text(item.get("pbanc_rcpt_end_dt")) or None,
        "source_url": detail_url or None,
        "source_unique_key": f"kstartup:{clean_text(item.get('pbanc_sn'))}" if clean_text(item.get("pbanc_sn")) else None,
        "sponsor_name": clean_text(item.get("biz_prch_dprt_nm")) or clean_text(item.get("sprv_inst")) or None,
        "compare_meta": compact_meta(
            {
                "announcement_id": clean_text(item.get("pbanc_sn")) or None,
                "application_url": apply_url or None,
                "application_method_online": clean_text(item.get("aply_mthd_onli_rcpt_istc")) or None,
                "application_method_etc": clean_text(item.get("aply_mthd_etc_istc")) or None,
                "contact_phone": clean_text(item.get("prch_cnpl_no")) or None,
                "department": clean_text(item.get("biz_prch_dprt_nm")) or None,
                "supervising_institution": clean_text(item.get("sprv_inst")) or None,
                "business_type": business_type or None,
                "target_age": clean_text(item.get("biz_trgt_age")) or None,
                "target_detail": clean_text(item.get("aply_trgt_ctnt")) or None,
                "excluded_target": clean_text(item.get("aply_excl_trgt_ctnt")) or None,
                "recruiting_status": clean_text(item.get("rcrt_prgs_yn")) or None,
                "source_url": detail_url or None,
                "field_sources": compact_meta(
                    {
                        "title": source_field_name(item, "biz_pbanc_nm"),
                        "deadline": source_field_name(item, "pbanc_rcpt_end_dt"),
                        "start_date": source_field_name(item, "pbanc_rcpt_bgng_dt"),
                        "end_date": source_field_name(item, "pbanc_rcpt_end_dt"),
                        "source_url": source_field_name(item, "detl_pg_url"),
                        "application_url": source_field_name(
                            item,
                            "biz_aply_url",
                            "aply_mthd_onli_rcpt_istc",
                            "aply_mthd_etc_istc",
                            "biz_gdnc_url",
                        ),
                        "target": source_field_name(item, "aply_trgt"),
                        "location": source_field_name(item, "supt_regin"),
                        "provider": source_field_name(item, "pbanc_ntrp_nm"),
                        "description": source_field_name(item, "pbanc_ctnt"),
                        "source_unique_key": source_field_name(item, "pbanc_sn"),
                        "sponsor_name": source_field_name(item, "biz_prch_dprt_nm", "sprv_inst"),
                    }
                ),
            }
        ),
    }
