from __future__ import annotations

from rag.collector.normalizer import normalize
from rag.collector.tier4_collectors import (
    DistrictHtmlCollector,
    DobongCollector,
    DobongStartupCollector,
    GuroCollector,
    MapoCollector,
    NowonCollector,
    SeongdongCollector,
)


class _DiagnosticDistrictCollector(DistrictHtmlCollector):
    source_key = "diagnostic_district"
    source_name = "진단 구 수집기"
    region_detail = "테스트구"
    list_urls = [
        "https://example.com/empty",
        "https://example.com/match",
        "https://example.com/fail",
    ]
    empty_message = "진단 목록 0건"

    def fetch_html(self, url: str) -> str:
        if url.endswith("/fail"):
            raise RuntimeError("blocked")
        return url

    def parse_html(self, html: str, *, base_url: str):
        if base_url.endswith("/empty"):
            return []
        return [
            self.build_item(
                title="테스트 취업 프로그램",
                link="https://example.com/program/1",
                raw={"page_source": "test"},
                category_hint="취업",
            )
        ]


class _EmptyDiagnosticDistrictCollector(_DiagnosticDistrictCollector):
    list_urls = ["https://example.com/empty"]

    def parse_html(self, html: str, *, base_url: str):
        return []


class _RequestFailedDistrictCollector(_DiagnosticDistrictCollector):
    list_urls = ["https://example.com/fail"]


def test_dobong_startup_parses_program_listing_with_stable_ids() -> None:
    html = """
    <ul class="program_box">
      <li>
        <a href="/program/programview.php?pg_id=77"></a>
        <div class="subject">도봉 청년 창업 실전 프로그램</div>
        <div class="tit">기간</div>
        <div class="text">2026.04.20 ~ 2026.05.03</div>
        <div class="tit">신청대상</div>
        <div class="text">도봉구 청년 예비창업자</div>
      </li>
    </ul>
    """

    collector = DobongStartupCollector()

    items = collector.parse_html(
        html,
        base_url="https://dobongstartup.com/program/programlist.php",
    )

    assert len(items) == 1
    assert items[0]["title"] == "도봉 청년 창업 실전 프로그램"
    assert items[0]["link"] == "https://dobongstartup.com/program/programview.php?pg_id=77"
    assert items[0]["raw_deadline"] == "2026-05-03"
    assert items[0]["category_hint"] == "창업"
    assert items[0]["target"] == ["청년"]
    assert items[0]["raw"]["pg_id"] == "77"
    assert items[0]["raw"]["page_source"] == "program"


def test_district_collector_records_url_level_diagnostics() -> None:
    collector = _DiagnosticDistrictCollector()

    items = collector.collect_items()

    assert len(items) == 1
    assert collector.last_collect_status == "success"
    assert "from 2/3 urls" in collector.last_collect_message
    assert "request_failed=1" in collector.last_collect_message
    assert "parse_empty=1" in collector.last_collect_message


def test_district_collector_distinguishes_parse_empty_and_request_failure() -> None:
    empty_collector = _EmptyDiagnosticDistrictCollector()
    failed_collector = _RequestFailedDistrictCollector()

    assert empty_collector.collect_items() == []
    assert empty_collector.last_collect_status == "parsing_failed"
    assert "진단 목록 0건" in empty_collector.last_collect_message
    assert "parse_empty=1" in empty_collector.last_collect_message

    assert failed_collector.collect_items() == []
    assert failed_collector.last_collect_status == "request_failed"
    assert "all requests failed" in failed_collector.last_collect_message
    assert "blocked" in failed_collector.last_collect_message


def test_guro_collector_uses_http_program_listing_and_it_category() -> None:
    html = """
    <ul>
      <li class="gallery_Card1">
        <a href="/product/item.php?it_id=555&ca_id=10"></a>
        <h4>AI 면접 대비 부트캠프</h4>
        <div class="gallery_ing">
          <em>모집중</em>
          <p>신청마감 2026.05.09</p>
        </div>
      </li>
    </ul>
    """

    collector = GuroCollector()

    items = collector.parse_html(
        html,
        base_url="http://youtheroom.kr/product/list.php?ca_id=10",
    )

    assert len(items) == 1
    assert items[0]["link"].startswith("http://youtheroom.kr/")
    assert items[0]["category_hint"] == "IT"
    assert items[0]["raw_deadline"] == "2026-05-09"
    assert items[0]["raw"]["ca_id"] == "10"
    assert items[0]["raw"]["page_source"] == "program"


def test_seongdong_collector_keeps_fixed_center_id_in_detail_link() -> None:
    html = """
    <div class="gallery-list-st1">
      <div class="list">
        <a onclick="goView('9001')"></a>
        <div class="ti">성동 청년 AI 취업 스터디</div>
        <div class="cate1">모집중</div>
        <ul class="list-info">
          <li><em>신청기간</em><span>2026.04.10 ~ 2026.04.28</span></li>
          <li><em>장소</em><span>성동 오랑</span></li>
        </ul>
      </div>
    </div>
    """

    collector = SeongdongCollector()

    items = collector.parse_html(
        html,
        base_url="https://youth.seoul.go.kr/orang/cntr/program.do?key=2309210001&cntrId=CT00006",
    )

    assert len(items) == 1
    assert "cntrId=CT00006" in items[0]["link"]
    assert "site=sd" not in items[0]["link"]
    assert items[0]["category_hint"] == "IT"
    assert items[0]["raw_deadline"] == "2026-04-28"
    assert items[0]["raw"]["sprtInfoId"] == "9001"


def test_nowon_collector_marks_ambiguous_titles_as_other_instead_of_employment() -> None:
    html = """
    <div>
      <a href="/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=100&t=board">
        청년 프로그램 안내
      </a>
    </div>
    """

    collector = NowonCollector()

    items = collector.parse_html(html, base_url="https://www.nwjob.kr/18")

    assert len(items) == 1
    assert items[0]["category_hint"] == "기타"
    assert items[0]["raw"]["idx"] == "100"
    assert items[0]["raw"]["page_source"] == "board"

    normalized = normalize(items[0])

    assert normalized is not None
    assert normalized["category"] == "기타"
    assert normalized["source_type"] == "district_crawl"
    assert normalized["region"] == "서울"
    assert normalized["region_detail"] == "노원구"


def test_dobong_collector_applies_keyword_filter_to_board_rows() -> None:
    html = """
    <table>
      <tbody>
        <tr>
          <td>1</td>
          <td><a href="/bbs.asp?bmode=D&pcode=123&code=10008769">도봉 취업 아카데미 참여자 모집</a></td>
          <td>2026-04-20</td>
          <td>일자리경제과</td>
        </tr>
        <tr>
          <td>2</td>
          <td><a href="/bbs.asp?bmode=D&pcode=124&code=10008769">구정 일반 안내</a></td>
          <td>2026-04-21</td>
          <td>홍보담당관</td>
        </tr>
      </tbody>
    </table>
    """

    collector = DobongCollector()

    items = collector.parse_html(
        html,
        base_url="https://www.dobong.go.kr/bbs.asp?code=10008769",
    )

    assert len(items) == 1
    assert items[0]["title"] == "도봉 취업 아카데미 참여자 모집"
    assert items[0]["category_hint"] == "취업"
    assert items[0]["raw"]["code"] == "10008769"
    assert items[0]["raw"]["page_source"] == "notice"


def test_mapo_collector_parses_main_program_and_notice_sections() -> None:
    html = """
    <ul class="widgetZineA">
      <li>
        <a class="title" href="/program/alpha">청년도전 취업 교육</a>
        <p class="board"><a href="/programview"></a></p>
        <span>접수 2026.04.11 ~ 2026.04.30</span>
      </li>
    </ul>
    <div class="contRight">
      <div class="title">
        <a href="/notice/beta">채용 준비 교육 안내</a>
        <span class="regdate">2026.04.22</span>
      </div>
    </div>
    """

    collector = MapoCollector()

    items = collector.parse_html(html, base_url="https://mapoworkfare.or.kr/")

    assert len(items) == 2
    assert {item["raw"]["page_source"] for item in items} == {"main"}
    assert any(item["title"] == "청년도전 취업 교육" and item["category_hint"] == "취업" for item in items)
    assert any(item["title"] == "채용 준비 교육 안내" and item["category_hint"] == "취업" for item in items)
