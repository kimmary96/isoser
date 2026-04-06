from __future__ import annotations

from typing import Any

import pytest

from backend.rag.chroma_client import (
    COLLECTION_ORDER,
    SearchResult,
    get_chroma_manager,
    get_collection,
    search_collection,
)


class FakeCollection:
    def __init__(self) -> None:
        self.documents: list[str] = []
        self.ids: list[str] = []
        self.metadatas: list[dict[str, Any]] = []

    def count(self) -> int:
        return len(self.documents)

    def upsert(
        self,
        *,
        ids: list[str],
        documents: list[str],
        metadatas: list[dict[str, Any]] | None = None,
    ) -> None:
        normalized_metadatas = metadatas or [{} for _ in documents]

        for item_id, document, metadata in zip(ids, documents, normalized_metadatas, strict=True):
            if item_id in self.ids:
                index = self.ids.index(item_id)
                self.documents[index] = document
                self.metadatas[index] = dict(metadata)
                continue

            self.ids.append(item_id)
            self.documents.append(document)
            self.metadatas.append(dict(metadata))

    def query(self, *, query_texts, n_results: int, include) -> dict[str, list[list[Any]]]:  # noqa: ANN001
        del query_texts, include
        documents = self.documents[:n_results]
        ids = self.ids[:n_results]
        metadatas = self.metadatas[:n_results]
        distances = [round(index * 0.1, 2) for index in range(len(documents))]

        return {
            "documents": [documents],
            "ids": [ids],
            "metadatas": [metadatas],
            "distances": [distances],
        }

    def get(self, include) -> dict[str, list[dict[str, Any]]]:  # noqa: ANN001
        return {"metadatas": self.metadatas}


class FakeClient:
    def __init__(self) -> None:
        self.collections = {
            name: FakeCollection()
            for name in COLLECTION_ORDER
        }

    def get_or_create_collection(self, *, name: str, metadata) -> FakeCollection:  # noqa: ANN001
        del metadata
        return self.collections.setdefault(name, FakeCollection())


@pytest.fixture(autouse=True)
def isolate_chroma_manager() -> None:
    manager = get_chroma_manager()
    manager.reset()
    yield
    manager.reset()


def _attach_fake_client() -> FakeClient:
    fake_client = FakeClient()
    manager = get_chroma_manager()
    manager._client = fake_client
    manager._collections = fake_client.collections
    manager._chroma_mode = "ephemeral"
    return fake_client


def test_search_result_exposes_metadata_properties() -> None:
    result = SearchResult(
        id="doc-1",
        document="Redis decision rationale",
        metadata={
            "source": "wanted",
            "job_bucket": "backend",
            "pattern_type": "decision_statement",
        },
        score=0.07,
    )

    assert result.source == "wanted"
    assert result.job_bucket == "backend"
    assert result.pattern_type == "decision_statement"
    assert result.to_record()["score"] == 0.07


def test_search_collection_wrapper_returns_legacy_record_shape() -> None:
    fake_client = _attach_fake_client()
    fake_client.collections["job_keyword_patterns"].upsert(
        ids=["pattern-1"],
        documents=["Redis and Memcached were compared before choosing Redis."],
        metadatas=[
            {
                "source": "seed",
                "job_bucket": "backend",
                "pattern_type": "decision_statement",
            }
        ],
    )

    collection = get_collection("job_keyword_patterns")
    results = search_collection("job_keyword_patterns", "Redis", 3)

    assert collection is fake_client.collections["job_keyword_patterns"]
    assert len(results) == 1
    assert results[0]["document"].startswith("Redis and Memcached")
    assert results[0]["job_bucket"] == "backend"
    assert results[0]["pattern_type"] == "decision_statement"
    assert results[0]["score"] == 0.0


def test_upsert_documents_and_collection_stats() -> None:
    _attach_fake_client()
    manager = get_chroma_manager()

    inserted = manager.upsert_documents(
        "job_posting_snippets",
        ids=["posting-1", "posting-2"],
        documents=[
            "Operate a stable backend platform.",
            "Improve batch throughput and observability.",
        ],
        metadatas=[
            {"source": "wanted", "section_type": "responsibility"},
            {"source": "work24", "section_type": "qualification"},
        ],
    )
    stats = manager.get_collection_stats("job_posting_snippets")

    assert inserted == 2
    assert stats["count"] == 2
    assert stats["source_distribution"] == {"wanted": 1, "work24": 1}
    assert stats["section_type_distribution"] == {
        "qualification": 1,
        "responsibility": 1,
    }
