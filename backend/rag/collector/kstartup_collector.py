from datetime import date
from typing import Dict, List

from .base_api_collector import BaseApiCollector
from .program_field_mapping import map_kstartup_announcement_item


class KstartupApiCollector(BaseApiCollector):
    tier: int = 1
    source_name: str = "K-Startup 창업진흥원"
    source_type: str = "national_api"
    region: str = "서울"
    region_detail: str = "서울"

    endpoint: str = "https://nidapi.k-startup.go.kr/api/kisedKstartupService/v1/getAnnouncementInformation"
    api_key_env: str = "KSTARTUP_API_KEY"
    timeout_seconds: int = 10
    max_pages: int = 3
    page_size: int = 100

    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        return {
            "serviceKey": api_key,
            "returnType": "json",
            "page": str(page_num),
            "perPage": str(self.page_size),
            "cond[supt_regin::LIKE]": "서울",
            "cond[pbanc_rcpt_end_dt::GTE]": date.today().strftime("%Y%m%d"),
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
            **map_kstartup_announcement_item(item),
            "source_meta": source_meta,
            "raw": item,
        }


KStartupCollector = KstartupApiCollector
