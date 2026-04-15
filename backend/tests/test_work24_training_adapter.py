from __future__ import annotations

from pathlib import Path

from backend.rag.source_adapters.work24_training import Work24TrainingAdapter


def test_normalize_program_adds_category_label_and_provider_name(tmp_path: Path) -> None:
    adapter = Work24TrainingAdapter(
        list_endpoint="https://example.com/list",
        sample_dir=tmp_path / "samples",
    )

    row = {
        "trprId": "TR-001",
        "title": "AI 데이터 분석 부트캠프",
        "ncsCd": "19010701",
        "address": "서울 강남구",
        "traStartDate": "2026-04-15",
        "traEndDate": "2026-07-15",
        "courseMan": "1000000",
        "realMan": "0",
        "trainTarget": "국민내일배움카드(일반)",
        "trainstCstId": "500020011165",
        "subTitle": "테스트 훈련기관",
        "titleLink": "https://example.com/program",
    }

    normalized = adapter._normalize_program(row)

    assert normalized["hrd_id"] == "TR-001"
    assert normalized["category"] == "19010701"
    assert normalized["category_label"] == "AI"
    assert normalized["provider"] == "500020011165"
    assert normalized["provider_name"] == "테스트 훈련기관"
    assert normalized["summary"] == "테스트 훈련기관"


def test_fetch_all_respects_max_pages(monkeypatch, tmp_path: Path) -> None:
    adapter = Work24TrainingAdapter(
        list_endpoint="https://example.com/list",
        sample_dir=tmp_path / "samples",
        page_size=2,
        sleep_seconds=0,
    )

    page_calls: list[int] = []

    def fake_request_payload(*, page_num: int, page_size: int, start_dt, end_dt, area_code, ncs_code, sample_name=None):
        page_calls.append(page_num)
        if page_num == 1:
            return {
                "scn_cnt": "6",
                "srchList": [
                    {"trprId": "TR-001", "title": "AI 과정", "address": "서울", "traStartDate": "2026-04-15", "traEndDate": "2026-05-15"},
                    {"trprId": "TR-002", "title": "IT 과정", "address": "경기", "traStartDate": "2026-04-15", "traEndDate": "2026-05-15"},
                ],
            }
        return {
            "srchList": [
                {"trprId": f"TR-00{page_num * 2 - 1}", "title": f"과정-{page_num}-a", "address": "서울", "traStartDate": "2026-04-15", "traEndDate": "2026-05-15"},
                {"trprId": f"TR-00{page_num * 2}", "title": f"과정-{page_num}-b", "address": "서울", "traStartDate": "2026-04-15", "traEndDate": "2026-05-15"},
            ]
        }

    monkeypatch.setattr(adapter, "_request_payload", fake_request_payload)

    rows = adapter.fetch_all(max_pages=2)

    assert rows is not None
    assert len(rows) == 4
    assert page_calls == [1, 2]
