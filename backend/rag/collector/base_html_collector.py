from __future__ import annotations

import re
from html import unescape
from typing import Dict, Iterable, List, Optional
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from .base_collector import BaseCollector


DATE_PATTERN = re.compile(r"(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})")
TAG_RE = re.compile(r"<[^>]+>")


class BaseHtmlCollector(BaseCollector):
    tier: int = 2
    source_type: str = "regional_crawl"
    collection_method: str = "web_crawl"
    scope: str = "seoul"
    region: str = "서울"
    region_detail: str = "서울"
    timeout_seconds: int = 15
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )

    def collect(self) -> List[Dict]:
        items = self.collect_items()
        return self._dedupe(items)

    def collect_items(self) -> List[Dict]:
        raise NotImplementedError

    def fetch_html(self, url: str) -> str:
        request = Request(url, headers={"User-Agent": self.user_agent})
        with urlopen(request, timeout=self.timeout_seconds) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="ignore")

    def absolute_url(self, base_url: str, maybe_relative: str) -> str:
        return urljoin(base_url, maybe_relative.strip())

    def extract_date(self, text: str) -> Optional[str]:
        match = DATE_PATTERN.search(self._clean_text(text))
        return match.group(1) if match else None

    def extract_texts(self, values: Iterable[str]) -> str:
        return " ".join(filter(None, (self._clean_text(value) for value in values)))

    def make_item(
        self,
        *,
        title: str,
        link: str,
        raw: str,
        raw_deadline: Optional[str] = None,
        category_hint: Optional[str] = None,
        target: Optional[List[str]] = None,
        sponsor_name: Optional[str] = None,
    ) -> Optional[Dict]:
        title = self._clean_text(title)
        link = link.strip()
        if not title or not link:
            return None
        item: Dict[str, object] = {
            "title": title,
            "link": link,
            "raw": raw,
            "source_meta": self.get_source_meta(),
        }
        if raw_deadline:
            item["raw_deadline"] = raw_deadline
        if category_hint:
            item["category_hint"] = category_hint
        if target:
            item["target"] = target
        if sponsor_name:
            item["sponsor_name"] = sponsor_name
        return item

    def _clean_text(self, value: str) -> str:
        plain = TAG_RE.sub(" ", unescape(value or ""))
        return re.sub(r"\s+", " ", plain).strip()

    def _dedupe(self, items: List[Dict]) -> List[Dict]:
        seen_primary: set[tuple[str, str, str]] = set()
        seen_link: set[tuple[str, str]] = set()
        seen_title: set[tuple[str, str]] = set()
        deduped: List[Dict] = []
        source = self.source_key or self.source_name

        for item in items:
            title = self._clean_text(str(item.get("title", "")))
            link = str(item.get("link", "")).strip()
            deadline = self._clean_text(str(item.get("raw_deadline", "")))
            primary_key = (source, title, deadline)
            link_key = (source, link)
            title_key = (source, title)

            if deadline and primary_key in seen_primary:
                continue
            if link and link_key in seen_link:
                continue
            if not deadline and title_key in seen_title:
                continue

            if deadline:
                seen_primary.add(primary_key)
            if link:
                seen_link.add(link_key)
            seen_title.add(title_key)
            deduped.append(item)
        return deduped
