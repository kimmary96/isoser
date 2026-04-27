from __future__ import annotations

from typing import Any, Callable, Mapping

try:
    from backend.schemas.programs import ProgramDetailResponse
    from backend.services.program_list_filters import (
        _derive_participation_display,
        _derive_selection_process_label,
        _extract_program_keywords,
        _first_text,
        _infer_display_categories,
        _int_or_none,
        _legacy_program_meta,
        _normalize_text_list,
    )
except ImportError:
    from schemas.programs import ProgramDetailResponse
    from services.program_list_filters import (
        _derive_participation_display,
        _derive_selection_process_label,
        _extract_program_keywords,
        _first_text,
        _infer_display_categories,
        _int_or_none,
        _legacy_program_meta,
        _normalize_text_list,
    )


def _legacy_detail_meta(program: Mapping[str, Any]) -> dict[str, Any]:
    return _legacy_program_meta(program)


def _compact_text_list(*values: Any) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for value in values:
        for item in _normalize_text_list(value):
            if item not in seen:
                seen.add(item)
                items.append(item)
    return items


def _detail_text_list(*values: Any) -> list[str]:
    return _compact_text_list(*values)


def _detail_dict_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _first_int(*values: Any) -> int | None:
    for value in values:
        parsed = _int_or_none(value)
        if parsed is not None:
            return parsed
    return None


def _detail_training_fee(program: Mapping[str, Any], summary_record: Mapping[str, Any], detail_meta: Mapping[str, Any]) -> int | None:
    return _first_int(
        program.get("fee_amount"),
        detail_meta.get("actual_training_cost"),
        detail_meta.get("actualTrainingCost"),
        detail_meta.get("training_fee_total"),
        detail_meta.get("training_fee"),
        summary_record.get("cost"),
    )


def _detail_self_pay_amount(
    program: Mapping[str, Any],
    summary_record: Mapping[str, Any],
    detail_meta: Mapping[str, Any],
    *,
    training_fee: int | None,
) -> int | None:
    explicit_self_pay = _first_int(
        program.get("verified_self_pay_amount"),
        detail_meta.get("self_payment"),
        detail_meta.get("selfPayment"),
        detail_meta.get("out_of_pocket"),
        detail_meta.get("outOfPocket"),
        detail_meta.get("out_of_pocket_amount"),
        detail_meta.get("outOfPocketAmount"),
    )
    if explicit_self_pay is not None:
        return explicit_self_pay

    support_candidate = _first_int(program.get("support_amount"), summary_record.get("subsidy_amount"))
    if support_candidate is None:
        return None
    if training_fee is not None and support_candidate >= training_fee:
        return None
    return support_candidate


def _build_program_detail_schedule_fields(
    program: Mapping[str, Any],
    *,
    resolve_program_deadline: Callable[[dict[str, Any]], str | None],
) -> dict[str, str | None]:
    record = dict(program)
    source = str(record.get("source") or "").casefold()
    is_kstartup = "k-startup" in source or "kstartup" in source
    is_work24 = "고용24" in source or "work24" in source

    application_start_date = _first_text(record.get("application_start_date"), record.get("reg_start_date"))
    application_end_date = _first_text(record.get("application_end_date"), record.get("close_date"), record.get("deadline"))
    program_start_date = _first_text(record.get("program_start_date"), record.get("start_date"))
    program_end_date = _first_text(record.get("program_end_date"), record.get("end_date"))
    if is_kstartup:
        application_start_date = _first_text(record.get("application_start_date"), record.get("start_date"), record.get("reg_start_date"))
        application_end_date = _first_text(record.get("application_end_date"), record.get("end_date"), record.get("deadline"), record.get("close_date"))
        program_start_date = _first_text(record.get("program_start_date"))
        program_end_date = _first_text(record.get("program_end_date"))
    elif is_work24:
        application_start_date = _first_text(record.get("application_start_date"), record.get("reg_start_date"))
        application_end_date = _first_text(record.get("application_end_date"), record.get("close_date"), resolve_program_deadline(record))
        program_start_date = _first_text(record.get("program_start_date"), record.get("start_date"))
        program_end_date = _first_text(record.get("program_end_date"), record.get("end_date"))

    return {
        "application_start_date": application_start_date,
        "application_end_date": application_end_date,
        "program_start_date": program_start_date,
        "program_end_date": program_end_date,
    }


def _format_detail_schedule_text(
    *,
    application_start_date: str | None,
    application_end_date: str | None,
    program_start_date: str | None,
    program_end_date: str | None,
) -> str | None:
    if application_start_date or application_end_date:
        start = application_start_date or "시작일 미정"
        end = application_end_date or "마감일 미정"
        return f"신청 {start} ~ {end}"
    if program_start_date or program_end_date:
        start = program_start_date or "시작일 미정"
        end = program_end_date or "종료일 미정"
        return f"운영 {start} ~ {end}"
    return None


def build_program_detail_response(
    program: dict[str, Any],
    source_record: Mapping[str, Any] | None = None,
    *,
    serialize_program_base_summary: Callable[[Mapping[str, Any]], dict[str, Any]],
    resolve_program_deadline: Callable[[dict[str, Any]], str | None],
) -> ProgramDetailResponse:
    summary_record = serialize_program_base_summary(program)
    detail_meta = _legacy_detail_meta(program)
    source_specific = (
        source_record.get("source_specific")
        if isinstance(source_record, Mapping) and isinstance(source_record.get("source_specific"), dict)
        else {}
    )
    schedule_fields = _build_program_detail_schedule_fields(
        summary_record,
        resolve_program_deadline=resolve_program_deadline,
    )
    application_start_date = schedule_fields["application_start_date"]
    application_end_date = schedule_fields["application_end_date"]
    program_start_date = schedule_fields["program_start_date"]
    program_end_date = schedule_fields["program_end_date"]
    participation_label, participation_time_text = _derive_participation_display(summary_record)
    display_categories = _compact_text_list(
        summary_record.get("display_categories"),
        _infer_display_categories(summary_record),
    )
    extracted_keywords = _compact_text_list(
        summary_record.get("extracted_keywords"),
        _extract_program_keywords(summary_record),
    )

    capacity_total = _first_int(
        program.get("capacity_total"),
        detail_meta.get("capacity_total"),
        detail_meta.get("capacity"),
        detail_meta.get("quota"),
    )
    capacity_current = _first_int(
        program.get("capacity_current"),
        detail_meta.get("capacity_current"),
        detail_meta.get("registered_count"),
        detail_meta.get("current_capacity"),
    )
    capacity_remaining = None
    if capacity_total is not None and capacity_current is not None:
        capacity_remaining = max(0, capacity_total - capacity_current)

    certification_values = _detail_text_list(
        program.get("certifications"),
        source_specific.get("certifications"),
        detail_meta.get("certifications"),
    )
    certification = _first_text(detail_meta.get("certificate"))
    if certification and certification not in certification_values:
        certification_values.append(certification)
    training_fee = _detail_training_fee(program, summary_record, detail_meta)
    self_pay_amount = _detail_self_pay_amount(
        program,
        summary_record,
        detail_meta,
        training_fee=training_fee,
    )

    return ProgramDetailResponse(
        id=summary_record.get("id"),
        title=_first_text(summary_record.get("title")),
        provider=_first_text(program.get("provider_name"), summary_record.get("provider")),
        organizer=_first_text(
            program.get("organizer_name"),
            program.get("sponsor_name"),
            detail_meta.get("supervising_institution"),
            detail_meta.get("department"),
        ),
        source=_first_text(summary_record.get("source"), detail_meta.get("source")),
        category=_first_text(summary_record.get("category"), detail_meta.get("category")),
        category_detail=_first_text(summary_record.get("category_detail"), detail_meta.get("category_detail")),
        display_categories=display_categories,
        ncs_code=_first_text(program.get("ncs_code"), detail_meta.get("ncs_code")),
        ncs_name=_first_text(program.get("ncs_name"), detail_meta.get("ncs_name")),
        location=_first_text(
            program.get("location_text"),
            summary_record.get("location"),
            summary_record.get("region_detail"),
            summary_record.get("region"),
        ),
        description=_first_text(summary_record.get("description"), summary_record.get("summary")),
        deadline=_first_text(summary_record.get("deadline"), application_end_date),
        days_left=_first_int(summary_record.get("days_left")),
        application_start_date=application_start_date,
        application_end_date=application_end_date,
        program_start_date=program_start_date,
        program_end_date=program_end_date,
        teaching_method=_first_text(summary_record.get("teaching_method"), detail_meta.get("teaching_method")),
        participation_time=_first_text(participation_label, summary_record.get("participation_time")),
        participation_time_text=participation_time_text,
        application_method=_first_text(
            program.get("application_method"),
            source_specific.get("application_method"),
            detail_meta.get("application_method"),
            detail_meta.get("apply_method"),
        ),
        selection_process_label=_first_text(
            summary_record.get("selection_process_label"),
            detail_meta.get("selection_process"),
            _derive_selection_process_label(summary_record),
        ),
        cost_type=_first_text(summary_record.get("cost_type"), detail_meta.get("cost_type")),
        support_type=_first_text(
            program.get("business_type"),
            summary_record.get("support_type"),
            detail_meta.get("business_type"),
            detail_meta.get("subsidy_rate"),
        ),
        source_url=_first_text(
            source_record.get("application_url") if isinstance(source_record, Mapping) else None,
            source_record.get("detail_url") if isinstance(source_record, Mapping) else None,
            source_record.get("source_url") if isinstance(source_record, Mapping) else None,
            summary_record.get("application_url"),
            detail_meta.get("application_url"),
            summary_record.get("source_url"),
            summary_record.get("link"),
        ),
        fee=training_fee,
        support_amount=self_pay_amount,
        eligibility=_detail_text_list(
            program.get("eligibility_labels"),
            program.get("target_summary"),
            program.get("target_detail"),
            program.get("target"),
            detail_meta.get("target_group"),
            detail_meta.get("target_detail"),
            detail_meta.get("target_age"),
        ),
        schedule_text=_format_detail_schedule_text(
            application_start_date=application_start_date,
            application_end_date=application_end_date,
            program_start_date=program_start_date,
            program_end_date=program_end_date,
        ),
        rating=summary_record.get("rating_display"),
        rating_raw=summary_record.get("rating_raw"),
        rating_normalized=summary_record.get("rating_normalized"),
        rating_scale=summary_record.get("rating_scale"),
        rating_display=summary_record.get("rating_display"),
        job_placement_rate=_first_text(detail_meta.get("employment_rate_6m"), detail_meta.get("employment_rate_3m")),
        capacity_total=capacity_total,
        capacity_remaining=capacity_remaining,
        manager_name=_first_text(
            source_specific.get("manager_name"),
            detail_meta.get("manager_name"),
            detail_meta.get("department"),
        ),
        phone=_first_text(
            program.get("contact_phone"),
            source_specific.get("contact_phone"),
            detail_meta.get("contact_phone"),
        ),
        email=_first_text(
            program.get("contact_email"),
            source_specific.get("contact_email"),
            detail_meta.get("contact_email"),
            detail_meta.get("application_method_email"),
        ),
        certifications=certification_values,
        tech_stack=_compact_text_list(summary_record.get("skills")),
        tags=_compact_text_list(summary_record.get("tags")),
        extracted_keywords=extracted_keywords,
        curriculum=_detail_text_list(
            program.get("curriculum_items"),
            source_specific.get("curriculum_items"),
            source_specific.get("curriculum"),
            detail_meta.get("curriculum_items"),
            detail_meta.get("curriculum"),
        ),
        faq=_detail_dict_list(source_specific.get("faq")) or _detail_dict_list(detail_meta.get("faq")),
        reviews=_detail_dict_list(source_specific.get("reviews")) or _detail_dict_list(detail_meta.get("reviews")),
        recommended_for=_detail_text_list(
            source_specific.get("recommended_for"),
            detail_meta.get("recommended_for"),
        ),
        learning_outcomes=_detail_text_list(
            source_specific.get("learning_outcomes"),
            detail_meta.get("learning_outcomes"),
        ),
        career_support=_detail_text_list(
            source_specific.get("career_support"),
            detail_meta.get("career_support"),
        ),
        event_banner=_first_text(source_specific.get("event_banner"), detail_meta.get("event_banner")),
        ai_matching_summary=_first_text(
            source_specific.get("ai_matching_summary"),
            detail_meta.get("ai_matching_summary"),
        ),
    )
