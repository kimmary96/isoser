from __future__ import annotations

from backend.rag.recommendation_rules_seed import (
    build_condition_keys,
    build_reason_template,
    generate_rule_seeds,
    normalize_category,
    normalize_region,
    normalize_support,
)


def test_normalize_category_maps_legacy_values() -> None:
    assert normalize_category("IT·컴퓨터") == "IT"
    assert normalize_category("AI") == "AI"
    assert normalize_category("미분류") == "기타"


def test_normalize_region_prefers_online_keywords() -> None:
    assert normalize_region("온라인", None) == "온라인"
    assert normalize_region("서울 강남", None) == "서울"
    assert normalize_region("경기 성남", None) == "경기"


def test_normalize_support_detects_subsidized_programs() -> None:
    assert normalize_support({"support_type": "무료", "title": "데이터 분석 부트캠프"}) == "국비"
    assert normalize_support({"support_type": "", "title": "내일배움카드 파이썬 과정"}) == "국비"
    assert normalize_support({"support_type": "", "title": "일반 강의"}) is None


def test_build_condition_keys_creates_rule_variants() -> None:
    keys = build_condition_keys(
        {
            "category": "IT·컴퓨터",
            "location": "서울 강남",
            "support_type": "무료",
            "teaching_method": "온라인",
        }
    )

    assert "IT+서울+국비" in keys
    assert "IT+서울" in keys
    assert "IT+온라인" in keys
    assert "IT+국비" in keys


def test_generate_rule_seeds_groups_programs_by_condition_key() -> None:
    programs = [
        {
            "id": "p1",
            "title": "서울 파이썬 부트캠프",
            "category": "IT",
            "location": "서울",
            "support_type": "무료",
            "teaching_method": "오프라인",
            "deadline": "2026-05-01",
        },
        {
            "id": "p2",
            "title": "서울 데이터 과정",
            "category": "IT",
            "location": "서울",
            "support_type": "일부 지원",
            "teaching_method": "오프라인",
            "deadline": "2026-04-20",
        },
        {
            "id": "p3",
            "title": "온라인 데이터 분석",
            "category": "IT",
            "location": "온라인",
            "support_type": "",
            "teaching_method": "온라인",
            "deadline": "2026-04-18",
        },
    ]

    rules = generate_rule_seeds(programs, max_rules=10, max_programs_per_rule=2)
    condition_map = {rule.condition_key: rule for rule in rules}

    assert "IT+서울+국비" in condition_map
    assert condition_map["IT+서울+국비"].program_ids == ["p2", "p1"]
    assert "IT+온라인" in condition_map
    assert condition_map["IT+온라인"].program_ids == ["p3"]
    assert build_reason_template(["IT", "서울", "국비"]).startswith("서울 지역")
