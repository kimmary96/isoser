from __future__ import annotations

import json
from pathlib import Path

from backend.rag.source_adapters.work24_job_duty import Work24JobDutyAdapter


def test_parse_job_description_with_explicit_fields(tmp_path: Path) -> None:
    adapter = Work24JobDutyAdapter(
        list_endpoint="https://example.com/list",
        detail_endpoint="https://example.com/detail",
        output_path=tmp_path / "job_profile_corpus.jsonl",
        sample_dir=tmp_path / "samples",
    )

    raw = {
        "result": {
            "jobCode": "D001",
            "jobName": "Data Analyst",
            "description": "Collects and analyzes data for decision making.",
            "keyTasks": ["Collect data", "Define metrics"],
            "requiredSkills": "SQL, Python, Statistics",
        }
    }

    parsed = adapter.parse_job_description(raw)

    assert parsed == {
        "job_code": "D001",
        "job_name": "Data Analyst",
        "description": "Collects and analyzes data for decision making.",
        "key_tasks": ["Collect data", "Define metrics"],
        "required_skills": ["SQL", "Python", "Statistics"],
        "source": "work24_job_duty",
    }


def test_parse_job_description_with_work24_like_payload(tmp_path: Path) -> None:
    adapter = Work24JobDutyAdapter(
        list_endpoint="https://example.com/list",
        detail_endpoint="https://example.com/detail",
        output_path=tmp_path / "job_profile_corpus.jsonl",
        sample_dir=tmp_path / "samples",
    )

    raw = {
        "result": [
            {
                "ablt_unit": "NCS-001",
                "job_scfn": "Data Analyst",
                "job_sdvn": "Collect data",
                "ablt_def": "Collects the data required for the task.",
                "knwg_tchn_attd": "SQL, Python",
            },
            {
                "ablt_unit": "NCS-001",
                "job_scfn": "Data Analyst",
                "job_sdvn": "Define metrics",
                "ablt_def": "Defines metrics aligned to analysis goals.",
                "knwg_tchn_attd": "Statistics, Problem solving",
            },
        ]
    }

    parsed = adapter.parse_job_description(raw)

    assert parsed["job_code"] == "NCS-001"
    assert parsed["job_name"] == "Data Analyst"
    assert parsed["description"] == (
        "Collects the data required for the task.\nDefines metrics aligned to analysis goals."
    )
    assert parsed["key_tasks"] == ["Collect data", "Define metrics"]
    assert parsed["required_skills"] == ["SQL", "Python", "Statistics", "Problem solving"]


def test_fetch_job_list_paginates_and_sleeps(monkeypatch, tmp_path: Path) -> None:
    adapter = Work24JobDutyAdapter(
        list_endpoint="https://example.com/list",
        detail_endpoint="https://example.com/detail",
        list_word="data",
        output_path=tmp_path / "job_profile_corpus.jsonl",
        sample_dir=tmp_path / "samples",
        page_size=100,
        sleep_seconds=0.5,
    )

    responses = {
        1: {"result": [{"jobCode": f"J{i:03d}", "jobName": f"Job {i:03d}"} for i in range(100)]},
        2: {"result": [{"jobCode": "J100", "jobName": "Job 100"}]},
    }
    sleep_calls: list[float] = []

    def fake_request(endpoint_url: str, *, params: dict[str, int | str] | None = None, sample_name: str):
        page_no = int((params or {}).get("startPage", 1))
        assert endpoint_url == "https://example.com/list"
        assert sample_name == f"job_list_page_{page_no}"
        assert params == {
            "word": "data",
            "startPage": page_no,
            "display": 100,
            "returnType": "JSON",
        }
        return responses[page_no]

    monkeypatch.setattr(adapter, "_request_payload", fake_request)
    monkeypatch.setattr("backend.rag.source_adapters.work24_job_duty.time.sleep", sleep_calls.append)

    items = adapter.fetch_job_list()

    assert len(items) == 101
    assert sleep_calls == [0.5]


def test_fetch_job_detail_uses_code_param(monkeypatch, tmp_path: Path) -> None:
    adapter = Work24JobDutyAdapter(
        list_endpoint="https://example.com/list",
        detail_endpoint="https://example.com/detail",
        output_path=tmp_path / "job_profile_corpus.jsonl",
        sample_dir=tmp_path / "samples",
    )

    def fake_request(endpoint_url: str, *, params: dict[str, int | str] | None = None, sample_name: str):
        assert endpoint_url == "https://example.com/detail"
        assert sample_name == "job_detail_NCS-001"
        assert params == {"code": "NCS-001", "returnType": "JSON"}
        return {"result": {"ablt_unit": "NCS-001", "ablt_def": "Detail text"}}

    monkeypatch.setattr(adapter, "_request_payload", fake_request)

    detail = adapter.fetch_job_detail("NCS-001")

    assert detail == {"result": {"ablt_unit": "NCS-001", "ablt_def": "Detail text"}}


def test_build_corpus_and_save_to_jsonl(tmp_path: Path) -> None:
    output_path = tmp_path / "job_profile_corpus.jsonl"
    adapter = Work24JobDutyAdapter(
        list_endpoint="https://example.com/list",
        detail_endpoint="https://example.com/detail",
        output_path=output_path,
        sample_dir=tmp_path / "samples",
    )

    adapter.fetch_job_list = lambda word=None: [
        {"ablt_unit": "NCS-001", "job_scfn": "Data Analyst"},
        {"ablt_unit": "NCS-002", "job_scfn": "Backend Engineer"},
    ]
    adapter.fetch_job_detail = lambda job_code: {
        "result": {
            "ablt_unit": job_code,
            "job_scfn": "Data Analyst" if job_code == "NCS-001" else "Backend Engineer",
            "ablt_def": "Role summary",
            "job_sdvn": "Core task",
            "knwg_tchn_attd": "Core skill",
        }
    }

    corpus = adapter.build_corpus()
    saved_path = adapter.save_to_jsonl(corpus)

    assert saved_path == output_path
    assert len(corpus) == 2

    lines = output_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2

    first_row = json.loads(lines[0])
    assert first_row["job_code"] == "NCS-001"
    assert first_row["key_tasks"] == ["Core task"]
