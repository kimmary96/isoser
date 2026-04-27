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


def test_resilient_browse_refresh_migration_adds_bounded_and_daily_helpers() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260426110000_add_program_list_browse_refresh_resilient.sql"
    ).read_text(encoding="utf-8")

    assert "refresh_program_list_browse_pool_bounded" in migration
    assert "limit effective_candidate_limit" in migration
    assert "refresh_program_list_browse_pool_resilient" in migration
    assert "when query_canceled or lock_not_available or deadlock_detected" in migration
    assert "refresh_program_list_browse_pool_daily_resilient" in migration
    assert "current_batch_limit := greatest(current_batch_limit / 2, min_batch_limit)" in migration
    assert "select public.refresh_program_list_browse_pool_daily_resilient(300, 500, 20, 2400);" in migration


def test_landing_chip_snapshot_migration_adds_snapshot_table_and_daily_refresh_hook() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260426143000_add_program_landing_chip_snapshots.sql"
    ).read_text(encoding="utf-8")

    assert "create table if not exists public.program_landing_chip_snapshots" in migration
    assert "refresh_program_landing_chip_snapshots" in migration
    assert "program_landing_chip_snapshots_public_read" in migration
    assert "landing_snapshot_result := public.refresh_program_landing_chip_snapshots('landing-c', 24);" in migration
    assert "'온라인'::text" in migration


def test_corrective_snapshot_migration_restores_verified_self_pay_and_rpc() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260426170000_add_verified_self_pay_surface_and_restore_landing_snapshot_rpc.sql"
    ).read_text(encoding="utf-8")

    assert "add column if not exists verified_self_pay_amount integer" in migration
    assert "program_surface_verified_self_pay_amount" in migration
    assert "'verified_self_pay_amount'" in migration
    assert "drop function if exists public.refresh_program_landing_chip_snapshots(text, integer);" in migration
    assert "on conflict on constraint program_landing_chip_snapshots_pkey do update" in migration
    assert "refresh_program_landing_chip_snapshots" in migration
    assert "update public.program_list_index\nset indexed_at = indexed_at;" not in migration
    assert "perform public.refresh_program_landing_chip_snapshots('landing-c', 24);" not in migration


def test_followup_snapshot_conflict_fix_migration_is_function_only() -> None:
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "20260426171000_fix_landing_snapshot_conflict_target.sql"
    ).read_text(encoding="utf-8")

    assert "drop function if exists public.refresh_program_landing_chip_snapshots(text, integer);" in migration
    assert "on conflict on constraint program_landing_chip_snapshots_pkey do update" in migration
    assert "verified_self_pay_amount" in migration
    assert "alter table public.program_list_index" not in migration


def test_refresh_script_runs_delta_batches_then_browse_rpc(monkeypatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []
    delta_results = [500, 12]

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append((function_name, payload))
        if function_name == "refresh_program_list_delta":
            return delta_results.pop(0)
        if function_name == "refresh_program_list_browse_pool_resilient":
            return {"browse_rows": 300, "mode": "full"}
        if function_name == "refresh_program_landing_chip_snapshots":
            return {"surface": "landing-c", "chip_rows": 10}
        raise AssertionError(f"unexpected rpc: {function_name}")

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
        (
            "refresh_program_list_browse_pool_resilient",
            {"pool_limit": 300, "candidate_limit": 2400},
        ),
        (
            "refresh_program_landing_chip_snapshots",
            {"surface": "landing-c", "item_limit": 24},
        ),
    ]
    assert report["status"] == "incremental_refresh"
    assert report["delta_synced_rows"] == 512
    assert report["delta_batches"] == 2
    assert report["affected_rows"] == 300
    assert report["browse_result"]["mode"] == "full"
    assert report["landing_snapshot_result"]["surface"] == "landing-c"


def test_refresh_script_falls_back_to_browse_rpc_when_delta_fails(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_delta":
            raise RuntimeError("canceling statement due to statement timeout")
        if function_name == "refresh_program_list_browse_pool_resilient":
            return {"browse_rows": 300, "mode": "bounded_fallback"}
        if function_name == "refresh_program_landing_chip_snapshots":
            return {"surface": "landing-c", "chip_rows": 10}
        raise AssertionError(f"unexpected rpc: {function_name}")

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(refresh_program_list_index.refresh(300, retry_delay_seconds=0))

    assert calls == [
        "refresh_program_list_delta",
        "refresh_program_list_browse_pool_resilient",
        "refresh_program_landing_chip_snapshots",
    ]
    assert report["pool_limit"] == 300
    assert report["status"] == "browse_fallback"
    assert report["delta_refresh_error"] == "canceling statement due to statement timeout"
    assert report["affected_rows"] == 300
    assert report["fallback_attempts"] == 1
    assert [stage["status"] for stage in report["stages"]] == ["failed", "succeeded", "succeeded"]
    assert report["browse_result"]["mode"] == "bounded_fallback"
    assert report["landing_snapshot_result"]["chip_rows"] == 10


def test_refresh_script_retries_retryable_browse_fallback_error(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_delta":
            raise RuntimeError("canceling statement due to statement timeout")
        if calls.count("refresh_program_list_browse_pool_resilient") == 1:
            raise RuntimeError("deadlock detected")
        if function_name == "refresh_program_list_browse_pool_resilient":
            return {"browse_rows": 300, "mode": "full"}
        if function_name == "refresh_program_landing_chip_snapshots":
            return {"surface": "landing-c", "chip_rows": 10}
        raise AssertionError(f"unexpected rpc: {function_name}")

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(refresh_program_list_index.refresh(300, fallback_attempts=2, retry_delay_seconds=0))

    assert calls == [
        "refresh_program_list_delta",
        "refresh_program_list_browse_pool_resilient",
        "refresh_program_list_browse_pool_resilient",
        "refresh_program_landing_chip_snapshots",
    ]
    assert report["status"] == "browse_fallback"
    assert report["affected_rows"] == 300
    assert report["fallback_attempts"] == 2
    assert [stage["status"] for stage in report["stages"]] == ["failed", "failed", "succeeded", "succeeded"]


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

    assert calls == ["refresh_program_list_browse_pool_resilient", "refresh_program_list_browse_pool_resilient"]
    assert report["status"] == "failed"
    assert report["fallback_attempts"] == 2
    assert report["error"] == "canceling statement due to statement timeout"


def test_refresh_script_falls_back_to_legacy_browse_rpc_when_resilient_rpc_is_missing(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_delta":
            return 100
        if function_name == "refresh_program_list_browse_pool_resilient":
            raise RuntimeError(
                "Could not find the function public.refresh_program_list_browse_pool_resilient(pool_limit, candidate_limit)"
            )
        if function_name == "refresh_program_list_browse_pool":
            return 300
        if function_name == "refresh_program_landing_chip_snapshots":
            return {"surface": "landing-c", "chip_rows": 10}
        raise AssertionError(f"unexpected rpc: {function_name}")

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
        "refresh_program_list_delta",
        "refresh_program_list_browse_pool_resilient",
        "refresh_program_list_browse_pool",
        "refresh_program_landing_chip_snapshots",
    ]
    assert report["status"] == "incremental_refresh"
    assert report["affected_rows"] == 300
    assert report["browse_result"] is None
    assert report["landing_snapshot_result"]["chip_rows"] == 10


def test_refresh_script_keeps_legacy_full_refresh_option(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_index":
            return 9467
        if function_name == "refresh_program_landing_chip_snapshots":
            return {"surface": "landing-c", "chip_rows": 10}
        raise AssertionError(f"unexpected rpc: {function_name}")

    monkeypatch.setattr(refresh_program_list_index, "_call_rpc", fake_call_rpc)

    report = asyncio.run(refresh_program_list_index.refresh(300, legacy_full_refresh=True))

    assert calls == ["refresh_program_list_index", "refresh_program_landing_chip_snapshots"]
    assert report["status"] == "full_refresh"
    assert report["affected_rows"] == 9467
    assert report["landing_snapshot_result"]["chip_rows"] == 10


def test_refresh_script_skips_optional_snapshot_stage_when_rpc_is_missing(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_call_rpc(function_name: str, payload: dict[str, object]) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_delta":
            return 100
        if function_name == "refresh_program_list_browse_pool_resilient":
            return {"browse_rows": 300, "mode": "full"}
        if function_name == "refresh_program_landing_chip_snapshots":
            raise RuntimeError(
                "Could not find the function public.refresh_program_landing_chip_snapshots(surface, item_limit)"
            )
        raise AssertionError(f"unexpected rpc: {function_name}")

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
        "refresh_program_list_delta",
        "refresh_program_list_browse_pool_resilient",
        "refresh_program_landing_chip_snapshots",
    ]
    assert report["status"] == "incremental_refresh"
    assert report["landing_snapshot_result"] is None
    assert report["stages"][-1]["status"] == "skipped"
    assert report["stages"][-1]["reason"] == "missing_rpc"


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
