from typing import Dict, List

from .base_api_collector import BaseApiCollector


class KstartupApiCollector(BaseApiCollector):
    tier: int = 1
    source_name: str = "K-Startup 창업진흥원"
    source_type: str = "national_api"

    endpoint: str = "https://apis.data.go.kr/B552735/kisedKstartupService/getAnnouncementInformation"
    api_key_env: str = "KSTARTUP_API_KEY"
    timeout_seconds: int = 10
    max_pages: int = 3
    page_size: int = 100

    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        return {
            "serviceKey": api_key,
            "type": "json",
            "page": str(page_num),
            "perPage": str(self.page_size),
        }

    def extract_items(self, payload: object) -> List[Dict]:
        if not isinstance(payload, dict):
            return []

        data = payload.get("data")
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]

        return []

    def map_item(self, item: Dict, source_meta: Dict) -> Dict:
        return {
            "title": str(item.get("사업명", "")).strip(),
            "raw_deadline": str(item.get("접수마감일", "")).strip(),
            "link": str(item.get("공고URL", "")).strip(),
            "category_hint": "창업",
            "source_meta": source_meta,
            "raw": item,
        }


KStartupCollector = KstartupApiCollector
