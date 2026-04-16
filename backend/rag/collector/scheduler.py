import os
from typing import Dict, List

import requests


def _should_fallback_to_backend(error: ModuleNotFoundError) -> bool:
    return error.name is not None and (
        error.name == "rag" or error.name.startswith("rag.")
    )


try:
    from rag.collector.hrd_collector import HrdCollector
    from rag.collector.kstartup_collector import KstartupApiCollector
    from rag.collector.normalizer import normalize
    from rag.collector.regional_html_collectors import (
        CampusTownCollector,
        SbaPostingCollector,
        SesacCollector,
        Seoul50PlusCollector,
        SeoulJobPortalCollector,
        SeoulWomanUpCollector,
    )
    from rag.collector.work24_collector import Work24Collector
except ModuleNotFoundError as error:
    if not _should_fallback_to_backend(error):
        raise
    from backend.rag.collector.hrd_collector import HrdCollector
    from backend.rag.collector.kstartup_collector import KstartupApiCollector
    from backend.rag.collector.normalizer import normalize
    from backend.rag.collector.regional_html_collectors import (
        CampusTownCollector,
        SbaPostingCollector,
        SesacCollector,
        Seoul50PlusCollector,
        SeoulJobPortalCollector,
        SeoulWomanUpCollector,
    )
    from backend.rag.collector.work24_collector import Work24Collector


class SupabaseClient:
    def __init__(self, url: str, service_key: str) -> None:
        self.url = url.rstrip("/")
        self.service_key = service_key
        self.upsert_batch_size = 100

    def upsert_programs(self, rows: List[Dict]) -> None:
        if not rows:
            return

        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        with requests.Session() as session:
            session.trust_env = False
            for index in range(0, len(rows), self.upsert_batch_size):
                batch = rows[index : index + self.upsert_batch_size]
                response = session.post(
                    f"{self.url}/rest/v1/programs",
                    params={"on_conflict": "title,source"},
                    json=batch,
                    headers=headers,
                    timeout=30,
                )
                response.raise_for_status()


def _create_supabase_client() -> SupabaseClient:
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not supabase_service_key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.")
    return SupabaseClient(supabase_url, supabase_service_key)


COLLECTORS = [
    HrdCollector(),
    Work24Collector(),
    KstartupApiCollector(),
    SeoulJobPortalCollector(),
    SbaPostingCollector(),
    SesacCollector(),
    Seoul50PlusCollector(),
    CampusTownCollector(),
    SeoulWomanUpCollector(),
]


def _deduplicate_rows(rows: List[Dict]) -> List[Dict]:
    deduped: Dict[tuple[str, str], Dict] = {}
    for row in rows:
        title = str(row.get("title") or "").strip()
        source = str(row.get("source") or "").strip()
        if not title or not source:
            continue
        deduped[(title, source)] = row
    return list(deduped.values())


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
        source_status = "idle"
        source_message = ""
        try:
            raw_items = collector.collect()
        except Exception as exc:
            print(f"[scheduler] collector failed: {collector.__class__.__name__}: {exc}")
            failed_count += 1
            source_failed += 1
            source_status = "collector_exception"
            source_message = str(exc)
            source_results.append(
                {
                    "tier": collector.tier,
                    "source": collector.source_name,
                    "saved": source_saved,
                    "failed": source_failed,
                    "status": source_status,
                    "message": source_message,
                }
            )
            continue

        source_status = getattr(collector, "last_collect_status", "success" if raw_items else "empty")
        source_message = getattr(collector, "last_collect_message", "")
        if not raw_items and source_status not in {"success", "empty"}:
            failed_count += 1
            source_failed += 1
            source_results.append(
                {
                    "tier": collector.tier,
                    "source": collector.source_name,
                    "saved": source_saved,
                    "failed": source_failed,
                    "status": source_status,
                    "message": source_message,
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

        normalized_rows = _deduplicate_rows(normalized_rows)
        if not normalized_rows:
            source_results.append(
                {
                    "tier": collector.tier,
                    "source": collector.source_name,
                    "saved": source_saved,
                    "failed": source_failed,
                    "status": "empty" if source_failed == 0 else "normalize_failed",
                    "message": source_message or "No rows to save after normalization",
                }
            )
            continue

        try:
            supabase.upsert_programs(normalized_rows)
            saved_count += len(normalized_rows)
            source_saved += len(normalized_rows)
            source_status = "saved"
            source_message = ""
        except Exception as exc:
            print(f"[scheduler] supabase upsert failed for {collector.__class__.__name__}: {exc}")
            failed_count += len(normalized_rows)
            source_failed += len(normalized_rows)
            source_status = "upsert_failed"
            source_message = str(exc)

        source_results.append(
            {
                "tier": collector.tier,
                "source": collector.source_name,
                "saved": source_saved,
                "failed": source_failed,
                "status": source_status,
                "message": source_message,
            }
        )

    return {"saved_count": saved_count, "failed_count": failed_count, "sources": source_results}


if __name__ == "__main__":
    import json

    print(json.dumps(run_all_collectors(), ensure_ascii=False, indent=2))
