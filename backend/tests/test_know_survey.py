from __future__ import annotations

import csv
from pathlib import Path

import pytest

from backend.rag.source_adapters.know_survey import (
    RawSurveyUnavailableError,
    build_question_labels_payload,
    build_skill_weights_payload,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = REPO_ROOT / "docs"
CODEBOOK_PATH = next(DOCS_DIR.glob("*코드북.xlsx"), None)
PLACEHOLDER_RAW_PATH = next(DOCS_DIR.glob("*원자료.csv"), None)


if CODEBOOK_PATH is None:
    pytest.skip("KNOW 코드북 원본이 저장소에 없어 관련 테스트를 건너뜁니다.", allow_module_level=True)


def test_build_question_labels_payload_reads_codebook() -> None:
    payload = build_question_labels_payload(CODEBOOK_PATH)

    assert payload["metadata"]["personality_question_count"] == 16
    assert payload["metadata"]["knowledge_question_count"] == 33
    assert payload["personality"]["sq1"]["label"] == "성취/노력"
    assert payload["knowledge"]["kq9"]["label"] == "컴퓨터와 전자공학"
    assert payload["knowledge"]["kq9"]["importance_code"] == "kq9_1"
    assert payload["knowledge"]["kq9"]["level_code"] == "kq9_2"


def test_build_skill_weights_payload_raises_for_placeholder_raw_csv() -> None:
    if PLACEHOLDER_RAW_PATH is None:
        pytest.skip("KNOW 원자료 placeholder CSV가 저장소에 없어 관련 테스트를 건너뜁니다.")

    with pytest.raises(RawSurveyUnavailableError):
        build_skill_weights_payload(PLACEHOLDER_RAW_PATH, CODEBOOK_PATH)


def test_build_skill_weights_payload_aggregates_sample_rows(tmp_path: Path) -> None:
    sample_raw_path = tmp_path / "know_raw_sample.csv"
    fieldnames = [
        "knowcode",
        "job",
        "sq1",
        "sq2",
        "kq9_1",
        "kq9_2",
        "kq10_1",
        "kq10_2",
        "kq11_1",
        "kq11_2",
    ]
    rows = [
        {
            "knowcode": "11111",
            "job": "웹개발자",
            "sq1": "5",
            "sq2": "4",
            "kq9_1": "5",
            "kq9_2": "4",
            "kq10_1": "3",
            "kq10_2": "3",
            "kq11_1": "1",
            "kq11_2": "1",
        },
        {
            "knowcode": "11111",
            "job": "웹개발자",
            "sq1": "5",
            "sq2": "4",
            "kq9_1": "4",
            "kq9_2": "5",
            "kq10_1": "2",
            "kq10_2": "3",
            "kq11_1": "1",
            "kq11_2": "1",
        },
        {
            "knowcode": "22222",
            "job": "UX·UI디자이너",
            "sq1": "2",
            "sq2": "5",
            "kq9_1": "1",
            "kq9_2": "1",
            "kq10_1": "1",
            "kq10_2": "1",
            "kq11_1": "5",
            "kq11_2": "4",
        },
        {
            "knowcode": "22222",
            "job": "UX·UI디자이너",
            "sq1": "2",
            "sq2": "5",
            "kq9_1": "1",
            "kq9_2": "1",
            "kq10_1": "1",
            "kq10_2": "1",
            "kq11_1": "4",
            "kq11_2": "4",
        },
    ]

    with sample_raw_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    payload = build_skill_weights_payload(sample_raw_path, CODEBOOK_PATH, top_k=2)
    jobs_by_code = {job["know_code"]: job for job in payload["jobs"]}

    assert payload["metadata"]["job_count"] == 2

    web_job = jobs_by_code["11111"]
    assert web_job["job_name"] == "웹개발자"
    assert web_job["knowledge_top_10"][0]["label"] == "컴퓨터와 전자공학"
    assert web_job["knowledge_top_10"][0]["weight"] == 0.875
    assert web_job["personality_top_10"][0]["label"] == "성취/노력"
    assert web_job["top_10"][0]["label"] == "성취/노력"

    design_job = jobs_by_code["22222"]
    assert design_job["job_name"] == "UX·UI디자이너"
    assert design_job["knowledge_top_10"][0]["label"] == "디자인"
    assert design_job["personality_top_10"][0]["label"] == "인내"
