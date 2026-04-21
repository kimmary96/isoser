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


def test_parse_and_normalize_result_extracts_project_team_fields_from_source_text() -> None:
    raw_content = """
    {
      "profile": {
        "name": "김지원"
      },
      "activities": [
        {
          "type": "프로젝트",
          "title": "FoodRunner — 실시간 배달 매칭 플랫폼 (팀 프로젝트)",
          "period": "2025.03 – 2025.07",
          "role": "",
          "skills": ["Redis", "WebSocket", "FastAPI", "PostgreSQL"],
          "description": ""
        }
      ]
    }
    """
    source_text = """
    FoodRunner — 실시간 배달 매칭 플랫폼 (팀 프로젝트) 2025.03 – 2025.07
    백엔드 개발자 (5인: PM 1 / 백엔드 2 / 프론트 1 / 디자이너 1)
    • Redis Sorted Set 기반 자동 매칭 엔진 설계 (반경·대기시간·완료율 기준)
    • WebSocket 실시간 라이더 위치 추적 및 주문 상태 동기화
    • FastAPI 비동기 주문·배달 관리 API 개발
    • PostgreSQL 배달 이력·통계 데이터 파이프라인 구축
    • 성과: 일 15,000건 처리 / 매칭시간 75% 단축(12s→3s) / 완료율 94% / 장애 0건
    """

    parsed = _parse_and_normalize_result(raw_content, source_text)
    activity = parsed["activities"][0]

    assert activity["organization"] == "FoodRunner"
    assert activity["period"] == "2025.03 ~ 2025.07"
    assert activity["role"] == "백엔드 개발자"
    assert activity["my_role"] == "백엔드 개발자"
    assert activity["team_size"] == 5
    assert activity["team_composition"] == "PM 1 / 백엔드 2 / 프론트 1 / 디자이너 1"
    assert activity["contributions"][0].startswith("Redis Sorted Set")
    assert activity["description"] == ""


def test_parse_and_normalize_result_splits_intro_and_contributions() -> None:
    raw_content = """
    {
      "profile": {
        "name": "김지원"
      },
      "activities": [
        {
          "type": "회사경력",
          "title": "머니플로우 (핀테크 스타트업)",
          "period": "2024.01 – 2025.10",
          "role": "백엔드 개발자",
          "skills": ["Python", "FastAPI", "PostgreSQL"],
          "description": "회사 폐업으로 전원 권고사직"
        }
      ]
    }
    """
    source_text = """
    머니플로우 (핀테크 스타트업) 2024.01 – 2025.10
    백엔드 개발자
    • Python/FastAPI 기반 REST API 개발 및 유지보수
    • 일 활성 사용자 5만 명 규모 PostgreSQL 스키마 설계·최적화
    • 인덱스 튜닝으로 평균 쿼리 지연 38% 단축
    • 거래 자동 분류 배치 구축으로 일 3시간 수동 작업 절감
    • 회사 폐업으로 전원 권고사직
    """

    parsed = _parse_and_normalize_result(raw_content, source_text)
    activity = parsed["activities"][0]

    assert activity["period"] == "2024.01 ~ 2025.10"
    assert activity["description"] == "Python/FastAPI 기반 REST API 개발 및 유지보수 회사 폐업으로 전원 권고사직"
    assert activity["contributions"] == [
        "일 활성 사용자 5만 명 규모 PostgreSQL 스키마 설계·최적화",
        "인덱스 튜닝으로 평균 쿼리 지연 38% 단축",
        "거래 자동 분류 배치 구축으로 일 3시간 수동 작업 절감",
    ]


def test_parse_and_normalize_result_absorbs_fragment_activities() -> None:
    raw_content = """
    {
      "profile": {
        "name": "김지원"
      },
      "activities": [
        {
          "type": "프로젝트",
          "title": "FoodRunner — 실시간 배달 매칭 플랫폼 (팀 프로젝트)",
          "period": "2025.03 – 2025.07",
          "role": "백엔드 개발자",
          "skills": ["Redis", "WebSocket", "FastAPI", "PostgreSQL"],
          "description": ""
        },
        {
          "type": "프로젝트",
          "title": "Redis Sorted Set 기반 자동 매칭 엔진 설계 (반경·대기시간·완료율 기준)",
          "period": "",
          "role": "",
          "skills": [],
          "description": ""
        },
        {
          "type": "프로젝트",
          "title": "WebSocket 실시간 라이더 위치 추적 및 주문 상태 동기화",
          "period": "",
          "role": "",
          "skills": [],
          "description": ""
        }
      ]
    }
    """
    source_text = """
    FoodRunner — 실시간 배달 매칭 플랫폼 (팀 프로젝트) 2025.03 – 2025.07
    백엔드 개발자 (5인: PM 1 / 백엔드 2 / 프론트 1 / 디자이너 1)
    • Redis Sorted Set 기반 자동 매칭 엔진 설계 (반경·대기시간·완료율 기준)
    • WebSocket 실시간 라이더 위치 추적 및 주문 상태 동기화
    • FastAPI 비동기 주문·배달 관리 API 개발
    • PostgreSQL 배달 이력·통계 데이터 파이프라인 구축
    """

    parsed = _parse_and_normalize_result(raw_content, source_text)

    assert len(parsed["activities"]) == 1
    assert parsed["activities"][0]["title"] == "FoodRunner — 실시간 배달 매칭 플랫폼 (팀 프로젝트)"
    assert parsed["activities"][0]["contributions"][:2] == [
        "Redis Sorted Set 기반 자동 매칭 엔진 설계 (반경·대기시간·완료율 기준)",
        "WebSocket 실시간 라이더 위치 추적 및 주문 상태 동기화",
    ]


def test_parse_and_normalize_result_handles_pdf_line_split_activity_headers() -> None:
    raw_content = """
    {
      "profile": {
        "name": "김호준",
        "career": ["머니플로우 | 백엔드 개발자 | 2024.01 | 2025.10"]
      },
      "activities": [
        {
          "type": "회사경력",
          "title": "백엔드 개발자",
          "organization": "머니플로우",
          "period": "2024.01 – 2025.10",
          "role": "백엔드 개발자",
          "skills": ["Python", "FastAPI", "PostgreSQL"],
          "contributions": ["Python/FastAPI 기반 REST API 개발 및 유지보수"],
          "description": "회사 폐업으로 전원 권고사직"
        },
        {
          "type": "프로젝트",
          "title": "FoodRunner — 실시간 배달 매칭 플랫폼",
          "organization": "팀 프로젝트",
          "period": "2025.03 – 2025.07",
          "role": "백엔드 개발자",
          "skills": ["Redis", "WebSocket", "FastAPI", "PostgreSQL"],
          "contributions": [],
          "description": "None"
        }
      ]
    }
    """
    source_text = """
    경력
    머니플로우 (핀테크 스타트업)
    2024.01 – 2025.10
    백엔드 개발자
    • Python/FastAPI 기반 REST API 개발 및 유지보수
    • 일 활성 사용자 5만 명 규모 PostgreSQL 스키마 설계·최적화
    • 인덱스 튜닝으로 평균 쿼리 지연 38% 단축
    • 거래 자동 분류 배치 구축으로 일 3시간 수동 작업 절감
    • 회사 폐업으로 전원 권고사직
    FoodRunner — 실시간 배달 매칭 플랫폼 (팀 프로젝트)
    2025.03 – 2025.07
    백엔드 개발자 (5인: PM 1 / 백엔드 2 / 프론트 1 / 디자이너 1)
    • Redis Sorted Set 기반 자동 매칭 엔진 설계 (반경·대기시간·완료율 기준)
    • WebSocket 실시간 라이더 위치 추적 및 주문 상태 동기화
    • FastAPI 비동기 주문·배달 관리 API 개발
    • PostgreSQL 배달 이력·통계 데이터 파이프라인 구축
    • 성과: 일 15,000건 처리 / 매칭시간 75% 단축(12s→3s) / 완료율 94% / 장애 0건
    자격증
    정보처리기사
    """

    parsed = _parse_and_normalize_result(raw_content, source_text)

    assert parsed["profile"]["career"] == [
        "머니플로우 (핀테크 스타트업) | 백엔드 개발자 | 2024.01 | 2025.10"
    ]
    assert len(parsed["activities"]) == 2
    moneyflow = parsed["activities"][0]
    foodrunner = parsed["activities"][1]
    assert moneyflow["title"] == "머니플로우 (핀테크 스타트업)"
    assert moneyflow["description"] == "Python/FastAPI 기반 REST API 개발 및 유지보수 회사 폐업으로 전원 권고사직"
    assert moneyflow["contributions"] == [
        "일 활성 사용자 5만 명 규모 PostgreSQL 스키마 설계·최적화",
        "인덱스 튜닝으로 평균 쿼리 지연 38% 단축",
        "거래 자동 분류 배치 구축으로 일 3시간 수동 작업 절감",
    ]
    assert foodrunner["organization"] == "FoodRunner"
    assert foodrunner["description"] == ""
    assert foodrunner["team_size"] == 5
    assert foodrunner["team_composition"] == "PM 1 / 백엔드 2 / 프론트 1 / 디자이너 1"
    assert foodrunner["contributions"] == [
        "Redis Sorted Set 기반 자동 매칭 엔진 설계 (반경·대기시간·완료율 기준)",
        "WebSocket 실시간 라이더 위치 추적 및 주문 상태 동기화",
        "FastAPI 비동기 주문·배달 관리 API 개발",
        "PostgreSQL 배달 이력·통계 데이터 파이프라인 구축",
        "성과: 일 15,000건 처리 / 매칭시간 75% 단축(12s→3s) / 완료율 94% / 장애 0건",
    ]
