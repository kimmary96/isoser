import os
from abc import abstractmethod
from typing import Dict, List

import requests

from .base_collector import BaseCollector


class BaseApiCollector(BaseCollector):
    endpoint: str = ""
    api_key_env: str = ""
    api_key_env_aliases: tuple[str, ...] = ()
    timeout_seconds: int = 10
    max_pages: int = 5
    page_size: int = 100
    last_collect_status: str = "idle"
    last_collect_message: str = ""
    last_collect_count: int = 0
    last_collect_key_env: str = ""

    def collect(self) -> List[Dict]:
        self._reset_collect_state()

        api_key = ""
        for env_name in self._api_key_env_names():
            candidate = os.getenv(env_name, "").strip()
            if candidate:
                api_key = candidate
                self.last_collect_key_env = env_name
                break

        if not api_key:
            self.last_collect_status = "config_error"
            self.last_collect_message = f"API key is not configured: {', '.join(self._api_key_env_names())}"
            print(f"[{self.__class__.__name__}] {self.last_collect_message}")
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
                self.last_collect_status = "request_failed"
                self.last_collect_message = f"request failed on page {page_num}: {exc}"
                print(f"[{self.__class__.__name__}] {self.last_collect_message}")
                return []

            items = self.extract_items(payload)
            if not items:
                break

            for item in items:
                mapped = self.map_item(item, source_meta)
                if mapped:
                    collected.append(mapped)

        self.last_collect_count = len(collected)
        if collected:
            self.last_collect_status = "success"
            return collected

        self.last_collect_status = "empty"
        self.last_collect_message = "API returned 0 items"
        return collected

    def _api_key_env_names(self) -> tuple[str, ...]:
        names = [self.api_key_env, *self.api_key_env_aliases]
        return tuple(name for name in names if name)

    def _reset_collect_state(self) -> None:
        self.last_collect_status = "idle"
        self.last_collect_message = ""
        self.last_collect_count = 0
        self.last_collect_key_env = ""

    @abstractmethod
    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        raise NotImplementedError

    @abstractmethod
    def extract_items(self, payload: object) -> List[Dict]:
        raise NotImplementedError

    @abstractmethod
    def map_item(self, item: Dict, source_meta: Dict) -> Dict:
        raise NotImplementedError
