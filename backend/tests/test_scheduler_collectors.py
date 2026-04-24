import requests

from backend.rag.collector import scheduler
from backend.rag.collector.base_collector import BaseCollector
from backend.rag.collector.base_api_collector import BaseApiCollector
from backend.rag.collector.hrd_collector import HrdCollector
from backend.rag.collector.normalizer import normalize
from backend.rag.collector.scheduler import _coerce_db_category, _deduplicate_rows, run_all_collectors
from backend.rag.collector.work24_collector import Work24Collector
from backend.rag.collector.tier3_collectors import KisedCollector, KobiaCollector
from backend.rag.collector.tier4_collectors import (
    DobongCollector,
    DobongStartupCollector,
    GuroCollector,
    MapoCollector,
    NowonCollector,
    SeongdongCollector,
)


class _DummySupabase:
    def upsert_programs(self, rows):
        self.rows = list(rows)
        return list(rows)


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


class _PagedApiCollector(BaseApiCollector):
    endpoint = "https://example.com/api"
    api_key_env = "PAGED_API_KEY"
    page_size = 2
    max_pages = None

    def build_params(self, *, api_key: str, page_num: int):
        return {"api_key": api_key, "page": str(page_num)}

    def extract_items(self, payload: object):
        return payload.get("items", []) if isinstance(payload, dict) else []

    def extract_total_count(self, payload: object) -> int | None:
        return int(payload["total"]) if isinstance(payload, dict) and "total" in payload else None

    def map_item(self, item, source_meta):
        return {"title": item["title"], "source_meta": source_meta}


def test_base_api_collector_uses_total_count_for_full_pagination(monkeypatch) -> None:
    calls: list[int] = []

    class FakeResponse:
        def __init__(self, page_num: int) -> None:
            self.page_num = page_num

        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {
                "total": 5,
                "items": [{"title": f"program-{self.page_num}-{index}"} for index in range(2)],
            }

    def fake_get(*_, params, **__):
        page_num = int(params["page"])
        calls.append(page_num)
        return FakeResponse(page_num)

    monkeypatch.setenv("PAGED_API_KEY", "test-key")
    monkeypatch.setattr("backend.rag.collector.base_api_collector.requests.get", fake_get)

    rows = _PagedApiCollector().collect()

    assert calls == [1, 2, 3]
    assert len(rows) == 6


def test_base_api_collector_retries_failed_page(monkeypatch) -> None:
    calls = 0

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {"total": 1, "items": [{"title": "program"}]}

    def fake_get(*_, **__):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("temporary")
        return FakeResponse()

    monkeypatch.setenv("PAGED_API_KEY", "test-key")
    monkeypatch.setattr("backend.rag.collector.base_api_collector.sleep", lambda *_: None)
    monkeypatch.setattr("backend.rag.collector.base_api_collector.requests.get", fake_get)

    rows = _PagedApiCollector().collect()

    assert calls == 2
    assert len(rows) == 1


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


def test_work24_collector_scans_enough_pages_for_provider_search_samples() -> None:
    assert Work24Collector.max_pages is None


def test_work24_collector_uses_documented_training_list_params(monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.rag.collector.work24_collector.default_training_date_range",
        lambda: ("20260423", "20261023"),
    )

    params = Work24Collector().build_params(api_key="test-key", page_num=2)

    assert params["authKey"] == "test-key"
    assert params["returnType"] == "JSON"
    assert params["outType"] == "1"
    assert params["pageNum"] == "2"
    assert params["pageSize"] == "100"
    assert params["srchTraStDt"] == "20260423"
    assert params["srchTraEndDt"] == "20261023"
    assert params["sort"] == "ASC"
    assert params["sortCol"] == "2"
    assert params["srchTraArea1"] == "11"


def test_work24_collector_accepts_documented_optional_params_from_env(monkeypatch) -> None:
    monkeypatch.setattr(
        "backend.rag.collector.work24_collector.default_training_date_range",
        lambda: ("20260423", "20261023"),
    )
    monkeypatch.setenv("WORK24_TRAINING_AREA1", "ALL")
    monkeypatch.setenv("WORK24_TRAINING_AREA2", "11680")
    monkeypatch.setenv("WORK24_TRAINING_NCS1", "20")
    monkeypatch.setenv("WORK24_TRAINING_WKEND_SE", "3")
    monkeypatch.setenv("WORK24_TRAINING_CRSE_TRACSE_SE", "C0104")
    monkeypatch.setenv("WORK24_TRAINING_TRA_GBN", "M1005")
    monkeypatch.setenv("WORK24_TRAINING_PROCESS_NAME", "AI")
    monkeypatch.setenv("WORK24_TRAINING_ORGAN_NAME", "테스트기관")
    monkeypatch.setenv("WORK24_TRAINING_SORT", "DESC")
    monkeypatch.setenv("WORK24_TRAINING_SORT_COL", "5")

    params = Work24Collector().build_params(api_key="test-key", page_num=1)

    assert "srchTraArea1" not in params
    assert params["srchTraArea2"] == "11680"
    assert params["srchNcs1"] == "20"
    assert params["wkendSe"] == "3"
    assert params["crseTracseSe"] == "C0104"
    assert params["srchTraGbn"] == "M1005"
    assert params["srchTraProcessNm"] == "AI"
    assert params["srchTraOrganNm"] == "테스트기관"
    assert params["sort"] == "DESC"
    assert params["sortCol"] == "5"


def test_scheduler_coerces_categories_to_db_allowed_values() -> None:
    assert _coerce_db_category({"title": "AI 심화 캠프", "category": "훈련"})["category"] == "AI"
    assert _coerce_db_category({"title": "재직자 데이터 분석 Course", "category": "훈련"})["category"] == "IT"
    assert _coerce_db_category({"title": "그래픽 디자인 과정", "category": "교육"})["category"] == "디자인"


def test_normalizer_derives_source_unique_key_from_source_link_and_title() -> None:
    row = normalize(
        {
            "title": "서울 AI 실무 교육",
            "link": "https://example.com/program/1",
            "source_meta": {"source_key": "sba_posting"},
        }
    )

    assert row is not None
    assert row["source_unique_key"].startswith("urltitle:sba_posting:")


def test_scheduler_deduplicates_by_source_unique_key_before_title_source() -> None:
    deduped = _deduplicate_rows(
        [
            {
                "title": "같은 제목 과정",
                "source": "고용24",
                "category": "기타",
                "source_unique_key": "work24:AIG1:1:5000",
            },
            {
                "title": "같은 제목 과정",
                "source": "고용24",
                "category": "기타",
                "source_unique_key": "work24:AIG1:2:5000",
            },
        ]
    )

    assert len(deduped) == 2


def test_scheduler_keeps_title_source_dedupe_for_rows_without_source_unique_key() -> None:
    deduped = _deduplicate_rows(
        [
            {"title": "중복 공고", "source": "legacy", "category": "기타"},
            {"title": "중복 공고", "source": "legacy", "category": "기타"},
        ]
    )

    assert len(deduped) == 1


def test_scheduler_preserves_source_unique_key_for_upsert(monkeypatch) -> None:
    supabase = _DummySupabase()
    monkeypatch.setattr("backend.rag.collector.scheduler.COLLECTORS", [_Tier1Collector()])
    monkeypatch.setattr("backend.rag.collector.scheduler._create_supabase_client", lambda: supabase)

    result = run_all_collectors()

    assert result["saved_count"] == 1
    assert supabase.rows[0]["source_unique_key"] == "tier1:program:1"
    assert supabase.rows[0]["primary_source_code"] == "tier1"
    assert supabase.rows[0]["primary_source_label"] == "tier1"
    assert supabase.rows[0]["application_end_date"] == "2026-05-01"


def test_supabase_client_soft_fails_missing_program_source_records_table(monkeypatch) -> None:
    created_sessions: list["_FakeSession"] = []

    class _FakeResponse:
        def __init__(self, *, status_code: int, json_data=None, text: str = "") -> None:
            self.status_code = status_code
            self._json_data = json_data
            self.text = text
            self.content = b"" if json_data is None else b"[]"

        @property
        def ok(self) -> bool:
            return 200 <= self.status_code < 300

        def json(self):
            return self._json_data

        def raise_for_status(self) -> None:
            raise requests.HTTPError(self.text)

    class _FakeSession:
        def __init__(self) -> None:
            self.trust_env = False
            self.calls: list[dict[str, object]] = []

        def __enter__(self):
            created_sessions.append(self)
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, *, params=None, json=None, headers=None, timeout=None):
            self.calls.append({"url": url, "params": params, "json": json, "headers": headers, "timeout": timeout})
            if url.endswith("/rest/v1/programs"):
                assert isinstance(json, list)
                return _FakeResponse(
                    status_code=201,
                    json_data=[{"id": "program-1", **json[0]}],
                )
            if url.endswith("/rest/v1/program_source_records"):
                return _FakeResponse(
                    status_code=404,
                    text='relation "public.program_source_records" does not exist',
                )
            raise AssertionError(f"unexpected post url: {url}")

        def patch(self, url, *, params=None, json=None, headers=None, timeout=None):
            raise AssertionError(f"unexpected patch url: {url}")

    monkeypatch.setattr("backend.rag.collector.scheduler.requests.Session", _FakeSession)

    client = scheduler.SupabaseClient("https://example.supabase.co", "service-key")
    rows = client.upsert_programs(
        [
            {
                "title": "테스트 프로그램",
                "source": "고용24",
                "category": "IT",
                "source_unique_key": "work24:TEST:1:1000",
                "deadline": "2026-05-01",
                "compare_meta": {
                    "field_sources": {"deadline": "traEndDate"},
                    "application_url": "https://example.com/apply",
                },
                "raw_data": {"id": "raw-1"},
            }
        ]
    )

    assert rows[0]["id"] == "program-1"
    assert created_sessions
    assert len(created_sessions[0].calls) == 2
    assert created_sessions[0].calls[0]["url"] == "https://example.supabase.co/rest/v1/programs"
    assert created_sessions[0].calls[1]["url"] == "https://example.supabase.co/rest/v1/program_source_records"
    assert created_sessions[0].calls[0]["json"][0]["primary_source_code"] == "work24"


def test_scheduler_adds_quality_summary_to_dry_run(monkeypatch) -> None:
    monkeypatch.setattr("backend.rag.collector.scheduler.COLLECTORS", [_Tier1Collector()])

    result = run_all_collectors(upsert=False)

    quality = result["sources"][0]["quality"]
    assert quality["checked_rows"] == 1
    assert quality["rows_with_errors"] == 0
    assert quality["rows_with_warnings"] == 0
    assert quality["issue_counts"]["info"] == 1
    assert quality["issue_codes"] == {"missing_provider": 1}


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
                "source_unique_key": "tier1:program:1",
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
    assert [source["source"] for source in result["sources"]] == ["tier1", "KISED", "KOBIA"]
    assert [source["tier"] for source in result["sources"]] == [1, 3, 3]
    assert all(source["status"] == "dry_run" for source in result["sources"])
    assert "Collected 1 rows; upsert skipped" in result["sources"][1]["message"]


def test_scheduler_includes_tier4_collectors_in_dry_run(monkeypatch) -> None:
    tier4_collectors = [
        DobongStartupCollector(),
        GuroCollector(),
        SeongdongCollector(),
        NowonCollector(),
        DobongCollector(),
        MapoCollector(),
    ]
    monkeypatch.setattr(
        "backend.rag.collector.scheduler.COLLECTORS",
        [_Tier1Collector(), *tier4_collectors],
    )

    def collect_tier4_fixture(self):
        self.last_collect_status = "success"
        self.last_collect_message = f"{self.source_name} fixture diagnostics"
        return [
            {
                "title": f"{self.source_name} 테스트 수집",
                "link": f"https://example.com/{self.source_key}",
                "raw_deadline": "2026-05-20",
                "category_hint": "기타",
                "source_meta": self.get_source_meta(),
                "raw": {"source": self.source_key},
            }
        ]

    for collector in tier4_collectors:
        monkeypatch.setattr(
            collector.__class__,
            "collect",
            collect_tier4_fixture,
        )

    result = run_all_collectors(upsert=False)

    assert result["saved_count"] == 0
    assert result["failed_count"] == 0
    assert [source["tier"] for source in result["sources"]] == [1, 4, 4, 4, 4, 4, 4]
    assert [source["source"] for source in result["sources"]] == [
        "tier1",
        "도봉구청년창업센터",
        "구로 청년이룸",
        "서울청년센터 성동",
        "노원구 청년일자리센터 청년내일",
        "도봉구청 일자리경제과",
        "마포구고용복지지원센터",
    ]
    assert all(source["status"] == "dry_run" for source in result["sources"])
    assert all("raw_items=1" in source["message"] for source in result["sources"])
    assert all("deduped_rows=1" in source["message"] for source in result["sources"])
    assert all(
        "collector_message=" in source["message"]
        for source in result["sources"][1:]
    )
