from __future__ import annotations

from scripts.program_source_diff import (
    build_ui_snapshot,
    compare_snapshots,
    is_same_program,
)


def test_build_ui_snapshot_distinguishes_missing_display_values() -> None:
    snapshot = build_ui_snapshot(
        {
            "title": "테스트 프로그램",
            "source": "K-Startup 창업진흥원",
            "deadline": "2026-05-01",
        }
    )

    assert snapshot["title"] == "테스트 프로그램"
    assert snapshot["provider"] == "기관 정보 없음"
    assert snapshot["location"] == "지역 정보 없음"
    assert snapshot["description"] == "프로그램 소개가 아직 등록되지 않았습니다."
    assert snapshot["period"] == "데이터 미수집"
    assert snapshot["link_state"] == "링크 없음"


def test_compare_snapshots_reports_missing_db_mapping() -> None:
    diff = compare_snapshots(
        normalized={"provider": "기관", "location": "서울", "title": "프로그램"},
        db_row={"provider": None, "location": None, "title": "프로그램"},
        api_row={"provider": None, "location": None, "title": "프로그램"},
    )

    assert diff["provider"]["normalized"] == "기관"
    assert diff["provider"]["db"] is None
    assert diff["location"]["normalized"] == "서울"


def test_is_same_program_matches_by_compare_meta_hrd_id() -> None:
    assert is_same_program(
        {"title": "과거 제목", "compare_meta": {"hrd_id": "AIG-1"}},
        {"title": "현재 제목", "hrd_id": "AIG-1"},
    )
