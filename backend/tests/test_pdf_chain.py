import asyncio
import json
import logging
from pathlib import Path

import pytest

from chains import pdf_chain, pdf_llm
from chains.pdf_chain import (
    _build_source_fallback_result,
    _extract_career_entries_from_text,
    _parse_and_normalize_result,
    parse_resume_pdf,
)


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "pdf_texts"
EXPECTED_DIR = Path(__file__).parent / "fixtures" / "pdf_expected"
PDF_FIXTURE_DIR = Path(__file__).parent / "fixtures" / "pdf_files"


def load_pdf_text_fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


def load_pdf_expected_fixture(name: str) -> dict:
    return json.loads((EXPECTED_DIR / name).read_text(encoding="utf-8"))


def load_pdf_binary_fixture(name: str) -> bytes:
    return (PDF_FIXTURE_DIR / name).read_bytes()


def summarize_parsed_resume(parsed: dict) -> dict:
    return {
        "profile": {
            "career": parsed.get("profile", {}).get("career", []),
        },
        "activities": [
            {
                "type": activity.get("type"),
                "title": activity.get("title"),
                "period": activity.get("period"),
                "role": activity.get("role"),
                "team_size": activity.get("team_size"),
                "team_composition": activity.get("team_composition"),
                "description": activity.get("description"),
                "contributions": activity.get("contributions", []),
            }
            for activity in parsed.get("activities", [])
        ],
    }


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


def test_parse_resume_pdf_uses_source_fallback_when_gemini_quota_fails(monkeypatch) -> None:
    source_text = """
    BACKEND DEVELOPER
    김 호 준
    이메일
    junho.park.dev@gmail.com
    연락처
    010-3892-5471
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
    """

    class QuotaFailingLlm:
        def __init__(self, *args, **kwargs):
            pass

        async def ainvoke(self, messages):
            raise RuntimeError("429 RESOURCE_EXHAUSTED")

    monkeypatch.setenv("GOOGLE_API_KEY", "primary")
    monkeypatch.setenv("GOOGLE_API_KEY_FALLBACK", "fallback")
    monkeypatch.setattr(pdf_chain, "_extract_text_from_pdf", lambda _: source_text)
    monkeypatch.setattr(pdf_llm, "ChatGoogleGenerativeAI", QuotaFailingLlm)

    parsed = asyncio.run(parse_resume_pdf(b"pdf"))

    assert parsed["profile"]["email"] == "junho.park.dev@gmail.com"
    assert parsed["profile"]["phone"] == "010-3892-5471"
    assert parsed["profile"]["career"] == [
        "머니플로우 (핀테크 스타트업) | 백엔드 개발자 | 2024.01 | 2025.10"
    ]
    assert len(parsed["activities"]) == 2
    assert parsed["activities"][0]["title"] == "머니플로우 (핀테크 스타트업)"
    assert parsed["activities"][0]["description"] == (
        "Python/FastAPI 기반 REST API 개발 및 유지보수 회사 폐업으로 전원 권고사직"
    )
    assert parsed["activities"][1]["title"] == "FoodRunner — 실시간 배달 매칭 플랫폼 (팀 프로젝트)"
    assert parsed["activities"][1]["team_size"] == 5
    assert parsed["activities"][1]["contributions"][-1].startswith("성과:")


def test_parse_resume_pdf_tries_fallback_key_after_primary_failure(monkeypatch) -> None:
    source_text = "김호준\n경력\n머니플로우 (핀테크 스타트업)\n2024.01 – 2025.10\n백엔드 개발자"
    used_keys = []

    class FallbackLlm:
        def __init__(self, *args, **kwargs):
            used_keys.append(kwargs["google_api_key"])

        async def ainvoke(self, messages):
            if used_keys[-1] == "primary":
                raise RuntimeError("429 RESOURCE_EXHAUSTED")
            return type(
                "Response",
                (),
                {
                    "content": """
                    {
                      "profile": {"name": "김호준"},
                      "activities": [
                        {
                          "type": "회사경력",
                          "title": "머니플로우 (핀테크 스타트업)",
                          "period": "2024.01 – 2025.10",
                          "role": "백엔드 개발자"
                        }
                      ]
                    }
                    """
                },
            )()

    monkeypatch.setenv("GOOGLE_API_KEY", "primary")
    monkeypatch.setenv("GOOGLE_API_KEY_FALLBACK", "fallback")
    monkeypatch.setattr(pdf_chain, "_extract_text_from_pdf", lambda _: source_text)
    monkeypatch.setattr(pdf_llm, "ChatGoogleGenerativeAI", FallbackLlm)

    parsed = asyncio.run(parse_resume_pdf(b"pdf"))

    assert used_keys == ["primary", "fallback"]
    assert parsed["activities"][0]["title"] == "머니플로우 (핀테크 스타트업)"


def test_parse_and_normalize_result_handles_pm_portfolio_template() -> None:
    raw_content = """
    {
      "profile": {"name": "김지원"},
      "activities": []
    }
    """
    source_text = load_pdf_text_fixture("pm_portfolio_resume.txt")

    parsed = _build_source_fallback_result(source_text)

    assert parsed["profile"]["career"] == [
        "긱블 | Game Designer/PM | 2024.09 | 2025.12",
        "롯데건설 | 공사기사 | 2021.09 | 2022.08",
    ]
    titles = [activity["title"] for activity in parsed["activities"]]
    assert "냥생점프" in titles
    assert "Color Blaster" in titles
    assert "션" not in titles

    color_blaster = next(activity for activity in parsed["activities"] if activity["title"] == "Color Blaster")
    assert color_blaster["period"] == "2024.10 ~ 진행중"
    assert color_blaster["role"] == "기획1"
    assert color_blaster["team_size"] == 2
    assert color_blaster["team_composition"] == "개발1 / 아트1"


def test_source_fallback_keeps_project_section_out_of_profile_career() -> None:
    source_text = load_pdf_text_fixture("park_backend_resume.txt")

    parsed = _build_source_fallback_result(source_text)

    assert parsed["profile"]["career"] == [
        "머니플로우 (핀테크 스타트업) | 백엔드 개발자 | 2024.01 | 2024.07"
    ]
    assert len(parsed["activities"]) == 2

    moneyflow = parsed["activities"][0]
    foodrunner = parsed["activities"][1]
    assert moneyflow["type"] == "회사경력"
    assert moneyflow["title"] == "머니플로우 (핀테크 스타트업)"
    assert moneyflow["description"] == (
        "개인 자산 관리 서비스의 REST API 개발 및 유지보수 (Python, FastAPI) "
        "회사 폐업으로 팀 전원 권고사직 처리됨"
    )
    assert moneyflow["contributions"] == [
        "일 활성 사용자 5만 명 이상을 처리하는 PostgreSQL 스키마 설계 및 최적화",
        "인덱스 튜닝을 통해 주요 조회 API 평균 응답 속도 38% 단축",
        "일별 거래 자동 분류 배치 작업을 구축하여 하루 3시간의 수동 운영 작업 절감",
    ]

    assert foodrunner["type"] == "프로젝트"
    assert foodrunner["title"] == "FoodRunner - 실시간 배달 매칭 플랫폼"
    assert foodrunner["role"] == "백엔드 개발자"
    assert foodrunner["my_role"] == "백엔드 개발자"
    assert foodrunner["team_size"] == 5
    assert foodrunner["team_composition"] == "PM 1 / 백엔드 2 / 프론트엔드 1 / 디자이너 1"
    assert foodrunner["contributions"] == [
        "Redis Sorted Set을 활용한 라이더-주문 자동 매칭 로직 구현",
        "WebSocket 기반 라이더 위치 실시간 갱신 기능 개발",
        "주문 생성, 배달 상태 변경, 라이더 배정 API 설계 및 구현",
        "평균 매칭 시간 12초에서 3초로 단축",
        "테스트 환경 기준 일 15,000건 주문 이벤트 처리",
        "배달 완료율 94% 달성",
    ]


@pytest.mark.parametrize(
    ("text_fixture", "expected_fixture"),
    [
        ("park_backend_resume.txt", "park_backend_resume.json"),
        ("pm_portfolio_resume.txt", "pm_portfolio_resume.json"),
    ],
)
def test_source_fallback_matches_pdf_template_snapshot(text_fixture: str, expected_fixture: str) -> None:
    parsed = _build_source_fallback_result(load_pdf_text_fixture(text_fixture))

    assert summarize_parsed_resume(parsed) == load_pdf_expected_fixture(expected_fixture)


def test_source_fallback_logs_sentence_scorer_reasons_when_enabled(monkeypatch, caplog) -> None:
    monkeypatch.setenv("ISOSER_PDF_PARSE_DEBUG_SCORER", "1")
    caplog.set_level(logging.DEBUG, logger="chains.pdf_activity_parser")

    _build_source_fallback_result(load_pdf_text_fixture("park_backend_resume.txt"))

    messages = [record.getMessage() for record in caplog.records]
    assert any("reason=intro_keyword" in message for message in messages)
    assert any("reason=metric_signal+keyword_signal" in message for message in messages)
    assert any("kind=contribution" in message for message in messages)


def test_pdf_binary_extraction_matches_snapshot() -> None:
    pdf_bytes = load_pdf_binary_fixture("park_backend_resume.pdf")
    source_text = pdf_chain._extract_text_from_pdf(pdf_bytes)

    assert "박준호" in source_text
    assert "FoodRunner - 실시간 배달 매칭 플랫폼" in source_text
    parsed = _build_source_fallback_result(source_text)

    assert summarize_parsed_resume(parsed) == load_pdf_expected_fixture("park_backend_resume_pdf.json")
