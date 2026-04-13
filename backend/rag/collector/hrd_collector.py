import os
from datetime import date, timedelta
from typing import Dict, List

import requests

from .base_collector import BaseCollector


class HRDCollector(BaseCollector):
    source_name: str = "HRD넷"
    region: str = "서울"
    region_detail: str = "서울"

    endpoint = "https://www.hrd.go.kr/jsp/HRDP/HRDPO00/HRDPOA60/HRDPOA60_1.jsp"
    timeout_seconds = 10
    max_pages = 5
    page_size = 100

    def collect(self) -> List[Dict]:
        api_key = os.getenv("HRD_API_KEY", "").strip()
        if not api_key:
            print("[HRDCollector] HRD_API_KEY is not configured.")
            return []

        today = date.today()
        end_date = today + timedelta(days=90)
        collected: List[Dict] = []

        for page_num in range(1, self.max_pages + 1):
            params = {
                "authKey": api_key,
                "returnType": "JSON",
                "outType": "1",
                "pageNum": str(page_num),
                "pageSize": str(self.page_size),
                "srchTraStDt": today.strftime("%Y%m%d"),
                "srchTraEndDt": end_date.strftime("%Y%m%d"),
                "srchTraArea1": "11",
            }

            try:
                response = requests.get(self.endpoint, params=params, timeout=self.timeout_seconds)
                response.raise_for_status()
                payload = response.json()
            except Exception as exc:
                print(f"[HRDCollector] request failed on page {page_num}: {exc}")
                return []

            items = self._extract_items(payload)
            if not items:
                break

            source_meta = self.get_source_meta()
            for item in items:
                collected.append(
                    {
                        "title": str(item.get("trprNm", "")).strip(),
                        "raw_deadline": str(item.get("traEndDate", "")).strip(),
                        "link": str(item.get("titleLink", "")).strip(),
                        "source_meta": source_meta,
                        "raw": item,
                    }
                )

        return collected

    def _extract_items(self, payload: object) -> List[Dict]:
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]

        if not isinstance(payload, dict):
            return []

        for key in ("HRDNet", "srchList", "scn_list", "list", "items", "item", "data", "results"):
            value = payload.get(key)
            items = self._extract_items(value)
            if items:
                return items

        rows: List[Dict] = []
        for value in payload.values():
            rows.extend(self._extract_items(value))
        return rows
