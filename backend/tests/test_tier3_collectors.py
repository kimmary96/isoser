from __future__ import annotations

from rag.collector.normalizer import normalize
from rag.collector.tier3_collectors import KisedCollector, KobiaCollector


def test_kobia_parses_notice_rows_into_tier3_items() -> None:
    html = """
    <table>
      <tbody>
        <tr>
          <td>공지</td>
          <td><a href="javascript:fnView('1234')">2026 창업전문매니저 자격 시험 안내</a></td>
          <td>2026.04.20</td>
        </tr>
      </tbody>
    </table>
    """

    collector = KobiaCollector()

    items = collector.parse_html(html)

    assert len(items) == 1
    assert items[0]["title"] == "2026 창업전문매니저 자격 시험 안내"
    assert (
        items[0]["link"]
        == "http://www.kobia.or.kr/board/view.do?idx=1234&board_kind=KNOTICE&page=1"
    )
    assert items[0]["raw_deadline"] == "2026.04.20"
    assert items[0]["category_hint"] == "훈련"
    assert items[0]["target"] == ["창업전문매니저"]
    assert items[0]["raw"] == {
        "idx": "1234",
        "board_kind": "KNOTICE",
        "posted_at": "2026.04.20",
        "label": "공지",
    }

    normalized = normalize(items[0])

    assert normalized is not None
    assert normalized["source"] == "KOBIA"
    assert normalized["source_type"] == "semi_public_crawl"
    assert normalized["collection_method"] == "web_crawl"
    assert normalized["category"] == "훈련"
    assert normalized["deadline"] == "2026-04-20"


def test_kised_keeps_external_kstartup_link_and_deadline() -> None:
    html = """
    <table>
      <tbody>
        <tr>
          <td class="title">
            <a href="https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=101">
              2026 글로벌 초격차 창업 지원사업 모집
            </a>
          </td>
          <td class="period">사업기간 2026.04.15 ~ 2026.05.02</td>
          <td class="organization">창업진흥원</td>
        </tr>
      </tbody>
    </table>
    """

    collector = KisedCollector()

    items = collector.parse_html(
        html,
        base_url="https://www.kised.or.kr/misAnnouncement/index.es?mid=a10302000000",
    )

    assert len(items) == 1
    assert items[0]["title"] == "2026 글로벌 초격차 창업 지원사업 모집"
    assert (
        items[0]["link"]
        == "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=101"
    )
    assert items[0]["raw_deadline"] == "2026.05.02"
    assert items[0]["category_hint"] == "초격차"
    assert items[0]["target"] == ["예비창업자", "초기창업기업"]
    assert items[0]["raw"] == {
        "period_text": "사업기간 2026.04.15 ~ 2026.05.02",
        "organization_name": "창업진흥원",
        "source_page": "misAnnouncement",
    }

    normalized = normalize(items[0])

    assert normalized is not None
    assert normalized["source"] == "KISED"
    assert normalized["source_type"] == "semi_public_crawl"
    assert normalized["category"] == "초격차"
    assert normalized["deadline"] == "2026-05-02"
