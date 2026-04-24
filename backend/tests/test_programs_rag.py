from __future__ import annotations

from rag import programs_rag


def test_resolve_recruitment_deadline_prefers_service_meta_over_compare_meta() -> None:
    deadline = programs_rag._resolve_recruitment_deadline(
        {
            "service_meta": {"application_end_date": "2026-05-01"},
            "compare_meta": {"application_end_date": "2026-04-01"},
        }
    )

    assert deadline == "2026-05-01"


def test_resolve_recruitment_deadline_trusts_training_start_marker_from_service_meta() -> None:
    deadline = programs_rag._resolve_recruitment_deadline(
        {
            "source": "고용24",
            "deadline": "2026-05-01",
            "end_date": "2026-05-01",
            "service_meta": {"deadline_source": "traStartDate"},
            "compare_meta": {},
        }
    )

    assert deadline == "2026-05-01"
