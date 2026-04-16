from backend.rag.collector.base_collector import BaseCollector
from backend.rag.collector.scheduler import run_all_collectors


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
