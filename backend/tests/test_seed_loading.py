from __future__ import annotations

from backend.rag.seed import (
    load_job_keyword_patterns,
    load_job_posting_snippets,
    load_star_examples,
)


def test_job_keyword_patterns_loaded() -> None:
    items, total_count = load_job_keyword_patterns()

    assert total_count >= 50
    assert len(items) >= 50


def test_star_examples_loaded() -> None:
    items, total_count = load_star_examples()

    assert total_count >= 30
    assert len(items) >= 30


def test_job_posting_snippets_loaded() -> None:
    items, total_count = load_job_posting_snippets()

    assert total_count >= 15
    assert len(items) >= 15


def test_no_duplicate_documents() -> None:
    job_items, _ = load_job_keyword_patterns()
    star_items, _ = load_star_examples()

    job_documents = [item.document for item in job_items]
    star_documents = [item.document for item in star_items]

    assert len(job_documents) == len(set(job_documents))
    assert len(star_documents) == len(set(star_documents))


def test_job_bucket_coverage() -> None:
    items, _ = load_job_keyword_patterns()

    assert items
    assert all(item.job_bucket for item in items)


def test_pattern_type_distribution() -> None:
    items, _ = load_job_keyword_patterns()
    pattern_types = {item.pattern_type for item in items}

    assert {
        "result_statement",
        "problem_statement",
        "decision_statement",
        "implementation_statement",
    }.issubset(pattern_types)


def test_activity_type_includes_new() -> None:
    items, _ = load_star_examples()
    activity_types = {item.activity_type for item in items}

    assert "tech_decision" in activity_types
    assert "problem_definition" in activity_types
