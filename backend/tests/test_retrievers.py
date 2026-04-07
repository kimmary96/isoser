from __future__ import annotations

from rag.retrievers import CoachRetriever, normalize_job_title


class FakeCollection:
    def __init__(self, rows, *, fail_query: bool = False):
        self.rows = rows
        self.fail_query = fail_query

    def count(self):
        return len(self.rows)

    def query(self, query_texts, n_results, where=None, include=None):  # noqa: ANN001
        if self.fail_query:
            raise RuntimeError("query unavailable")

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

    def get(self, where=None, include=None):  # noqa: ANN001
        rows = self.rows
        if where:
            rows = [
                row
                for row in rows
                if all(row["metadata"].get(key) == value for key, value in where.items())
            ]
        return {
            "ids": [row["id"] for row in rows],
            "documents": [row["document"] for row in rows],
            "metadatas": [row["metadata"] for row in rows],
        }


def test_normalize_job_title_alias() -> None:
    assert normalize_job_title("Backend Engineer") == "backend_engineer"
    assert normalize_job_title("PM") == "pm"


def test_retrieve_for_coaching_prioritizes_problem_statement_and_bucket() -> None:
    retriever = CoachRetriever(
        job_collection=FakeCollection(
            [
                {
                    "id": "jk:1",
                    "document": "Problem statement example",
                    "distance": 0.10,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "real_posting",
                        "pattern_type": "problem_statement",
                    },
                },
                {
                    "id": "jk:2",
                    "document": "Result statement example",
                    "distance": 0.05,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "real_posting",
                        "pattern_type": "result_statement",
                    },
                },
                {
                    "id": "jk:3",
                    "document": "Other bucket example",
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
        job_title="backend engineer",
        activity_text="Resolved major bottleneck issues.",
        section_type="project",
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
                    "document": "Problem definition example",
                    "distance": 0.20,
                    "metadata": {
                        "job_family": "pm",
                        "section_type": "project",
                        "activity_type": "problem_definition",
                    },
                },
                {
                    "id": "se:2",
                    "document": "Quantification example",
                    "distance": 0.05,
                    "metadata": {
                        "job_family": "pm",
                        "section_type": "work",
                        "activity_type": "quantification",
                    },
                },
            ]
        ),
        posting_collection=FakeCollection([]),
    )

    result = retriever.retrieve_for_coaching(
        job_title="PM",
        activity_text="Improved onboarding flow.",
        section_type="project",
        priority_focus="problem_definition",
    )

    star_examples = result["star_examples"]
    assert star_examples[0]["activity_type"] == "problem_definition"
    assert star_examples[0]["section_type"] == "project"


def test_retrieve_for_coaching_limits_job_posting_top_two() -> None:
    retriever = CoachRetriever(
        job_collection=FakeCollection([]),
        star_collection=FakeCollection([]),
        posting_collection=FakeCollection(
            [
                {
                    "id": "jp:1",
                    "document": "Main duty 1",
                    "distance": 0.05,
                    "metadata": {
                        "job_bucket": "frontend_web",
                        "section_type": "responsibility",
                    },
                },
                {
                    "id": "jp:2",
                    "document": "Main duty 2",
                    "distance": 0.07,
                    "metadata": {
                        "job_bucket": "frontend_web",
                        "section_type": "responsibility",
                    },
                },
                {
                    "id": "jp:3",
                    "document": "Qualification 3",
                    "distance": 0.03,
                    "metadata": {
                        "job_bucket": "frontend_web",
                        "section_type": "qualification",
                    },
                },
            ]
        ),
    )

    result = retriever.retrieve_for_coaching(
        job_title="frontend engineer",
        activity_text="Improved SSR performance.",
        section_type="responsibility",
        priority_focus="quantification",
    )

    snippets = result["job_posting_snippets"]
    assert len(snippets) == 2
    assert all(item["job_bucket"] == "frontend_web" for item in snippets)
    assert snippets[0]["section_type"] == "responsibility"


def test_retrieve_for_coaching_uses_fallback_when_query_fails() -> None:
    retriever = CoachRetriever(
        job_collection=FakeCollection(
            [
                {
                    "id": "jk:f1",
                    "document": "Redis cache applied to improve API latency.",
                    "distance": 0.30,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "legacy_migrated",
                        "pattern_type": "implementation_statement",
                    },
                },
                {
                    "id": "jk:f2",
                    "document": "Monitoring reduced incident response time.",
                    "distance": 0.30,
                    "metadata": {
                        "job_bucket": "backend_infra",
                        "source": "legacy_migrated",
                        "pattern_type": "result_statement",
                    },
                },
            ],
            fail_query=True,
        ),
        star_collection=FakeCollection([], fail_query=True),
        posting_collection=FakeCollection([], fail_query=True),
    )

    result = retriever.retrieve_for_coaching(
        job_title="backend engineer",
        activity_text="Redis based API performance improvement",
        section_type="project",
        priority_focus="problem_definition",
    )

    patterns = result["job_keyword_patterns"]
    assert len(patterns) >= 1
    assert patterns[0]["id"] == "jk:f1"
