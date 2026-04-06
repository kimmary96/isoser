from __future__ import annotations

from rag.retrievers import CoachRetriever, normalize_job_title


class FakeCollection:
    def __init__(self, rows):
        self.rows = rows

    def count(self):
        return len(self.rows)

    def query(self, query_texts, n_results, where=None, include=None):  # noqa: ANN001
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


def test_normalize_job_title_alias() -> None:
    assert normalize_job_title("Backend Engineer") == "backend_engineer"
    assert normalize_job_title("서비스 기획자") == "pm"


def test_retrieve_for_coaching_prioritizes_problem_statement_and_bucket() -> None:
    retriever = CoachRetriever(
        job_collection=FakeCollection(
            [
                {
                    "id": "jk:1",
                    "document": "문제 정의 문장",
                    "distance": 0.10,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "real_posting",
                        "pattern_type": "problem_statement",
                    },
                },
                {
                    "id": "jk:2",
                    "document": "성과 문장",
                    "distance": 0.05,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "real_posting",
                        "pattern_type": "result_statement",
                    },
                },
                {
                    "id": "jk:3",
                    "document": "다른 버킷 문장",
                    "distance": 0.01,
                    "metadata": {
                        "job_bucket": "product_management",
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
        activity_text="병목 문제를 해결했습니다.",
        section_type="프로젝트",
        priority_focus="problem_definition",
    )

    job_patterns = result["job_keyword_patterns"]
    assert len(job_patterns) == 2
    assert all(item["job_bucket"] == "backend_infra" for item in job_patterns)
    assert job_patterns[0]["pattern_type"] == "problem_statement"


def test_retrieve_for_coaching_filters_star_examples_by_section_and_activity() -> None:
    retriever = CoachRetriever(
        job_collection=FakeCollection([]),
        star_collection=FakeCollection(
            [
                {
                    "id": "se:1",
                    "document": "문제 정의 예시",
                    "distance": 0.20,
                    "metadata": {
                        "job_family": "pm",
                        "section_type": "프로젝트",
                        "activity_type": "problem_definition",
                    },
                },
                {
                    "id": "se:2",
                    "document": "성과 예시",
                    "distance": 0.05,
                    "metadata": {
                        "job_family": "pm",
                        "section_type": "회사경력",
                        "activity_type": "quantification",
                    },
                },
            ]
        ),
        posting_collection=FakeCollection([]),
    )

    result = retriever.retrieve_for_coaching(
        job_title="PM",
        activity_text="온보딩을 개선했습니다.",
        section_type="프로젝트",
        priority_focus="problem_definition",
    )

    star_examples = result["star_examples"]
    assert star_examples[0]["activity_type"] == "problem_definition"
    assert star_examples[0]["section_type"] == "프로젝트"


def test_retrieve_for_coaching_limits_job_posting_top_two() -> None:
    retriever = CoachRetriever(
        job_collection=FakeCollection([]),
        star_collection=FakeCollection([]),
        posting_collection=FakeCollection(
            [
                {
                    "id": "jp:1",
                    "document": "주요업무 1",
                    "distance": 0.05,
                    "metadata": {
                        "job_bucket": "frontend_web",
                        "section_type": "주요업무",
                    },
                },
                {
                    "id": "jp:2",
                    "document": "주요업무 2",
                    "distance": 0.07,
                    "metadata": {
                        "job_bucket": "frontend_web",
                        "section_type": "주요업무",
                    },
                },
                {
                    "id": "jp:3",
                    "document": "자격요건 3",
                    "distance": 0.03,
                    "metadata": {
                        "job_bucket": "frontend_web",
                        "section_type": "자격요건",
                    },
                },
            ]
        ),
    )

    result = retriever.retrieve_for_coaching(
        job_title="프론트엔드 개발자",
        activity_text="SSR 성능을 개선했습니다.",
        section_type="주요업무",
        priority_focus="quantification",
    )

    snippets = result["job_posting_snippets"]
    assert len(snippets) == 2
    assert all(item["job_bucket"] == "frontend_web" for item in snippets)
    assert snippets[0]["section_type"] == "주요업무"
