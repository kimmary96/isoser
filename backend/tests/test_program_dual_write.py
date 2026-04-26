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


def test_build_program_additive_fields_keeps_kstartup_application_dates_separate_from_program_dates() -> None:
    fields = program_dual_write.build_program_additive_fields(
        {
            "source": "K-Startup 창업진흥원",
            "title": "스케일업 아카데미",
            "start_date": "2026-04-13",
            "end_date": "2026-04-26",
            "deadline": "2026-04-26",
            "compare_meta": {
                "application_url": "https://example.com/program/233",
                "program_start_date": "2026-04-29",
                "program_end_date": "2026-04-29",
                "schedule_text": "2026-04-29 ~ 2026-04-29 / 14:00 ~ 15:30",
                "application_end_date": "2026-04-27",
            },
        }
    )

    assert fields["application_start_date"] == "2026-04-13"
    assert fields["application_end_date"] == "2026-04-27"
    assert fields["program_start_date"] == "2026-04-29"
    assert fields["program_end_date"] == "2026-04-29"


def test_merge_program_dual_write_fields_enriches_work24_out_of_pocket_from_detail(monkeypatch) -> None:
    def fake_fetch_work24_detail_fields(*, source_url: str, title: str) -> dict[str, object]:
        assert source_url == "https://www.work24.go.kr/hr/detail"
        assert title == "스케치업 과정"
        return {
            "cost": 265980,
            "subsidy_amount": 93100,
            "deadline": "2026-05-01",
            "compare_meta": {
                "self_payment": 93100,
                "out_of_pocket": 93100,
                "training_fee_total": 265980,
            },
        }

    monkeypatch.setattr(program_dual_write, "fetch_work24_detail_fields", fake_fetch_work24_detail_fields)

    row = program_dual_write.merge_program_dual_write_fields(
        {
            "source": "고용24",
            "title": "스케치업 과정",
            "source_url": "https://www.work24.go.kr/hr/detail",
            "cost": 265980,
            "subsidy_amount": 265980,
            "start_date": "2026-05-01",
            "end_date": "2026-07-01",
            "compare_meta": {
                "application_deadline": "2026-05-01",
            },
        }
    )

    assert row["support_amount"] == 93100
    assert row["subsidy_amount"] == 93100
    assert row["compare_meta"]["self_payment"] == 93100
    assert row["compare_meta"]["out_of_pocket"] == 93100
