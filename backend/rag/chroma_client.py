"""ChromaDB client bootstrap and retrieval helpers for Coach AI."""

from __future__ import annotations

from collections import Counter
from typing import Any

import chromadb
from chromadb.config import Settings

try:
    from backend.rag.runtime_config import (
        load_backend_dotenv,
        resolve_chroma_mode,
        resolve_chroma_persist_dir,
    )
except ImportError:
    from rag.runtime_config import (
        load_backend_dotenv,
        resolve_chroma_mode,
        resolve_chroma_persist_dir,
    )

_client: chromadb.ClientAPI | None = None
_job_collection: chromadb.Collection | None = None
_star_collection: chromadb.Collection | None = None
_posting_collection: chromadb.Collection | None = None
_chroma_mode: str | None = None

load_backend_dotenv()


def create_chroma_client() -> tuple[chromadb.ClientAPI, str]:
    """Create a Chroma client according to the configured mode."""

    chroma_mode = resolve_chroma_mode()
    settings = Settings(anonymized_telemetry=False)

    if chroma_mode == "ephemeral":
        client = chromadb.EphemeralClient(settings=settings)
        return client, chroma_mode

    persist_dir = resolve_chroma_persist_dir()
    client = chromadb.PersistentClient(
        path=str(persist_dir),
        settings=settings,
    )
    return client, chroma_mode


def get_or_create_collections(
    client: chromadb.ClientAPI,
) -> tuple[chromadb.Collection, chromadb.Collection, chromadb.Collection]:
    """Return the collections used by Coach AI."""

    job_collection = client.get_or_create_collection(
        name="job_keyword_patterns",
        metadata={"hnsw:space": "cosine"},
    )
    star_collection = client.get_or_create_collection(
        name="star_examples",
        metadata={"hnsw:space": "cosine"},
    )
    posting_collection = client.get_or_create_collection(
        name="job_posting_snippets",
        metadata={"hnsw:space": "cosine"},
    )
    return job_collection, star_collection, posting_collection


def init_chroma() -> None:
    """Initialize the Chroma client, collections, and in-process seed data."""

    global _client, _job_collection, _star_collection, _posting_collection, _chroma_mode

    try:
        _client, _chroma_mode = create_chroma_client()
        _job_collection, _star_collection, _posting_collection = get_or_create_collections(_client)

        try:
            from backend.rag.seed import seed_collections
        except ImportError:
            from rag.seed import seed_collections

        seed_collections(_job_collection, _star_collection, _posting_collection)

        if _chroma_mode == "persistent":
            persist_dir = resolve_chroma_persist_dir()
            print(f"[ChromaDB] initialized - mode={_chroma_mode}, persist_dir={persist_dir}")
        else:
            print(f"[ChromaDB] initialized - mode={_chroma_mode}")
    except Exception as exc:
        print(f"[ChromaDB] init failed, fallback without RAG: {exc}")
        _client = None
        _job_collection = None
        _star_collection = None
        _posting_collection = None
        _chroma_mode = None


def get_job_collection() -> chromadb.Collection | None:
    """Return the job keyword pattern collection if available."""

    return _job_collection


def get_star_collection() -> chromadb.Collection | None:
    """Return the STAR example collection if available."""

    return _star_collection


def get_job_posting_collection() -> chromadb.Collection | None:
    """Return the job posting snippet collection if available."""

    return _posting_collection


def get_chroma_mode() -> str | None:
    """Return the initialized Chroma mode."""

    return _chroma_mode


def _query_collection_records(
    collection: chromadb.Collection | None,
    query_text: str,
    n_results: int,
) -> list[dict]:
    """Query a collection and return combined document and metadata records."""

    if collection is None:
        return []

    try:
        count = collection.count()
        if count == 0:
            return []

        results = collection.query(
            query_texts=[query_text],
            n_results=min(n_results, count),
        )
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        ids = results.get("ids", [[]])[0]

        records: list[dict] = []
        for index, document in enumerate(documents):
            metadata = metadatas[index] if index < len(metadatas) else {}
            item = {
                "id": ids[index] if index < len(ids) else None,
                "document": document,
            }
            if isinstance(metadata, dict):
                item.update(metadata)
            records.append(item)

        return records
    except Exception:
        return []


def _collection_metadata_distribution(
    collection: chromadb.Collection | None,
    metadata_key: str,
) -> dict[str, int]:
    """Return a metadata value distribution for a collection."""

    if collection is None:
        return {}

    try:
        count = collection.count()
        if count == 0:
            return {}

        result = collection.get(include=["metadatas"])
        metadatas = result.get("metadatas") or []
        counter: Counter[str] = Counter()
        for metadata in metadatas:
            if not isinstance(metadata, dict):
                continue
            value = metadata.get(metadata_key)
            if value in (None, ""):
                continue
            counter[str(value)] += 1

        return dict(sorted(counter.items()))
    except Exception:
        return {}


def get_chroma_health_summary() -> dict[str, Any]:
    """Return collection counts and metadata distributions for /health."""

    job_count = _job_collection.count() if _job_collection is not None else 0
    star_count = _star_collection.count() if _star_collection is not None else 0
    posting_count = _posting_collection.count() if _posting_collection is not None else 0

    return {
        "mode": _chroma_mode or resolve_chroma_mode(),
        "collections": {
            "job_keyword_patterns": {
                "count": job_count,
                "pattern_type_distribution": _collection_metadata_distribution(
                    _job_collection,
                    "pattern_type",
                ),
            },
            "star_examples": {
                "count": star_count,
                "activity_type_distribution": _collection_metadata_distribution(
                    _star_collection,
                    "activity_type",
                ),
            },
            "job_posting_snippets": {
                "count": posting_count,
                "source_distribution": _collection_metadata_distribution(
                    _posting_collection,
                    "source",
                ),
                "section_type_distribution": _collection_metadata_distribution(
                    _posting_collection,
                    "section_type",
                ),
            },
        },
    }


def search_job_keyword_pattern_records(
    job_title: str,
    n_results: int = 4,
) -> list[dict]:
    """Return job keyword pattern records with metadata for prompt assembly."""

    return _query_collection_records(_job_collection, job_title, n_results)


def search_star_example_records(
    activity_text: str,
    n_results: int = 3,
) -> list[dict]:
    """Return STAR example records with metadata for prompt assembly."""

    return _query_collection_records(_star_collection, activity_text, n_results)


def search_job_posting_snippet_records(
    query_text: str,
    n_results: int = 3,
) -> list[dict]:
    """Return job posting snippet records with metadata for prompt assembly."""

    return _query_collection_records(_posting_collection, query_text, n_results)


def search_job_keywords(job_title: str, n_results: int = 3) -> list[str]:
    """Return only job keyword pattern documents for backward compatibility."""

    return [
        item["document"]
        for item in search_job_keyword_pattern_records(job_title, n_results)
        if item.get("document")
    ]


def search_star_examples(activity_text: str, n_results: int = 2) -> list[str]:
    """Return only STAR example documents for backward compatibility."""

    return [
        item["document"]
        for item in search_star_example_records(activity_text, n_results)
        if item.get("document")
    ]
