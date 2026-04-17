from __future__ import annotations

import re
from typing import Dict, Iterable, List
from urllib.parse import parse_qs, urlparse

from bs4 import Tag

from .base_html_collector import BaseHtmlCollector


DATE_TOKEN_PATTERN = re.compile(r"20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}")


def _text(node: Tag | None) -> str:
    if node is None:
        return ""
    return " ".join(node.stripped_strings)


def _last_date(text: str) -> str | None:
    matches = DATE_TOKEN_PATTERN.findall(text)
    if not matches:
        return None
    return matches[-1]


def _first_text(container: Tag, selectors: Iterable[str]) -> str | None:
    for selector in selectors:
        node = container.select_one(selector)
        if node is None:
            continue
        text = " ".join(node.stripped_strings).strip()
        if text:
            return text
    return None


class BaseDistrictCollector(BaseHtmlCollector):
    tier = 4
    source_type = "district_crawl"
    collection_method = "web_crawl"
    scope = "district"
    region = "서울"

    list_pages: List[tuple[str, str]] = []

    def collect_items(self) -> List[Dict]:
        items: List[Dict] = []
        request_failures = 0
        for page_source, url in self.list_pages:
            try:
                html = self.fetch_html(url)
            except Exception as exc:
                request_failures += 1
                print(f"[{self.__class__.__name__}] request failed: {url}: {exc}")
                continue
            items.extend(self.parse_html(html, base_url=url, page_source=page_source))

        if items:
            self.last_collect_status = "success"
            self.last_collect_message = f"{self.source_name} collected {len(items)} items"
            return items

        if request_failures == len(self.list_pages):
            self.last_collect_status = "request_failed"
            self.last_collect_message = f"{self.source_name} request failed"
        else:
            self.last_collect_status = "parsing_failed"
            self.last_collect_message = f"{self.source_name} parsing returned 0 items"
        return []

    def parse_html(self, html: str, *, base_url: str, page_source: str) -> List[Dict]:
        raise NotImplementedError

    def _make_item(
        self,
        *,
        title: str,
        link: str,
        raw_text: str,
        raw_deadline: str | None,
        category_hint: str,
        raw: Dict,
        target: List[str] | None = None,
    ) -> Dict | None:
        cleaned_title = self._clean_text(title)
        cleaned_link = link.strip()
        if not cleaned_title or not cleaned_link:
            return None
        return {
            "title": cleaned_title,
            "link": cleaned_link,
            "raw_deadline": raw_deadline,
            "category_hint": category_hint,
            "target": target or self._resolve_targets(raw_text),
            "source_meta": {
                **self.get_source_meta(),
                "source": self.source_name,
                "tier": self.tier,
            },
            "raw": raw,
        }

    def _resolve_targets(self, text: str) -> List[str]:
        mapping = (
            ("청년", "청년"),
            ("중장년", "중장년"),
            ("여성", "여성"),
            ("청소년", "청소년"),
            ("예비창업", "예비창업자"),
            ("창업", "창업자"),
            ("구직", "구직자"),
        )
        targets = [value for keyword, value in mapping if keyword in text]
        return targets or ["일반"]


class DobongStartupCollector(BaseDistrictCollector):
    source_key = "dobong_startup"
    source_name = "도봉구 청년창업센터"
    region_detail = "도봉구"
    base_url = "https://dobongstartup.com"
    list_pages = [
        ("notice", "https://dobongstartup.com/bbs/board.php?bo_table=donotic"),
        ("program", "https://dobongstartup.com/program/programlist.php"),
    ]

    def parse_html(self, html: str, *, base_url: str, page_source: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("tr, li, .card, .program-item, .notice-item, article"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            href = anchor.get("href", "").strip()
            if "donotic" not in href and "/program/" not in href:
                continue
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or not any(token in raw_text for token in ("모집", "창업", "프로그램", "교육", "지원")):
                continue
            query = parse_qs(urlparse(self.absolute_url(base_url, href)).query)
            pg_id = (query.get("pg_id") or [""])[0]
            wr_id = (query.get("wr_id") or [""])[0]
            board_table = (query.get("bo_table") or [""])[0]
            target_text = _first_text(container, (".target", ".badge", ".meta", ".category")) or raw_text
            status_text = _first_text(container, (".status", ".state", ".badge-status")) or raw_text
            item = self._make_item(
                title=title,
                link=self.absolute_url(base_url, href),
                raw_text=raw_text,
                raw_deadline=_last_date(raw_text),
                category_hint="창업",
                raw={
                    "pg_id": pg_id,
                    "wr_id": wr_id,
                    "board_table": board_table,
                    "target_text": self._clean_text(target_text),
                    "status_text": self._clean_text(status_text),
                    "page_source": page_source,
                },
            )
            if item is not None:
                items.append(item)
        return items


class GuroCollector(BaseDistrictCollector):
    source_key = "guro_youth"
    source_name = "구로청년이룸"
    region_detail = "구로구"
    base_url = "http://youtheroom.kr"
    list_pages = [
        ("program", "http://youtheroom.kr/product/list.php?ca_id=10"),
        ("notice", "http://youtheroom.kr/bbs/board.php?tbl=bbs41"),
    ]

    def parse_html(self, html: str, *, base_url: str, page_source: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("tr, li, .card, .product-item, .notice-item, article"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            href = anchor.get("href", "").strip()
            if "product/" not in href and "bbs/board.php" not in href:
                continue
            resolved = self.absolute_url(base_url, href)
            query = parse_qs(urlparse(resolved).query)
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or not any(token in raw_text for token in ("청년", "취업", "교육", "모집", "프로그램", "IT", "개발")):
                continue
            item = self._make_item(
                title=title,
                link=resolved.replace("https://youtheroom.kr", self.base_url),
                raw_text=raw_text,
                raw_deadline=_last_date(raw_text),
                category_hint=self._resolve_category(raw_text),
                raw={
                    "mode": (query.get("mode") or [""])[0],
                    "num": (query.get("num") or [""])[0],
                    "ca_id": (query.get("ca_id") or [""])[0],
                    "tbl": (query.get("tbl") or [""])[0],
                    "status_text": self._clean_text(_first_text(container, (".status", ".state", ".badge")) or raw_text),
                    "page_source": page_source,
                },
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        if any(keyword in text for keyword in ("IT", "개발", "데이터", "AI", "클라우드")):
            return "IT"
        return "취업"


class SeongdongCollector(BaseDistrictCollector):
    source_key = "seongdong_youth"
    source_name = "성동청년플랫폼"
    region_detail = "성동구"
    base_url = "https://youth.seoul.go.kr"
    list_pages = [
        ("program", "https://youth.seoul.go.kr/site/main/program/applProgramList?cntrId=CT00006"),
        ("notice", "https://youth.seoul.go.kr/site/main/board/centerNotice/list?cntrId=CT00006"),
    ]

    def parse_html(self, html: str, *, base_url: str, page_source: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("tr, li, .card, .list-item, article"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            href = anchor.get("href", "").strip()
            resolved = self.absolute_url(base_url, href)
            if "cntrId=CT00006" not in resolved or "site=sd" in resolved:
                continue
            query = parse_qs(urlparse(resolved).query)
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or not any(token in raw_text for token in ("청년", "취업", "교육", "모집", "프로그램", "특강", "채용")):
                continue
            period_text = _first_text(container, (".period", ".date", ".term", ".recruit-period")) or raw_text
            place_text = _first_text(container, (".place", ".location", ".addr")) or ""
            item = self._make_item(
                title=title,
                link=resolved,
                raw_text=raw_text,
                raw_deadline=_last_date(period_text) or _last_date(raw_text),
                category_hint=self._resolve_category(raw_text),
                raw={
                    "cntrId": (query.get("cntrId") or [""])[0],
                    "pstSn": (query.get("pstSn") or [""])[0],
                    "sprtInfoId": (query.get("sprtInfoId") or [""])[0],
                    "period_text": self._clean_text(period_text),
                    "place_text": self._clean_text(place_text),
                    "page_source": page_source,
                },
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        if any(keyword in text for keyword in ("IT", "개발", "데이터", "AI", "코딩")):
            return "IT"
        return "취업"


class NowonCollector(BaseDistrictCollector):
    source_key = "nowon_job"
    source_name = "노원일자리센터"
    region_detail = "노원구"
    base_url = "https://www.nwjob.kr"
    list_pages = [
        ("board", "https://www.nwjob.kr/?q=YToyOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjtzOjQ6InBhZ2UiO2k6MTt9&bmode=list&board=job"),
        ("main", "https://www.nwjob.kr"),
    ]

    def parse_html(self, html: str, *, base_url: str, page_source: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for anchor in soup.select("a[href*='bmode=view'][href*='idx=']"):
            href = anchor.get("href", "").strip()
            resolved = self.absolute_url(base_url, href)
            query = parse_qs(urlparse(resolved).query)
            idx = (query.get("idx") or [""])[0]
            if not idx:
                continue
            container = anchor.find_parent(["li", "tr", "div", "article"]) or anchor
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or not any(token in raw_text for token in ("취업", "채용", "훈련", "교육", "과정", "모집")):
                continue
            item = self._make_item(
                title=title,
                link=resolved,
                raw_text=raw_text,
                raw_deadline=_last_date(raw_text),
                category_hint=self._resolve_category(raw_text),
                raw={
                    "idx": idx,
                    "q_param": (query.get("q") or [""])[0],
                    "board_path": urlparse(resolved).path or "/",
                    "status_text": self._clean_text(_first_text(container, (".status", ".state", ".badge")) or raw_text),
                    "page_source": page_source,
                },
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        if any(keyword in text for keyword in ("훈련", "교육", "과정", "부트캠프")):
            return "훈련"
        return "취업"


class DobongCollector(BaseDistrictCollector):
    source_key = "dobong_gu"
    source_name = "도봉구청"
    region_detail = "도봉구"
    base_url = "https://www.dobong.go.kr"
    list_pages = [
        ("job_board", "https://www.dobong.go.kr/WDB_dev/MYDEV/bbs.asp?code=10008769"),
        ("training_board", "https://www.dobong.go.kr/WDB_dev/MYDEV/bbs.asp?code=10008770"),
    ]
    title_keywords = ("취업", "채용", "일자리", "훈련", "교육", "청년", "인턴", "창업")

    def parse_html(self, html: str, *, base_url: str, page_source: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("tr, li, .banner, .card, article"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            href = anchor.get("href", "").strip()
            resolved = self.absolute_url(base_url, href)
            query = parse_qs(urlparse(resolved).query)
            code = (query.get("code") or [""])[0]
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or not any(keyword in title for keyword in self.title_keywords):
                continue
            item = self._make_item(
                title=title,
                link=resolved,
                raw_text=raw_text,
                raw_deadline=_last_date(raw_text),
                category_hint=self._resolve_category(raw_text),
                raw={
                    "code": code,
                    "page_source": page_source,
                },
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        if any(keyword in text for keyword in ("훈련", "교육", "과정")):
            return "훈련"
        return "취업"


class MapoCollector(BaseDistrictCollector):
    source_key = "mapo_workfare"
    source_name = "마포일자리센터"
    region_detail = "마포구"
    base_url = "https://mapoworkfare.or.kr"
    list_pages = [
        ("main", "https://mapoworkfare.or.kr"),
    ]

    def parse_html(self, html: str, *, base_url: str, page_source: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("section li, .notice li, .program li, .card, article, li"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or not any(token in raw_text for token in ("취업", "채용", "훈련", "교육", "모집", "프로그램")):
                continue
            item = self._make_item(
                title=title,
                link=self.absolute_url(base_url, anchor.get("href", "")),
                raw_text=raw_text,
                raw_deadline=_last_date(raw_text),
                category_hint=self._resolve_category(raw_text),
                raw={
                    "page_source": page_source,
                },
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        if any(keyword in text for keyword in ("훈련", "교육", "과정")):
            return "훈련"
        return "취업"
