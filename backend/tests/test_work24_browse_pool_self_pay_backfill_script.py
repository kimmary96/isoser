import asyncio
import subprocess
import sys
from pathlib import Path

from scripts import backfill_work24_browse_pool_self_pay


def test_fetch_browse_pool_work24_rows_uses_bounded_browse_rank_window(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def fake_supabase_request(method, path, *, params=None, payload=None):
        assert method == "GET"
        assert path == "/rest/v1/program_list_index"
        captured.update(params or {})
        return []

    monkeypatch.setattr(
        backfill_work24_browse_pool_self_pay.program_backfill,
        "supabase_request",
        fake_supabase_request,
    )

    assert backfill_work24_browse_pool_self_pay.fetch_browse_pool_work24_rows(300) == []
    assert captured["browse_rank"] == "lte.300"
    assert captured["or"] == "(source.ilike.*고용24*,source.ilike.*work24*)"


def test_build_report_only_keeps_suspicious_work24_rows(monkeypatch) -> None:
    monkeypatch.setattr(
        backfill_work24_browse_pool_self_pay,
        "fetch_browse_pool_work24_rows",
        lambda pool_limit: [
            {"id": "program-1", "title": "의심 과정", "source": "고용24", "browse_rank": 1},
            {"id": "program-2", "title": "정상 과정", "source": "고용24", "browse_rank": 2},
        ],
    )
    monkeypatch.setattr(
        backfill_work24_browse_pool_self_pay,
        "fetch_program_rows_by_ids",
        lambda ids: [
            {
                "id": "program-1",
                "title": "의심 과정",
                "source": "고용24",
                "cost": 265980,
                "subsidy_amount": 265980,
                "compare_meta": {},
                "link": "https://www.work24.go.kr/detail?id=1",
            },
            {
                "id": "program-2",
                "title": "정상 과정",
                "source": "고용24",
                "cost": 265980,
                "subsidy_amount": 93100,
                "compare_meta": {"self_payment": 93100},
                "link": "https://www.work24.go.kr/detail?id=2",
            },
        ],
    )
    monkeypatch.setattr(
        backfill_work24_browse_pool_self_pay.program_backfill,
        "fetch_work24_record_from_detail_url",
        lambda row: type(
            "Record",
            (),
            {"normalized": {"support_amount": 93100, "compare_meta": {"self_payment": 93100}}},
        )(),
    )
    monkeypatch.setattr(
        backfill_work24_browse_pool_self_pay.program_backfill,
        "build_patch",
        lambda db_row, normalized, overwrite: {
            "support_amount": normalized["support_amount"],
            "compare_meta": {"self_payment": 93100},
        },
    )

    report = backfill_work24_browse_pool_self_pay.build_report(pool_limit=300, overwrite=False)

    assert report["candidate_rows_from_program_list_index"] == 2
    assert report["candidate_rows_from_programs"] == 2
    assert report["suspicious_count"] == 1
    assert report["patch_count"] == 1
    assert report["items"] == [
        {
            "id": "program-1",
            "title": "의심 과정",
            "source": "고용24",
            "browse_rank": 1,
            "matched": True,
            "patch": {"support_amount": 93100, "compare_meta": {"self_payment": 93100}},
            "diff": {
                "support_amount": {"after": 93100},
                "compare_meta": {"after": {"self_payment": 93100}},
            },
        }
    ]


def test_refresh_browse_pool_uses_browse_only_strategy(monkeypatch) -> None:
    calls: list[dict[str, object]] = []

    async def fake_refresh(pool_limit: int, **kwargs) -> dict[str, object]:
        calls.append({"pool_limit": pool_limit, **kwargs})
        return {"status": "browse_fallback", "affected_rows": pool_limit}

    monkeypatch.setattr(
        backfill_work24_browse_pool_self_pay.refresh_program_list_index,
        "refresh",
        fake_refresh,
    )

    report = asyncio.run(
        backfill_work24_browse_pool_self_pay.refresh_browse_pool(
            pool_limit=300,
            browse_candidate_limit=2400,
            fallback_attempts=2,
            retry_delay_seconds=0,
        )
    )

    assert calls == [
        {
            "pool_limit": 300,
            "browse_only": True,
            "fallback_attempts": 2,
            "retry_delay_seconds": 0.0,
            "browse_candidate_limit": 2400,
        }
    ]
    assert report["affected_rows"] == 300


def test_script_can_run_directly_as_file_from_repo_root() -> None:
    script_path = (
        Path(__file__).resolve().parents[2]
        / "scripts"
        / "backfill_work24_browse_pool_self_pay.py"
    )

    result = subprocess.run(
        [sys.executable, str(script_path), "--help"],
        cwd=script_path.parents[1],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert "Backfill verified self-pay for Work24 browse-pool rows" in result.stdout
