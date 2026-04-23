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
    from rag.collector.quality_validator import summarize_program_quality
    from rag.collector.regional_html_collectors import (
        CampusTownCollector,
        SbaPostingCollector,
        SesacCollector,
        Seoul50PlusCollector,
        SeoulJobPortalCollector,
        SeoulWomanUpCollector,
    )
    from rag.collector.tier3_collectors import KisedCollector, KobiaCollector
    from rag.collector.tier4_collectors import (
        DobongCollector,
        DobongStartupCollector,
        GuroCollector,
        MapoCollector,
        NowonCollector,
        SeongdongCollector,
    )
    from rag.collector.work24_collector import Work24Collector
except ModuleNotFoundError as error:
    if not _should_fallback_to_backend(error):
        raise
    from backend.rag.collector.hrd_collector import HrdCollector
    from backend.rag.collector.kstartup_collector import KstartupApiCollector
    from backend.rag.collector.normalizer import normalize
    from backend.rag.collector.quality_validator import summarize_program_quality
    from backend.rag.collector.regional_html_collectors import (
        CampusTownCollector,
        SbaPostingCollector,
        SesacCollector,
        Seoul50PlusCollector,
        SeoulJobPortalCollector,
        SeoulWomanUpCollector,
    )
    from backend.rag.collector.tier3_collectors import KisedCollector, KobiaCollector
    from backend.rag.collector.tier4_collectors import (
        DobongCollector,
        DobongStartupCollector,
        GuroCollector,
        MapoCollector,
        NowonCollector,
        SeongdongCollector,
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
                response = self._post_program_batch(session, batch, headers, conflict_target="source_unique_key")
                fallback_state = self._source_unique_key_fallback_state(response)
                if fallback_state:
                    fallback_batch = batch
                    if fallback_state == "missing_column":
                        fallback_batch = [
                            {key: value for key, value in row.items() if key != "source_unique_key"}
                            for row in batch
                        ]
                    response = self._post_program_batch(session, fallback_batch, headers, conflict_target="title,source")
                if response.status_code == 409:
                    self._upsert_rows_one_by_one(session, batch, headers)
                    continue
                response.raise_for_status()

    def _post_program_batch(
        self,
        session: requests.Session,
        batch: List[Dict],
        headers: dict[str, str],
        *,
        conflict_target: str,
    ) -> requests.Response:
        return session.post(
            f"{self.url}/rest/v1/programs",
            params={"on_conflict": conflict_target},
            json=batch,
            headers=headers,
            timeout=30,
        )

    def _upsert_rows_one_by_one(
        self,
        session: requests.Session,
        rows: List[Dict],
        headers: dict[str, str],
    ) -> None:
        for row in rows:
            response = self._post_program_batch(session, [row], headers, conflict_target="source_unique_key")
            fallback_state = self._source_unique_key_fallback_state(response)
            if fallback_state:
                if fallback_state == "missing_column":
                    row = {key: value for key, value in row.items() if key != "source_unique_key"}
                response = self._post_program_batch(session, [row], headers, conflict_target="title,source")
            if response.status_code == 409 and not row.get("source_unique_key") and row.get("hrd_id"):
                response = session.patch(
                    f"{self.url}/rest/v1/programs",
                    params={"hrd_id": f"eq.{row['hrd_id']}"},
                    json=row,
                    headers=headers,
                    timeout=30,
                )
                if response.status_code == 409 and row.get("title") and row.get("source"):
                    legacy_row = {key: value for key, value in row.items() if key != "hrd_id"}
                    response = session.patch(
                        f"{self.url}/rest/v1/programs",
                        params={
                            "title": f"eq.{row['title']}",
                            "source": f"eq.{row['source']}",
                        },
                        json=legacy_row,
                        headers=headers,
                        timeout=30,
                    )
            response.raise_for_status()

    def _source_unique_key_fallback_state(self, response: requests.Response) -> str | None:
        if response.status_code != 400:
            return None
        text = response.text
        if "source_unique_key" in text:
            return "missing_column"
        if "ON CONFLICT" in text or "on conflict" in text.lower():
            return "unusable_conflict_target"
        return None


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
    KobiaCollector(),
    KisedCollector(),
    DobongStartupCollector(),
    GuroCollector(),
    SeongdongCollector(),
    NowonCollector(),
    DobongCollector(),
    MapoCollector(),
]


def _env_flag(name: str, *, default: bool) -> bool:
    value = os.getenv(name, "").strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "on"}


def _maybe_skip_collector(collector) -> tuple[str, str] | None:
    if collector.__class__.__name__ == "HrdCollector" or getattr(collector, "source_name", "") == "HRD넷":
        if not _env_flag("ENABLE_HRD_COLLECTOR", default=False):
            return ("skipped_disabled", "ENABLE_HRD_COLLECTOR=false")

        key_env_names = getattr(collector, "_api_key_env_names", lambda: ())()
        if not any(os.getenv(env_name, "").strip() for env_name in key_env_names):
            return ("skipped_missing_config", f"API key is not configured: {', '.join(key_env_names)}")

    return None


DB_ALLOWED_CATEGORIES = {"AI", "IT", "디자인", "경영", "창업", "기타"}


def _coerce_db_category(row: Dict) -> Dict:
    category = str(row.get("category") or "").strip()
    if category in DB_ALLOWED_CATEGORIES:
        return row

    title = str(row.get("title") or "")
    if any(keyword in title for keyword in ("AI", "인공지능", "LLM", "ChatGPT", "생성형", "머신러닝", "딥러닝")):
        row["category"] = "AI"
    elif any(keyword in title for keyword in ("개발", "코딩", "프로그래밍", "SW", "소프트웨어", "클라우드", "데이터", "분석")):
        row["category"] = "IT"
    elif any(keyword in title for keyword in ("디자인", "영상", "콘텐츠", "그래픽", "UX", "UI", "일러스트", "포토샵")):
        row["category"] = "디자인"
    elif any(keyword in title for keyword in ("경영", "마케팅", "회계", "사무", "HR", "세무", "총무")):
        row["category"] = "경영"
    elif any(keyword in title for keyword in ("창업", "스타트업", "보육", "예비창업")):
        row["category"] = "창업"
    else:
        row["category"] = "기타"
    return row


def _deduplicate_rows(rows: List[Dict]) -> List[Dict]:
    deduped: Dict[tuple[str, ...], Dict] = {}
    for row in rows:
        row = _coerce_db_category(row)
        title = str(row.get("title") or "").strip()
        source = str(row.get("source") or "").strip()
        if not title or not source:
            continue
        source_unique_key = str(row.get("source_unique_key") or "").strip()
        key = ("source_unique_key", source_unique_key) if source_unique_key else ("title_source", title, source)
        deduped[key] = row
    return list(deduped.values())


def _format_dry_run_message(raw_count: int, normalized_count: int, source_message: str) -> str:
    message = (
        f"Collected {normalized_count} rows; upsert skipped "
        f"(raw_items={raw_count}, deduped_rows={normalized_count})"
    )
    if source_message:
        message = f"{message}; collector_message={source_message}"
    return message


def run_all_collectors(*, upsert: bool = True) -> Dict:
    saved_count = 0
    failed_count = 0

    supabase = None
    if upsert:
        try:
            supabase = _create_supabase_client()
        except Exception as exc:
            print(f"[scheduler] failed to create Supabase client: {exc}")
            return {"saved_count": 0, "failed_count": len(COLLECTORS), "sources": []}

    ordered_collectors = sorted(
        enumerate(COLLECTORS),
        key=lambda entry: (entry[1].tier, entry[0]),
    )
    source_results: List[Dict] = []

    for _, collector in ordered_collectors:
        source_saved = 0
        source_failed = 0
        source_status = "idle"
        source_message = ""
        skip_state = _maybe_skip_collector(collector)
        if skip_state is not None:
            source_status, source_message = skip_state
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
            print(
                f"[scheduler] source={collector.source_name} tier={collector.tier} "
                f"collected=0 failed={source_failed} status={'empty' if source_failed == 0 else 'normalize_failed'}"
            )
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

        if not upsert:
            quality_summary = summarize_program_quality(normalized_rows)
            dry_run_message = _format_dry_run_message(
                len(raw_items),
                len(normalized_rows),
                source_message,
            )
            print(
                f"[scheduler] source={collector.source_name} tier={collector.tier} "
                f"collected={len(normalized_rows)} raw={len(raw_items)} "
                f"failed={source_failed} status=dry_run"
            )
            source_results.append(
                {
                    "tier": collector.tier,
                    "source": collector.source_name,
                    "saved": 0,
                    "failed": source_failed,
                    "status": "dry_run",
                    "message": dry_run_message,
                    "quality": quality_summary,
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

        print(
            f"[scheduler] source={collector.source_name} tier={collector.tier} "
            f"collected={len(normalized_rows)} failed={source_failed} status={source_status}"
        )
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
