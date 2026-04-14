from datetime import date, timedelta
from typing import Dict, List

from .base_api_collector import BaseApiCollector


class HrdCollector(BaseApiCollector):
    tier: int = 1
    source_name: str = "HRD넷"
    region: str = "서울"
    region_detail: str = "서울"

    endpoint: str = "https://www.hrd.go.kr/jsp/HRDP/HRDPO00/HRDPOA60/HRDPOA60_1.jsp"
    api_key_env: str = "HRD_API_KEY"
    timeout_seconds: int = 10
    max_pages: int = 5
    page_size: int = 100

    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        today = date.today()
        end_date = today + timedelta(days=90)
        return {
            "authKey": api_key,
            "returnType": "JSON",
            "outType": "1",
            "pageNum": str(page_num),
            "pageSize": str(self.page_size),
            "srchTraStDt": today.strftime("%Y%m%d"),
            "srchTraEndDt": end_date.strftime("%Y%m%d"),
            "srchTraArea1": "11",
        }

    def extract_items(self, payload: object) -> List[Dict]:
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]

        if not isinstance(payload, dict):
            return []

        for key in ("HRDNet", "srchList", "scn_list", "list", "items", "item", "data", "results"):
            value = payload.get(key)
            items = self.extract_items(value)
            if items:
                return items

        rows: List[Dict] = []
        for value in payload.values():
            rows.extend(self.extract_items(value))
        return rows

    def map_item(self, item: Dict, source_meta: Dict) -> Dict:
        return {
            "title": str(item.get("trprNm", "")).strip(),
            "raw_deadline": str(item.get("traEndDate", "")).strip(),
            "link": str(item.get("titleLink", "")).strip(),
            "source_meta": source_meta,
            "raw": item,
        }


HRDCollector = HrdCollector
