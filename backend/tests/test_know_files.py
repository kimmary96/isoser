from __future__ import annotations

from pathlib import Path

from backend.rag.source_adapters.know_files import (
    build_taxonomy_from_rows,
    load_csv_rows,
    match_taxonomy_key,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = REPO_ROOT / "docs" / "data"


def test_load_csv_rows_supports_know_csv_encoding() -> None:
    rows = load_csv_rows(DOCS_DIR / "직업중분류.CSV")

    assert rows
    assert rows[0]["KNOW직업중분류명"] == "관리직(임원·부서장)"


def test_match_taxonomy_key_expands_digital_aliases() -> None:
    assert match_taxonomy_key("웹개발자") == "frontend_engineer"
    assert match_taxonomy_key("웹기획자") == "service_planner"
    assert match_taxonomy_key("UX·UI디자이너") == "product_designer"
    assert match_taxonomy_key("IT테스터 및 QA전문가(SW테스터)") == "backend_engineer"


def test_build_taxonomy_from_rows_merges_known_titles() -> None:
    mid_rows = load_csv_rows(DOCS_DIR / "직업중분류.CSV")
    detail_rows = load_csv_rows(DOCS_DIR / "직업세세분류.CSV")

    taxonomy_nodes, _unmapped_jobs = build_taxonomy_from_rows(mid_rows, detail_rows)
    nodes_by_key = {node["normalized_job_key"]: node for node in taxonomy_nodes}

    assert "웹개발자" in nodes_by_key["frontend_engineer"]["aliases"]
    assert "웹개발자" in nodes_by_key["frontend_engineer"]["know_titles"]
    assert "웹기획자" in nodes_by_key["service_planner"]["know_titles"]
    assert "UX·UI디자이너" in nodes_by_key["product_designer"]["know_titles"]
    assert "IT테스터 및 QA전문가(SW테스터)" in nodes_by_key["backend_engineer"]["know_titles"]
