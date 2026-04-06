"""ChromaDB bootstrap, singleton access, and retrieval helpers for Coach AI."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
import logging
import os
from typing import Any, ClassVar, Mapping, Sequence

import chromadb
from chromadb.config import Settings
from chromadb.utils.embedding_functions import GoogleGenerativeAiEmbeddingFunction

try:
    from backend.logging_config import get_logger, log_event
    from backend.rag.runtime_config import (
        load_backend_dotenv,
        resolve_chroma_mode,
        resolve_chroma_persist_dir,
    )
except ImportError:
    from logging_config import get_logger, log_event
    from rag.runtime_config import (
        load_backend_dotenv,
        resolve_chroma_mode,
        resolve_chroma_persist_dir,
    )

load_backend_dotenv()
logger = get_logger(__name__)

COLLECTION_CONFIG: dict[str, dict[str, Any]] = {
    "job_keyword_patterns": {
        "metadata": {"hnsw:space": "cosine"},
        "stats_keys": ("pattern_type",),
    },
    "star_examples": {
        "metadata": {"hnsw:space": "cosine"},
        "stats_keys": ("activity_type",),
    },
    "job_posting_snippets": {
        "metadata": {"hnsw:space": "cosine"},
        "stats_keys": ("source", "section_type"),
    },
}
COLLECTION_ORDER = (
    "job_keyword_patterns",
    "star_examples",
    "job_posting_snippets",
)


def build_embedding_function() -> GoogleGenerativeAiEmbeddingFunction:
    """Build a shared embedding function that avoids local ONNX model loading."""

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is required for Chroma embedding initialization.")

    return GoogleGenerativeAiEmbeddingFunction(
        api_key=api_key,
        model_name="models/embedding-001",
    )


def _collection_metadata(name: str) -> dict[str, Any]:
    config = COLLECTION_CONFIG.get(name, {})
    metadata = config.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return {"hnsw:space": "cosine"}


def _collection_stats_keys(name: str) -> tuple[str, ...]:
    config = COLLECTION_CONFIG.get(name, {})
    stats_keys = config.get("stats_keys")
    if isinstance(stats_keys, tuple):
        return stats_keys
    return ()


def _empty_collection_stats(
    collection_name: str,
    metadata_keys: Sequence[str] | None = None,
) -> dict[str, Any]:
    stats: dict[str, Any] = {"count": 0}
    for metadata_key in metadata_keys or _collection_stats_keys(collection_name):
        stats[f"{metadata_key}_distribution"] = {}
    return stats


def _text_metadata_value(metadata: Mapping[str, Any], key: str) -> str | None:
    value = metadata.get(key)
    if value in (None, ""):
        return None
    return str(value)


@dataclass(slots=True)
class SearchResult:
    """Normalized Chroma search hit with convenience metadata accessors."""

    id: str | None
    document: str | None
    metadata: dict[str, Any] = field(default_factory=dict)
    score: float | None = None

    @property
    def source(self) -> str | None:
        return _text_metadata_value(self.metadata, "source")

    @property
    def job_bucket(self) -> str | None:
        return _text_metadata_value(self.metadata, "job_bucket")

    @property
    def pattern_type(self) -> str | None:
        return _text_metadata_value(self.metadata, "pattern_type")

    def to_record(self) -> dict[str, Any]:
        """Return the legacy merged record representation."""

        record = {
            "id": self.id,
            "document": self.document,
        }
        record.update(self.metadata)
        if self.score is not None:
            record["score"] = self.score
        return record


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

    embedding_fn = build_embedding_function()
    collections = tuple(
        client.get_or_create_collection(
            name=name,
            metadata=_collection_metadata(name),
            embedding_function=embedding_fn,
        )
        for name in COLLECTION_ORDER
    )
    return collections


class ChromaManager:
    """Singleton lifecycle and collection access for ChromaDB."""

    _instance: ClassVar[ChromaManager | None] = None

    def __new__(cls) -> ChromaManager:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_bootstrapped", False):
            return

        self._client: chromadb.ClientAPI | None = None
        self._collections: dict[str, chromadb.Collection] = {}
        self._chroma_mode: str | None = None
        self._bootstrapped = True

    @property
    def client(self) -> chromadb.ClientAPI | None:
        return self._client

    @property
    def mode(self) -> str | None:
        return self._chroma_mode

    def reset(self) -> None:
        """Clear initialized client state."""

        self._client = None
        self._collections = {}
        self._chroma_mode = None

    def initialize(self, *, seed_data: bool = True, force: bool = False) -> None:
        """Initialize the Chroma client, collections, and optional seed data."""

        if self._client is not None and not force:
            return

        try:
            client, chroma_mode = create_chroma_client()
            collections = get_or_create_collections(client)

            self._client = client
            self._chroma_mode = chroma_mode
            self._collections = dict(zip(COLLECTION_ORDER, collections, strict=True))

            if seed_data:
                try:
                    from backend.rag.seed import seed_collections
                except ImportError:
                    from rag.seed import seed_collections

                seed_collections(*collections)

            if self._chroma_mode == "persistent":
                persist_dir = resolve_chroma_persist_dir()
                log_event(
                    logger,
                    logging.INFO,
                    "chroma_initialized",
                    chroma_mode=self._chroma_mode,
                    persist_dir=str(persist_dir),
                )
            else:
                log_event(
                    logger,
                    logging.INFO,
                    "chroma_initialized",
                    chroma_mode=self._chroma_mode,
                )
        except Exception as exc:
            log_event(
                logger,
                logging.ERROR,
                "chroma_init_failed",
                error=str(exc),
            )
            self.reset()

    def ensure_initialized(self, *, seed_data: bool = True) -> bool:
        """Initialize on first use and report whether a client is available."""

        if self._client is None:
            self.initialize(seed_data=seed_data)
        return self._client is not None

    def get_collection(self, collection_name: str) -> chromadb.Collection | None:
        """Return a collection, creating it when the client is available."""

        if not self.ensure_initialized():
            return None

        if collection_name in self._collections:
            return self._collections[collection_name]

        if self._client is None:
            return None

        collection = self._client.get_or_create_collection(
            name=collection_name,
            metadata=_collection_metadata(collection_name),
            embedding_function=build_embedding_function(),
        )
        self._collections[collection_name] = collection
        return collection

    def search(
        self,
        collection_name: str,
        query_text: str,
        n_results: int = 4,
    ) -> list[SearchResult]:
        """Search a collection and normalize results into SearchResult objects."""

        if not query_text.strip() or n_results <= 0:
            return []

        collection = self.get_collection(collection_name)
        if collection is None:
            return []

        try:
            count = collection.count()
            if count == 0:
                return []

            raw_results = collection.query(
                query_texts=[query_text],
                n_results=min(n_results, count),
                include=["documents", "metadatas", "distances"],
            )
        except Exception:
            return []

        documents = raw_results.get("documents", [[]])[0]
        metadatas = raw_results.get("metadatas", [[]])[0]
        ids = raw_results.get("ids", [[]])[0]
        distances = raw_results.get("distances", [[]])[0]

        results: list[SearchResult] = []
        for index, document in enumerate(documents):
            metadata = metadatas[index] if index < len(metadatas) else {}
            result = SearchResult(
                id=ids[index] if index < len(ids) else None,
                document=document,
                metadata=dict(metadata) if isinstance(metadata, dict) else {},
                score=distances[index] if index < len(distances) else None,
            )
            results.append(result)

        return results

    def upsert_documents(
        self,
        collection_name: str,
        *,
        ids: Sequence[str],
        documents: Sequence[str],
        metadatas: Sequence[Mapping[str, Any]] | None = None,
    ) -> int:
        """Upsert documents into a collection and return the number of processed rows."""

        if len(ids) != len(documents):
            raise ValueError("ids and documents must be the same length")
        if metadatas is not None and len(metadatas) != len(documents):
            raise ValueError("metadatas and documents must be the same length")
        if not documents:
            return 0

        collection = self.get_collection(collection_name)
        if collection is None:
            return 0

        payload: dict[str, Any] = {
            "ids": list(ids),
            "documents": list(documents),
        }
        if metadatas is not None:
            payload["metadatas"] = [dict(metadata) for metadata in metadatas]

        collection.upsert(**payload)
        return len(documents)

    def get_collection_stats(
        self,
        collection_name: str,
        *,
        metadata_keys: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        """Return document count plus metadata distributions for a collection."""

        collection = self.get_collection(collection_name)
        if collection is None:
            return _empty_collection_stats(collection_name, metadata_keys)

        try:
            count = collection.count()
        except Exception:
            return _empty_collection_stats(collection_name, metadata_keys)

        stats: dict[str, Any] = {"count": count}
        if count == 0:
            return _empty_collection_stats(collection_name, metadata_keys)

        keys = tuple(metadata_keys or _collection_stats_keys(collection_name))
        for metadata_key in keys:
            stats[f"{metadata_key}_distribution"] = self._collection_metadata_distribution(
                collection,
                metadata_key,
            )
        return stats

    @staticmethod
    def _collection_metadata_distribution(
        collection: chromadb.Collection,
        metadata_key: str,
    ) -> dict[str, int]:
        """Return the distribution for a metadata key."""

        try:
            result = collection.get(include=["metadatas"])
        except Exception:
            return {}

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


def get_chroma_manager() -> ChromaManager:
    """Return the process-wide Chroma manager singleton."""

    return ChromaManager()


def init_chroma() -> None:
    """Initialize the Chroma client, collections, and in-process seed data."""

    get_chroma_manager().initialize(seed_data=True, force=True)


def get_collection(collection_name: str) -> chromadb.Collection | None:
    """Backward-compatible collection lookup wrapper."""

    return get_chroma_manager().get_collection(collection_name)


def get_job_collection() -> chromadb.Collection | None:
    """Return the job keyword pattern collection if available."""

    return get_collection("job_keyword_patterns")


def get_star_collection() -> chromadb.Collection | None:
    """Return the STAR example collection if available."""

    return get_collection("star_examples")


def get_job_posting_collection() -> chromadb.Collection | None:
    """Return the job posting snippet collection if available."""

    return get_collection("job_posting_snippets")


def get_chroma_mode() -> str | None:
    """Return the initialized Chroma mode."""

    return get_chroma_manager().mode


def search_collection(
    collection_name: str,
    query_text: str,
    n_results: int = 4,
) -> list[dict[str, Any]]:
    """Backward-compatible search wrapper with merged metadata records."""

    return [
        result.to_record()
        for result in get_chroma_manager().search(
            collection_name,
            query_text,
            n_results,
        )
    ]


def get_chroma_health_summary() -> dict[str, Any]:
    """Return collection counts and metadata distributions for /health."""

    manager = get_chroma_manager()
    return {
        "mode": manager.mode or resolve_chroma_mode(),
        "collections": {
            name: manager.get_collection_stats(name)
            for name in COLLECTION_ORDER
        },
    }


def search_job_keyword_pattern_records(
    job_title: str,
    n_results: int = 4,
) -> list[dict[str, Any]]:
    """Return job keyword pattern records with metadata for prompt assembly."""

    return search_collection("job_keyword_patterns", job_title, n_results)


def search_star_example_records(
    activity_text: str,
    n_results: int = 3,
) -> list[dict[str, Any]]:
    """Return STAR example records with metadata for prompt assembly."""

    return search_collection("star_examples", activity_text, n_results)


def search_job_posting_snippet_records(
    query_text: str,
    n_results: int = 3,
) -> list[dict[str, Any]]:
    """Return job posting snippet records with metadata for prompt assembly."""

    return search_collection("job_posting_snippets", query_text, n_results)


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
