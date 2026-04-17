from __future__ import annotations

from rag.collector.normalizer import normalize
from rag.collector.tier4_collectors import (
    DobongCollector,
    DobongStartupCollector,
    GuroCollector,
    MapoCollector,
    NowonCollector,
    SeongdongCollector,
)


def test_dobong_startup_parses_notice_and_raw_keys() -> None:
    html = """
    <table>
      <tr>
        <td><a href="/bbs/board.php?bo_table=donotic&wr_id=321">도봉 창업 입주기업 모집</a></td>
        <td class="target">예비창업자</td>
        <td class="status">모집중</td>
        <td>2026.05.30</td>
      </tr>
    </table>
    """

    collector = DobongStartupCollector()

    items = collector.parse_html(
        html,
        base_url="https://dobongstartup.com/bbs/board.php?bo_table=donotic",
        page_source="notice",
    )

    assert len(items) == 1
    assert items[0]["title"] == "도봉 창업 입주기업 모집"
    assert items[0]["category_hint"] == "창업"
    assert items[0]["raw"]["wr_id"] == "321"
    assert items[0]["raw"]["board_table"] == "donotic"
    assert items[0]["raw"]["target_text"] == "예비창업자"
    assert items[0]["raw"]["status_text"] == "모집중"

    normalized = normalize(items[0])
    assert normalized is not None
    assert normalized["source_type"] == "district_crawl"
    assert normalized["collection_method"] == "web_crawl"
    assert normalized["region"] == "서울"
    assert normalized["region_detail"] == "도봉구"


def test_guro_keeps_http_base_url_and_category() -> None:
    html = """
    <div class="product-item">
      <a href="/product/view.php?ca_id=10&num=77&mode=view">구로 청년 IT 취업 부트캠프</a>
      <span class="status">접수중</span>
      <span>2026-05-18</span>
    </div>
    """

    collector = GuroCollector()

    items = collector.parse_html(
        html,
        base_url="http://youtheroom.kr/product/list.php?ca_id=10",
        page_source="program",
    )

    assert len(items) == 1
    assert items[0]["link"].startswith("http://youtheroom.kr/")
    assert items[0]["category_hint"] == "IT"
    assert items[0]["raw"] == {
        "mode": "view",
        "num": "77",
        "ca_id": "10",
        "tbl": "",
        "status_text": "접수중",
        "page_source": "program",
    }


def test_seongdong_uses_ct00006_without_site_sd_dependency() -> None:
    html = """
    <li>
      <a href="/site/main/program/applProgramView?cntrId=CT00006&sprtInfoId=45">성동 AI 취업 특강</a>
      <span class="period">접수기간 2026.05.01 ~ 2026.05.22</span>
      <span class="place">성동청년센터 3층</span>
    </li>
    """

    collector = SeongdongCollector()

    items = collector.parse_html(
        html,
        base_url="https://youth.seoul.go.kr/site/main/program/applProgramList?cntrId=CT00006",
        page_source="program",
    )

    assert len(items) == 1
    assert "cntrId=CT00006" in items[0]["link"]
    assert "site=sd" not in items[0]["link"]
    assert items[0]["category_hint"] == "IT"
    assert items[0]["raw"] == {
        "cntrId": "CT00006",
        "pstSn": "",
        "sprtInfoId": "45",
        "period_text": "접수기간 2026.05.01 ~ 2026.05.22",
        "place_text": "성동청년센터 3층",
        "page_source": "program",
    }


def test_nowon_prefers_imweb_view_link_pattern() -> None:
    html = """
    <div class="card">
      <a href="/?q=YToyOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=901&t=board">
        노원 청년 취업 훈련 과정 모집
      </a>
      <span class="status">모집중</span>
      <span>2026/05/25</span>
    </div>
    """

    collector = NowonCollector()

    items = collector.parse_html(html, base_url="https://www.nwjob.kr", page_source="main")

    assert len(items) == 1
    assert items[0]["category_hint"] == "훈련"
    assert items[0]["raw"]["idx"] == "901"
    assert items[0]["raw"]["q_param"].startswith("YToy")
    assert items[0]["raw"]["board_path"] == "/"
    assert items[0]["raw"]["status_text"] == "모집중"


def test_dobong_filters_general_notice_but_keeps_job_listing() -> None:
    html = """
    <table>
      <tr>
        <td><a href="/WDB_dev/MYDEV/view.asp?code=10008769&num=1">도봉구청 청사 정기 점검 안내</a></td>
      </tr>
      <tr>
        <td><a href="/WDB_dev/MYDEV/view.asp?code=10008770&num=2">도봉 청년 취업 지원 프로그램 참여자 모집</a></td>
        <td>2026-05-14</td>
      </tr>
    </table>
    """

    collector = DobongCollector()

    items = collector.parse_html(
        html,
        base_url="https://www.dobong.go.kr/WDB_dev/MYDEV/bbs.asp?code=10008770",
        page_source="training_board",
    )

    assert len(items) == 1
    assert items[0]["title"] == "도봉 청년 취업 지원 프로그램 참여자 모집"
    assert items[0]["category_hint"] == "취업"
    assert items[0]["raw"] == {
        "code": "10008770",
        "page_source": "training_board",
    }


def test_mapo_reads_main_page_sections_only() -> None:
    html = """
    <section class="notice">
      <ul>
        <li>
          <a href="/program/11">마포 청년 취업 역량강화 교육 모집</a>
          <span>접수마감 2026.05.29</span>
        </li>
      </ul>
    </section>
    """

    collector = MapoCollector()

    items = collector.parse_html(html, base_url="https://mapoworkfare.or.kr", page_source="main")

    assert len(items) == 1
    assert items[0]["category_hint"] == "훈련"
    assert items[0]["raw"] == {
        "page_source": "main",
    }

    normalized = normalize(items[0])
    assert normalized is not None
    assert normalized["source"] == "mapo_workfare"
    assert normalized["deadline"] == "2026-05-29"
