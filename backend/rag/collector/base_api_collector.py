import os
from abc import abstractmethod
from typing import Dict, List

import requests

from .base_collector import BaseCollector


class BaseApiCollector(BaseCollector):
    endpoint: str = ""
    api_key_env: str = ""
    timeout_seconds: int = 10
    max_pages: int = 5
    page_size: int = 100

    def collect(self) -> List[Dict]:
        api_key = os.getenv(self.api_key_env, "").strip()
        if not api_key:
            print(f"[{self.__class__.__name__}] {self.api_key_env} is not configured.")
            return []

        collected: List[Dict] = []
        source_meta = self.get_source_meta()

        for page_num in range(1, self.max_pages + 1):
            try:
                response = requests.get(
                    self.endpoint,
                    params=self.build_params(api_key=api_key, page_num=page_num),
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                payload = response.json()
            except Exception as exc:
                print(f"[{self.__class__.__name__}] request failed on page {page_num}: {exc}")
                return []

            items = self.extract_items(payload)
            if not items:
                break

            for item in items:
                mapped = self.map_item(item, source_meta)
                if mapped:
                    collected.append(mapped)

        return collected

    @abstractmethod
    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        raise NotImplementedError

    @abstractmethod
    def extract_items(self, payload: object) -> List[Dict]:
        raise NotImplementedError

    @abstractmethod
    def map_item(self, item: Dict, source_meta: Dict) -> Dict:
        raise NotImplementedError
