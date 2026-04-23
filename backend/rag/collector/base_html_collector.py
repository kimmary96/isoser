from __future__ import annotations

import re
from html import unescape
from typing import Callable, Dict, Iterable, List, Optional
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

from .base_collector import BaseCollector


DATE_PATTERN = re.compile(r"(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})")
TAG_RE = re.compile(r"<[^>]+>")


class BaseHtmlCollector(BaseCollector):
    tier: int = 2
    source_type: str = "seoul_city"
    collection_method: str = "web_crawl"
    scope: str = "seoul"
    region: str = "서울"
    region_detail: str = "서울"
    timeout_seconds: int = 15
    html_snapshot_char_limit: int = 4000
    text_snapshot_char_limit: int = 400
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

    def collect_url_items(
        self,
        parser: Callable[[str, str], List[Dict]],
        *,
        fetcher: Callable[[str], str] | None = None,
        empty_message: str | None = None,
    ) -> List[Dict]:
        items: List[Dict] = []
        request_errors: List[str] = []
        parse_errors: List[str] = []
        parsed_empty_count = 0
        successful_request_count = 0
        url_diagnostics: List[Dict] = []
        list_urls = list(getattr(self, "list_urls", []) or [])
        html_fetcher = fetcher or self.fetch_html
        self.last_collect_url_diagnostics = []

        for url in list_urls:
            try:
                html = html_fetcher(url)
            except Exception as exc:
                request_errors.append(f"{url}: {exc}")
                url_diagnostics.append(
                    {
                        "url": url,
                        "request_status": "request_failed",
                        "parse_status": "not_attempted",
                        "item_count": 0,
                        "error": str(exc),
                    }
                )
                print(f"[{self.__class__.__name__}] request failed: {url}: {exc}")
                continue

            successful_request_count += 1
            parse_status = "success"
            parse_error = None
            try:
                parsed_items = parser(html, url)
            except Exception as exc:
                parse_errors.append(f"{url}: {exc}")
                parsed_items = []
                parse_status = "parse_failed"
                parse_error = str(exc)
                print(f"[{self.__class__.__name__}] parse failed: {url}: {exc}")

            if not parsed_items:
                parsed_empty_count += 1
                if parse_status == "success":
                    parse_status = "parse_empty"
                print(f"[{self.__class__.__name__}] parsed 0 items: {url}")
            items.extend(parsed_items)
            url_diagnostic: Dict[str, object] = {
                "url": url,
                "request_status": "success",
                "parse_status": parse_status,
                "item_count": len(parsed_items),
            }
            if parse_error is not None:
                url_diagnostic["error"] = parse_error
            if parse_status in {"parse_empty", "parse_failed"}:
                url_diagnostic["html_snapshot"] = self.build_html_snapshot(html)
            url_diagnostics.append(url_diagnostic)

        self.last_collect_url_diagnostics = url_diagnostics

        if items:
            self.last_collect_status = "success"
            self.last_collect_message = (
                f"{self.source_name} collected {len(items)} items "
                f"from {successful_request_count}/{len(list_urls)} urls; "
                f"request_failed={len(request_errors)}; parse_empty={parsed_empty_count}"
            )
            if parse_errors:
                self.last_collect_message += f"; parse_failed={len(parse_errors)}"
            print(
                f"[{self.__class__.__name__}] collected={len(items)} "
                f"urls={successful_request_count}/{len(list_urls)} "
                f"request_failed={len(request_errors)} parse_empty={parsed_empty_count} "
                f"parse_failed={len(parse_errors)}"
            )
            return items

        if request_errors and successful_request_count == 0:
            self.last_collect_status = "request_failed"
            self.last_collect_message = (
                f"all requests failed ({len(request_errors)}/{len(list_urls)}): "
                + "; ".join(request_errors[:2])
            )
        else:
            self.last_collect_status = "parsing_failed"
            source_empty_message = empty_message or f"{self.source_name} 목록 0건 또는 경로 변경 의심"
            self.last_collect_message = (
                f"{source_empty_message}; urls={successful_request_count}/{len(list_urls)}; "
                f"request_failed={len(request_errors)}; parse_empty={parsed_empty_count}"
            )
            if parse_errors:
                self.last_collect_message += f"; parse_failed={len(parse_errors)}"
        print(f"[{self.__class__.__name__}] {self.last_collect_message}")
        return []

    def fetch_html(self, url: str) -> str:
        request = Request(url, headers={"User-Agent": self.user_agent})
        with urlopen(request, timeout=self.timeout_seconds) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="ignore")

    def build_html_snapshot(self, html: str) -> Dict[str, object]:
        soup = self.soup_from_html(html)
        title_text = ""
        if soup.title is not None and soup.title.string is not None:
            title_text = self._clean_text(soup.title.string)
        body_text = self._clean_text(soup.get_text(" ", strip=True))
        html_preview = html[: self.html_snapshot_char_limit]
        body_preview = body_text[: self.text_snapshot_char_limit]
        return {
            "html_length": len(html),
            "html_preview": html_preview,
            "html_preview_truncated": len(html) > self.html_snapshot_char_limit,
            "body_text_preview": body_preview,
            "body_text_preview_truncated": len(body_text) > self.text_snapshot_char_limit,
            "title_text": title_text,
            "script_tag_count": len(soup.select("script")),
            "noscript_tag_count": len(soup.select("noscript")),
            "iframe_tag_count": len(soup.select("iframe")),
            "form_tag_count": len(soup.select("form")),
        }

    def absolute_url(self, base_url: str, maybe_relative: str) -> str:
        return urljoin(base_url, maybe_relative.strip())

    def soup_from_html(self, html: str) -> BeautifulSoup:
        return BeautifulSoup(html, "html.parser")

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
