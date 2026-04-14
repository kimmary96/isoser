from typing import Dict, List

from .base_api_collector import BaseApiCollector


class Work24Collector(BaseApiCollector):
    tier: int = 1
    source_name: str = "고용24"
    region: str = "서울"
    region_detail: str = "서울"

    endpoint: str = "https://www.work24.go.kr/cm/openApi/call/wantedInfoSrch.do"
    api_key_env: str = "WORK24_API_KEY"
    timeout_seconds: int = 10
    max_pages: int = 5
    page_size: int = 100

    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        return {
            "callTp": "L",
            "returnType": "JSON",
            "authKey": api_key,
            "pageNum": str(page_num),
            "pageSize": str(self.page_size),
            "region": "11",
        }

    def extract_items(self, payload: object) -> List[Dict]:
        if not isinstance(payload, dict):
            return []

        result = payload.get("result")
        if isinstance(result, dict):
            wanted_info = result.get("wantedInfo")
            if isinstance(wanted_info, list):
                return [item for item in wanted_info if isinstance(item, dict)]

        return []

    def map_item(self, item: Dict, source_meta: Dict) -> Dict:
        return {
            "title": str(item.get("wantedTitle", "")).strip(),
            "raw_deadline": str(item.get("closeDt", "")).strip(),
            "link": str(item.get("wantedAuthUrl", "")).strip(),
            "source_meta": source_meta,
            "raw": item,
        }
