import asyncio
from argparse import Namespace
from pathlib import Path

from scripts import refresh_program_validation_sample


def test_validation_sample_script_runs_read_model_then_source_records(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_refresh(*args, **kwargs):
        calls.append("read_model")
        return {
            "status": "sample_refresh",
            "affected_rows": 50,
            "sample_result": {"remaining_rows": 50},
        }

    async def fake_backfill(*args, **kwargs):
        calls.append("source_records")
        return {
            "status": "sample_backfill",
            "affected_rows": 50,
            "attempt_count": 1,
            "used_fallback_batch": False,
            "sample_result": {"remaining_rows": 50, "remaining_linked_programs": 50},
        }

    monkeypatch.setattr(refresh_program_validation_sample.refresh_program_list_index, "refresh", fake_refresh)
    monkeypatch.setattr(refresh_program_validation_sample.backfill_program_source_records, "backfill_sample", fake_backfill)

    report = asyncio.run(
        refresh_program_validation_sample.run_validation_sample(
            pool_limit=50,
            delta_batch_limit=50,
            sample_max_rows=50,
            sample_keep_latest_snapshot_count=1,
            source_record_batch_limit=50,
            source_record_max_rows=50,
            source_record_fallback_min_batch_limit=10,
        )
    )

    assert calls == ["read_model", "source_records"]
    assert report["status"] == "validation_sample_refresh"
    assert report["read_model"]["status"] == "sample_refresh"
    assert report["source_records"]["status"] == "sample_backfill"


def test_validation_sample_script_keeps_successful_fallback_backfill(monkeypatch) -> None:
    async def fake_refresh(*args, **kwargs):
        return {
            "status": "sample_refresh",
            "affected_rows": 50,
        }

    async def fake_backfill(*args, **kwargs):
        return {
            "status": "sample_backfill",
            "affected_rows": 25,
            "attempt_count": 2,
            "used_fallback_batch": True,
            "effective_batch_limit": 25,
            "effective_max_rows": 25,
            "sample_result": {"remaining_rows": 25},
        }

    monkeypatch.setattr(refresh_program_validation_sample.refresh_program_list_index, "refresh", fake_refresh)
    monkeypatch.setattr(refresh_program_validation_sample.backfill_program_source_records, "backfill_sample", fake_backfill)

    report = asyncio.run(
        refresh_program_validation_sample.run_validation_sample(
            pool_limit=50,
            delta_batch_limit=50,
            sample_max_rows=50,
            sample_keep_latest_snapshot_count=1,
            source_record_batch_limit=50,
            source_record_max_rows=50,
            source_record_fallback_min_batch_limit=10,
        )
    )

    assert report["status"] == "validation_sample_refresh"
    assert report["source_records"]["used_fallback_batch"] is True
    assert report["source_records"]["effective_batch_limit"] == 25


def test_validation_sample_script_stops_when_read_model_fails(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_refresh(*args, **kwargs):
        calls.append("read_model")
        return {
            "status": "failed",
            "error": "program list refresh sample already running",
        }

    async def fake_backfill(*args, **kwargs):
        calls.append("source_records")
        raise AssertionError("source_records should not run when read_model fails")

    monkeypatch.setattr(refresh_program_validation_sample.refresh_program_list_index, "refresh", fake_refresh)
    monkeypatch.setattr(refresh_program_validation_sample.backfill_program_source_records, "backfill_sample", fake_backfill)

    report = asyncio.run(
        refresh_program_validation_sample.run_validation_sample(
            pool_limit=50,
            delta_batch_limit=50,
            sample_max_rows=50,
            sample_keep_latest_snapshot_count=1,
            source_record_batch_limit=50,
            source_record_max_rows=50,
            source_record_fallback_min_batch_limit=10,
        )
    )

    assert calls == ["read_model"]
    assert report["status"] == "failed"
    assert report["failed_stage"] == "program_list_index_sample_refresh"


def test_validation_sample_script_reports_source_record_failure(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_refresh(*args, **kwargs):
        calls.append("read_model")
        return {
            "status": "sample_refresh",
            "affected_rows": 50,
        }

    async def fake_backfill(*args, **kwargs):
        calls.append("source_records")
        return {
            "status": "failed",
            "error": "program source records sample backfill already running",
        }

    monkeypatch.setattr(refresh_program_validation_sample.refresh_program_list_index, "refresh", fake_refresh)
    monkeypatch.setattr(refresh_program_validation_sample.backfill_program_source_records, "backfill_sample", fake_backfill)

    report = asyncio.run(
        refresh_program_validation_sample.run_validation_sample(
            pool_limit=50,
            delta_batch_limit=50,
            sample_max_rows=50,
            sample_keep_latest_snapshot_count=1,
            source_record_batch_limit=50,
            source_record_max_rows=50,
            source_record_fallback_min_batch_limit=10,
        )
    )

    assert calls == ["read_model", "source_records"]
    assert report["status"] == "failed"
    assert report["failed_stage"] == "program_source_records_sample_backfill"


def test_validation_sample_script_passes_source_record_fallback_floor(monkeypatch) -> None:
    observed_kwargs: dict[str, object] = {}

    async def fake_refresh(*args, **kwargs):
        return {
            "status": "sample_refresh",
            "affected_rows": 50,
        }

    async def fake_backfill(*args, **kwargs):
        observed_kwargs.update(kwargs)
        return {
            "status": "sample_backfill",
            "affected_rows": 50,
            "attempt_count": 1,
            "used_fallback_batch": False,
            "sample_result": {"remaining_rows": 50},
        }

    monkeypatch.setattr(refresh_program_validation_sample.refresh_program_list_index, "refresh", fake_refresh)
    monkeypatch.setattr(refresh_program_validation_sample.backfill_program_source_records, "backfill_sample", fake_backfill)

    asyncio.run(
        refresh_program_validation_sample.run_validation_sample(
            pool_limit=50,
            delta_batch_limit=50,
            sample_max_rows=50,
            sample_keep_latest_snapshot_count=1,
            source_record_batch_limit=50,
            source_record_max_rows=50,
            source_record_fallback_min_batch_limit=12,
        )
    )

    assert observed_kwargs["batch_limit"] == 50
    assert observed_kwargs["max_rows"] == 50
    assert observed_kwargs["min_batch_limit"] == 12


def test_validation_sample_script_resolves_preset_and_keeps_explicit_overrides() -> None:
    args = Namespace(
        preset="free-plan-50",
        pool_limit=80,
        delta_batch_limit=50,
        sample_max_rows=50,
        sample_keep_latest_snapshot_count=1,
        source_record_batch_limit=50,
        source_record_max_rows=50,
        source_record_fallback_min_batch_limit=10,
    )

    options = refresh_program_validation_sample._resolve_validation_sample_options(args)

    assert options == {
        "pool_limit": 80,
        "delta_batch_limit": 50,
        "sample_max_rows": 50,
        "sample_keep_latest_snapshot_count": 1,
        "source_record_batch_limit": 50,
        "source_record_max_rows": 50,
        "source_record_fallback_min_batch_limit": 10,
    }


def test_validation_sample_script_writes_output_report(tmp_path: Path) -> None:
    report = {
        "status": "validation_sample_refresh",
        "read_model": {"status": "sample_refresh"},
        "source_records": {"status": "sample_backfill"},
    }
    output_path = tmp_path / "validation-report.json"

    refresh_program_validation_sample._write_report(output_path, report)

    assert output_path.exists() is True
    assert '"status": "validation_sample_refresh"' in output_path.read_text(encoding="utf-8")
