import asyncio
from pathlib import Path

from scripts import refresh_program_list_index


def test_participation_display_migration_does_not_run_full_refresh() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260423203000_conservative_program_participation_display.sql"
    ).read_text(encoding="utf-8")

    assert "select public.refresh_program_list_index(300)" not in migration
    assert "bounded browse-pool fallback refresh" in migration


def test_browse_pool_fallback_migration_refreshes_bounded_surface() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260423204000_add_program_list_browse_refresh_fallback.sql"
    ).read_text(encoding="utf-8")

    assert "refresh_program_list_browse_pool" in migration
    assert "idx_program_list_index_browse_refresh_candidates" in migration
    assert "from public.program_list_index i" in migration
    assert "where i.is_open" in migration
    assert "where new_browse_rank <= greatest(pool_limit, 1)" in migration
    assert "select public.refresh_program_list_browse_pool(300)" in migration


def test_delta_refresh_migration_adds_chunked_sync_entrypoint() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260423205500_add_program_list_delta_refresh.sql"
    ).read_text(encoding="utf-8")

    assert "refresh_program_list_delta" in migration
    assert "idx_programs_read_model_delta" in migration
    assert "limit greatest(coalesce(batch_limit, 500), 1)" in migration
    assert "> coalesce(i.updated_at, 'epoch'::timestamptz)" in migration
    assert "pg_try_advisory_xact_lock" in migration
    assert "browse_rank = pli.browse_rank" in migration


def test_refresh_script_runs_delta_batches_then_browse_rpc(monkeypatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []
    delta_results = [500, 12]

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append((function_name, payload))
        if function_name == "refresh_program_list_delta":
            return delta_results.pop(0)
        return 300

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(
        refresh_program_list_index.refresh(
            300,
            delta_batch_limit=500,
            max_delta_batches=3,
            retry_delay_seconds=0,
        )
    )

    assert calls == [
        ("refresh_program_list_delta", {"batch_limit": 500}),
        ("refresh_program_list_delta", {"batch_limit": 500}),
        ("refresh_program_list_browse_pool", {"pool_limit": 300}),
    ]
    assert report["status"] == "incremental_refresh"
    assert report["delta_synced_rows"] == 512
    assert report["delta_batches"] == 2
    assert report["affected_rows"] == 300


def test_refresh_script_falls_back_to_browse_rpc_when_delta_fails(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_delta":
            raise RuntimeError("canceling statement due to statement timeout")
        return 300

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(refresh_program_list_index.refresh(300, retry_delay_seconds=0))

    assert calls == ["refresh_program_list_delta", "refresh_program_list_browse_pool"]
    assert report["pool_limit"] == 300
    assert report["status"] == "browse_fallback"
    assert report["delta_refresh_error"] == "canceling statement due to statement timeout"
    assert report["affected_rows"] == 300
    assert report["fallback_attempts"] == 1
    assert [stage["status"] for stage in report["stages"]] == ["failed", "succeeded"]


def test_refresh_script_retries_retryable_browse_fallback_error(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_delta":
            raise RuntimeError("canceling statement due to statement timeout")
        if calls.count("refresh_program_list_browse_pool") == 1:
            raise RuntimeError("deadlock detected")
        return 300

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(refresh_program_list_index.refresh(300, fallback_attempts=2, retry_delay_seconds=0))

    assert calls == [
        "refresh_program_list_delta",
        "refresh_program_list_browse_pool",
        "refresh_program_list_browse_pool",
    ]
    assert report["status"] == "browse_fallback"
    assert report["affected_rows"] == 300
    assert report["fallback_attempts"] == 2
    assert [stage["status"] for stage in report["stages"]] == ["failed", "failed", "succeeded"]


def test_refresh_script_reports_failed_browse_only_after_retries(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        raise RuntimeError("canceling statement due to statement timeout")

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(
        refresh_program_list_index.refresh(
            300,
            browse_only=True,
            fallback_attempts=2,
            retry_delay_seconds=0,
        )
    )

    assert calls == ["refresh_program_list_browse_pool", "refresh_program_list_browse_pool"]
    assert report["status"] == "failed"
    assert report["fallback_attempts"] == 2
    assert report["error"] == "canceling statement due to statement timeout"


def test_refresh_script_keeps_legacy_full_refresh_option(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_index":
            return 9467
        raise AssertionError(f"unexpected rpc: {function_name}")

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(refresh_program_list_index.refresh(300, legacy_full_refresh=True))

    assert calls == ["refresh_program_list_index"]
    assert report["status"] == "full_refresh"
    assert report["affected_rows"] == 9467


def test_refresh_script_supports_sample_refresh_helper(monkeypatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append((function_name, payload))
        if function_name != "refresh_program_list_index_sample":
            raise AssertionError(f"unexpected rpc: {function_name}")
        return {
            "batch_limit": 100,
            "browse_pool_limit": 100,
            "max_rows": 100,
            "delta_rows": 100,
            "browse_rows": 100,
            "trimmed_rows": 100,
            "remaining_rows": 100,
            "remaining_browse_rows": 100,
            "trimmed_facet_snapshots": 0,
        }

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(
        refresh_program_list_index.refresh(
            100,
            delta_batch_limit=100,
            sample_refresh=True,
            sample_max_rows=100,
        )
    )

    assert calls == [
        (
            "refresh_program_list_index_sample",
            {
                "batch_limit": 100,
                "browse_pool_limit": 100,
                "max_rows": 100,
                "keep_latest_snapshot_count": 1,
            },
        )
    ]
    assert report["status"] == "sample_refresh"
    assert report["affected_rows"] == 100
    assert report["sample_result"]["trimmed_rows"] == 100


def test_refresh_script_parses_stringified_sample_refresh_result(monkeypatch) -> None:
    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        assert function_name == "refresh_program_list_index_sample"
        return '{"remaining_rows": 50, "delta_rows": 50, "browse_rows": 50}'

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(
        refresh_program_list_index.refresh(
            50,
            delta_batch_limit=50,
            sample_refresh=True,
        )
    )

    assert report["status"] == "sample_refresh"
    assert report["affected_rows"] == 50
    assert report["sample_result"]["browse_rows"] == 50
