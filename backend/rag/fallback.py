"""Rule-based fallback response generation for Coach AI."""

from __future__ import annotations

import re
from typing import Any

from rag.schema import CoachResponse, RewriteSuggestion, StructureDiagnosis

STAR_KEYWORDS = {
    "Situation": ["상황", "배경", "당시", "문제", "이슈", "할 때", "~할 때"],
    "Task": ["목표", "과제", "담당", "맡아", "역할", "책임"],
    "Action": ["설계", "구현", "개발", "분석", "도입", "적용", "진행"],
    "Result": ["개선", "달성", "증가", "감소", "절감", "향상", "%", "건", "명"],
}

PROJECT_OVERVIEW_KEYWORDS = ["프로젝트", "서비스", "제품", "기간", "개월", "주", "분기"]
PROBLEM_KEYWORDS = ["문제", "이슈", "과제", "불편", "비효율", "장애", "병목", "한계"]
TECH_DECISION_KEYWORDS = ["선택", "도입", "비교", "대안", "vs", "대신", "이유", "왜"]
ROLE_KEYWORDS = ["담당", "역할", "인원", "팀", "명", "리드", "매니저", "개발자"]
IMPLEMENTATION_KEYWORDS = ["아키텍처", "설계", "구조", "방식", "패턴", "모델", "알고리즘"]

PRIORITY_ORDER = [
    "문제 정의",
    "기술 선택 근거",
    "정량적 성과",
    "역할 명확화",
    "구현 디테일",
    "프로젝트 개요",
]

FEEDBACK_TEMPLATES = {
    "문제 정의": "이 프로젝트에서 어떤 문제를 해결하셨나요? '기존에 OO 방식이라 OO 문제가 있었고' 같은 문장을 추가하면 기술적 의사결정의 근거가 명확해집니다.",
    "기술 선택 근거": "OO 기술을 사용하셨네요. 왜 다른 대안 대신 이걸 선택하셨나요?",
    "정량적 성과": "성과가 정성적으로 작성되어 있어요. 숫자로 표현할 수 있는 부분이 있을까요?",
    "역할 명확화": "팀 프로젝트라면 전체 인원과 본인의 역할을 명시해주세요.",
    "구현 디테일": "'구현했습니다'로 끝나지 말고, 어떻게 구현했는지 한 문장만 추가해보세요.",
    "프로젝트 개요": "프로젝트명, 기간, 담당 역할이 먼저 보여야 문장의 맥락이 빠르게 잡힙니다.",
}

FOCUS_TO_SECTION = {
    "star_gap": "STAR 구조",
    "quantification": "성과",
    "verb_strength": "구현 디테일",
    "job_fit": "역할",
    "tech_decision": "기술적 의사결정",
    "problem_definition": "문제 정의",
}

FOCUS_TO_REFERENCE_PATTERN = {
    "tech_decision": "Problem  Alternative Comparison  Decision",
    "problem_definition": "Concrete Problem  Business Impact",
    "quantification": "Technical Achievement  Quantified Impact  Business Value",
}


def _safe_text(value: Any) -> str:
    """Normalize arbitrary values into stripped strings."""

    return str(value).strip() if value is not None else ""


def _contains_any_keyword(text: str, keywords: list[str]) -> bool:
    """Return True when the text contains at least one keyword."""

    return any(keyword in text for keyword in keywords)


def _numeric_token_count(text: str) -> int:
    """Count numeric tokens in the text."""

    return len(re.findall(r"\d+(?:[.,]\d+)?", text))


def detect_missing_star(text: str) -> list[str]:
    """Detect missing STAR components using keyword rules."""

    normalized = _safe_text(text)
    missing: list[str] = []

    for label, keywords in STAR_KEYWORDS.items():
        if not _contains_any_keyword(normalized, keywords):
            missing.append(label)

    return missing


def detect_quantification_gap(text: str) -> bool:
    """Return True when the text lacks enough numeric evidence."""

    return _numeric_token_count(_safe_text(text)) < 2


def diagnose_structure(text: str) -> StructureDiagnosis:
    """Diagnose 6-step portfolio structure completeness using keyword rules."""

    normalized = _safe_text(text)

    has_project_overview = _contains_any_keyword(normalized, PROJECT_OVERVIEW_KEYWORDS)
    has_problem_definition = _contains_any_keyword(normalized, PROBLEM_KEYWORDS)
    has_tech_decision = _contains_any_keyword(normalized, TECH_DECISION_KEYWORDS)
    has_quantified_result = not detect_quantification_gap(normalized)
    has_role_clarification = _contains_any_keyword(normalized, ROLE_KEYWORDS)
    has_implementation_detail = _contains_any_keyword(normalized, IMPLEMENTATION_KEYWORDS)

    missing_elements: list[str] = []
    if not has_problem_definition:
        missing_elements.append("문제 정의")
    if not has_tech_decision:
        missing_elements.append("기술 선택 근거")
    if not has_quantified_result:
        missing_elements.append("정량적 성과")
    if not has_role_clarification:
        missing_elements.append("역할 명확화")
    if not has_implementation_detail:
        missing_elements.append("구현 디테일")
    if not has_project_overview:
        missing_elements.append("프로젝트 개요")

    priority_focus = next(
        (item for item in PRIORITY_ORDER if item in missing_elements),
        "정량적 성과",
    )

    return StructureDiagnosis(
        has_problem_definition=has_problem_definition,
        has_tech_decision=has_tech_decision,
        has_quantified_result=has_quantified_result,
        has_role_clarification=has_role_clarification,
        has_implementation_detail=has_implementation_detail,
        missing_elements=missing_elements,
        priority_focus=priority_focus,
    )


def _normalize_rag_results(rag_results: Any) -> dict[str, list[dict[str, Any]]]:
    """Normalize arbitrary rag results into the expected dictionary shape."""

    if not isinstance(rag_results, dict):
        return {"job_keyword_patterns": [], "star_examples": []}

    job_patterns = rag_results.get("job_keyword_patterns")
    star_examples = rag_results.get("star_examples")
    return {
        "job_keyword_patterns": job_patterns if isinstance(job_patterns, list) else [],
        "star_examples": star_examples if isinstance(star_examples, list) else [],
    }


def _reference_available(
    rag_results: dict[str, list[dict[str, Any]]],
    *,
    pattern_type: str | None = None,
    activity_type: str | None = None,
) -> bool:
    """Return True when a relevant RAG reference exists for the given focus."""

    if pattern_type:
        for item in rag_results["job_keyword_patterns"]:
            if item.get("pattern_type") == pattern_type and _safe_text(item.get("document")):
                return True
    if activity_type:
        for item in rag_results["star_examples"]:
            if item.get("activity_type") == activity_type and _safe_text(item.get("document")):
                return True
    return False


def _focus_from_priority(priority_focus: str) -> str:
    """Map the highest-priority missing element to a suggestion focus."""

    mapping = {
        "문제 정의": "problem_definition",
        "기술 선택 근거": "tech_decision",
        "정량적 성과": "quantification",
        "역할 명확화": "job_fit",
        "구현 디테일": "verb_strength",
        "프로젝트 개요": "star_gap",
    }
    return mapping.get(priority_focus, "star_gap")


def _build_feedback(
    structure: StructureDiagnosis,
    star_missing: list[str],
    job_title: str,
    section_type: str,
    rag_results: dict[str, list[dict[str, Any]]],
) -> str:
    """Build fallback coaching feedback from the diagnosed gaps."""

    primary = structure.priority_focus
    messages = [f"{section_type} 항목을 {job_title} 관점에서 보면, {FEEDBACK_TEMPLATES[primary]}"]

    secondary_missing = [item for item in structure.missing_elements if item != primary][:1]
    for item in secondary_missing:
        messages.append(FEEDBACK_TEMPLATES[item])

    if star_missing:
        messages.append(f"현재 문장에는 STAR 중 {', '.join(star_missing)} 정보가 부족합니다.")

    focus = _focus_from_priority(primary)
    has_reference = _reference_available(
        rag_results,
        pattern_type={
            "problem_definition": "problem_statement",
            "tech_decision": "decision_statement",
            "quantification": "result_statement",
            "verb_strength": "implementation_statement",
        }.get(focus),
        activity_type=focus if focus in {"star_gap", "quantification", "job_fit", "tech_decision", "problem_definition"} else None,
    )
    if has_reference:
        messages.append("유사 레퍼런스의 문장 구조를 참고해 한 문장 안에서 문제, 액션, 결과를 연결해보세요.")

    return " ".join(messages)


def _build_suggestion_text(
    focus: str,
    activity_description: str,
    section_type: str,
) -> str:
    """Build a rule-based improved sentence for the given focus."""

    base = _safe_text(activity_description).rstrip(".")

    if focus == "problem_definition":
        return f"기존 방식에서는 사용자 불편과 운영 병목이 발생했고, 이를 해결하기 위해 {base}를 진행해 서비스 품질과 비즈니스 임팩트를 함께 개선했습니다."
    if focus == "tech_decision":
        return f"기존 방식의 한계로 {base}가 필요했고, 대안을 비교한 뒤 현재 방식을 선택해 운영 효율과 확장성을 높였습니다."
    if focus == "quantification":
        return f"{base}를 통해 처리 시간, 전환율, 운영 비용 등 핵심 지표를 수치로 개선해 기술적 성과가 비즈니스 가치로 이어졌음을 보여주었습니다."
    if focus == "job_fit":
        return f"{section_type} 경험에서 맡은 역할을 기준으로 {base}를 주도해 팀 내 기여도와 직무 적합성을 함께 드러냈습니다."
    if focus == "verb_strength":
        return f"아키텍처와 처리 방식을 직접 설계하며 {base}를 구현해 서비스 안정성과 유지보수성을 높였습니다."
    return f"프로젝트 배경과 맡은 역할을 먼저 제시한 뒤 {base}를 실행해 만든 결과를 한 문장으로 연결했습니다."


def _build_suggestion(
    focus: str,
    activity_description: str,
    job_title: str,
    section_type: str,
    rag_results: dict[str, list[dict[str, Any]]],
) -> RewriteSuggestion:
    """Build a single fallback rewrite suggestion."""

    reference_map = {
        "problem_definition": ("problem_statement", "problem_definition"),
        "tech_decision": ("decision_statement", "tech_decision"),
        "quantification": ("result_statement", "quantification"),
        "verb_strength": ("implementation_statement", None),
        "job_fit": (None, "job_fit"),
        "star_gap": (None, "star_gap"),
    }
    pattern_type, activity_type = reference_map[focus]
    has_reference = _reference_available(
        rag_results,
        pattern_type=pattern_type,
        activity_type=activity_type,
    )

    rationale = {
        "problem_definition": f"{job_title} 이력서에서는 해결한 문제와 비즈니스 영향이 먼저 보여야 합니다.",
        "tech_decision": "대안 비교와 선택 이유가 있어야 기술적 의사결정의 설득력이 생깁니다.",
        "quantification": "정량 수치를 넣어야 성과의 크기와 비즈니스 임팩트가 분명해집니다.",
        "verb_strength": "구현 방식과 강한 행동 동사를 넣으면 실행력이 더 선명하게 보입니다.",
        "job_fit": "팀 내 역할과 담당 범위를 적어야 직무 적합성이 드러납니다.",
        "star_gap": "상황, 역할, 액션, 결과를 한 흐름으로 연결해야 STAR 구조가 완성됩니다.",
    }[focus]
    if has_reference:
        rationale += " RAG 레퍼런스의 문장 구조를 참고했습니다."

    return RewriteSuggestion(
        text=_build_suggestion_text(focus, activity_description, section_type),
        focus=focus,
        section=FOCUS_TO_SECTION[focus],
        rationale=rationale,
        reference_pattern=FOCUS_TO_REFERENCE_PATTERN.get(focus),
    )


def _build_suggestions(
    activity_description: str,
    structure: StructureDiagnosis,
    star_missing: list[str],
    job_title: str,
    section_type: str,
    rag_results: dict[str, list[dict[str, Any]]],
) -> list[RewriteSuggestion]:
    """Build 1 to 3 fallback suggestions with the highest-priority focus first."""

    ordered_focuses: list[str] = [_focus_from_priority(structure.priority_focus)]

    if detect_quantification_gap(activity_description) and "quantification" not in ordered_focuses:
        ordered_focuses.append("quantification")
    if star_missing and "star_gap" not in ordered_focuses:
        ordered_focuses.append("star_gap")
    if "역할 명확화" in structure.missing_elements and "job_fit" not in ordered_focuses:
        ordered_focuses.append("job_fit")
    if "구현 디테일" in structure.missing_elements and "verb_strength" not in ordered_focuses:
        ordered_focuses.append("verb_strength")

    suggestions: list[RewriteSuggestion] = []
    for focus in ordered_focuses[:3]:
        suggestions.append(
            _build_suggestion(
                focus=focus,
                activity_description=activity_description,
                job_title=job_title,
                section_type=section_type,
                rag_results=rag_results,
            )
        )
    return suggestions


def generate_fallback_response(
    activity_description: str,
    rag_results: Any,
    job_title: str,
    section_type: str,
) -> CoachResponse:
    """Generate a rule-based CoachResponse when the model call fails."""

    normalized_rag_results = _normalize_rag_results(rag_results)
    structure_diagnosis = diagnose_structure(activity_description)
    star_missing = detect_missing_star(activity_description)
    feedback = _build_feedback(
        structure=structure_diagnosis,
        star_missing=star_missing,
        job_title=job_title,
        section_type=section_type,
        rag_results=normalized_rag_results,
    )
    suggestions = _build_suggestions(
        activity_description=activity_description,
        structure=structure_diagnosis,
        star_missing=star_missing,
        job_title=job_title,
        section_type=section_type,
        rag_results=normalized_rag_results,
    )

    return CoachResponse(
        feedback=feedback,
        structure_diagnosis=structure_diagnosis,
        rewrite_suggestions=suggestions,
        missing_elements=structure_diagnosis.missing_elements,
        iteration_count=1,
    )


__all__ = [
    "detect_missing_star",
    "detect_quantification_gap",
    "diagnose_structure",
    "generate_fallback_response",
]
