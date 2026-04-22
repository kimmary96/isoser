from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlparse


def clean_text(value: object) -> str:
    return str(value or "").strip()


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


def query_param(value: str, key: str) -> str:
    parsed = urlparse(value)
    values = parse_qs(parsed.query).get(key)
    return clean_text(values[0]) if values else ""


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


def map_work24_training_item(item: dict[str, Any]) -> dict[str, Any]:
    source_url = clean_text(item.get("titleLink"))
    provider_name = clean_text(item.get("subTitle"))
    start_date = clean_text(item.get("traStartDate"))
    end_date = clean_text(item.get("traEndDate"))
    description = clean_text(item.get("contents"))

    return {
        "title": clean_text(item.get("title")),
        "raw_deadline": end_date,
        "link": source_url,
        "target": [clean_text(item.get("trainTarget"))] if clean_text(item.get("trainTarget")) else None,
        "hrd_id": clean_text(item.get("trprId")) or None,
        "source_unique_key": work24_source_unique_key(item, source_url),
        "location": clean_text(item.get("address")) or None,
        "provider": provider_name or None,
        "description": description or provider_name or None,
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
                "ncs_code": clean_text(item.get("ncsCd")) or None,
                "certificate": clean_text(item.get("certificate")) or None,
                "contact_phone": clean_text(item.get("telNo")) or None,
                "weekend_code": clean_text(item.get("wkendSe")) or None,
                "satisfaction_score": clean_text(item.get("stdgScor")) or None,
                "employment_rate_3m": clean_text(item.get("eiEmplRate3")) or None,
                "employment_rate_6m": clean_text(item.get("eiEmplRate6")) or None,
                "registered_count": clean_text(item.get("regCourseMan")) or None,
                "capacity": clean_text(item.get("yardMan")) or None,
                "source_url": source_url or None,
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

    return {
        "title": clean_text(item.get("biz_pbanc_nm")),
        "raw_deadline": clean_text(item.get("pbanc_rcpt_end_dt")),
        "link": detail_url or apply_url,
        "category_hint": "창업",
        "target": [target] if target else None,
        "location": clean_text(item.get("supt_regin")) or None,
        "provider": clean_text(item.get("pbanc_ntrp_nm")) or None,
        "description": clean_text(item.get("pbanc_ctnt")) or None,
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
                "business_type": clean_text(item.get("supt_biz_clsfc")) or None,
                "target_age": clean_text(item.get("biz_trgt_age")) or None,
                "target_detail": clean_text(item.get("aply_trgt_ctnt")) or None,
                "excluded_target": clean_text(item.get("aply_excl_trgt_ctnt")) or None,
                "recruiting_status": clean_text(item.get("rcrt_prgs_yn")) or None,
                "source_url": detail_url or None,
            }
        ),
    }
