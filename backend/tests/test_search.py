from __future__ import annotations

from backend.rag.chroma_client import SearchResult
from backend.rag.retrievers import CoachRetriever


class FakeCollection:
    def __init__(self, rows):
        self.rows = rows

    def count(self):
        return len(self.rows)

    def query(self, query_texts, n_results, where=None, include=None):  # noqa: ANN001
        del query_texts, include
        rows = self.rows
        if where:
            rows = [
                row
                for row in rows
                if all(row["metadata"].get(key) == value for key, value in where.items())
            ]

        rows = rows[:n_results]
        return {
            "ids": [[row["id"] for row in rows]],
            "documents": [[row["document"] for row in rows]],
            "metadatas": [[row["metadata"] for row in rows]],
            "distances": [[row["distance"] for row in rows]],
        }


def test_search_result_format() -> None:
    result = SearchResult(
        id="jk:backend:v1:001",
        document="Redis와 Memcached를 비교해 Redis를 선택했습니다.",
        metadata={
            "source": "real_posting",
            "job_bucket": "backend_infra",
            "pattern_type": "decision_statement",
        },
        score=0.12,
    )

    record = result.to_record()
    assert record["id"] == "jk:backend:v1:001"
    assert record["document"].startswith("Redis")
    assert record["source"] == "real_posting"
    assert record["job_bucket"] == "backend_infra"
    assert record["pattern_type"] == "decision_statement"
    assert record["score"] == 0.12


def test_search_respects_metadata_filter() -> None:
    retriever = CoachRetriever(
        job_collection=FakeCollection(
            [
                {
                    "id": "jk:1",
                    "document": "백엔드 성과 문장",
                    "distance": 0.1,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "real_posting",
                        "pattern_type": "result_statement",
                    },
                },
                {
                    "id": "jk:2",
                    "document": "마케팅 성과 문장",
                    "distance": 0.01,
                    "metadata": {
                        "job_bucket": "growth_marketing",
                        "source": "real_posting",
                        "pattern_type": "result_statement",
                    },
                },
            ]
        ),
        star_collection=FakeCollection([]),
        posting_collection=FakeCollection([]),
    )

    result = retriever.retrieve_for_coaching(
        job_title="백엔드 개발자",
        activity_text="응답속도를 개선했습니다.",
        section_type="프로젝트",
        priority_focus="quantification",
    )

    assert len(result["job_keyword_patterns"]) == 1
    assert result["job_keyword_patterns"][0]["job_bucket"] == "backend_infra"


def test_search_prioritizes_pattern_type_filter() -> None:
    retriever = CoachRetriever(
        job_collection=FakeCollection(
            [
                {
                    "id": "jk:1",
                    "document": "성과 문장",
                    "distance": 0.05,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "real_posting",
                        "pattern_type": "result_statement",
                    },
                },
                {
                    "id": "jk:2",
                    "document": "문제 정의 문장",
                    "distance": 0.12,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "real_posting",
                        "pattern_type": "problem_statement",
                    },
                },
            ]
        ),
        star_collection=FakeCollection([]),
        posting_collection=FakeCollection([]),
    )

    result = retriever.retrieve_for_coaching(
        job_title="백엔드 개발자",
        activity_text="세션 기반 인증에서 확장성 문제가 있었습니다.",
        section_type="프로젝트",
        priority_focus="problem_definition",
    )

    assert result["job_keyword_patterns"][0]["pattern_type"] == "problem_statement"
