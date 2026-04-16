from backend.rag.collector.base_collector import BaseCollector
from backend.rag.collector.hrd_collector import HrdCollector
from backend.rag.collector.scheduler import run_all_collectors
from backend.rag.collector.tier3_collectors import KisedCollector, KobiaCollector


class _DummySupabase:
    def upsert_programs(self, rows):
        self.rows = list(rows)


class _EmptyCollector(BaseCollector):
    tier = 1
    source_name = "empty"

    def collect(self):
        self.last_collect_status = "empty"
        self.last_collect_message = "API returned 0 items"
        return []


class _FailedCollector(BaseCollector):
    tier = 1
    source_name = "failed"

    def collect(self):
        self.last_collect_status = "config_error"
        self.last_collect_message = "HRD_API_KEY is not configured"
        return []


def test_scheduler_distinguishes_empty_and_failed_collectors(monkeypatch) -> None:
    monkeypatch.setattr("backend.rag.collector.scheduler.COLLECTORS", [_EmptyCollector(), _FailedCollector()])
    monkeypatch.setattr("backend.rag.collector.scheduler._create_supabase_client", lambda: _DummySupabase())

    result = run_all_collectors()

    assert result["saved_count"] == 0
    assert result["failed_count"] == 1
    assert result["sources"] == [
        {
            "tier": 1,
            "source": "empty",
            "saved": 0,
            "failed": 0,
            "status": "empty",
            "message": "API returned 0 items",
        },
        {
            "tier": 1,
            "source": "failed",
            "saved": 0,
            "failed": 1,
            "status": "config_error",
            "message": "HRD_API_KEY is not configured",
        },
    ]


def test_scheduler_skips_hrd_when_disabled(monkeypatch) -> None:
    monkeypatch.setattr("backend.rag.collector.scheduler.COLLECTORS", [HrdCollector()])
    monkeypatch.setattr("backend.rag.collector.scheduler._create_supabase_client", lambda: _DummySupabase())
    monkeypatch.setenv("ENABLE_HRD_COLLECTOR", "false")
    monkeypatch.delenv("HRD_API_KEY", raising=False)
    monkeypatch.delenv("HRDNET_API_KEY", raising=False)

    result = run_all_collectors()

    assert result["saved_count"] == 0
    assert result["failed_count"] == 0
    assert result["sources"] == [
        {
            "tier": 1,
            "source": "HRD넷",
            "saved": 0,
            "failed": 0,
            "status": "skipped_disabled",
            "message": "ENABLE_HRD_COLLECTOR=false",
        }
    ]


def test_scheduler_skips_hrd_when_key_missing(monkeypatch) -> None:
    monkeypatch.setattr("backend.rag.collector.scheduler.COLLECTORS", [HrdCollector()])
    monkeypatch.setattr("backend.rag.collector.scheduler._create_supabase_client", lambda: _DummySupabase())
    monkeypatch.setenv("ENABLE_HRD_COLLECTOR", "true")
    monkeypatch.delenv("HRD_API_KEY", raising=False)
    monkeypatch.delenv("HRDNET_API_KEY", raising=False)

    result = run_all_collectors()

    assert result["saved_count"] == 0
    assert result["failed_count"] == 0
    assert result["sources"] == [
        {
            "tier": 1,
            "source": "HRD넷",
            "saved": 0,
            "failed": 0,
            "status": "skipped_missing_config",
            "message": "API key is not configured: HRD_API_KEY, HRDNET_API_KEY",
        }
    ]


class _Tier1Collector(BaseCollector):
    tier = 1
    source_name = "tier1"
    source_key = "tier1"
    source_type = "national_api"
    collection_method = "public_api"

    def collect(self):
        return [
            {
                "title": "전국 창업 지원",
                "link": "https://example.com/tier1",
                "raw_deadline": "2026-05-01",
                "category_hint": "창업",
                "source_meta": self.get_source_meta(),
                "raw": {"id": 1},
            }
        ]


def test_scheduler_includes_tier3_collectors_in_dry_run(monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.rag.collector.scheduler.COLLECTORS",
        [_Tier1Collector(), KisedCollector(), KobiaCollector()],
    )

    monkeypatch.setattr(
        KobiaCollector,
        "collect",
        lambda self: [
            {
                "title": "KOBIA 창업보육센터 네트워킹 데이",
                "link": "http://www.kobia.or.kr/board/view.do?idx=1&board_kind=KNOTICE&page=1",
                "raw_deadline": "2026.05.10",
                "category_hint": "행사/네트워킹",
                "target": ["창업보육센터"],
                "source_meta": {
                    **self.get_source_meta(),
                    "source": "KOBIA",
                    "tier": 3,
                    "board_kind": "KNOTICE",
                },
                "raw": {"idx": "1"},
            }
        ],
    )
    monkeypatch.setattr(
        KisedCollector,
        "collect",
        lambda self: [
            {
                "title": "KISED 예비창업 패키지",
                "link": "https://www.k-startup.go.kr/announcement/1",
                "raw_deadline": "2026.05.12",
                "category_hint": "예비창업",
                "target": ["예비창업자"],
                "source_meta": {
                    **self.get_source_meta(),
                    "source": "KISED",
                    "tier": 3,
                    "page": "misAnnouncement",
                },
                "raw": {"id": "1"},
            }
        ],
    )

    result = run_all_collectors(upsert=False)

    assert result["saved_count"] == 0
    assert result["failed_count"] == 0
    assert [source["source"] for source in result["sources"]] == ["tier1", "KOBIA", "KISED"]
    assert [source["tier"] for source in result["sources"]] == [1, 3, 3]
    assert all(source["status"] == "dry_run" for source in result["sources"])
    assert "Collected 1 rows; upsert skipped" in result["sources"][1]["message"]
