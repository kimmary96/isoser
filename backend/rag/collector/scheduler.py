import os
from typing import Dict, List

import requests

from rag.collector.hrd_collector import HRDCollector as HrdCollector
from rag.collector.kstartup_collector import KStartupCollector as KstartupCollector
from rag.collector.normalizer import normalize
from rag.collector.work24_collector import Work24Collector


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
    HrdCollector,
    Work24Collector,
    KstartupCollector,
]


def run_all_collectors() -> Dict:
    saved_count = 0
    failed_count = 0

    try:
        supabase = _create_supabase_client()
    except Exception as exc:
        print(f"[scheduler] failed to create Supabase client: {exc}")
        return {"saved_count": 0, "failed_count": len(COLLECTORS)}

    for collector_cls in COLLECTORS:
        try:
            collector = collector_cls()
            raw_items = collector.collect()
        except Exception as exc:
            print(f"[scheduler] collector failed: {collector_cls.__name__}: {exc}")
            failed_count += 1
            continue

        normalized_rows: List[Dict] = []
        for raw_item in raw_items:
            try:
                row = normalize(raw_item)
                if row is None:
                    failed_count += 1
                    continue
                normalized_rows.append(row)
            except Exception as exc:
                print(f"[scheduler] normalize failed in {collector_cls.__name__}: {exc}")
                failed_count += 1

        if not normalized_rows:
            continue

        try:
            supabase.upsert_programs(normalized_rows)
            saved_count += len(normalized_rows)
        except Exception as exc:
            print(f"[scheduler] supabase upsert failed for {collector_cls.__name__}: {exc}")
            failed_count += len(normalized_rows)

    return {"saved_count": saved_count, "failed_count": failed_count}
