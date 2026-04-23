from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup, Tag

from .base_html_collector import BaseHtmlCollector
from .program_field_mapping import extract_skill_keywords


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
        "https://job.seoul.go.kr/hmpg/chjb/prmg/prmgListPgng.do",
        "https://job.seoul.go.kr/hmpg/chjb/pvmg/pcmgListPgng.do",
        "https://job.seoul.go.kr/hmpg/chjb/prnt/prntListPgng.do",
    ]
    title_keywords = ("매력일자리", "직무캠프", "취업", "일자리카페", "인턴", "청년")

    def collect_items(self) -> List[Dict]:
        return self.collect_url_items(
            lambda html, url: self.parse_html(html, base_url=url),
            fetcher=self._fetch_fragment,
            empty_message="서울일자리포털 목록 0건 또는 경로 변경 의심",
        )

    def _fetch_fragment(self, url: str) -> str:
        request = Request(
            url,
            data=b"",
            headers={
                "User-Agent": self.user_agent,
                "X-Requested-With": "XMLHttpRequest",
            },
        )
        with urlopen(request, timeout=self.timeout_seconds) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="ignore")

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for anchor in soup.select("a[href], a[onclick]"):
            title = self._clean_title(anchor.get_text(" ", strip=True))
            container = anchor.find_parent(["li", "tr", "div", "article", "dl"]) or anchor
            raw_text = _text(container)
            if not title:
                continue
            if title.lower().endswith((".xlsx", ".xls", ".pdf", ".hwp")):
                continue
            link = self._resolve_link(base_url, anchor)
            if not link or "fileDownLoad.do" in link:
                continue
            if self._should_skip_listing(title=title, raw_text=raw_text, link=link):
                continue
            item = self.make_item(
                title=title,
                link=link,
                raw=raw_text,
                raw_deadline=self.extract_date(raw_text),
                category_hint="교육" if "교육" in raw_text or "과정" in raw_text else "취업",
            )
            if item is not None:
                items.append(item)
        return items

    def _clean_title(self, title: str) -> str:
        cleaned = self._clean_text(title)
        cleaned = re.sub(r"\s*\([^)]*첨부[^)]*\)\s*", " ", cleaned)
        return self._clean_text(cleaned)

    def _should_skip_listing(self, *, title: str, raw_text: str, link: str) -> bool:
        searchable = f"{title} {raw_text}"
        if not any(keyword in searchable for keyword in self.title_keywords) and "모집" not in raw_text:
            return True
        if "bordContDetail.do" in link:
            return not any(token in searchable for token in ("모집", "공고", "특강", "직무캠프", "인턴"))
        if "job.seoul.go.kr" not in link:
            return not any(token in searchable for token in ("과정", "교육", "취업", "인턴", "직무캠프"))
        return False

    def _resolve_link(self, base_url: str, anchor: Tag) -> str:
        href = anchor.get("href", "").strip()
        onclick = anchor.get("onclick", "")
        if href and href != "javascript:;" and not href.startswith("javascript:"):
            return self.absolute_url(base_url, href)
        detail_match = re.search(r"prmgDetail\('([^']+)'\)", href)
        if detail_match:
            return self.absolute_url(
                base_url,
                f"/hmpg/chjb/prmg/prmgDetail.do?recmnt_pbanc_no={detail_match.group(1)}",
            )
        notice_match = re.search(r"bordContDetail\.do[^\"'\s]*", href)
        if notice_match:
            return self.absolute_url(base_url, notice_match.group(0))
        notice_match = re.search(r"bordContDetail\.do[^\"'\s]*", onclick)
        if notice_match:
            return self.absolute_url(base_url, notice_match.group(0))
        return ""


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
        return self.collect_url_items(
            lambda html, url: self.parse_html(html, base_url=url),
            empty_message="서울경제진흥원 사업신청 목록 0건 또는 경로 변경 의심",
        )

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("tr, .board-list-item, .list-item, .card"):
            raw_text = _text(container)
            if "접수일정" not in raw_text and "접수" not in raw_text and "사업" not in raw_text and "모집" not in raw_text:
                continue
            title = self._extract_title(raw_text, container)
            link = self._extract_link(base_url, container)
            if not title or not link:
                continue
            category_hint = self._resolve_category(raw_text)
            item = self.make_item(
                title=title,
                link=link,
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

    def _extract_title(self, raw_text: str, container: Tag) -> str:
        anchor = container.select_one("a[href]")
        if anchor is not None:
            title = self._clean_text(anchor.get_text(" ", strip=True))
            if title and title not in {"전체 사업", "접수중인 사업", "접수마감 사업"}:
                return title

        title_match = re.search(r"유형\s*:\s*.+?\s(.+?)\s담당부서", raw_text)
        if title_match:
            return self._clean_text(title_match.group(1))

        for line in (self._clean_text(value) for value in raw_text.splitlines()):
            if line and any(token in line for token in ("모집", "지원", "공모")):
                return line
        return ""

    def _extract_link(self, base_url: str, container: Tag) -> str:
        anchor = container.select_one("a[href]")
        if anchor is not None:
            href = anchor.get("href", "").strip()
            if href and href != "javascript:;" and not href.startswith("javascript:"):
                return self.absolute_url(base_url, href)

        clickable = container.select_one("[onclick]")
        if clickable is None:
            return ""
        onclick = clickable.get("onclick", "")
        match = re.search(r"location\.href='([^']+)'", onclick)
        if match:
            return self.absolute_url(base_url, match.group(1))
        return ""


class SesacCollector(BaseHtmlCollector):
    source_key = "sesac"
    source_name = "청년취업사관학교 SeSAC"
    list_urls = [
        "https://sesac.seoul.kr/sesac/course/offline/courseList.do",
    ]

    def collect_items(self) -> List[Dict]:
        return self.collect_url_items(
            lambda html, url: self.parse_html(html, base_url=url),
            empty_message="SeSAC 과정 목록 0건 또는 경로 변경 의심",
        )

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
            href = anchor.get("href", "")
            title = self._clean_text(anchor.get_text(" ", strip=True))
            raw_text = _text(container)
            if (
                not title
                or href.startswith("javascript:")
                or ("courseDetail.do" not in href and "모집" not in raw_text and "모집 기간" not in raw_text)
            ):
                continue
            item = self.make_item(
                title=self._clean_live_title(title, raw_text),
                link=self.absolute_url(base_url, href),
                raw=raw_text,
                raw_deadline=self._extract_period(raw_text)[1] or self.extract_date(raw_text),
                category_hint="교육",
                target=["청년"],
            )
            if item is not None:
                start_date, end_date = self._extract_period(raw_text)
                if start_date:
                    item["start_date"] = start_date
                if end_date:
                    item["end_date"] = end_date
                location = self._extract_location(title, raw_text)
                if location:
                    item["location"] = location
                item["provider"] = self.source_name
                item["description"] = self._clean_live_title(title, raw_text)
                item["skills"] = extract_skill_keywords(title, raw_text)
                item["cost"] = 0
                items.append(item)
        return items

    def _clean_live_title(self, title: str, raw_text: str) -> str:
        cleaned = self._clean_text(title)
        cleaned = re.sub(r"^(모집중|상시모집|마감임박)\s+", "", cleaned)
        cleaned = re.sub(r"\s+D-\d+\b", "", cleaned)
        cleaned = re.sub(r"\s+모집\s*기간\s+\d{4}[./-]\d{1,2}[./-]\d{1,2}\s*-\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}.*$", "", cleaned)
        cleaned = re.sub(r"\s+\d+$", "", cleaned)
        if not cleaned or cleaned == title:
            cleaned = re.sub(r"\s+모집\s*기간\s+.*$", "", raw_text)
        return self._clean_text(cleaned)

    def _extract_period(self, text: str) -> tuple[str | None, str | None]:
        match = re.search(
            r"모집\s*기간\s+(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*-\s*(\d{4})[./-](\d{1,2})[./-](\d{1,2})",
            self._clean_text(text),
        )
        if not match:
            return None, None
        start_year, start_month, start_day, end_year, end_month, end_day = match.groups()
        return (
            f"{start_year}-{int(start_month):02d}-{int(start_day):02d}",
            f"{end_year}-{int(end_month):02d}-{int(end_day):02d}",
        )

    def _extract_location(self, title: str, raw_text: str) -> str | None:
        combined = f"{title} {raw_text}"
        districts = (
            "강남",
            "강동",
            "강북",
            "강서",
            "관악",
            "광진",
            "구로",
            "금천",
            "노원",
            "도봉",
            "동대문",
            "동작",
            "마포",
            "서대문",
            "서초",
            "성동",
            "성북",
            "송파",
            "양천",
            "영등포",
            "용산",
            "은평",
            "종로",
            "중구",
            "중랑",
        )
        for district in districts:
            if district in combined:
                return f"서울 {district}구"
        return "서울"


class Seoul50PlusCollector(BaseHtmlCollector):
    source_key = "seoul_50plus"
    source_name = "서울시 50플러스"
    list_urls = [
        "https://service1.50plus.or.kr/",
    ]

    def collect_items(self) -> List[Dict]:
        return self.collect_url_items(
            lambda html, url: self.parse_html(html, base_url=url),
            empty_message="서울시 50플러스 목록 0건 또는 경로 변경 의심",
        )

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for anchor in soup.select("a[href*='/in_appView.do?ANN_NO=']"):
            title = self._clean_title(anchor.get_text(" ", strip=True), _text(anchor.find_parent(["li", "div", "article"]) or anchor))
            if not title:
                continue
            container = anchor.find_parent(["li", "div", "article"]) or anchor
            raw_text = _text(container)
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
        for container in soup.select("li, tr, .list-item, .card, article"):
            anchor = container.select_one("a[href]")
            if anchor is None:
                continue
            title = self._clean_title(anchor.get_text(" ", strip=True), _text(container))
            href = anchor.get("href", "")
            if (
                href.startswith("javascript:")
                or "/in_appView.do?ANN_NO=" in href
                or self._is_menu_like_title(title)
            ):
                continue
            raw_text = _text(container)
            if not title or not any(token in raw_text for token in ("50+", "중장년", "교육", "일자리", "모집", "강좌")):
                continue
            if not any(token in raw_text for token in ("모집", "채용", "강좌", "신청")) and self.extract_date(raw_text) is None:
                continue
            item = self.make_item(
                title=title,
                link=self.absolute_url(base_url, href),
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

    def _clean_title(self, title: str, raw_text: str) -> str:
        cleaned = self._clean_text(title)
        if any(token in cleaned for token in ("모집기간", "모집인원", "활동비", "행사일자", "행사장소")):
            cleaned = raw_text
        cleaned = re.sub(r"^(기타|민간채용공고|채용설명회|취업 훈련|AI 디지털 교육|건강몽땅 교육|50플러스센터 교육)\s+", "", cleaned)
        cleaned = re.sub(r"\s+활동비\s*:.*$", "", cleaned)
        cleaned = re.sub(r"\s+모집인원\s*:.*$", "", cleaned)
        cleaned = re.sub(r"\s+모집기간\s*:\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}\s*-\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}.*$", "", cleaned)
        cleaned = re.sub(r"\s+행사일자\s*:.*$", "", cleaned)
        cleaned = re.sub(r"\s+행사장소\s*:.*$", "", cleaned)
        cleaned = re.sub(r"\s+신청\s*[··]\s*접수하기.*$", "", cleaned)
        return self._clean_text(cleaned)

    def _is_menu_like_title(self, title: str) -> bool:
        if not title:
            return True
        if title in {"중장년취업사관학교", "취업상담", "직업교육", "취업지원", "기업지원", "일자리 참여 신청", "참여 신청", "신청하기"}:
            return True
        return bool(re.fullmatch(r"(일자리|교육|강좌)\s*참여\s*신청", title))


class CampusTownCollector(BaseHtmlCollector):
    source_key = "campus_town"
    source_name = "서울캠퍼스타운"
    list_urls = [
        "https://campustown.seoul.go.kr/site/main/board/university_news/list",
    ]

    def collect_items(self) -> List[Dict]:
        return self.collect_url_items(
            lambda html, url: self.parse_html(html, base_url=url),
            empty_message="서울캠퍼스타운 목록 0건 또는 경로 변경 의심",
        )

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

        for anchor in soup.select("a[href*='/site/main/board/university_news/']"):
            title = self._clean_text(anchor.get_text(" ", strip=True))
            if not title or title == "캠타프로그램":
                continue
            container = anchor.find_parent(["li", "tr", "div", "article"]) or anchor
            raw_text = self.extract_texts([title, _text(container)])
            item = self.make_item(
                title=title,
                link=self.absolute_url(base_url, anchor.get("href", "")),
                raw=raw_text,
                raw_deadline=self.extract_date(raw_text),
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
        "https://project.seoulcareerup.or.kr/swm/internship/recruit/list.do?menu_no=02030200",
    ]

    def collect_items(self) -> List[Dict]:
        return self.collect_url_items(
            lambda html, url: self.parse_html(html, base_url=url),
            empty_message="서울커리업 목록 0건 또는 경로 변경 의심",
        )

    def parse_html(self, html: str, *, base_url: str) -> List[Dict]:
        soup = self.soup_from_html(html)
        items: List[Dict] = []
        for container in soup.select("tbody tr"):
            cells = [self._clean_text(cell.get_text(" ", strip=True)) for cell in container.find_all("td")]
            if len(cells) < 6:
                continue
            recruit_type = cells[1]
            district = cells[2]
            job_field = cells[3]
            company = cells[5]
            detail = container.select_one("a[onclick]")
            if not company or not job_field or detail is None:
                continue
            match = re.search(r"fnView\((\d+)\)", detail.get("onclick", ""))
            if match is None:
                continue
            title = self._clean_text(f"{company} {job_field} 인턴십")
            raw_text = self.extract_texts(cells)
            if district:
                raw_text = self.extract_texts([raw_text, district])
            item = self.make_item(
                title=title,
                link=self.absolute_url(
                    base_url,
                    f"/swm/internship/recruit/view.do?jobDescriptionId={match.group(1)}&menu_no=02030200",
                ),
                raw=raw_text,
                raw_deadline=self.extract_date(raw_text),
                category_hint="취업",
                target=["여성"],
                sponsor_name=company,
            )
            if item is not None:
                items.append(item)

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
