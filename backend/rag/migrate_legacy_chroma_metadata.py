"""In-place migration for legacy Chroma metadata.

This script updates metadata only (no re-embedding) for legacy collections:
- job_keyword_patterns: {"job","keywords"} -> adds job_bucket/pattern_type schema
- star_examples: {"original","missing_before"} -> adds activity_type/job_family schema
"""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
import sys
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.rag.chroma_client import get_chroma_manager


def _safe_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _looks_legacy_job(meta: dict[str, Any]) -> bool:
    return "job" in meta and "job_bucket" not in meta


def _looks_legacy_star(meta: dict[str, Any]) -> bool:
    return "original" in meta and "activity_type" not in meta


def _infer_job_slug(job_text: str) -> str:
    token = _safe_text(job_text).lower().replace(" ", "")
    if any(key in token for key in ("pm", "product", "기획", "온보딩", "전환", "가입", "추천", "리텐션", "파트너")):
        return "pm"
    if any(
        key in token
        for key in ("marketer", "market", "marketing", "광고", "캠페인", "메일", "푸시", "roas", "cac", "crm")
    ):
        return "marketer"
    if any(key in token for key in ("front", "frontend", "react", "lcp", "번들", "웹", "ui")):
        return "frontend_engineer"
    if any(key in token for key in ("design", "designer", "ux", "voc", "사용성", "디자인")):
        return "product_designer"
    if any(key in token for key in ("backend", "server", "api", "redis", "배치", "인프라", "모니터링", "ci")):
        return "backend_engineer"
    return "backend_engineer"


def _slug_to_bucket(slug: str) -> str:
    return {
        "pm": "product_management",
        "backend_engineer": "backend_infra",
        "frontend_engineer": "frontend_web",
        "product_designer": "product_design",
        "marketer": "growth_marketing",
    }.get(slug, "backend_infra")


def _slug_to_family(slug: str) -> str:
    return {
        "pm": "product",
        "backend_engineer": "engineering",
        "frontend_engineer": "engineering",
        "product_designer": "design",
        "marketer": "marketing",
    }.get(slug, "engineering")


def _infer_pattern_type(text: str) -> str:
    lowered = _safe_text(text).lower()
    if any(key in lowered for key in ("%", "improve", "improved", "increase", "decrease", "result")):
        return "result_statement"
    if any(key in lowered for key in ("decide", "decision", "compare", "trade-off", "tradeoff")):
        return "decision_statement"
    if any(key in lowered for key in ("issue", "problem", "bottleneck", "root cause", "cause")):
        return "problem_statement"
    return "implementation_statement"


def _infer_activity_type(missing_before: str, text: str) -> str:
    merged = f"{_safe_text(missing_before)} {_safe_text(text)}".lower()
    if any(key in merged for key in ("problem", "issue", "cause")):
        return "problem_definition"
    if any(key in merged for key in ("decision", "trade-off", "compare", "architecture")):
        return "tech_decision"
    if any(key in merged for key in ("%", "metric", "kpi", "result", "improve")):
        return "quantification"
    if any(key in merged for key in ("implemented", "built", "designed", "executed")):
        return "verb_strength"
    if any(key in merged for key in ("owned", "led", "responsible", "contribution")):
        return "job_fit"
    return "star_gap"


def _activity_to_focus(activity_type: str) -> str:
    return {
        "problem_definition": "Clarify concrete problem context and root cause.",
        "tech_decision": "Explain alternatives and decision rationale.",
        "quantification": "Add measurable impact and numerical outcomes.",
        "verb_strength": "Use concrete actions and implementation detail.",
        "job_fit": "Separate role and contribution for job relevance.",
        "star_gap": "Complete Situation-Task-Action-Result flow.",
    }.get(activity_type, "Complete Situation-Task-Action-Result flow.")


def _get_collections():
    manager = get_chroma_manager()
    manager.initialize(seed_data=False, force=True)
    job_collection = manager.get_collection("job_keyword_patterns")
    star_collection = manager.get_collection("star_examples")
    return job_collection, star_collection


def migrate_job_metadata(*, apply: bool) -> dict[str, Any]:
    job_collection, _ = _get_collections()
    if job_collection is None:
        return {"legacy_found": 0, "updated": 0, "error": "job collection unavailable"}

    payload = job_collection.get(include=["metadatas", "documents"])
    ids: list[str] = payload.get("ids", [])
    metas: list[dict[str, Any]] = payload.get("metadatas", [])
    docs: list[str] = payload.get("documents", [])

    update_ids: list[str] = []
    update_metas: list[dict[str, Any]] = []
    bucket_counter: Counter[str] = Counter()

    for idx, item_id in enumerate(ids):
        meta = metas[idx] if idx < len(metas) and isinstance(metas[idx], dict) else {}
        if not _looks_legacy_job(meta):
            continue

        doc = docs[idx] if idx < len(docs) else ""
        slug = _infer_job_slug(meta.get("job"))
        bucket = _slug_to_bucket(slug)
        family = _slug_to_family(slug)
        pattern_type = _infer_pattern_type(doc)
        keywords = _safe_text(meta.get("keywords"))

        merged = dict(meta)
        merged.update(
            {
                "job_slug": slug,
                "job_title": _safe_text(meta.get("job")) or slug,
                "job_family": family,
                "job_bucket": bucket,
                "section_types": "프로젝트,회사경력",
                "source": "legacy_migrated",
                "pattern_type": pattern_type,
                "lang": "ko",
                "version": "v1",
                "is_active": True,
                "keywords": keywords,
            }
        )
        update_ids.append(item_id)
        update_metas.append(merged)
        bucket_counter[bucket] += 1

    if apply and update_ids:
        job_collection.update(ids=update_ids, metadatas=update_metas)

    return {
        "legacy_found": len(update_ids),
        "updated": len(update_ids) if apply else 0,
        "bucket_distribution": dict(bucket_counter),
    }


def migrate_star_metadata(*, apply: bool, reclassify_all: bool = False) -> dict[str, Any]:
    _, star_collection = _get_collections()
    if star_collection is None:
        return {"legacy_found": 0, "updated": 0, "error": "star collection unavailable"}

    payload = star_collection.get(include=["metadatas", "documents"])
    ids: list[str] = payload.get("ids", [])
    metas: list[dict[str, Any]] = payload.get("metadatas", [])
    docs: list[str] = payload.get("documents", [])

    update_ids: list[str] = []
    update_metas: list[dict[str, Any]] = []
    activity_counter: Counter[str] = Counter()

    for idx, item_id in enumerate(ids):
        meta = metas[idx] if idx < len(metas) and isinstance(metas[idx], dict) else {}
        if not reclassify_all and not _looks_legacy_star(meta):
            continue

        doc = docs[idx] if idx < len(docs) else ""
        original = _safe_text(meta.get("original"))
        missing = _safe_text(meta.get("missing_before"))
        activity_type = _infer_activity_type(missing, f"{original} {doc}")
        slug = _infer_job_slug(f"{original} {doc}")

        merged = dict(meta)
        merged.update(
            {
                "activity_type": activity_type,
                "section_type": "프로젝트",
                "job_family": slug,
                "original_text": original,
                "rewrite_focus": _activity_to_focus(activity_type),
                "lang": "ko",
                "version": "v1",
                "is_active": True,
                "source": "legacy_migrated",
            }
        )
        update_ids.append(item_id)
        update_metas.append(merged)
        activity_counter[activity_type] += 1

    if apply and update_ids:
        star_collection.update(ids=update_ids, metadatas=update_metas)

    return {
        "legacy_found": len(update_ids),
        "updated": len(update_ids) if apply else 0,
        "activity_distribution": dict(activity_counter),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate legacy Chroma metadata in place.")
    parser.add_argument("--apply", action="store_true", help="Apply updates (default: dry-run).")
    parser.add_argument(
        "--reclassify-star",
        action="store_true",
        help="Recompute STAR metadata for all rows (not only legacy rows).",
    )
    args = parser.parse_args()

    mode = "apply" if args.apply else "dry-run"
    job_result = migrate_job_metadata(apply=args.apply)
    star_result = migrate_star_metadata(apply=args.apply, reclassify_all=args.reclassify_star)
    print(
        {
            "mode": mode,
            "job_keyword_patterns": job_result,
            "star_examples": star_result,
        }
    )


if __name__ == "__main__":
    main()
