from typing import Dict, List

from .base_api_collector import BaseApiCollector


class Work24Collector(BaseApiCollector):
    tier: int = 1
    source_name: str = "고용24"
    region: str = "서울"
    region_detail: str = "서울"

    endpoint: str = "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L01.do"
    api_key_env: str = "WORK24_TRAINING_AUTH_KEY"
    api_key_env_aliases: tuple[str, ...] = ("WORK24_API_KEY", "WORK24_JOB_SUPPORT_AUTH_KEY")
    timeout_seconds: int = 10
    max_pages: int = 5
    page_size: int = 100

    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        return {
            "returnType": "JSON",
            "outType": "1",
            "authKey": api_key,
            "pageNum": str(page_num),
            "pageSize": str(self.page_size),
            "srchTraArea1": "11",
        }

    def extract_items(self, payload: object) -> List[Dict]:
        if not isinstance(payload, dict):
            return []

        items = payload.get("srchList")
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]
        return [item for item in payload.get("HRDNet", {}).get("srchList", []) if isinstance(item, dict)] if isinstance(payload.get("HRDNet"), dict) else []

    def map_item(self, item: Dict, source_meta: Dict) -> Dict:
        return {
            "title": str(item.get("title", "")).strip(),
            "raw_deadline": str(item.get("traEndDate", "")).strip(),
            "link": str(item.get("titleLink", "")).strip(),
            "target": [str(item.get("trainTarget", "")).strip()] if str(item.get("trainTarget", "")).strip() else None,
            "source_meta": source_meta,
            "raw": item,
        }
