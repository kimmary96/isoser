from __future__ import annotations

from backend.rag.fallback import diagnose_structure, generate_fallback_response


def test_diagnose_structure_detects_problem_definition() -> None:
    diagnosis = diagnose_structure(
        "기존 결제 흐름에서 중복 요청 문제와 병목 이슈가 발생해 처리 지연이 커졌습니다."
    )

    assert diagnosis.has_problem_definition is True


def test_diagnose_structure_marks_missing_tech_decision() -> None:
    diagnosis = diagnose_structure(
        "기존 병목 문제를 해결하기 위해 캐시를 적용하고 응답속도를 780ms에서 290ms로 줄였습니다."
    )

    assert diagnosis.has_tech_decision is False


def test_generate_fallback_response_includes_structure_diagnosis() -> None:
    response = generate_fallback_response(
        activity_description="온보딩을 개선했습니다.",
        rag_results={
            "job_keyword_patterns": [],
            "star_examples": [],
            "job_posting_snippets": [],
        },
        job_title="PM",
        section_type="프로젝트",
    )

    assert response.structure_diagnosis.priority_focus
    assert isinstance(response.structure_diagnosis.missing_elements, list)
    assert response.missing_elements == response.structure_diagnosis.missing_elements
    assert response.rewrite_suggestions
