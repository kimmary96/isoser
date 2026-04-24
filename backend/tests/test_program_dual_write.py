from __future__ import annotations

from services import program_dual_write


def test_build_program_source_record_row_curates_source_specific_payload() -> None:
    row = program_dual_write.build_program_source_record_row(
        {"id": "program-1", "source": "고용24"},
        {
            "source": "고용24",
            "title": "훈련 과정",
            "source_url": "https://example.com/source",
            "link": "https://example.com/detail",
            "compare_meta": {
                "training_type": "국가기간전략산업직종",
                "contact_phone": "02-1111-1111",
                "application_deadline": "2026-04-20",
                "field_sources": {"deadline": "traStartDate"},
            },
        },
    )

    assert row is not None
    assert row["field_evidence"] == {"deadline": "traStartDate"}
    assert row["source_specific"]["contact_phone"] == "02-1111-1111"
    assert row["source_specific"]["legacy_link"] == "https://example.com/detail"
    assert "training_type" not in row["source_specific"]
    assert "application_deadline" not in row["source_specific"]


def test_build_program_additive_fields_prefers_service_meta_for_deadline_markers() -> None:
    fields = program_dual_write.build_program_additive_fields(
        {
            "source": "고용24",
            "start_date": "2026-04-20",
            "end_date": "2026-05-20",
            "deadline": "2026-04-20",
            "compare_meta": {
                "application_deadline": "2026-05-20",
                "deadline_source": "otherDeadline",
            },
            "service_meta": {
                "application_deadline": "2026-04-20",
                "deadline_source": "traStartDate",
            },
        }
    )

    assert fields["application_end_date"] == "2026-04-20"
    assert fields["deadline_confidence"] == "medium"
