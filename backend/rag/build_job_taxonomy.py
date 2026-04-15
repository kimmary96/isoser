"""KNOW 직업분류 CSV를 기반으로 초기 job taxonomy를 생성한다."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.parent
SEED_DIR = Path(__file__).parent / "seed_data"
sys.path.insert(0, str(BACKEND_DIR))

from rag.runtime_config import load_backend_dotenv, resolve_backend_path
from rag.source_adapters.know_files import build_taxonomy_from_rows, load_csv_rows

load_backend_dotenv()


def _resolve_backend_relative_path(env_name: str, default_relative_path: str) -> Path:
    """backend 기준 상대 경로 또는 절대 경로를 모두 허용한다."""
    return resolve_backend_path(os.environ.get(env_name), default_relative_path)


def main() -> None:
    """job taxonomy JSON을 생성한다."""
    mid_category_path = _resolve_backend_relative_path(
        "KNOW_MID_CATEGORY_CSV_PATH",
        "../docs/data/직업중분류.CSV",
    )
    detail_category_path = _resolve_backend_relative_path(
        "KNOW_DETAIL_CATEGORY_CSV_PATH",
        "../docs/data/직업세세분류.CSV",
    )

    print(f"[taxonomy] mid category source: {mid_category_path}")
    print(f"[taxonomy] detail category source: {detail_category_path}")

    mid_category_rows = load_csv_rows(mid_category_path)
    detail_category_rows = load_csv_rows(detail_category_path)
    taxonomy_nodes, unmapped_jobs = build_taxonomy_from_rows(mid_category_rows, detail_category_rows)

    taxonomy_output_path = SEED_DIR / "job_taxonomy.json"
    unmapped_output_path = SEED_DIR / "job_taxonomy_unmapped.json"

    taxonomy_output_path.write_text(
        json.dumps(taxonomy_nodes, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    unmapped_output_path.write_text(
        json.dumps(unmapped_jobs, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[taxonomy] taxonomy nodes: {len(taxonomy_nodes)}")
    print(f"[taxonomy] unmapped jobs: {len(unmapped_jobs)}")
    print(f"[taxonomy] wrote: {taxonomy_output_path}")
    print(f"[taxonomy] wrote: {unmapped_output_path}")


if __name__ == "__main__":
    main()
