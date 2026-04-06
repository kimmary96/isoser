from __future__ import annotations

import json
from pathlib import Path

from backend.rag.source_adapters.work24_supplementary import Work24SupplementaryAdapter


def test_fetch_job_info_uses_official_params(monkeypatch, tmp_path: Path) -> None:
    adapter = Work24SupplementaryAdapter(
        job_info_list_endpoint="https://example.com/job-list",
        job_info_detail_endpoint="https://example.com/job-detail",
        output_path=tmp_path / "work24_supplement.json",
        sample_dir=tmp_path / "samples",
        detail_sleep_seconds=0,
    )

    def fake_request(endpoint_url: str, *, source, params, sample_name: str):
        if endpoint_url == "https://example.com/job-list":
            assert params == {"returnType": "XML", "target": "JOBCD"}
            assert sample_name == "job_info_list"
            return {"result": {"jobList": {"jobCd": "J001", "jobNm": "Data Analyst", "jobClcd": "02", "jobClcdNM": "분석"}}}
        assert endpoint_url == "https://example.com/job-detail"
        assert params == {
            "returnType": "XML",
            "target": "JOBDTL",
            "jobGb": "1",
            "jobCd": "J001",
            "dtlGb": "1",
        }
        assert sample_name == "job_info_detail_J001"
        return {
            "result": {
                "jobSum": {
                    "jobCd": "J001",
                    "jobSum": "Analyze business and product data.",
                    "way": "Statistics or CS background",
                    "jobLrclNm": "IT",
                    "jobMdclNm": "Data",
                    "jobSmclNm": "Analytics",
                    "relMajorList": {"majorCd": "M001", "majorNm": "통계학"},
                }
            }
        }

    monkeypatch.setattr(adapter, "_request_payload", fake_request)

    rows = adapter.fetch_job_info()

    assert rows == [
        {
            "job_code": "J001",
            "job_name": "Data Analyst",
            "job_class_code": "02",
            "job_class_name": "분석",
            "large_class_name": "IT",
            "middle_class_name": "Data",
            "small_class_name": "Analytics",
            "description": "Analyze business and product data.",
            "career_path": "Statistics or CS background",
            "related_major_refs": [{"major_id": "M001", "major_name": "통계학"}],
            "source_ref": "work24_job_info:J001",
        }
    ]


def test_fetch_common_codes_flattens_nested_entries(monkeypatch, tmp_path: Path) -> None:
    adapter = Work24SupplementaryAdapter(
        common_codes_endpoint="https://example.com/common",
        output_path=tmp_path / "work24_supplement.json",
        sample_dir=tmp_path / "samples",
    )

    def fake_request(endpoint_url: str, *, source, params, sample_name: str):
        assert endpoint_url == "https://example.com/common"
        assert params["returnType"] == "XML"
        assert params["target"] == "CMCD"
        if params["dtlGb"] == "2":
            return {
                "result": {
                    "oneDepth": {
                        "code": "02",
                        "name": "분석",
                        "twoDepth": {"code": "0201", "name": "데이터분석", "superCd": "02"},
                    }
                }
            }
        return {"result": {"oneDepth": {"code": params["dtlGb"], "name": f"code-{params['dtlGb']}"}}}

    monkeypatch.setattr(adapter, "_request_payload", fake_request)

    payload = adapter.fetch_common_codes()

    assert {"dtl_gb": "2", "label": "job_classification", "code": "02", "name": "분석", "super_code": "", "depth": "1"} in payload["records"]
    assert {"dtl_gb": "2", "label": "job_classification", "code": "0201", "name": "데이터분석", "super_code": "02", "depth": "2"} in payload["records"]
    assert payload["by_dtl_gb"]["8"][0]["label"] == "major_series"


def test_fetch_major_info_uses_general_and_special_detail(monkeypatch, tmp_path: Path) -> None:
    adapter = Work24SupplementaryAdapter(
        major_info_list_endpoint="https://example.com/major-list",
        major_info_general_detail_endpoint="https://example.com/major-general",
        major_info_special_detail_endpoint="https://example.com/major-special",
        output_path=tmp_path / "work24_supplement.json",
        sample_dir=tmp_path / "samples",
        detail_sleep_seconds=0,
    )

    def fake_request(endpoint_url: str, *, source, params, sample_name: str):
        if endpoint_url == "https://example.com/major-list":
            assert params == {"returnType": "XML", "target": "MAJORCD", "srchType": "A", "keyword": ""}
            return {
                "result": {
                    "majorList": [
                        {"majorGb": "1", "empCurtState1Id": "S01", "empCurtState2Id": "M01", "knowSchDptNm": "공학", "knowDtlSchDptNm": "컴퓨터공학"},
                        {"majorGb": "2", "empCurtState1Id": "S02", "empCurtState2Id": "M02", "knowSchDptNm": "예술", "knowDtlSchDptNm": "게임아트"},
                    ]
                }
            }
        if endpoint_url == "https://example.com/major-general":
            assert params["majorGb"] == "1"
            assert params["empCurtState1Id"] == "S01"
            assert params["empCurtState2Id"] == "M01"
            return {
                "result": {
                    "majorSum": {
                        "knowDptNm": "컴퓨터공학",
                        "schDptIntroSum": "Software and systems.",
                        "aptdIntrstCont": "Problem solving",
                        "relAdvanJobsList": {"knowJobNm": "Data Analyst"},
                    }
                }
            }
        assert endpoint_url == "https://example.com/major-special"
        assert params["majorGb"] == "2"
        return {
            "result": {
                "specMajor": {
                    "knowDptNm": "게임아트",
                    "schDptIntroSum": "Art for games.",
                    "whatStudy": "3D modeling",
                    "howPrepare": "Portfolio",
                    "jobPropect": "Positive",
                }
            }
        }

    monkeypatch.setattr(adapter, "_request_payload", fake_request)

    rows = adapter.fetch_major_info()

    assert rows[0]["major_id"] == "M01"
    assert rows[0]["related_job_names"] == ["Data Analyst"]
    assert rows[1]["major_gb"] == "2"
    assert rows[1]["what_study"] == "3D modeling"
    assert rows[1]["how_prepare"] == "Portfolio"


def test_build_supplement_joins_by_job_code_and_saves(tmp_path: Path) -> None:
    output_path = tmp_path / "work24_supplement.json"
    adapter = Work24SupplementaryAdapter(
        output_path=output_path,
        sample_dir=tmp_path / "samples",
    )

    adapter.fetch_job_info = lambda: [
        {
            "job_code": "J001",
            "job_name": "Data Analyst",
            "job_class_code": "02",
            "job_class_name": "분석",
            "large_class_name": "IT",
            "middle_class_name": "Data",
            "small_class_name": "Analytics",
            "description": "Analyze business and product data.",
            "career_path": "Statistics or CS background",
            "related_major_refs": [{"major_id": "M01", "major_name": "컴퓨터공학"}],
            "source_ref": "work24_job_info:J001",
        }
    ]
    adapter.fetch_common_codes = lambda: {
        "records": [
            {"dtl_gb": "2", "label": "job_classification", "code": "02", "name": "분석", "super_code": "", "depth": "1"},
            {"dtl_gb": "8", "label": "major_series", "code": "S01", "name": "공학", "super_code": "", "depth": "1"},
        ],
        "by_dtl_gb": {
            "2": [{"dtl_gb": "2", "label": "job_classification", "code": "02", "name": "분석", "super_code": "", "depth": "1"}],
            "8": [{"dtl_gb": "8", "label": "major_series", "code": "S01", "name": "공학", "super_code": "", "depth": "1"}],
        },
    }
    adapter.fetch_major_info = lambda: [
        {
            "major_gb": "1",
            "series_id": "S01",
            "major_id": "M01",
            "series_name": "공학",
            "major_name": "컴퓨터공학",
            "intro_summary": "Software and systems.",
            "aptitude_interest": "Problem solving",
            "what_study": "",
            "how_prepare": "",
            "job_prospect": "",
            "related_job_names": ["Data Analyst"],
            "source_ref": "work24_major_info:1:S01:M01",
        }
    ]

    payload = adapter.build_supplement()
    saved_path = adapter.save_to_json(payload)

    assert saved_path == output_path
    assert payload["supplement_count"] == 1
    assert payload["items"][0]["job_code"] == "J001"
    assert payload["items"][0]["related_majors"][0]["series_code_name"] == "공학"

    saved = json.loads(output_path.read_text(encoding="utf-8"))
    assert saved["items"][0]["job_classification"]["common_code_name"] == "분석"
