import os
from typing import Dict, List

import requests

try:
    from rag.collector.hrd_collector import HrdCollector
    from rag.collector.kstartup_collector import KstartupApiCollector
    from rag.collector.normalizer import normalize
    from rag.collector.work24_collector import Work24Collector
except ImportError:
    from backend.rag.collector.hrd_collector import HrdCollector
    from backend.rag.collector.kstartup_collector import KstartupApiCollector
    from backend.rag.collector.normalizer import normalize
    from backend.rag.collector.work24_collector import Work24Collector


class SupabaseClient:
    def __init__(self, url: str, service_key: str) -> None:
        self.url = url.rstrip("/")
        self.service_key = service_key

    def upsert_programs(self, rows: List[Dict]) -> None:
        if not rows:
            return

        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        response = requests.post(
            f"{self.url}/rest/v1/programs",
            params={"on_conflict": "title,source"},
            json=rows,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()


def _create_supabase_client() -> SupabaseClient:
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not supabase_url or not supabase_service_key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_KEY is not configured.")
    return SupabaseClient(supabase_url, supabase_service_key)


COLLECTORS = [
    HrdCollector(),
    Work24Collector(),
    KstartupApiCollector(),
]


def run_all_collectors() -> Dict:
    saved_count = 0
    failed_count = 0

    try:
        supabase = _create_supabase_client()
    except Exception as exc:
        print(f"[scheduler] failed to create Supabase client: {exc}")
        return {"saved_count": 0, "failed_count": len(COLLECTORS), "sources": []}

    ordered_collectors = sorted(COLLECTORS, key=lambda collector: (collector.tier, collector.source_name))
    source_results: List[Dict] = []

    for collector in ordered_collectors:
        source_saved = 0
        source_failed = 0
        try:
            raw_items = collector.collect()
        except Exception as exc:
            print(f"[scheduler] collector failed: {collector.__class__.__name__}: {exc}")
            failed_count += 1
            source_failed += 1
            source_results.append(
                {
                    "tier": collector.tier,
                    "source": collector.source_name,
                    "saved": source_saved,
                    "failed": source_failed,
                }
            )
            continue

        normalized_rows: List[Dict] = []
        for raw_item in raw_items:
            try:
                row = normalize(raw_item)
                if row is None:
                    failed_count += 1
                    source_failed += 1
                    continue
                normalized_rows.append(row)
            except Exception as exc:
                print(f"[scheduler] normalize failed in {collector.__class__.__name__}: {exc}")
                failed_count += 1
                source_failed += 1

        if not normalized_rows:
            source_results.append(
                {
                    "tier": collector.tier,
                    "source": collector.source_name,
                    "saved": source_saved,
                    "failed": source_failed,
                }
            )
            continue

        try:
            supabase.upsert_programs(normalized_rows)
            saved_count += len(normalized_rows)
            source_saved += len(normalized_rows)
        except Exception as exc:
            print(f"[scheduler] supabase upsert failed for {collector.__class__.__name__}: {exc}")
            failed_count += len(normalized_rows)
            source_failed += len(normalized_rows)

        source_results.append(
            {
                "tier": collector.tier,
                "source": collector.source_name,
                "saved": source_saved,
                "failed": source_failed,
            }
        )

    return {"saved_count": saved_count, "failed_count": failed_count, "sources": source_results}
