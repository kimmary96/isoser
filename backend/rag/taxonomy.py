"""Chroma Coach AI용 직무 taxonomy 생성 규칙."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import re
from pathlib import Path


@dataclass
class TaxonomyNode:
    """초기 Chroma seed 구축에 사용하는 정규화 직무 노드."""

    normalized_job_key: str
    display_name_ko: str
    job_family: str
    aliases: list[str] = field(default_factory=list)
    know_codes: list[str] = field(default_factory=list)
    know_titles: list[str] = field(default_factory=list)
    know_mid_categories: list[str] = field(default_factory=list)
    source_refs: list[str] = field(default_factory=list)
    priority: int = 99

    def to_dict(self) -> dict:
        """JSON 직렬화 가능한 dict를 반환한다."""
        data = asdict(self)
        for field_name in ("aliases", "know_codes", "know_titles", "know_mid_categories", "source_refs"):
            data[field_name] = sorted(set(data[field_name]))
        return data


CANONICAL_JOB_SPECS: tuple[dict, ...] = (
    {
        "normalized_job_key": "pm",
        "display_name_ko": "PM",
        "job_family": "product",
        "priority": 1,
        "aliases": [
            "PM",
            "Product Manager",
            "Product Owner",
            "PO",
            "프로덕트 매니저",
            "프로덕트매니저",
            "프로덕트 오너",
        ],
    },
    {
        "normalized_job_key": "service_planner",
        "display_name_ko": "서비스 기획자",
        "job_family": "product",
        "priority": 1,
        "aliases": [
            "기획자",
            "서비스 기획자",
            "서비스기획자",
            "웹기획자",
            "앱기획자",
            "서비스 운영 기획자",
            "사업기획자",
            "상품기획자",
        ],
    },
    {
        "normalized_job_key": "backend_engineer",
        "display_name_ko": "백엔드 개발자",
        "job_family": "engineering",
        "priority": 1,
        "aliases": [
            "백엔드 개발자",
            "백엔드개발자",
            "Backend Engineer",
            "Backend Developer",
            "서버 개발자",
            "서버개발자",
            "플랫폼 개발자",
            "플랫폼개발자",
            "API 개발자",
            "API개발자",
            "응용소프트웨어 개발자",
            "응용소프트웨어개발자",
            "시스템소프트웨어 개발자",
            "시스템소프트웨어개발자",
        ],
    },
    {
        "normalized_job_key": "frontend_engineer",
        "display_name_ko": "프론트엔드 개발자",
        "job_family": "engineering",
        "priority": 1,
        "aliases": [
            "프론트엔드 개발자",
            "프론트엔드개발자",
            "Frontend Engineer",
            "Frontend Developer",
            "웹 프론트엔드 개발자",
            "웹프론트엔드개발자",
            "React 개발자",
            "React개발자",
        ],
    },
    {
        "normalized_job_key": "product_designer",
        "display_name_ko": "프로덕트 디자이너",
        "job_family": "design",
        "priority": 1,
        "aliases": [
            "프로덕트 디자이너",
            "프로덕트디자이너",
            "Product Designer",
            "UX 디자이너",
            "UI 디자이너",
            "UX/UI 디자이너",
            "서비스 디자이너",
            "서비스디자이너",
        ],
    },
    {
        "normalized_job_key": "marketer",
        "display_name_ko": "마케터",
        "job_family": "marketing",
        "priority": 1,
        "aliases": [
            "마케터",
            "마케팅",
            "퍼포먼스 마케터",
            "퍼포먼스마케터",
            "브랜드 마케터",
            "브랜드마케터",
            "콘텐츠 마케터",
            "콘텐츠마케터",
            "CRM 마케터",
            "CRM마케터",
            "그로스 마케터",
            "그로스마케터",
            "마케팅·광고·홍보관리자",
            "광고·홍보·마케팅전문가",
            "광고·홍보·마케팅사무원",
            "텔레마케터",
        ],
    },
)

def normalize_for_match(value: str) -> str:
    """직무명 비교용 텍스트 정규화."""
    return re.sub(r"[^0-9a-z가-힣]+", "", value.casefold())


def build_canonical_nodes() -> dict[str, TaxonomyNode]:
    """초기 직군 taxonomy 노드를 생성한다."""
    nodes: dict[str, TaxonomyNode] = {}
    for spec in CANONICAL_JOB_SPECS:
        nodes[spec["normalized_job_key"]] = TaxonomyNode(
            normalized_job_key=spec["normalized_job_key"],
            display_name_ko=spec["display_name_ko"],
            job_family=spec["job_family"],
            aliases=list(spec["aliases"]),
            source_refs=["MANUAL_CANONICAL_RULE"],
            priority=spec["priority"],
        )
    return nodes


def match_normalized_job_key(job_name: str) -> str | None:
    """원본 직무명을 초기 canonical key 중 하나로 매핑한다."""
    normalized_job_name = normalize_for_match(job_name)
    if not normalized_job_name:
        return None

    for spec in CANONICAL_JOB_SPECS:
        for alias in sorted(spec["aliases"], key=len, reverse=True):
            normalized_alias = normalize_for_match(alias)
            if not normalized_alias:
                continue

            if len(normalized_alias) <= 3:
                if normalized_job_name == normalized_alias:
                    return spec["normalized_job_key"]
                continue

            if normalized_alias in normalized_job_name or normalized_job_name in normalized_alias:
                return spec["normalized_job_key"]

    return None


def build_job_taxonomy(
    mid_category_rows: list[dict[str, str]],
    detail_category_rows: list[dict[str, str]],
) -> tuple[list[dict], list[dict]]:
    """Backward-compatible wrapper around the KNOW file adapter."""
    try:
        from backend.rag.source_adapters.know_files import build_taxonomy_from_rows
    except ImportError:
        from rag.source_adapters.know_files import build_taxonomy_from_rows

    return build_taxonomy_from_rows(mid_category_rows, detail_category_rows)


def load_csv_rows(path: Path) -> list[dict[str, str]]:
    """Backward-compatible wrapper around the KNOW file adapter."""
    try:
        from backend.rag.source_adapters.know_files import load_csv_rows as _load_csv_rows
    except ImportError:
        from rag.source_adapters.know_files import load_csv_rows as _load_csv_rows

    return _load_csv_rows(path)
