from __future__ import annotations

import csv
from pathlib import Path

try:
    from backend.rag.taxonomy import (
        TaxonomyNode,
        build_canonical_nodes,
        match_normalized_job_key,
        normalize_for_match,
    )
except ImportError:
    from rag.taxonomy import (
        TaxonomyNode,
        build_canonical_nodes,
        match_normalized_job_key,
        normalize_for_match,
    )

CSV_ENCODING_CANDIDATES: tuple[str, ...] = ("utf-8-sig", "cp949", "euc-kr", "utf-8")

# KNOW 세세직업명 중 현재 canonical taxonomy에 직접 편입할 수 있는 직무만 보수적으로 확장한다.
KNOWN_TITLE_TO_CANONICAL_KEY: dict[str, str] = {
    "웹개발자": "frontend_engineer",
    "모바일앱개발자": "frontend_engineer",
    "웹기획자": "service_planner",
    "상품기획자": "service_planner",
    "UX·UI디자이너": "product_designer",
    "웹디자이너": "product_designer",
    "컴퓨터시스템설계 및 분석가": "backend_engineer",
    "데이터베이스개발자": "backend_engineer",
    "네트워크시스템개발자": "backend_engineer",
    "네트워크관리자": "backend_engineer",
    "정보보안전문가": "backend_engineer",
    "정보시스템운영자": "backend_engineer",
    "IT기술지원전문가": "backend_engineer",
    "IT테스터 및 QA전문가(SW테스터)": "backend_engineer",
    "통신기술개발자": "backend_engineer",
    "통신망운영기술자": "backend_engineer",
}
NORMALIZED_KNOW_TITLE_MAP = {
    normalize_for_match(title): key for title, key in KNOWN_TITLE_TO_CANONICAL_KEY.items()
}


def load_csv_rows(path: Path) -> list[dict[str, str]]:
    """Read a CSV file with UTF-8/CP949 fallback."""

    last_error: UnicodeDecodeError | None = None
    for encoding in CSV_ENCODING_CANDIDATES:
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                return list(csv.DictReader(handle))
        except UnicodeDecodeError as error:
            last_error = error

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"CSV를 읽을 수 없습니다: {path}")


def build_know_code(row: dict[str, str]) -> str:
    """Combine KNOW classification columns into a single code."""

    code_parts = (
        row.get("KNOW직업대분류", "").strip(),
        row.get("KNOW직업중분류", "").strip(),
        row.get("KNOW직업소분류", "").strip(),
        row.get("KNOW직업세분류", "").strip(),
        row.get("KNOW직업세세분류", "").strip(),
    )
    return "-".join(part for part in code_parts if part)


def build_mid_category_name_map(mid_category_rows: list[dict[str, str]]) -> dict[tuple[str, str], str]:
    """Resolve middle-category code pairs to Korean labels."""

    return {
        (
            row.get("KNOW직업대분류", "").strip(),
            row.get("KNOW직업중분류", "").strip(),
        ): row.get("KNOW직업중분류명", "").strip()
        for row in mid_category_rows
    }


def match_taxonomy_key(job_name: str) -> str | None:
    """Map a KNOW title into one of the current canonical taxonomy keys."""

    normalized_title = normalize_for_match(job_name)
    if not normalized_title:
        return None

    explicit_match = NORMALIZED_KNOW_TITLE_MAP.get(normalized_title)
    if explicit_match:
        return explicit_match

    return match_normalized_job_key(job_name)


def build_taxonomy_from_rows(
    mid_category_rows: list[dict[str, str]],
    detail_category_rows: list[dict[str, str]],
) -> tuple[list[dict], list[dict]]:
    """Merge KNOW middle/detail CSV rows into canonical taxonomy nodes."""

    nodes: dict[str, TaxonomyNode] = build_canonical_nodes()
    mid_category_names = build_mid_category_name_map(mid_category_rows)
    unmapped_jobs: list[dict] = []

    for row in detail_category_rows:
        job_name = row.get("KNOW직업명", "").strip()
        if not job_name:
            continue

        know_code = build_know_code(row)
        mid_category_name = mid_category_names.get(
            (
                row.get("KNOW직업대분류", "").strip(),
                row.get("KNOW직업중분류", "").strip(),
            ),
            "",
        )
        matched_key = match_taxonomy_key(job_name)

        if matched_key is None:
            unmapped_jobs.append(
                {
                    "normalized_job_key": f"know_{know_code.replace('-', '_')}",
                    "display_name_ko": job_name,
                    "aliases": [job_name],
                    "job_family": "unmapped",
                    "know_code": know_code,
                    "know_mid_category": mid_category_name,
                    "source_ref": f"KNOW_DETAIL:{know_code}",
                    "priority": 99,
                }
            )
            continue

        node = nodes[matched_key]
        node.aliases.append(job_name)
        node.know_codes.append(know_code)
        node.know_titles.append(job_name)
        if mid_category_name:
            node.know_mid_categories.append(mid_category_name)
        node.source_refs.append(f"KNOW_DETAIL:{know_code}")

    taxonomy_nodes = [node.to_dict() for node in nodes.values()]
    taxonomy_nodes.sort(key=lambda item: (item["priority"], item["normalized_job_key"]))
    unmapped_jobs.sort(key=lambda item: item["display_name_ko"])
    return taxonomy_nodes, unmapped_jobs
