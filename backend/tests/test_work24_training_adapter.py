from __future__ import annotations

from pathlib import Path

from backend.rag.source_adapters.work24_training import Work24TrainingAdapter, build_training_list_params


def test_build_training_list_params_uses_documented_required_params() -> None:
    params = build_training_list_params(
        auth_key="test-key",
        page_num=1,
        page_size=100,
        start_dt="20260423",
        end_dt="20261023",
    )

    assert params == {
        "returnType": "JSON",
        "outType": "1",
        "pageNum": "1",
        "pageSize": "100",
        "srchTraStDt": "20260423",
        "srchTraEndDt": "20261023",
        "sort": "ASC",
        "sortCol": "2",
        "authKey": "test-key",
    }


def test_build_training_list_params_supports_documented_optional_params() -> None:
    params = build_training_list_params(
        auth_key="test-key",
        page_num=3,
        page_size=50,
        start_dt="20260423",
        end_dt="20261023",
        area_code="11",
        area2_code="11680",
        ncs1_code="20",
        ncs2_code="2001",
        ncs3_code="200102",
        ncs4_code="20010201",
        weekend_code="3",
        course_type="C0104",
        training_category="M1005",
        training_type="M1005-1",
        process_name="AI",
        organization_name="테스트기관",
        sort="DESC",
        sort_col="5",
    )

    assert params["srchTraArea1"] == "11"
    assert params["srchTraArea2"] == "11680"
    assert params["srchNcs1"] == "20"
    assert params["srchNcs2"] == "2001"
    assert params["srchNcs3"] == "200102"
    assert params["srchNcs4"] == "20010201"
    assert params["wkendSe"] == "3"
    assert params["crseTracseSe"] == "C0104"
    assert params["srchTraGbn"] == "M1005"
    assert params["srchTraType"] == "M1005-1"
    assert params["srchTraProcessNm"] == "AI"
    assert params["srchTraOrganNm"] == "테스트기관"
    assert params["sort"] == "DESC"
    assert params["sortCol"] == "5"


def test_build_training_list_params_maps_legacy_ncs_code_to_documented_param() -> None:
    params = build_training_list_params(
        page_num=1,
        page_size=100,
        start_dt="20260423",
        end_dt="20261023",
        ncs_code="20010201",
    )

    assert params["srchNcs4"] == "20010201"
    assert "srchNcsCd" not in params


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

    def fake_request_payload(
        *,
        page_num: int,
        page_size: int,
        start_dt,
        end_dt,
        area_code,
        ncs_code,
        **_,
    ):
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


def test_request_payload_sends_documented_params(monkeypatch, tmp_path: Path) -> None:
    captured: dict = {}

    class FakeResponse:
        headers = {"content-type": "application/json"}

        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {"srchList": []}

    class FakeClient:
        def get(self, url, *, params):
            captured["url"] = url
            captured["params"] = dict(params)
            return FakeResponse()

    monkeypatch.setenv("WORK24_TRAINING_AUTH_KEY", "test-key")
    adapter = Work24TrainingAdapter(
        list_endpoint="https://example.com/list",
        sample_dir=tmp_path / "samples",
        client=FakeClient(),
        retry_count=1,
    )

    payload = adapter._request_payload(
        page_num=2,
        page_size=100,
        start_dt="20260423",
        end_dt="20261023",
        area_code="11",
        area2_code="11680",
        ncs_code=None,
        ncs1_code="20",
        ncs2_code=None,
        ncs3_code=None,
        ncs4_code=None,
        weekend_code="3",
        course_type="C0061",
        training_category="M1001",
        training_type=None,
        process_name="AI",
        organization_name="테스트기관",
        sort="ASC",
        sort_col="2",
    )

    assert payload == {"srchList": []}
    assert captured["params"]["authKey"] == "test-key"
    assert captured["params"]["srchTraStDt"] == "20260423"
    assert captured["params"]["srchTraEndDt"] == "20261023"
    assert captured["params"]["sort"] == "ASC"
    assert captured["params"]["sortCol"] == "2"
    assert captured["params"]["srchTraArea1"] == "11"
    assert captured["params"]["srchTraArea2"] == "11680"
    assert captured["params"]["srchNcs1"] == "20"
    assert captured["params"]["wkendSe"] == "3"
    assert captured["params"]["crseTracseSe"] == "C0061"
    assert captured["params"]["srchTraGbn"] == "M1001"
    assert captured["params"]["srchTraProcessNm"] == "AI"
    assert captured["params"]["srchTraOrganNm"] == "테스트기관"
