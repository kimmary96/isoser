# ChromaDB 초기 시드 데이터 적재 스크립트 - 서버 첫 시작 또는 수동 실행
from __future__ import annotations

import json
import sys
import logging
from collections import Counter
from json import JSONDecodeError
from pathlib import Path
from typing import Any

import chromadb
from pydantic import ValidationError

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.logging_config import get_logger, log_event
from backend.rag.runtime_config import load_backend_dotenv, resolve_chroma_persist_dir
from backend.rag.schema import (
    JobKeywordPatternSeed,
    JobPostingSnippetSeed,
    StarExampleSeed,
)
from backend.rag.chroma_client import create_chroma_client, get_or_create_collections
from check_python_version import main as assert_python_version

SEED_DIR = Path(__file__).parent / "seed_data"
logger = get_logger(__name__)

load_backend_dotenv()


def _read_seed_json(path: Path) -> list[dict[str, Any]]:
    """시드 JSON 파일을 읽고 리스트 형태로 반환한다."""

    try:
        with path.open(encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, JSONDecodeError) as exc:
        raise RuntimeError(f"failed to read seed file: {path}") from exc

    if not isinstance(data, list):
        raise RuntimeError(f"seed file must contain a list: {path}")

    return data


def _format_validation_error(exc: ValidationError) -> str:
    """Pydantic 검증 오류를 한 줄 로그 형태로 압축한다."""

    return "; ".join(
        f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
        for error in exc.errors(include_url=False)
    )


def _validate_seed_item(
    item: dict[str, Any],
    index: int,
    collection_name: str,
    seen_documents: set[str],
    model_cls: type[JobKeywordPatternSeed] | type[StarExampleSeed] | type[JobPostingSnippetSeed],
) -> JobKeywordPatternSeed | StarExampleSeed | JobPostingSnippetSeed | None:
    """시드 항목 1건을 검증하고 중복 document를 필터링한다."""

    item_ref = item.get("id", f"index={index}")

    try:
        model = model_cls(**item)
    except ValidationError as exc:
        log_event(
            logger,
            logging.WARNING,
            "seed_validation_failed",
            collection=collection_name,
            item_ref=item_ref,
            error=_format_validation_error(exc),
        )
        return None

    if model.document in seen_documents:
        log_event(
            logger,
            logging.WARNING,
            "seed_duplicate_skipped",
            collection=collection_name,
            item_ref=model.id,
        )
        return None

    seen_documents.add(model.document)
    return model


def load_job_keyword_patterns() -> tuple[list[JobKeywordPatternSeed], int]:
    """직무 키워드 패턴 시드를 읽고 검증된 항목만 반환한다."""

    raw_items = _read_seed_json(SEED_DIR / "job_keyword_patterns.json")
    seen_documents: set[str] = set()
    validated_items: list[JobKeywordPatternSeed] = []

    for index, item in enumerate(raw_items):
        if not isinstance(item, dict):
            log_event(
                logger,
                logging.WARNING,
                "seed_validation_failed",
                collection="job_keyword_patterns",
                item_ref=f"index={index}",
                error="item must be an object",
            )
            continue

        validated = _validate_seed_item(
            item=item,
            index=index,
            collection_name="job_keyword_patterns",
            seen_documents=seen_documents,
            model_cls=JobKeywordPatternSeed,
        )
        if validated is not None:
            validated_items.append(validated)

    family_counts = Counter(item.job_family for item in validated_items)
    for job_family, count in sorted(family_counts.items()):
        if count < 5:
            log_event(
                logger,
                logging.WARNING,
                "seed_coverage_warning",
                collection="job_keyword_patterns",
                job_family=job_family,
                valid_count=count,
                minimum_recommended=5,
            )

    return validated_items, len(raw_items)


def load_star_examples() -> tuple[list[StarExampleSeed], int]:
    """STAR 예시 시드를 읽고 검증된 항목만 반환한다."""

    raw_items = _read_seed_json(SEED_DIR / "star_examples.json")
    seen_documents: set[str] = set()
    validated_items: list[StarExampleSeed] = []

    for index, item in enumerate(raw_items):
        if not isinstance(item, dict):
            log_event(
                logger,
                logging.WARNING,
                "seed_validation_failed",
                collection="star_examples",
                item_ref=f"index={index}",
                error="item must be an object",
            )
            continue

        validated = _validate_seed_item(
            item=item,
            index=index,
            collection_name="star_examples",
            seen_documents=seen_documents,
            model_cls=StarExampleSeed,
        )
        if validated is not None:
            validated_items.append(validated)

    if len(validated_items) < 20:
        log_event(
            logger,
            logging.WARNING,
            "seed_coverage_warning",
            collection="star_examples",
            valid_count=len(validated_items),
            minimum_recommended=20,
        )

    return validated_items, len(raw_items)


def load_job_posting_snippets() -> tuple[list[JobPostingSnippetSeed], int]:
    """채용 공고 표현 시드를 읽고 검증된 항목만 반환한다."""

    raw_items = _read_seed_json(SEED_DIR / "job_posting_snippets.json")
    seen_documents: set[str] = set()
    validated_items: list[JobPostingSnippetSeed] = []

    for index, item in enumerate(raw_items):
        if not isinstance(item, dict):
            log_event(
                logger,
                logging.WARNING,
                "seed_validation_failed",
                collection="job_posting_snippets",
                item_ref=f"index={index}",
                error="item must be an object",
            )
            continue

        validated = _validate_seed_item(
            item=item,
            index=index,
            collection_name="job_posting_snippets",
            seen_documents=seen_documents,
            model_cls=JobPostingSnippetSeed,
        )
        if validated is not None:
            validated_items.append(validated)

    return validated_items, len(raw_items)


def seed_job_keywords(
    collection: chromadb.Collection,
    items: list[JobKeywordPatternSeed] | None = None,
    total_count: int | None = None,
) -> None:
    """검증된 직무 키워드 패턴 시드를 ChromaDB에 적재한다."""

    if collection.count() > 0:
        log_event(
            logger,
            logging.INFO,
            "seed_init",
            collection="job_keyword_patterns",
            status="skipped_existing",
        )
        return

    if items is None or total_count is None:
        items, total_count = load_job_keyword_patterns()
    loaded_count = len(items)

    if loaded_count > 0:
        collection.add(
            documents=[item.document for item in items],
            metadatas=[
                {
                    "job_title": item.job_title,
                    "job_family": item.job_family,
                    "job_bucket": item.job_bucket,
                    "section_types": ",".join(item.section_types),
                    "keywords": ",".join(item.keywords),
                    "source": item.source,
                    "pattern_type": item.pattern_type,
                    "lang": item.lang,
                    "version": item.version,
                    "is_active": item.is_active,
                }
                for item in items
            ],
            ids=[item.id for item in items],
        )

    log_event(
        logger,
        logging.INFO,
        "seed_init",
        collection="job_keyword_patterns",
        loaded=loaded_count,
        total=total_count,
    )


def seed_star_examples(
    collection: chromadb.Collection,
    items: list[StarExampleSeed] | None = None,
    total_count: int | None = None,
) -> None:
    """검증된 STAR 예시 시드를 ChromaDB에 적재한다."""

    if collection.count() > 0:
        log_event(
            logger,
            logging.INFO,
            "seed_init",
            collection="star_examples",
            status="skipped_existing",
        )
        return

    if items is None or total_count is None:
        items, total_count = load_star_examples()
    loaded_count = len(items)

    if loaded_count > 0:
        collection.add(
            documents=[item.document for item in items],
            metadatas=[
                {
                    "activity_type": item.activity_type,
                    "section_type": item.section_type,
                    "job_family": item.job_family,
                    "original_text": item.original_text,
                    "missing_before": ",".join(item.missing_before),
                    "rewrite_focus": item.rewrite_focus,
                    "lang": item.lang,
                    "version": item.version,
                    "is_active": item.is_active,
                }
                for item in items
            ],
            ids=[item.id for item in items],
        )

    log_event(
        logger,
        logging.INFO,
        "seed_init",
        collection="star_examples",
        loaded=loaded_count,
        total=total_count,
    )


def seed_job_posting_snippets(
    collection: chromadb.Collection,
    items: list[JobPostingSnippetSeed] | None = None,
    total_count: int | None = None,
) -> None:
    """검증한 채용 공고 표현 시드를 ChromaDB에 적재한다."""

    if collection.count() > 0:
        log_event(
            logger,
            logging.INFO,
            "seed_init",
            collection="job_posting_snippets",
            status="skipped_existing",
        )
        return

    if items is None or total_count is None:
        items, total_count = load_job_posting_snippets()
    loaded_count = len(items)

    if loaded_count > 0:
        collection.add(
            documents=[item.document for item in items],
            metadatas=[
                {
                    "job_slug": item.job_slug,
                    "job_family": item.job_family,
                    "job_bucket": item.job_bucket,
                    "source": item.source,
                    "section_type": item.section_type,
                    "lang": item.lang,
                    "version": item.version,
                    "is_active": item.is_active,
                }
                for item in items
            ],
            ids=[item.id for item in items],
        )

    log_event(
        logger,
        logging.INFO,
        "seed_init",
        collection="job_posting_snippets",
        loaded=loaded_count,
        total=total_count,
    )


def seed_collections(
    job_collection: chromadb.Collection,
    star_collection: chromadb.Collection,
    posting_collection: chromadb.Collection,
) -> None:
    """Load, validate, and seed all Coach AI collections."""

    job_items, job_total = load_job_keyword_patterns()
    star_items, star_total = load_star_examples()
    posting_items, posting_total = load_job_posting_snippets()
    seed_job_keywords(job_collection, items=job_items, total_count=job_total)
    seed_star_examples(star_collection, items=star_items, total_count=star_total)
    seed_job_posting_snippets(
        posting_collection,
        items=posting_items,
        total_count=posting_total,
    )


def main() -> None:
    """ChromaDB 시드 데이터를 적재하는 메인 함수."""

    chroma_client, chroma_mode = create_chroma_client()
    if chroma_mode == "persistent":
        persist_dir = resolve_chroma_persist_dir()
        log_event(
            logger,
            logging.INFO,
            "seed_init",
            collection="all",
            chroma_mode=chroma_mode,
            persist_dir=str(persist_dir),
            status="starting",
        )
    else:
        log_event(
            logger,
            logging.INFO,
            "seed_init",
            collection="all",
            chroma_mode=chroma_mode,
            status="starting",
        )

    job_collection, star_collection, posting_collection = get_or_create_collections(chroma_client)
    seed_collections(job_collection, star_collection, posting_collection)
    log_event(
        logger,
        logging.INFO,
        "seed_init",
        collection="all",
        chroma_mode=chroma_mode,
        status="completed",
    )


if __name__ == "__main__":
    # Render preflight / 수동 실행: python -m backend.rag.seed
    assert_python_version()
    main()
