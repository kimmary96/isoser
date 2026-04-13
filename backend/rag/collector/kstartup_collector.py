import os
from typing import Dict, List

import requests

from .base_collector import BaseCollector


class KStartupCollector(BaseCollector):
    source_name: str = "K-Startup 창업진흥원"
    source_type: str = "national_api"

    endpoint = "https://apis.data.go.kr/B552735/kisedKstartupService/getAnnouncementInformation"
    timeout_seconds = 10
    max_pages = 3
    page_size = 100

    def collect(self) -> List[Dict]:
        api_key = os.getenv("KSTARTUP_API_KEY", "").strip()
        if not api_key:
            print("[KStartupCollector] KSTARTUP_API_KEY is not configured.")
            return []

        collected: List[Dict] = []

        for page_num in range(1, self.max_pages + 1):
            params = {
                "serviceKey": api_key,
                "type": "json",
                "page": str(page_num),
                "perPage": str(self.page_size),
            }

            try:
                response = requests.get(self.endpoint, params=params, timeout=self.timeout_seconds)
                response.raise_for_status()
                payload = response.json()
            except Exception as exc:
                print(f"[KStartupCollector] request failed on page {page_num}: {exc}")
                return []

            items = self._extract_items(payload)
            if not items:
                break

            source_meta = self.get_source_meta()
            for item in items:
                raw = dict(item)
                raw["category_hint"] = "창업"
                collected.append(
                    {
                        "title": str(item.get("사업명", "")).strip(),
                        "raw_deadline": str(item.get("접수마감일", "")).strip(),
                        "link": str(item.get("공고URL", "")).strip(),
                        "source_meta": source_meta,
                        "raw": raw,
                    }
                )

        return collected

    def _extract_items(self, payload: object) -> List[Dict]:
        if not isinstance(payload, dict):
            return []

        data = payload.get("data")
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]

        return []
