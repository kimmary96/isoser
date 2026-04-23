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


def test_refresh_script_falls_back_to_browse_rpc(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_refresh_rpc(function_name: str, pool_limit: int) -> object:
        calls.append(function_name)
        if function_name == "refresh_program_list_index":
            raise RuntimeError("canceling statement due to statement timeout")
        return 300

    monkeypatch.setattr(refresh_program_list_index, "_refresh_rpc", fake_refresh_rpc)

    report = asyncio.run(refresh_program_list_index.refresh(300))

    assert calls == ["refresh_program_list_index", "refresh_program_list_browse_pool"]
    assert report == {
        "pool_limit": 300,
        "status": "browse_fallback",
        "full_refresh_error": "canceling statement due to statement timeout",
        "affected_rows": 300,
    }
