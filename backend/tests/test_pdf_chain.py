from chains.pdf_chain import _extract_career_entries_from_text, _parse_and_normalize_result


def test_extract_career_entries_from_career_section() -> None:
    text = """
    CAREER
    기블 2024.09 - 2025.12
    Game Designer/PM
    구미산단미래놀이터 체험 부스 운영프로젝트
    롯데건설 2021.09 - 2022.08
    공사기사

    EDUCATION
    서울과학기술대학교
    """

    entries = _extract_career_entries_from_text(text)

    assert entries == [
        {
            "company": "기블",
            "position": "Game Designer/PM",
            "start": "2024.09",
            "end": "2025.12",
        },
        {
            "company": "롯데건설",
            "position": "공사기사",
            "start": "2021.09",
            "end": "2022.08",
        },
    ]


def test_parse_and_normalize_result_promotes_career_entries_and_filters_summary() -> None:
    raw_content = """
    {
      "profile": {
        "name": "김지원",
        "career": [
          "연간 5개 이상의 B2B/B2G 오프라인 행사를 전 행사 현장 운영하며, 1,200명~10,000명 규모의 현장 기획·운영·예산 관리를 총괄",
          "기블 | Game Designer/PM | 2024.09 ~ 2025.12"
        ],
        "self_intro": ""
      },
      "activities": [
        {
          "type": "프로젝트",
          "title": "기블",
          "period": "2024.09 ~ 2025.12",
          "role": "Game Designer/PM",
          "skills": [],
          "description": ""
        },
        {
          "type": "프로젝트",
          "title": "구미산단미래놀이터 체험 부스 운영프로젝트",
          "period": "",
          "role": "",
          "skills": [],
          "description": "행사 운영"
        }
      ]
    }
    """
    source_text = """
    CAREER
    기블 2024.09 - 2025.12
    Game Designer/PM
    구미산단미래놀이터 체험 부스 운영프로젝트
    """

    parsed = _parse_and_normalize_result(raw_content, source_text)

    assert parsed["profile"]["career"] == ["기블 | Game Designer/PM | 2024.09 | 2025.12"]
    assert parsed["profile"]["self_intro"].startswith("연간 5개 이상의 B2B/B2G 오프라인 행사")
    assert parsed["activities"][0]["type"] == "회사경력"
    assert parsed["activities"][0]["title"] == "기블"
    assert parsed["activities"][0]["role"] == "Game Designer/PM"
    assert parsed["activities"][1]["type"] == "프로젝트"
