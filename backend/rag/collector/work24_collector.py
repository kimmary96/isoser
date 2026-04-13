import os
from typing import Dict, List

import requests

from .base_collector import BaseCollector


class Work24Collector(BaseCollector):
    source_name: str = "고용24"
    region: str = "서울"
    region_detail: str = "서울"

    endpoint = "https://www.work24.go.kr/cm/openApi/call/wantedInfoSrch.do"
    timeout_seconds = 10
    max_pages = 5
    page_size = 100

    def collect(self) -> List[Dict]:
        api_key = os.getenv("WORK24_API_KEY", "").strip()
        if not api_key:
            print("[Work24Collector] WORK24_API_KEY is not configured.")
            return []

        collected: List[Dict] = []

        for page_num in range(1, self.max_pages + 1):
            params = {
                "callTp": "L",
                "returnType": "JSON",
                "authKey": api_key,
                "pageNum": str(page_num),
                "pageSize": str(self.page_size),
                "region": "11",
            }

            try:
                response = requests.get(self.endpoint, params=params, timeout=self.timeout_seconds)
                response.raise_for_status()
                payload = response.json()
            except Exception as exc:
                print(f"[Work24Collector] request failed on page {page_num}: {exc}")
                return []

            items = self._extract_items(payload)
            if not items:
                break

            source_meta = self.get_source_meta()
            for item in items:
                collected.append(
                    {
                        "title": str(item.get("wantedTitle", "")).strip(),
                        "raw_deadline": str(item.get("closeDt", "")).strip(),
                        "link": str(item.get("wantedAuthUrl", "")).strip(),
                        "source_meta": source_meta,
                        "raw": item,
                    }
                )

        return collected

    def _extract_items(self, payload: object) -> List[Dict]:
        if not isinstance(payload, dict):
            return []

        result = payload.get("result")
        if isinstance(result, dict):
            wanted_info = result.get("wantedInfo")
            if isinstance(wanted_info, list):
                return [item for item in wanted_info if isinstance(item, dict)]

        return []
