import os
from typing import Dict, List

from .base_api_collector import BaseApiCollector
from .program_field_mapping import map_work24_training_item
from ..source_adapters.work24_supplementary import Work24SupplementaryAdapter
from ..source_adapters.work24_training import build_training_list_params, default_training_date_range


class Work24Collector(BaseApiCollector):
    tier: int = 1
    source_name: str = "고용24"
    region: str = "서울"
    region_detail: str = "서울"

    endpoint: str = "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L01.do"
    api_key_env: str = "WORK24_TRAINING_AUTH_KEY"
    api_key_env_aliases: tuple[str, ...] = ("WORK24_API_KEY", "WORK24_JOB_SUPPORT_AUTH_KEY")
    timeout_seconds: int = 10
    max_pages: int | None = None
    page_size: int = 100
    region_code_map: dict[str, dict[str, str]]

    def __init__(self, *, region_code_map: dict[str, dict[str, str]] | None = None) -> None:
        self.region_code_map = region_code_map or {}

    def collect(self) -> List[Dict]:
        if not self.region_code_map and os.getenv("WORK24_COMMON_CODES_AUTH_KEY", "").strip():
            try:
                self.region_code_map = Work24SupplementaryAdapter().fetch_region_code_map()
            except Exception as exc:
                self.region_code_map = {}
                print(f"[Work24Collector] failed to load Work24 region codes: {exc}")
        return super().collect()

    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        start_dt, end_dt = default_training_date_range()
        return build_training_list_params(
            auth_key=api_key,
            page_num=page_num,
            page_size=self.page_size,
            start_dt=_env_param("WORK24_TRAINING_START_DT") or start_dt,
            end_dt=_env_param("WORK24_TRAINING_END_DT") or end_dt,
            area_code=_env_param("WORK24_TRAINING_AREA1", default="11"),
            area2_code=_env_param("WORK24_TRAINING_AREA2"),
            ncs1_code=_env_param("WORK24_TRAINING_NCS1"),
            ncs2_code=_env_param("WORK24_TRAINING_NCS2"),
            ncs3_code=_env_param("WORK24_TRAINING_NCS3"),
            ncs4_code=_env_param("WORK24_TRAINING_NCS4"),
            weekend_code=_env_param("WORK24_TRAINING_WKEND_SE"),
            course_type=_env_param("WORK24_TRAINING_CRSE_TRACSE_SE"),
            training_category=_env_param("WORK24_TRAINING_TRA_GBN"),
            training_type=_env_param("WORK24_TRAINING_TRA_TYPE"),
            process_name=_env_param("WORK24_TRAINING_PROCESS_NAME"),
            organization_name=_env_param("WORK24_TRAINING_ORGAN_NAME"),
            sort=_env_param("WORK24_TRAINING_SORT", default="ASC"),
            sort_col=_env_param("WORK24_TRAINING_SORT_COL", default="2"),
        )

    def extract_items(self, payload: object) -> List[Dict]:
        if not isinstance(payload, dict):
            return []

        items = payload.get("srchList")
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]
        return [item for item in payload.get("HRDNet", {}).get("srchList", []) if isinstance(item, dict)] if isinstance(payload.get("HRDNet"), dict) else []

    def extract_total_count(self, payload: object) -> int | None:
        if not isinstance(payload, dict):
            return None
        try:
            return int(payload.get("scn_cnt"))
        except (TypeError, ValueError):
            return None

    def map_item(self, item: Dict, source_meta: Dict) -> Dict:
        return {
            **map_work24_training_item(item, region_code_map=self.region_code_map),
            "source_meta": source_meta,
            "raw": item,
        }


def _env_param(name: str, *, default: str | None = None) -> str | None:
    value = os.getenv(name, default or "").strip()
    if not value or value.upper() in {"ALL", "NONE", "NULL"}:
        return None
    return value
