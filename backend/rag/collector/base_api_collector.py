import os
from abc import abstractmethod
from math import ceil
from time import sleep
from typing import Dict, List

import requests

from .base_collector import BaseCollector


class BaseApiCollector(BaseCollector):
    endpoint: str = ""
    api_key_env: str = ""
    api_key_env_aliases: tuple[str, ...] = ()
    timeout_seconds: int = 10
    max_pages: int | None = 5
    max_retries: int = 2
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

        page_num = 1
        total_pages: int | None = None

        while True:
            if self.max_pages is not None and page_num > self.max_pages:
                break
            if total_pages is not None and page_num > total_pages:
                break

            payload = self._request_page(api_key=api_key, page_num=page_num)
            if payload is None:
                return []

            items = self.extract_items(payload)
            if not items:
                break

            total_count = self.extract_total_count(payload)
            if total_count is not None and total_count >= 0:
                total_pages = ceil(total_count / self.page_size) if self.page_size > 0 else 1

            for item in items:
                mapped = self.map_item(item, source_meta)
                if mapped:
                    collected.append(mapped)

            if total_pages is None and len(items) < self.page_size:
                break
            page_num += 1

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

    def _request_page(self, *, api_key: str, page_num: int) -> object | None:
        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 2):
            try:
                response = requests.get(
                    self.endpoint,
                    params=self.build_params(api_key=api_key, page_num=page_num),
                    timeout=self.timeout_seconds,
                )
                response.raise_for_status()
                return response.json()
            except Exception as exc:
                last_error = exc
                if attempt <= self.max_retries:
                    sleep(min(attempt, 3))
                    continue
        self.last_collect_status = "request_failed"
        self.last_collect_message = f"request failed on page {page_num}: {last_error}"
        print(f"[{self.__class__.__name__}] {self.last_collect_message}")
        return None

    @abstractmethod
    def build_params(self, *, api_key: str, page_num: int) -> Dict[str, str]:
        raise NotImplementedError

    @abstractmethod
    def extract_items(self, payload: object) -> List[Dict]:
        raise NotImplementedError

    def extract_total_count(self, payload: object) -> int | None:
        return None

    @abstractmethod
    def map_item(self, item: Dict, source_meta: Dict) -> Dict:
        raise NotImplementedError
