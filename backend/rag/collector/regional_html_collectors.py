from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional

from bs4 import BeautifulSoup, Tag

from .base_html_collector import BaseHtmlCollector


def _text(node: Tag | None) -> str:
    if node is None:
        return ""
    return " ".join(node.stripped_strings)


def _first(nodes: Iterable[Tag | None]) -> Tag | None:
    for node in nodes:
        if node is not None:
            return node
    return None


class SeoulJobPortalCollector(BaseHtmlCollector):
    source_key = "seoul_job_portal"
    source_name = "서울일자리포털"
    list_urls = [
        "https://job.seoul.go.kr/www/job_support_service/openChasm/selectOpenChasmList.do",
        "https://job.seoul.go.kr/www/add_service/openJobCafe/selectOpenJobCafeList.do",
    ]
    title_keywords = ("매력일자리", "직무캠프", "취업", "일자리카페", "인턴", "청년")

    def collect_items(self) -> List[Dict]:
        items: List[Dict] = []
        for url in self.list_urls:
            try:
                html = self.fetch_html(url)
            except Exception as exc:
                print(f"[{self.__class__.__name__}] request failed: {url}: {exc}")
                continue
            items.extend(self.parse_html(html, base_url=url))
        return items

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for anchor in soup.select("a[href]"):
            title = self._clean_text(anchor.get_text(" ", strip=True))
            if not title or not any(keyword in title for keyword in self.title_keywords):
                continue
            container = anchor.find_parent(["li", "tr", "div", "article", "dl"]) or anchor
            raw_text = _text(container)
            link = self.absolute_url(base_url, anchor.get("href", ""))
            item = self.make_item(
                title=title,
                link=link,
                raw=raw_text,
                raw_deadline=self.extract_date(raw_text),
                category_hint="취업",
            )
            if item is not None:
                items.append(item)
        return items


class SbaPostingCollector(BaseHtmlCollector):
    source_key = "sba_posting"
    source_name = "서울경제진흥원 사업신청"
    list_urls = [
        "https://www.sba.kr/Pages/BusinessApply/Posting.aspx",
    ]
    category_map = {
        "창업": "창업",
        "교육": "교육",
        "세미나": "네트워킹",
        "행사": "네트워킹",
        "일자리": "취업",
    }

    def collect_items(self) -> List[Dict]:
        items: List[Dict] = []
        for url in self.list_urls:
            try:
                html = self.fetch_html(url)
            except Exception as exc:
                print(f"[{self.__class__.__name__}] request failed: {url}: {exc}")
                continue
            items.extend(self.parse_html(html, base_url=url))
        return items

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("tr, li, .board-list-item, .list-item, .card"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            title = self._clean_text(anchor.get_text(" ", strip=True))
            if not title:
                continue
            raw_text = _text(container)
            if "접수" not in raw_text and "사업" not in raw_text and "모집" not in raw_text:
                continue
            category_hint = self._resolve_category(raw_text)
            item = self.make_item(
                title=title,
                link=self.absolute_url(base_url, anchor.get("href", "")),
                raw=raw_text,
                raw_deadline=self.extract_date(raw_text),
                category_hint=category_hint,
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        for keyword, category in self.category_map.items():
            if keyword in text:
                return category
        return "창업" if "사업" in text else "교육"


class SesacCollector(BaseHtmlCollector):
    source_key = "sesac"
    source_name = "청년취업사관학교 SeSAC"
    list_urls = [
        "https://sesac.seoul.kr/sesac/course/offline/list.do",
    ]

    def collect_items(self) -> List[Dict]:
        items: List[Dict] = []
        for url in self.list_urls:
            try:
                html = self.fetch_html(url)
            except Exception as exc:
                print(f"[{self.__class__.__name__}] request failed: {url}: {exc}")
                continue
            items.extend(self.parse_html(html, base_url=url))
        return items

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("li, .course-card, .list-item, .course_list_item"):
            anchor = _first(
                [
                    container.select_one("a[href]"),
                    container.find("a", href=True),
                ]
            )
            if anchor is None:
                continue
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or ("모집" not in raw_text and "교육" not in raw_text and "과정" not in raw_text):
                continue
            item = self.make_item(
                title=title,
                link=self.absolute_url(base_url, anchor.get("href", "")),
                raw=raw_text,
                raw_deadline=self.extract_date(raw_text),
                category_hint="교육",
                target=["청년"],
            )
            if item is not None:
                items.append(item)
        return items


class Seoul50PlusCollector(BaseHtmlCollector):
    source_key = "seoul_50plus"
    source_name = "서울시 50플러스"
    list_urls = [
        "https://www.50plus.or.kr/org/program.do",
    ]

    def collect_items(self) -> List[Dict]:
        items: List[Dict] = []
        for url in self.list_urls:
            try:
                html = self.fetch_html(url)
            except Exception as exc:
                print(f"[{self.__class__.__name__}] request failed: {url}: {exc}")
                continue
            items.extend(self.parse_html(html, base_url=url))
        return items

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("li, tr, .list-item, .card, article"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or not any(token in raw_text for token in ("50+", "중장년", "교육", "일자리", "모집", "강좌")):
                continue
            item = self.make_item(
                title=title,
                link=self.absolute_url(base_url, anchor.get("href", "")),
                raw=raw_text,
                raw_deadline=self.extract_date(raw_text),
                category_hint=self._resolve_category(raw_text),
                target=["중장년"],
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        if any(keyword in text for keyword in ("일자리", "채용", "취업")):
            return "취업"
        return "교육"


class CampusTownCollector(BaseHtmlCollector):
    source_key = "campus_town"
    source_name = "서울캠퍼스타운"
    list_urls = [
        "https://campustown.seoul.go.kr/site/main/program/program/list",
    ]

    def collect_items(self) -> List[Dict]:
        items: List[Dict] = []
        for url in self.list_urls:
            try:
                html = self.fetch_html(url)
            except Exception as exc:
                print(f"[{self.__class__.__name__}] request failed: {url}: {exc}")
                continue
            items.extend(self.parse_html(html, base_url=url))
        return items

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for node in soup.select("[data-title][data-url]"):
            title = self._clean_text(node.get("data-title", ""))
            link = self.absolute_url(base_url, node.get("data-url", ""))
            start_date = self._clean_text(node.get("data-startdate", "") or node.get("data-startDate", ""))
            end_date = self._clean_text(node.get("data-enddate", "") or node.get("data-endDate", ""))
            raw_text = self.extract_texts(
                [
                    title,
                    start_date,
                    end_date,
                    _text(node if isinstance(node, Tag) else None),
                ]
            )
            item = self.make_item(
                title=title,
                link=link,
                raw=raw_text,
                raw_deadline=end_date or self.extract_date(raw_text),
                category_hint=self._resolve_category(raw_text),
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        if any(keyword in text for keyword in ("네트워킹", "행사", "데모데이", "IR")):
            return "네트워킹"
        return "창업"


class SeoulWomanUpCollector(BaseHtmlCollector):
    source_key = "seoul_womanup"
    source_name = "서울커리업"
    list_urls = [
        "https://womanup.seoulwomanup.or.kr/womanup/edu/selectThisMonthPageList.do",
        "https://womanup.seoulwomanup.or.kr/womanup/main/main.do",
    ]

    def collect_items(self) -> List[Dict]:
        items: List[Dict] = []
        for url in self.list_urls:
            try:
                html = self.fetch_html(url)
            except Exception as exc:
                print(f"[{self.__class__.__name__}] request failed: {url}: {exc}")
                continue
            items.extend(self.parse_html(html, base_url=url))
        return items

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("li, tr, .list-item, .card, article, .program-item"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if not title or not any(token in raw_text for token in ("교육", "프로그램", "인턴", "모집", "신청")):
                continue
            item = self.make_item(
                title=title,
                link=self.absolute_url(base_url, anchor.get("href", "")),
                raw=raw_text,
                raw_deadline=self.extract_date(raw_text),
                category_hint=self._resolve_category(raw_text),
                target=["여성"],
            )
            if item is not None:
                items.append(item)
        return items

    def _resolve_category(self, text: str) -> str:
        if "인턴" in text or "취업" in text:
            return "취업"
        return "교육"
