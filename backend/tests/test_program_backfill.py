from scripts.program_backfill import (
    build_patch,
    build_work24_deadline_audit_report,
    fetch_work24_record_from_detail_url,
    is_work24_deadline_copied_from_end_date,
    kstartup_key,
    sesac_key,
    work24_key,
)


def test_kstartup_key_prefers_announcement_id_from_compare_meta() -> None:
    row = {
        "source": "K-Startup 창업진흥원",
        "link": "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=176678",
        "compare_meta": {"announcement_id": "177296"},
    }

    assert kstartup_key(row) == "kstartup:announcement:177296"


def test_kstartup_key_falls_back_to_pbanc_sn_url_param() -> None:
    row = {
        "source": "K-Startup 창업진흥원",
        "link": "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=176678",
    }

    assert kstartup_key(row) == "kstartup:announcement:176678"


def test_work24_key_uses_hrd_id_before_url_params() -> None:
    row = {
        "source": "고용24",
        "hrd_id": "AIG202500001",
        "link": "https://www.work24.go.kr/hr/a/a/3100/selectTracseDetl.do?tracseId=AIG20259999999999&tracseTme=2",
    }

    assert work24_key(row) == "work24:hrd:AIG202500001"


def test_work24_key_falls_back_to_training_url_params() -> None:
    row = {
        "source": "고용24",
        "link": "https://www.work24.go.kr/hr/a/a/3100/selectTracseDetl.do?tracseId=AIG202500001&tracseTme=2&trainstCstmrId=5000",
    }

    assert work24_key(row) == "work24:url:AIG202500001:2:5000"


def test_detects_work24_deadline_copied_from_training_end_date() -> None:
    assert is_work24_deadline_copied_from_end_date(
        {
            "source": "고용24",
            "deadline": "2026-06-30",
            "end_date": "2026-06-30",
        }
    )
    assert not is_work24_deadline_copied_from_end_date(
        {
            "source": "K-Startup 창업진흥원",
            "deadline": "2026-06-30",
            "end_date": "2026-06-30",
        }
    )


def test_work24_deadline_audit_report_is_dry_run(monkeypatch) -> None:
    monkeypatch.setattr(
        "scripts.program_backfill.fetch_work24_deadline_audit_rows",
        lambda limit: [
            {
                "id": "program-1",
                "title": "고용24 의심 과정",
                "source": "고용24",
                "deadline": "2026-06-30",
                "end_date": "2026-06-30",
            },
            {
                "id": "program-2",
                "title": "고용24 정상 과정",
                "source": "고용24",
                "deadline": "2026-05-20",
                "end_date": "2026-06-30",
            },
        ],
    )

    report = build_work24_deadline_audit_report(limit=10)

    assert report["mode"] == "dry-run"
    assert report["candidate_count"] == 2
    assert report["suspect_count"] == 1
    assert report["items"][0]["recommended_patch"] == {"deadline": None}


def test_sesac_key_uses_course_id_before_cleaned_title() -> None:
    row = {
        "source": "sesac",
        "link": "https://sesac.seoul.kr/sesac/course/offline/courseDetail.do?crsSn=1174",
        "title": "모집예정 금천 보안 모집 기간 2026.04.29 - 2026.05.26 1",
    }

    assert sesac_key(row) == "sesac:course:1174"


def test_sesac_key_falls_back_to_cleaned_title() -> None:
    row = {
        "source": "sesac",
        "title": "모집예정 금천 보안 모집 기간 2026.04.29 - 2026.05.26 1",
    }

    assert sesac_key(row) == "sesac:title:금천 보안"


def test_fetch_work24_record_from_detail_url_extracts_html_fields(monkeypatch) -> None:
    html = """
    <html><body>
      <p>귀하는 "요양보호사(사회복지사자격증소지자)자격 취득과정" 훈련과정에 최종 "선발" 되셨습니다.</p>
      <p>상계요양보호사교육원</p>
      <p>3년 인증</p>
      <h1>요양보호사(사회복지사자격증소지자)자격 취득과정</h1>
      <p>수강확정인원 17명 / 선발인원 17명 / 모집인원 37명</p>
      <p>훈련비 250,000 원 231,020 원 일반훈련생 기준금액 표기</p>
      <p>만족도 (3.9)</p>
      <p>수강신청기간 2026.04.01 ~ 2026.04.15</p>
      <p>훈련유형 국가기간전략산업직종 훈련기간 2026-04-16 ~ 2026-04-24 (3회차)</p>
      <p>주야구분 주간 주말여부 주중 훈련시간 월,화,수,목,금 / 09:00 ~ 18:00</p>
      <p>훈련기간 2026-04-16 ~ 2026-04-24 (3회차)</p>
      <p>훈련기관 및 담당자 주소 서울특별시 노원구 덕릉로 814 재원빌딩 5f 전화번호 02-792-3440 이메일 test@example.com 주관부처 서울북부</p>
      <p>훈련목표 자격취득후 취업을 목표로 한다. 훈련대상 요건 선수학습 사회복지사</p>
    </body></html>
    """

    class FakeResponse:
        text = html

        def raise_for_status(self) -> None:
            return None

    monkeypatch.setattr("backend.rag.collector.work24_detail_parser.requests.get", lambda *_, **__: FakeResponse())

    record = fetch_work24_record_from_detail_url(
        {
            "title": "요양보호사(사회복지사자격증소지자)자격 취득과정",
            "link": "https://www.work24.go.kr/hr/a/a/3100/selectTracseDetl.do?tracseId=AIG20250000502424&tracseTme=3&trainstCstmrId=500038418203",
        }
    )

    assert record is not None
    assert record.normalized["provider"] == "상계요양보호사교육원"
    assert record.normalized["location"] == "서울특별시 노원구 덕릉로 814 재원빌딩 5f"
    assert record.normalized["deadline"] == "2026-04-15"
    assert record.normalized["start_date"] == "2026-04-16"
    assert record.normalized["end_date"] == "2026-04-24"
    assert record.normalized["cost"] == 250000
    assert record.normalized["subsidy_amount"] == 231020
    assert record.normalized["compare_meta"]["satisfaction_score"] == "3.9"
    assert record.normalized["compare_meta"]["capacity"] == "37"
    assert record.normalized["compare_meta"]["registered_count"] == "17"
    assert record.normalized["compare_meta"]["application_deadline"] == "2026-04-15"
    assert record.normalized["compare_meta"]["training_type"] == "국가기간전략산업직종"
    assert record.normalized["compare_meta"]["training_time"] == "월,화,수,목,금 / 09:00 ~ 18:00"


def test_build_patch_fills_only_blank_fields_by_default() -> None:
    db_row = {
        "provider": None,
        "location": "기존 지역",
        "description": "",
        "compare_meta": {"contact_phone": "02-0000-0000"},
    }
    normalized = {
        "provider": "새 기관",
        "location": "새 지역",
        "description": "새 설명",
        "compare_meta": {
            "contact_phone": "02-1111-1111",
            "announcement_id": "176678",
        },
    }

    patch = build_patch(db_row, normalized, overwrite=False)

    assert patch["provider"] == "새 기관"
    assert patch["description"] == "새 설명"
    assert "location" not in patch
    assert patch["compare_meta"] == {
        "contact_phone": "02-0000-0000",
        "announcement_id": "176678",
    }


def test_build_patch_can_overwrite_when_requested() -> None:
    db_row = {"provider": "기존 기관"}
    normalized = {"provider": "새 기관"}

    assert build_patch(db_row, normalized, overwrite=True)["provider"] == "새 기관"
