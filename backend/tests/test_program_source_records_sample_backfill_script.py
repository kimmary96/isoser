import asyncio

from scripts import backfill_program_source_records


def test_source_records_sample_backfill_script_calls_rpc(monkeypatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append((function_name, payload))
        if function_name != "backfill_program_source_records_sample":
            raise AssertionError(f"unexpected rpc: {function_name}")
        return {
            "batch_limit": 50,
            "max_rows": 50,
            "selected_candidate_rows": 50,
            "candidate_rows_from_program_list_index": 50,
            "candidate_rows_from_programs": 0,
            "upserted_rows": 50,
            "linked_program_rows": 50,
            "trimmed_program_links": 0,
            "trimmed_rows": 0,
            "remaining_rows": 50,
            "remaining_linked_programs": 50,
        }

    monkeypatch.setattr(backfill_program_source_records, "_call_rpc", fake_call_rpc)

    report = asyncio.run(
        backfill_program_source_records.backfill_sample(
            batch_limit=50,
            max_rows=50,
        )
    )

    assert calls == [
        (
            "backfill_program_source_records_sample",
            {
                "batch_limit": 50,
                "max_rows": 50,
            },
        )
    ]
    assert report["status"] == "sample_backfill"
    assert report["affected_rows"] == 50
    assert report["sample_result"]["linked_program_rows"] == 50
    assert report["attempt_count"] == 1
    assert report["used_fallback_batch"] is False


def test_source_records_sample_backfill_script_parses_stringified_json(monkeypatch) -> None:
    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        assert function_name == "backfill_program_source_records_sample"
        return '{"remaining_rows": 50, "upserted_rows": 50, "linked_program_rows": 50}'

    monkeypatch.setattr(backfill_program_source_records, "_call_rpc", fake_call_rpc)

    report = asyncio.run(
        backfill_program_source_records.backfill_sample(
            batch_limit=50,
            max_rows=50,
        )
    )

    assert report["status"] == "sample_backfill"
    assert report["affected_rows"] == 50
    assert report["sample_result"]["upserted_rows"] == 50


def test_source_records_sample_backfill_script_retries_with_smaller_batch_on_timeout(monkeypatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append((function_name, payload))
        if len(calls) == 1:
            raise RuntimeError("Supabase request failed: canceling statement due to statement timeout")
        return {
            "remaining_rows": payload["max_rows"],
            "upserted_rows": payload["batch_limit"],
            "linked_program_rows": payload["batch_limit"],
        }

    monkeypatch.setattr(backfill_program_source_records, "_call_rpc", fake_call_rpc)

    report = asyncio.run(
        backfill_program_source_records.backfill_sample(
            batch_limit=50,
            max_rows=50,
            min_batch_limit=10,
        )
    )

    assert calls == [
        ("backfill_program_source_records_sample", {"batch_limit": 50, "max_rows": 50}),
        ("backfill_program_source_records_sample", {"batch_limit": 25, "max_rows": 25}),
    ]
    assert report["status"] == "sample_backfill"
    assert report["attempt_count"] == 2
    assert report["used_fallback_batch"] is True
    assert report["effective_batch_limit"] == 25
    assert report["effective_max_rows"] == 25
    assert report["affected_rows"] == 25


def test_source_records_sample_backfill_script_reports_failure(monkeypatch) -> None:
    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        raise RuntimeError("lock not available")

    monkeypatch.setattr(backfill_program_source_records, "_call_rpc", fake_call_rpc)

    report = asyncio.run(
        backfill_program_source_records.backfill_sample(
            batch_limit=50,
            max_rows=50,
        )
    )

    assert report["status"] == "failed"
    assert report["error"] == "lock not available"
    assert len(report["stages"]) >= 1
