from __future__ import annotations

from backend.rag.collector.kstartup_collector import KstartupApiCollector
from backend.rag.collector.normalizer import normalize
from backend.rag.collector.program_field_mapping import (
    derive_korean_region,
    map_kstartup_announcement_item,
    map_work24_training_item,
)
from backend.rag.collector.work24_collector import Work24Collector


def test_work24_collector_preserves_detail_fields_for_program_pages() -> None:
    collector = Work24Collector()
    mapped = collector.map_item(
        {
            "trprId": "AIG202500001",
            "title": "AI 데이터 분석 과정",
            "traStartDate": "20260422",
            "traEndDate": "20260629",
            "titleLink": "https://www.work24.go.kr/hr/detail",
            "trprDegr": "7",
            "trainstCstId": "500012345678",
            "trainTarget": "국민내일배움카드(일반)",
            "address": "서울 강남구",
            "trngAreaCd": "11680",
            "subTitle": "테스트 훈련기관",
            "contents": "훈련 과정 소개",
            "courseMan": "1,000,000",
            "realMan": "300000",
            "ncsCd": "20010201",
            "telNo": "02-1234-5678",
            "wkendSe": "3",
            "stdgScor": "95",
        },
        collector.get_source_meta(),
    )

    row = normalize(mapped)

    assert row is not None
    assert row["hrd_id"] == "AIG202500001"
    assert row["source_unique_key"] == "work24:AIG202500001:7:500012345678"
    assert row["location"] == "서울 강남구"
    assert row["region"] == "서울"
    assert row["region_detail"] == "강남구"
    assert row["provider"] == "테스트 훈련기관"
    assert row["description"] == "훈련 과정 소개"
    assert row["start_date"] == "2026-04-22"
    assert row["end_date"] == "2026-06-29"
    assert row["deadline"] == "2026-04-22"
    assert row["cost"] == 1000000
    assert row["subsidy_amount"] == 300000
    assert row["source_url"] == "https://www.work24.go.kr/hr/detail"
    assert row["raw_data"]["trprId"] == "AIG202500001"
    assert row["raw_data"]["title"] == "AI 데이터 분석 과정"
    assert row["skills"] == ["AI", "데이터", "IT", "소프트웨어", "정보기술"]
    assert row["compare_meta"]["ncs_code"] == "20010201"
    assert row["compare_meta"]["address"] == "서울 강남구"
    assert row["compare_meta"]["trng_area_code"] == "11680"
    assert row["compare_meta"]["trpr_degr"] == "7"
    assert row["compare_meta"]["trainst_cstmr_id"] == "500012345678"
    assert row["compare_meta"]["contact_phone"] == "02-1234-5678"
    assert row["compare_meta"]["application_deadline"] == "2026-04-22"
    assert row["compare_meta"]["deadline_source"] == "traStartDate"
    assert row["compare_meta"]["training_start_date"] == "2026-04-22"
    assert row["compare_meta"]["training_end_date"] == "2026-06-29"
    assert row["compare_meta"]["weekend_code"] == "3"


def test_work24_collector_passes_region_code_map_to_field_mapping() -> None:
    collector = Work24Collector(
        region_code_map={"11680": {"region": "서울", "region_detail": "강남구"}}
    )
    mapped = collector.map_item(
        {
            "trprId": "AIG202500002",
            "title": "AI 과정",
            "trngAreaCd": "11680",
        },
        collector.get_source_meta(),
    )

    assert mapped["region"] == "서울"
    assert mapped["region_detail"] == "강남구"


def test_work24_field_mapping_can_be_used_without_collector_state() -> None:
    mapped = map_work24_training_item(
        {
            "title": "AI 과정",
            "traEndDate": "20260501",
            "courseMan": "120,000",
            "realMan": "0",
            "subTitle": "훈련기관",
        }
    )

    assert mapped["title"] == "AI 과정"
    assert mapped.get("raw_deadline") is None
    assert mapped["description"] == "훈련기관"
    assert mapped["cost"] == 120000
    assert mapped["subsidy_amount"] == 0


def test_work24_field_mapping_derives_non_seoul_region() -> None:
    mapped = map_work24_training_item(
        {
            "title": "클라우드 과정",
            "address": "부산광역시 해운대구 센텀로",
            "trngAreaCd": "26350",
        }
    )

    assert mapped["region"] == "부산"
    assert mapped["region_detail"] == "해운대구"


def test_work24_field_mapping_uses_region_code_map_when_address_is_missing() -> None:
    mapped = map_work24_training_item(
        {
            "title": "클라우드 과정",
            "trngAreaCd": "26350",
        },
        region_code_map={"26350": {"region": "부산", "region_detail": "해운대구"}},
    )

    assert mapped["region"] == "부산"
    assert mapped["region_detail"] == "해운대구"


def test_derive_korean_region_falls_back_to_area_code() -> None:
    region, region_detail = derive_korean_region("", "41135")

    assert region == "경기"
    assert region_detail == "경기"


def test_derive_korean_region_uses_full_area_code_map() -> None:
    region, region_detail = derive_korean_region(
        "",
        "41135",
        region_code_map={"41135": {"region": "경기", "region_detail": "성남시"}},
    )

    assert region == "경기"
    assert region_detail == "성남시"


def test_derive_korean_region_keeps_city_and_district_detail() -> None:
    region, region_detail = derive_korean_region("경기 성남시 분당구", "41135")

    assert region == "경기"
    assert region_detail == "성남시 분당구"


def test_kstartup_collector_preserves_description_provider_and_trace_meta() -> None:
    collector = KstartupApiCollector()
    mapped = collector.map_item(
        {
            "biz_pbanc_nm": "코디세이 AI 네이티브 과정",
            "pbanc_rcpt_bgng_dt": "20260415",
            "pbanc_rcpt_end_dt": "20260514",
            "detl_pg_url": "https://www.k-startup.go.kr/detail",
            "aply_mthd_onli_rcpt_istc": "https://apply.example.com",
            "aply_trgt": "대학생,일반인",
            "aply_trgt_ctnt": "성인 또는 고졸 이상 누구나",
            "biz_trgt_age": "만 20세 이상",
            "pbanc_ctnt": "산업 현장형 AI 실무 인재 양성 과정입니다.",
            "pbanc_ntrp_nm": "(재)이노베이션아카데미",
            "biz_prch_dprt_nm": "코디세이",
            "prch_cnpl_no": "02-6177-2111",
            "sprv_inst": "공공기관",
            "supt_biz_clsfc": "멘토링ㆍ컨설팅ㆍ교육",
            "supt_regin": "서울",
            "rcrt_prgs_yn": "Y",
            "pbanc_sn": 177296,
        },
        collector.get_source_meta(),
    )

    row = normalize(mapped)

    assert row is not None
    assert row["title"] == "코디세이 AI 네이티브 과정"
    assert row["category"] == "창업"
    assert row["location"] == "서울"
    assert row["provider"] == "(재)이노베이션아카데미"
    assert row["description"] == "산업 현장형 AI 실무 인재 양성 과정입니다."
    assert row["start_date"] == "2026-04-15"
    assert row["deadline"] == "2026-05-14"
    assert row["end_date"] == "2026-05-14"
    assert row["source_url"] == "https://www.k-startup.go.kr/detail"
    assert row["source_unique_key"] == "kstartup:177296"
    assert row["raw_data"]["pbanc_sn"] == 177296
    assert row["raw_data"]["biz_pbanc_nm"] == "코디세이 AI 네이티브 과정"
    assert row["sponsor_name"] == "코디세이"
    assert row["skills"] == ["AI", "창업"]
    assert row["compare_meta"]["application_url"] == "https://apply.example.com"
    assert row["compare_meta"]["contact_phone"] == "02-6177-2111"
    assert row["compare_meta"]["business_type"] == "멘토링ㆍ컨설팅ㆍ교육"
    assert row["compare_meta"]["target_detail"] == "성인 또는 고졸 이상 누구나"


def test_kstartup_field_mapping_prefers_detail_url_and_keeps_apply_url_in_meta() -> None:
    mapped = map_kstartup_announcement_item(
        {
            "biz_pbanc_nm": "창업 지원",
            "detl_pg_url": "https://detail.example.com",
            "aply_mthd_onli_rcpt_istc": "https://apply.example.com",
        }
    )

    assert mapped["link"] == "https://detail.example.com"
    assert mapped["source_url"] == "https://detail.example.com"
    assert mapped["compare_meta"]["application_url"] == "https://apply.example.com"
