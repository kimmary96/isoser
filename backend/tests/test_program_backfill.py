from scripts.program_backfill import build_patch, kstartup_key, work24_key


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
