from __future__ import annotations

import hashlib
from datetime import date, datetime
import re
from typing import Any

_MISSING_COLUMN_PATTERN = re.compile(r"Could not find the '([^']+)' column", flags=re.IGNORECASE)


def clean_text(value: Any) -> str | None:
    normalized = str(value or "").strip()
    return normalized or None


def clean_text_list(value: Any) -> list[str] | None:
    if value in (None, "", [], ()):
        return None

    source_items = value if isinstance(value, list) else [value]
    items: list[str] = []
    seen: set[str] = set()
    for item in source_items:
        text = clean_text(item)
        if not text or text in seen:
            continue
        seen.add(text)
        items.append(text)
    return items or None


def pick_first_text(*values: Any) -> str | None:
    for value in values:
        normalized = clean_text(value)
        if normalized:
            return normalized
    return None


def parse_date_text(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()

    raw = str(value).strip().replace("/", "-").replace(".", "-")
    compact_match = re.search(r"\b(\d{4})(\d{2})(\d{2})\b", raw)
    if compact_match:
        try:
            return datetime(
                int(compact_match.group(1)),
                int(compact_match.group(2)),
                int(compact_match.group(3)),
            ).strftime("%Y-%m-%d")
        except ValueError:
            return None

    match = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", raw)
    if match:
        try:
            return datetime(
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
            ).strftime("%Y-%m-%d")
        except ValueError:
            return None
    return None


def parse_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    text = re.sub(r"[^\d-]", "", str(value))
    if not text or text == "-":
        return None
    try:
        return int(text)
    except ValueError:
        return None


def normalize_rating_value(value: Any) -> float | None:
    raw = clean_text(value)
    if not raw:
        return None
    match = re.search(r"(?<![\d.])\d+(?:\.\d+)?(?![\d.])", raw.replace(",", ""))
    if not match:
        return None
    try:
        score = float(match.group(0))
    except ValueError:
        return None
    if score <= 0 or score > 100:
        return None
    if score <= 5:
        return round(score, 2)
    return round(score / 20.0, 2)


def program_source_code_from_label(source_label: str | None) -> str:
    raw_label = str(source_label or "").strip()
    normalized = re.sub(r"\s+", "", raw_label).lower()
    if not normalized:
        return "unknown"

    if normalized in {"고용24", "work24", "hrdnet", "hrd-net"} or "고용24" in normalized or "work24" in normalized:
        return "work24"
    if "k-startup" in normalized or "kstartup" in normalized or "startup" in normalized:
        return "kstartup"
    if "sesac" in normalized:
        return "sesac"
    if "fastcampus" in normalized or "패스트캠퍼스" in normalized:
        return "fastcampus"

    slug = re.sub(r"[^a-z0-9가-힣]+", "-", raw_label.lower())
    slug = re.sub(r"(^-+|-+$)", "", slug)
    return slug or "unknown"


def program_source_family(source_code: str) -> str | None:
    return source_code if source_code in {"work24", "kstartup", "sesac", "fastcampus"} else None


def missing_program_column_name(detail: Any) -> str | None:
    text = str(getattr(detail, "detail", detail) or "")
    match = _MISSING_COLUMN_PATTERN.search(text)
    if not match:
        return None
    return clean_text(match.group(1))


def is_missing_schema_error(detail: Any, resource_name: str) -> bool:
    text = str(getattr(detail, "detail", detail) or "").lower()
    resource = resource_name.lower()
    return resource in text and (
        "does not exist" in text
        or "schema cache" in text
        or "column" in text
        or "on conflict" in text
        or "constraint" in text
    )


def _compare_meta(source_row: dict[str, Any]) -> dict[str, Any]:
    value = source_row.get("compare_meta")
    return value if isinstance(value, dict) else {}


def _detail_url_from_source_row(source_row: dict[str, Any], application_url: str | None, source_url: str | None) -> str | None:
    link = clean_text(source_row.get("link"))
    if link and link != application_url:
        return link
    return source_url


def _service_meta(source_row: dict[str, Any]) -> dict[str, Any] | None:
    compare_meta = _compare_meta(source_row)
    service_meta = {
        str(key): value
        for key, value in compare_meta.items()
        if key != "field_sources" and value not in (None, "", [], {})
    }
    return service_meta or None


def _uses_training_start_deadline(compare_meta: dict[str, Any], application_end_date: str | None) -> bool:
    markers = [
        compare_meta.get("deadline_source"),
        compare_meta.get("application_deadline_source"),
        compare_meta.get("recruitment_deadline_source"),
    ]
    for marker in markers:
        normalized = str(marker or "").replace("_", "").replace("-", "").casefold()
        if normalized in {"trastartdate", "trainingstartdate", "trainingstart"}:
            return True

    training_start = parse_date_text(compare_meta.get("training_start_date"))
    return bool(training_start and application_end_date and training_start == application_end_date)


def _eligibility_labels(source_row: dict[str, Any]) -> list[str] | None:
    compare_meta = _compare_meta(source_row)
    values: list[str] = []
    target_summary = clean_text_list(source_row.get("target")) or []
    values.extend(target_summary)
    for candidate in (
        compare_meta.get("target_group"),
        compare_meta.get("target_detail"),
        compare_meta.get("age_restriction"),
        compare_meta.get("education_requirement"),
        compare_meta.get("employment_restriction"),
        compare_meta.get("experience_requirement"),
    ):
        normalized = clean_text(candidate)
        if normalized:
            values.append(normalized)
    return clean_text_list(values)


def _curriculum_items(source_row: dict[str, Any]) -> list[str] | None:
    compare_meta = _compare_meta(source_row)
    for key in ("curriculum_items", "curriculum"):
        value = compare_meta.get(key)
        if isinstance(value, list):
            cleaned = clean_text_list(value)
            if cleaned:
                return cleaned
    return clean_text_list(
        [
            compare_meta.get("course_content"),
            compare_meta.get("training_content"),
            compare_meta.get("education_content"),
        ]
    )


def _certifications(source_row: dict[str, Any]) -> list[str] | None:
    compare_meta = _compare_meta(source_row)
    value = compare_meta.get("certifications")
    if isinstance(value, list):
        cleaned = clean_text_list(value)
        if cleaned:
            return cleaned
    return clean_text_list([compare_meta.get("certificate")])


def build_program_additive_fields(source_row: dict[str, Any]) -> dict[str, Any]:
    compare_meta = _compare_meta(source_row)
    source_label = clean_text(source_row.get("source")) or "미분류"
    source_code = program_source_code_from_label(source_label)
    application_url = pick_first_text(source_row.get("application_url"), compare_meta.get("application_url"))
    source_url = clean_text(source_row.get("source_url"))
    detail_url = _detail_url_from_source_row(source_row, application_url, source_url)
    application_end_date = parse_date_text(
        pick_first_text(
            source_row.get("deadline"),
            compare_meta.get("application_deadline"),
            compare_meta.get("recruitment_deadline"),
            compare_meta.get("application_end_date"),
            compare_meta.get("recruitment_end_date"),
        )
    )
    target_summary = clean_text_list(source_row.get("target"))
    target_detail = pick_first_text(
        compare_meta.get("target"),
        compare_meta.get("trainTarget"),
        compare_meta.get("target_detail"),
        ", ".join(target_summary) if target_summary else None,
    )
    deadline_confidence = "low"
    if application_end_date:
        deadline_confidence = "medium" if _uses_training_start_deadline(compare_meta, application_end_date) else "high"

    fields = {
        "primary_source_code": source_code,
        "primary_source_label": source_label,
        "provider_name": pick_first_text(source_row.get("provider"), compare_meta.get("provider_name")),
        "organizer_name": pick_first_text(
            source_row.get("sponsor_name"),
            compare_meta.get("training_institution"),
            compare_meta.get("supervising_institution"),
            compare_meta.get("organization"),
            compare_meta.get("department"),
            source_row.get("provider"),
        ),
        "summary_text": pick_first_text(source_row.get("summary"), source_row.get("description"), source_row.get("provider"), source_row.get("title")),
        "business_type": pick_first_text(source_row.get("support_type"), compare_meta.get("business_type")),
        "location_text": pick_first_text(
            source_row.get("location"),
            compare_meta.get("location"),
            compare_meta.get("address"),
            source_row.get("region_detail"),
            source_row.get("region"),
        ),
        "application_start_date": parse_date_text(
            pick_first_text(
                compare_meta.get("application_start_date"),
                compare_meta.get("recruitment_start_date"),
                compare_meta.get("registration_start_date"),
            )
        ),
        "application_end_date": application_end_date,
        "program_start_date": parse_date_text(source_row.get("start_date")),
        "program_end_date": parse_date_text(source_row.get("end_date")),
        "deadline_confidence": deadline_confidence,
        "detail_url": detail_url,
        "fee_amount": parse_int(source_row.get("cost")),
        "support_amount": parse_int(source_row.get("subsidy_amount")),
        "target_summary": target_summary,
        "target_detail": target_detail,
        "eligibility_labels": _eligibility_labels(source_row),
        "selection_process_label": pick_first_text(compare_meta.get("selection_process"), compare_meta.get("selection_method")),
        "contact_phone": pick_first_text(compare_meta.get("contact_phone"), compare_meta.get("phone"), compare_meta.get("manager_phone")),
        "contact_email": pick_first_text(
            compare_meta.get("contact_email"),
            compare_meta.get("email"),
            compare_meta.get("manager_email"),
            compare_meta.get("application_method_email"),
        ),
        "capacity_total": parse_int(pick_first_text(compare_meta.get("capacity_total"), compare_meta.get("capacity"), compare_meta.get("quota"))),
        "capacity_current": parse_int(
            pick_first_text(compare_meta.get("capacity_current"), compare_meta.get("remaining_capacity"), compare_meta.get("current_capacity"))
        ),
        "rating_value": normalize_rating_value(pick_first_text(compare_meta.get("satisfaction_score"), compare_meta.get("rating"))),
        "curriculum_items": _curriculum_items(source_row),
        "certifications": _certifications(source_row),
        "service_meta": _service_meta(source_row),
    }
    return {key: value for key, value in fields.items() if value not in (None, "", [], {})}


def merge_program_dual_write_fields(source_row: dict[str, Any]) -> dict[str, Any]:
    merged = dict(source_row)
    merged.update(build_program_additive_fields(source_row))
    return merged


def _program_source_record_key(
    source_row: dict[str, Any],
    *,
    program_id: str,
    source_url: str | None,
    application_url: str | None,
) -> str:
    for candidate in (
        source_row.get("source_unique_key"),
        source_row.get("hrd_id"),
        source_url,
        application_url,
    ):
        cleaned = clean_text(candidate)
        if cleaned:
            return cleaned

    fingerprint = "||".join(
        [
            program_id,
            clean_text(source_row.get("title")) or "",
            clean_text(source_row.get("source")) or "",
            clean_text(source_row.get("provider")) or "",
            source_url or "",
            application_url or "",
        ]
    )
    return hashlib.md5(fingerprint.encode("utf-8"), usedforsecurity=False).hexdigest()


def build_program_source_record_row(program_row: dict[str, Any], source_row: dict[str, Any]) -> dict[str, Any] | None:
    program_id = clean_text(program_row.get("id"))
    if not program_id:
        return None

    compare_meta = _compare_meta(source_row)
    raw_payload = source_row.get("raw_data") if isinstance(source_row.get("raw_data"), dict) else {}
    field_evidence = compare_meta.get("field_sources") if isinstance(compare_meta.get("field_sources"), dict) else {}
    source_label = clean_text(source_row.get("source")) or clean_text(program_row.get("source")) or "미분류"
    source_code = program_source_code_from_label(source_label)
    application_url = pick_first_text(source_row.get("application_url"), compare_meta.get("application_url"))
    source_url = clean_text(source_row.get("source_url"))
    detail_url = _detail_url_from_source_row(source_row, application_url, source_url)
    source_specific = _service_meta(source_row) or {}
    if detail_url:
        source_specific["legacy_link"] = detail_url
    if clean_text(source_row.get("source_unique_key")):
        source_specific["legacy_source_unique_key"] = clean_text(source_row.get("source_unique_key"))
    if clean_text(source_row.get("hrd_id")):
        source_specific["legacy_hrd_id"] = clean_text(source_row.get("hrd_id"))

    return {
        "program_id": program_id,
        "source_code": source_code,
        "source_label": source_label,
        "source_family": program_source_family(source_code),
        "source_record_key": _program_source_record_key(
            source_row,
            program_id=program_id,
            source_url=source_url,
            application_url=application_url,
        ),
        "external_program_id": clean_text(source_row.get("hrd_id")),
        "source_url": source_url,
        "detail_url": detail_url,
        "application_url": application_url,
        "collect_method": pick_first_text(source_row.get("collection_method"), "dual-write"),
        "raw_payload": raw_payload,
        "normalized_snapshot": {
            "program_id": program_id,
            "title": clean_text(source_row.get("title")),
            "provider": clean_text(source_row.get("provider")),
            "category": clean_text(source_row.get("category")),
            "location": clean_text(source_row.get("location")),
            "region": clean_text(source_row.get("region")),
            "region_detail": clean_text(source_row.get("region_detail")),
            "start_date": parse_date_text(source_row.get("start_date")),
            "end_date": parse_date_text(source_row.get("end_date")),
            "deadline": parse_date_text(source_row.get("deadline")),
            "application_url": application_url,
            "source_url": source_url,
        },
        "field_evidence": field_evidence,
        "source_specific": source_specific,
        "is_primary": True,
    }


def build_program_source_record_rows(program_rows: list[dict[str, Any]], source_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_source_unique_key: dict[str, dict[str, Any]] = {}
    by_hrd_id: dict[str, dict[str, Any]] = {}
    by_title_source: dict[tuple[str, str], dict[str, Any]] = {}

    for row in program_rows:
        source_unique_key = clean_text(row.get("source_unique_key"))
        hrd_id = clean_text(row.get("hrd_id"))
        title = clean_text(row.get("title"))
        source = clean_text(row.get("source"))
        if source_unique_key:
            by_source_unique_key[source_unique_key] = row
        if hrd_id:
            by_hrd_id[hrd_id] = row
        if title and source:
            by_title_source[(title, source)] = row

    deduped_rows: dict[tuple[str, str], dict[str, Any]] = {}
    for source_row in source_rows:
        match = None
        source_unique_key = clean_text(source_row.get("source_unique_key"))
        hrd_id = clean_text(source_row.get("hrd_id"))
        title = clean_text(source_row.get("title"))
        source = clean_text(source_row.get("source"))
        if source_unique_key:
            match = by_source_unique_key.get(source_unique_key)
        if match is None and hrd_id:
            match = by_hrd_id.get(hrd_id)
        if match is None and title and source:
            match = by_title_source.get((title, source))
        if match is None:
            continue

        record_row = build_program_source_record_row(match, source_row)
        if record_row is None:
            continue
        deduped_rows[(record_row["source_code"], record_row["source_record_key"])] = record_row

    return list(deduped_rows.values())
