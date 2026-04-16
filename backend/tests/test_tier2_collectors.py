from __future__ import annotations

from rag.collector.regional_html_collectors import (
    CampusTownCollector,
    SbaPostingCollector,
    SesacCollector,
    Seoul50PlusCollector,
    SeoulJobPortalCollector,
    SeoulWomanUpCollector,
)


def test_seoul_job_portal_filters_program_like_titles() -> None:
    html = """
    <ul>
      <li><a href="/program/1">서울 매력일자리 청년인턴 모집</a><span>접수마감 2026.05.10</span></li>
      <li><a href="/job/2">일반 채용 공고</a><span>2026.05.11</span></li>
    </ul>
    """

    collector = SeoulJobPortalCollector()

    items = collector.parse_html(html, base_url="https://job.seoul.go.kr")

    assert len(items) == 1
    assert items[0]["title"] == "서울 매력일자리 청년인턴 모집"
    assert items[0]["link"] == "https://job.seoul.go.kr/program/1"
    assert items[0]["category_hint"] == "취업"
    assert items[0]["raw_deadline"] == "2026.05.10"


def test_sba_posting_parses_category_from_listing_text() -> None:
    html = """
    <table>
      <tr>
        <td>교육</td>
        <td><a href="/Pages/BusinessApply/View.aspx?id=10">서울 AI 실무 교육</a></td>
        <td>접수기간 2026-04-20 ~ 2026-05-03</td>
      </tr>
    </table>
    """

    collector = SbaPostingCollector()

    items = collector.parse_html(html, base_url="https://www.sba.kr")

    assert len(items) == 1
    assert items[0]["category_hint"] == "교육"
    assert items[0]["raw_deadline"] == "2026-04-20"


def test_sesac_marks_youth_training_programs() -> None:
    html = """
    <ul>
      <li class="course-card">
        <a href="/sesac/course/offline/view.do?courseId=1">SeSAC 데이터 분석 과정</a>
        <span>모집기간 2026.04.15 ~ 2026.05.01</span>
      </li>
    </ul>
    """

    collector = SesacCollector()

    items = collector.parse_html(html, base_url="https://sesac.seoul.kr")

    assert len(items) == 1
    assert items[0]["title"] == "SeSAC 데이터 분석 과정"
    assert items[0]["category_hint"] == "교육"
    assert items[0]["target"] == ["청년"]


def test_seoul_50plus_captures_target_and_category() -> None:
    html = """
    <div class="card">
      <a href="/org/program/123">50+ 중장년 재취업 지원 과정</a>
      <p>교육 신청 2026/05/12</p>
    </div>
    """

    collector = Seoul50PlusCollector()

    items = collector.parse_html(html, base_url="https://www.50plus.or.kr")

    assert len(items) == 1
    assert items[0]["target"] == ["중장년"]
    assert items[0]["category_hint"] == "취업"


def test_sesac_trims_live_listing_metadata_from_title() -> None:
    html = """
    <ul>
      <li>
        <a href="/sesac/course/offline/courseDetail.do?crsSn=1174">모집중 영등포 클라우드 (영등포8기) AWS와 AI를 활용한 MSA 기반 웹 서비스 개발 모집 기간 2026.04.03 - 2026.04.30 2</a>
      </li>
    </ul>
    """

    collector = SesacCollector()

    items = collector.parse_html(html, base_url="https://sesac.seoul.kr")

    assert len(items) == 1
    assert items[0]["title"] == "영등포 클라우드 (영등포8기) AWS와 AI를 활용한 MSA 기반 웹 서비스 개발"


def test_sesac_keeps_course_name_but_strips_status_chip() -> None:
    html = """
    <ul>
      <li>
        <a href="/sesac/course/offline/courseDetail.do?crsSn=1200">마감임박 강서 AI 서비스 기획자 양성 과정 D-3 12</a>
      </li>
    </ul>
    """

    collector = SesacCollector()

    items = collector.parse_html(html, base_url="https://sesac.seoul.kr")

    assert len(items) == 1
    assert items[0]["title"] == "강서 AI 서비스 기획자 양성 과정"


def test_seoul_50plus_trims_listing_metadata_from_title() -> None:
    html = """
    <li>
      <a href="/in_appView.do?ANN_NO=1418">
        기타 2026년 공유사무실 입주기업 모집(2차) 기타 모집인원 : 12명 모집기간 : 2026-04-15-2026-05-08 신청 · 접수하기 (D-22)
      </a>
    </li>
    """

    collector = Seoul50PlusCollector()

    items = collector.parse_html(html, base_url="https://service1.50plus.or.kr")

    assert len(items) == 1
    assert items[0]["title"] == "2026년 공유사무실 입주기업 모집(2차) 기타"


def test_seoul_50plus_skips_menu_like_apply_title() -> None:
    html = """
    <li>
      <a href="/org/apply">일자리 참여 신청</a>
      <span>중장년 일자리 신청 안내</span>
    </li>
    """

    collector = Seoul50PlusCollector()

    items = collector.parse_html(html, base_url="https://service1.50plus.or.kr")

    assert items == []


def test_seoul_job_portal_skips_notice_without_program_signal() -> None:
    html = """
    <table>
      <tr>
        <td><a href="/hmpg/bdmg/noti/bordContDetail.do?bbs_no=1&pst_no=1">서울시 일자리포털 홍보 배너 안내</a></td>
      </tr>
      <tr>
        <td><a href="/hmpg/bdmg/noti/bordContDetail.do?bbs_no=1&pst_no=2">2026 서울커리업 인턴십 참여자 모집 공고</a></td>
      </tr>
    </table>
    """

    collector = SeoulJobPortalCollector()

    items = collector.parse_html(html, base_url="https://job.seoul.go.kr")

    assert len(items) == 1
    assert items[0]["title"] == "2026 서울커리업 인턴십 참여자 모집 공고"


def test_campus_town_reads_structured_data_attributes() -> None:
    html = """
    <div data-title="창업 네트워킹 데이" data-url="/program/55" data-startDate="2026-04-10" data-endDate="2026-04-25"></div>
    """

    collector = CampusTownCollector()

    items = collector.parse_html(html, base_url="https://campustown.seoul.go.kr")

    assert len(items) == 1
    assert items[0]["title"] == "창업 네트워킹 데이"
    assert items[0]["link"] == "https://campustown.seoul.go.kr/program/55"
    assert items[0]["raw_deadline"] == "2026-04-25"
    assert items[0]["category_hint"] == "네트워킹"


def test_seoul_womanup_marks_women_programs() -> None:
    html = """
    <li class="program-item">
      <a href="/womanup/program/7">서울커리업 여성 인턴십 프로그램</a>
      <span>신청마감 2026-04-30</span>
    </li>
    """

    collector = SeoulWomanUpCollector()

    items = collector.parse_html(html, base_url="https://womanup.seoulwomanup.or.kr")

    assert len(items) == 1
    assert items[0]["target"] == ["여성"]
    assert items[0]["category_hint"] == "취업"
