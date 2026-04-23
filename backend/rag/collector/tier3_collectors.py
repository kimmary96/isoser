from __future__ import annotations

import re
from typing import Dict, List

from bs4 import Tag

from .base_html_collector import BaseHtmlCollector


DATE_TOKEN_PATTERN = re.compile(r"20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}")


def _text(node: Tag | None) -> str:
    if node is None:
        return ""
    return " ".join(node.stripped_strings)


class KobiaCollector(BaseHtmlCollector):
    tier = 3
    source_key = "KOBIA"
    source_name = "KOBIA"
    source_type = "semi_public_crawl"
    collection_method = "web_crawl"
    scope = "national"
    region = "전국"
    region_detail = "전국"

    board_kind = "KNOTICE"
    list_urls = [
        "http://www.kobia.or.kr/board/list.do?board_kind=KNOTICE",
    ]

    def collect_items(self) -> List[Dict]:
        return self.collect_url_items(
            lambda html, _url: self.parse_html(html),
            empty_message="KOBIA 구조 변경 의심 또는 목록 0건",
        )

    def parse_html(self, html: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []

        for row in soup.select("tbody tr, .board-list tr, .board_list tr, table tr"):
            cells = row.find_all("td")
            raw_text = _text(row)
            if not raw_text:
                continue

            title = self._extract_title(row, cells, raw_text)
            idx = self._extract_idx(row)
            if not title or not idx:
                continue

            posted_at = self._extract_posted_at(cells, raw_text)
            label = self._extract_label(cells)
            item = {
                "title": title,
                "link": (
                    f"http://www.kobia.or.kr/board/view.do?idx={idx}"
                    f"&board_kind={self.board_kind}&page=1"
                ),
                "raw_deadline": posted_at or self.extract_date(title),
                "category_hint": self._resolve_category(title),
                "target": self._resolve_targets(f"{title} {raw_text}"),
                "source_meta": {
                    **self.get_source_meta(),
                    "source": "KOBIA",
                    "tier": 3,
                    "board_kind": self.board_kind,
                },
                "raw": {
                    "idx": idx,
                    "board_kind": self.board_kind,
                    "posted_at": posted_at,
                    "label": label,
                },
            }
            items.append(item)
        return items

    def _extract_title(self, row: Tag, cells: List[Tag], raw_text: str) -> str:
        anchor = row.select_one("a[href], a[onclick]")
        if anchor is not None:
            title = self._clean_text(anchor.get_text(" ", strip=True))
            if title:
                return title

        for cell in cells:
            text = self._clean_text(cell.get_text(" ", strip=True))
            if text and not DATE_TOKEN_PATTERN.fullmatch(text) and text not in {"공지", "일반", "필독"}:
                return text
        return self._clean_text(raw_text)

    def _extract_idx(self, row: Tag) -> str:
        attrs = [
            row.get("data-idx", ""),
        ]
        anchor = row.select_one("a[href], a[onclick]")
        if anchor is not None:
            attrs.extend(
                [
                    anchor.get("data-idx", ""),
                    anchor.get("href", ""),
                    anchor.get("onclick", ""),
                ]
            )

        for value in attrs:
            if not value:
                continue
            match = re.search(r"(?:idx=|fnView\(|goView\(|view\()'?(\d+)'?", value)
            if match is not None:
                return match.group(1)
            digits = re.fullmatch(r"\d+", value.strip())
            if digits is not None:
                return digits.group(0)
        return ""

    def _extract_posted_at(self, cells: List[Tag], raw_text: str) -> str | None:
        for cell in reversed(cells):
            text = self._clean_text(cell.get_text(" ", strip=True))
            if DATE_TOKEN_PATTERN.fullmatch(text):
                return text
        dates = DATE_TOKEN_PATTERN.findall(raw_text)
        if dates:
            return dates[-1]
        return None

    def _extract_label(self, cells: List[Tag]) -> str | None:
        if not cells:
            return None
        first = self._clean_text(cells[0].get_text(" ", strip=True))
        return first or None

    def _resolve_category(self, title: str) -> str:
        if any(keyword in title for keyword in ("교육", "매니저", "자격", "시험")):
            return "훈련"
        if any(keyword in title for keyword in ("경진대회", "설명회", "네트워킹")):
            return "행사/네트워킹"
        return "창업"

    def _resolve_targets(self, text: str) -> List[str]:
        mapping = (
            ("예비창업", "예비창업자"),
            ("초기창업", "초기창업기업"),
            ("창업보육", "창업보육센터"),
            ("보육센터", "창업보육센터"),
            ("매니저", "창업전문매니저"),
        )
        targets = [value for keyword, value in mapping if keyword in text]
        return targets or ["예비창업자", "초기창업기업"]


class KisedCollector(BaseHtmlCollector):
    tier = 3
    source_key = "KISED"
    source_name = "KISED"
    source_type = "semi_public_crawl"
    collection_method = "web_crawl"
    scope = "national"
    region = "전국"
    region_detail = "전국"

    list_urls = [
        "https://www.kised.or.kr/misAnnouncement/index.es?mid=a10302000000",
    ]

    def collect_items(self) -> List[Dict]:
        return self.collect_url_items(
            lambda html, url: self.parse_html(html, base_url=url),
            empty_message="KISED 구조 변경 의심 또는 목록 0건",
        )

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []

        for container in soup.select("tbody tr, li, .board-list-item, .list-item, .card, article"):
            raw_text = _text(container)
            if not raw_text:
                continue

            title = self._extract_title(container)
            link = self._extract_link(container, base_url)
            if not title or not link:
                continue

            period_text = self._extract_period_text(container, raw_text)
            organization_name = self._extract_organization_name(container, raw_text)
            item = {
                "title": title,
                "link": link,
                "raw_deadline": self._extract_end_date(period_text) or self.extract_date(title),
                "category_hint": self._resolve_category(f"{title} {raw_text}"),
                "target": self._resolve_targets(f"{title} {raw_text}"),
                "source_meta": {
                    **self.get_source_meta(),
                    "source": "KISED",
                    "tier": 3,
                    "page": "misAnnouncement",
                },
                "raw": {
                    "period_text": period_text,
                    "organization_name": organization_name,
                    "source_page": "misAnnouncement",
                },
            }
            items.append(item)
        return items

    def _extract_title(self, container: Tag) -> str:
        anchor = container.select_one("a[href], a[onclick]")
        if anchor is not None:
            title = self._clean_text(anchor.get_text(" ", strip=True))
            if title:
                return title

        title_node = container.select_one(".subject, .title, .tit")
        if title_node is not None:
            return self._clean_text(title_node.get_text(" ", strip=True))
        return ""

    def _extract_link(self, container: Tag, base_url: str) -> str:
        for anchor in container.select("a[href]"):
            href = anchor.get("href", "").strip()
            if "k-startup.go.kr" in href:
                return href
            if href and href.startswith(("http://", "https://")):
                return href

        clickable = container.select_one("[onclick]")
        if clickable is None:
            return ""
        onclick = clickable.get("onclick", "")
        match = re.search(r"(https?://[^'\"\s]*k-startup\.go\.kr[^'\"\s]*)", onclick)
        if match is not None:
            return match.group(1)
        match = re.search(r"location\.href=['\"]([^'\"]+)['\"]", onclick)
        if match is not None:
            href = match.group(1)
            if href.startswith(("http://", "https://")):
                return href
            return self.absolute_url(base_url, href)
        return ""

    def _extract_period_text(self, container: Tag, raw_text: str) -> str | None:
        for selector in (".period", ".date", ".term", ".biz_period"):
            node = container.select_one(selector)
            if node is not None:
                text = self._clean_text(node.get_text(" ", strip=True))
                if text:
                    return text
        if "사업기간" in raw_text:
            return raw_text
        return None

    def _extract_organization_name(self, container: Tag, raw_text: str) -> str | None:
        for selector in (".organization", ".org", ".company", ".agency"):
            node = container.select_one(selector)
            if node is not None:
                text = self._clean_text(node.get_text(" ", strip=True))
                if text:
                    return text

        for cell in container.find_all("td"):
            text = self._clean_text(cell.get_text(" ", strip=True))
            if text and any(token in text for token in ("창업", "센터", "원", "기관", "재단")):
                return text
        return None if not raw_text else None

    def _extract_end_date(self, period_text: str | None) -> str | None:
        if not period_text:
            return None
        dates = DATE_TOKEN_PATTERN.findall(period_text)
        if not dates:
            return None
        return dates[-1]

    def _resolve_category(self, text: str) -> str:
        for keyword in ("오픈이노베이션", "초격차", "예비창업", "글로벌", "공간", "보육"):
            if keyword in text:
                return keyword
        return "창업"

    def _resolve_targets(self, text: str) -> List[str]:
        mapping = (
            ("예비창업", "예비창업자"),
            ("초기창업", "초기창업기업"),
            ("도약", "도약기 창업기업"),
            ("중장년", "중장년"),
            ("1인", "1인 창조기업"),
        )
        targets = [value for keyword, value in mapping if keyword in text]
        return targets or ["예비창업자", "초기창업기업"]
