from __future__ import annotations

import asyncio
from typing import Any

from scripts import work24_partition_sync
from scripts.work24_partition_sync import (
    REGION_PARTITIONS,
    build_chroma_sync_rows,
    fetch_chroma_db_rows_for_payload,
    ordered_region_partitions,
    quote_postgrest_in_values,
    sync_chroma_rows_at_end,
)


def test_work24_region_partition_order_covers_17_regions_once() -> None:
    codes = [partition.code for partition in REGION_PARTITIONS]

    assert len(codes) == 17
    assert len(set(codes)) == 17
    assert codes[:3] == ["11", "41", "28"]


def test_work24_region_partition_order_skips_seoul_by_default_for_followup_runs() -> None:
    partitions = ordered_region_partitions(include_seoul=False)

    assert [partition.code for partition in partitions[:3]] == ["41", "28", "51"]
    assert "11" not in {partition.code for partition in partitions}


def test_work24_region_partition_order_can_resume_from_code_or_name() -> None:
    by_code = ordered_region_partitions(include_seoul=False, start_from="47")
    by_name = ordered_region_partitions(include_seoul=False, start_from="경북")

    assert [partition.code for partition in by_code[:3]] == ["47", "27", "48"]
    assert by_code == by_name


def test_work24_region_partition_order_can_stop_after_region() -> None:
    partitions = ordered_region_partitions(include_seoul=False, stop_after="대전")

    assert [partition.code for partition in partitions] == ["41", "28", "51", "43", "44", "36", "30"]


def test_build_chroma_sync_rows_deduplicates_by_program_id() -> None:
    rows = [
        {"id": "program-1", "title": "첫 과정", "description": "설명", "ignored": "value"},
        {"id": "program-1", "title": "중복 과정"},
        {"id": "", "title": "id 없는 과정"},
        {"id": "program-2", "title": "둘째 과정", "skills": ["AI"]},
    ]

    chroma_rows = build_chroma_sync_rows(rows)

    assert [row["id"] for row in chroma_rows] == ["program-1", "program-2"]
    assert "ignored" not in chroma_rows[0]
    assert chroma_rows[1]["skills"] == ["AI"]


def test_chroma_sync_at_end_requires_apply_mode(monkeypatch) -> None:
    monkeypatch.setattr(work24_partition_sync, "resolve_chroma_mode", lambda: "persistent")

    result = asyncio.run(
        sync_chroma_rows_at_end(
            [{"id": "program-1", "title": "과정"}],
            apply_mode=False,
            sync_requested=True,
        )
    )

    assert result == {
        "requested": True,
        "chroma_mode": "persistent",
        "candidate_count": 1,
        "status": "skipped",
        "reason": "requires_apply",
    }


def test_chroma_sync_at_end_skips_non_persistent_mode(monkeypatch) -> None:
    monkeypatch.setattr(work24_partition_sync, "resolve_chroma_mode", lambda: "ephemeral")

    result = asyncio.run(
        sync_chroma_rows_at_end(
            [{"id": "program-1", "title": "과정"}],
            apply_mode=True,
            sync_requested=True,
        )
    )

    assert result == {
        "requested": True,
        "chroma_mode": "ephemeral",
        "candidate_count": 1,
        "status": "skipped",
        "reason": "non_persistent_chroma_mode",
    }


def test_chroma_sync_at_end_runs_in_persistent_mode(monkeypatch) -> None:
    captured_rows: list[dict[str, Any]] = []

    async def fake_sync_program_batches(rows: list[dict[str, Any]]) -> tuple[int, int]:
        captured_rows.extend(rows)
        return len(rows), 0

    monkeypatch.setattr(work24_partition_sync, "resolve_chroma_mode", lambda: "persistent")
    monkeypatch.setattr(work24_partition_sync, "_sync_program_batches", fake_sync_program_batches)

    result = asyncio.run(
        sync_chroma_rows_at_end(
            [
                {"id": "program-1", "title": "첫 과정"},
                {"id": "program-1", "title": "중복 과정"},
                {"id": "program-2", "title": "둘째 과정"},
            ],
            apply_mode=True,
            sync_requested=True,
        )
    )

    assert [row["id"] for row in captured_rows] == ["program-1", "program-2"]
    assert result is not None
    assert result["status"] == "completed"
    assert result["candidate_count"] == 2
    assert result["synced_count"] == 2
    assert result["skipped_count"] == 0


def test_quote_postgrest_in_values_quotes_source_unique_keys() -> None:
    assert quote_postgrest_in_values(["work24:A:1:5000", 'key"quoted']) == '"work24:A:1:5000","key\\"quoted"'


def test_fetch_chroma_db_rows_for_payload_uses_source_unique_key(monkeypatch) -> None:
    calls: list[dict[str, Any]] = []

    async def fake_request_supabase(**kwargs: Any) -> list[dict[str, Any]]:
        calls.append(kwargs)
        return [
            {"id": "program-1", "title": "첫 과정", "source_unique_key": "work24:A:1:5000"},
            {"id": "program-2", "title": "둘째 과정", "source_unique_key": "work24:B:1:5000"},
        ]

    monkeypatch.setattr(work24_partition_sync, "request_supabase", fake_request_supabase)

    rows = asyncio.run(
        fetch_chroma_db_rows_for_payload(
            [
                {"source_unique_key": "work24:A:1:5000"},
                {"source_unique_key": "work24:A:1:5000"},
                {"source_unique_key": "work24:B:1:5000"},
                {"source_unique_key": ""},
            ]
        )
    )

    assert [row["id"] for row in rows] == ["program-1", "program-2"]
    assert calls[0]["method"] == "GET"
    assert calls[0]["path"] == "/rest/v1/programs"
    assert calls[0]["params"]["source_unique_key"] == 'in.("work24:A:1:5000","work24:B:1:5000")'
