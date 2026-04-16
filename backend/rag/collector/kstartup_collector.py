from datetime import date
from typing import Dict, List

from .base_api_collector import BaseApiCollector


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
            "title": str(item.get("biz_pbanc_nm", "")).strip(),
            "raw_deadline": str(item.get("pbanc_rcpt_end_dt", "")).strip(),
            "link": str(item.get("detl_pg_url", "") or item.get("biz_aply_url", "") or item.get("biz_gdnc_url", "")).strip(),
            "category_hint": "창업",
            "target": [str(item.get("aply_trgt", "")).strip()] if str(item.get("aply_trgt", "")).strip() else None,
            "source_meta": source_meta,
            "raw": item,
        }


KStartupCollector = KstartupApiCollector
