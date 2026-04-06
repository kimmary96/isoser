from __future__ import annotations

import json

import pytest

from chains import coach_graph


class DummyLLMResponse:
    def __init__(self, content: str):
        self.content = content


class DummyLLM:
    def __init__(self, content: str):
        self._content = content

    async def ainvoke(self, messages):  # noqa: ANN001
        return DummyLLMResponse(self._content)


@pytest.fixture(autouse=True)
def isolate_rag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        coach_graph.COACH_RETRIEVER,
        "retrieve_for_coaching",
        lambda **kwargs: {
            "job_keyword_patterns": [
                {
                    "pattern_type": "decision_statement",
                    "document": "Redis와 Memcached를 비교해 TTL 제어와 운영 가시성을 기준으로 Redis를 선택했습니다.",
                },
                {
                    "pattern_type": "result_statement",
                    "document": "응답속도를 780ms에서 290ms로 개선했습니다.",
                },
            ],
            "star_examples": [
                {
                    "activity_type": "tech_decision",
                    "original_text": "Redis를 사용했습니다.",
                    "document": "대안을 비교한 뒤 Redis를 선택해 지연 시간을 줄였습니다.",
                    "rewrite_focus": "기술 선택 근거와 대안 비교 보강",
                }
            ],
            "job_posting_snippets": [
                {
                    "source": "wanted",
                    "section_type": "주요업무",
                    "document": "대규모 서비스의 데이터 흐름을 설계하고 안정적으로 운영할 백엔드 엔지니어를 찾습니다.",
                }
            ],
        },
    )


def _valid_payload(activity_description: str = "로그인 응답속도 개선 프로젝트에서 Redis를 도입했습니다.") -> dict:
    return {
        "session_id": "session-1",
        "activity_description": activity_description,
        "job_title": "백엔드 개발자",
        "section_type": "프로젝트",
        "selected_suggestion_index": None,
    }


def _mock_success_llm(monkeypatch: pytest.MonkeyPatch, *, focus: str = "quantification") -> None:
    payload = {
        "feedback": "문제 정의와 성과를 함께 드러내면 더 설득력 있습니다.",
        "structure_diagnosis": {
            "has_problem_definition": True,
            "has_tech_decision": True,
            "has_quantified_result": False,
            "has_role_clarification": True,
            "has_implementation_detail": True,
            "missing_elements": ["정량적 성과"],
            "priority_focus": "정량적 성과",
        },
        "rewrite_suggestions": [
            {
                "text": "로그인 병목 문제를 해결하기 위해 Redis 캐시를 도입하고 요청 처리 시간을 780ms에서 290ms로 줄였습니다.",
                "focus": focus,
                "section": "성과" if focus == "quantification" else "기술적 의사결정",
                "rationale": "정량 성과와 기술 선택 근거를 한 문장에 담았습니다.",
                "reference_pattern": "Technical Achievement  Quantified Impact  Business Value"
                if focus == "quantification"
                else "Problem  Alternative Comparison  Decision",
            }
        ],
        "missing_elements": ["정량적 성과"],
        "iteration_count": 1,
    }
    monkeypatch.setattr(
        coach_graph,
        "_get_llm",
        lambda: DummyLLM(json.dumps(payload, ensure_ascii=False)),
    )


def _mock_gemini_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise():  # noqa: ANN202
        raise RuntimeError("gemini unavailable")

    monkeypatch.setattr(coach_graph, "_get_llm", _raise)


def test_coach_feedback_success(client, monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_success_llm(monkeypatch)

    response = client.post("/coach/feedback", json=_valid_payload())

    assert response.status_code == 200
    payload = response.json()
    assert payload["feedback"]
    assert payload["structure_diagnosis"]["priority_focus"] == "정량적 성과"
    assert 1 <= len(payload["rewrite_suggestions"]) <= 3


def test_structure_diagnosis_present(client, monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_success_llm(monkeypatch)

    response = client.post("/coach/feedback", json=_valid_payload())

    assert response.status_code == 200
    structure = response.json()["structure_diagnosis"]
    assert "has_problem_definition" in structure
    assert "has_tech_decision" in structure
    assert "has_quantified_result" in structure
    assert "has_role_clarification" in structure
    assert "has_implementation_detail" in structure
    assert "missing_elements" in structure
    assert "priority_focus" in structure


def test_coach_feedback_short_input(client) -> None:
    response = client.post(
        "/coach/feedback",
        json=_valid_payload(activity_description="짧아요"),
    )

    assert response.status_code == 400
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_coach_feedback_empty_job_title(client) -> None:
    payload = _valid_payload()
    payload["job_title"] = "   "

    response = client.post("/coach/feedback", json=payload)

    assert response.status_code == 400
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_coach_feedback_invalid_section(client) -> None:
    payload = _valid_payload()
    payload["section_type"] = "자기소개"

    response = client.post("/coach/feedback", json=payload)

    assert response.status_code == 400
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_coach_fallback_on_gemini_failure(client, monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_gemini_failure(monkeypatch)

    response = client.post(
        "/coach/feedback",
        json=_valid_payload(activity_description="회원가입 개선 프로젝트에서 이탈 문제를 줄였습니다."),
    )

    assert response.status_code == 200
    payload = response.json()
    assert "structure_diagnosis" in payload
    assert payload["structure_diagnosis"]["missing_elements"]
    assert payload["rewrite_suggestions"]


def test_tech_decision_coaching(client, monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_gemini_failure(monkeypatch)

    response = client.post(
        "/coach/feedback",
        json=_valid_payload(
            activity_description="로그인 병목 문제를 해결하기 위해 Redis를 사용했습니다."
        ),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["rewrite_suggestions"][0]["focus"] == "tech_decision"


def test_problem_definition_coaching(client, monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_gemini_failure(monkeypatch)

    response = client.post(
        "/coach/feedback",
        json=_valid_payload(activity_description="온보딩 프로세스를 개선했습니다."),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["rewrite_suggestions"][0]["focus"] == "problem_definition"
