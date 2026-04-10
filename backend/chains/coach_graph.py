"""LangGraph-based Coach AI flow with 6-step structure diagnosis."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, ConfigDict, field_validator

from logging_config import get_logger, log_event
from rag.fallback import generate_fallback_response
from rag.retrievers import CoachRetriever
from rag.schema import CoachResponse, RewriteSuggestion, StructureDiagnosis

STRUCTURE_CHECKLIST = [
    "프로젝트 개요",
    "문제 정의",
    "기술 선택 근거",
    "구현 디테일",
    "정량적 성과",
    "역할 명확화",
]

PATTERN_TYPE_LABELS = {
    "result_statement": "성과",
    "problem_statement": "문제정의",
    "decision_statement": "기술선택",
    "implementation_statement": "구현",
}

FOCUS_TO_SECTION = {
    "star_gap": "STAR 구조",
    "quantification": "정량적 성과",
    "verb_strength": "구현 디테일",
    "job_fit": "역할 명확화",
    "tech_decision": "기술적 의사결정",
    "problem_definition": "문제 정의",
}

FOCUS_TO_REFERENCE_PATTERN = {
    "tech_decision": "Problem - Alternative Comparison - Decision",
    "problem_definition": "Problem - Cause - Action - Result",
}

PRIORITY_TO_FOCUS = {
    "프로젝트 개요": "star_gap",
    "문제 정의": "problem_definition",
    "기술 선택 근거": "tech_decision",
    "구현 디테일": "verb_strength",
    "정량적 성과": "quantification",
    "역할 명확화": "job_fit",
}

MISSING_ELEMENT_ALIASES = {
    "프로젝트 개요": "프로젝트 개요",
    "프로젝트개요": "프로젝트 개요",
    "project overview": "프로젝트 개요",
    "project_overview": "프로젝트 개요",
    "개요": "프로젝트 개요",
    "문제 정의": "문제 정의",
    "문제정의": "문제 정의",
    "problem definition": "문제 정의",
    "problem_definition": "문제 정의",
    "situation": "문제 정의",
    "기술 선택 근거": "기술 선택 근거",
    "기술선택근거": "기술 선택 근거",
    "tech_decision": "기술 선택 근거",
    "technical decision": "기술 선택 근거",
    "대안비교": "기술 선택 근거",
    "대안 비교": "기술 선택 근거",
    "alternative comparison": "기술 선택 근거",
    "구현 디테일": "구현 디테일",
    "구현디테일": "구현 디테일",
    "implementation detail": "구현 디테일",
    "implementation_detail": "구현 디테일",
    "action": "구현 디테일",
    "정량적 성과": "정량적 성과",
    "정량성과": "정량적 성과",
    "quantification": "정량적 성과",
    "quantified result": "정량적 성과",
    "quantified_result": "정량적 성과",
    "result": "정량적 성과",
    "역할 명확화": "역할 명확화",
    "역할명확화": "역할 명확화",
    "role clarification": "역할 명확화",
    "role_clarification": "역할 명확화",
    "역할": "역할 명확화",
}

COACH_SYSTEM_PROMPT = """
너는 이력서와 포트폴리오 bullet을 코칭하는 Coach AI다.
사용자 입력을 받으면 먼저 아래 6단계 구조 체크리스트로 문장을 진단하고, 빠진 항목을 우선순위대로 코칭한다.

체크리스트:
1. 프로젝트 개요: 제목, 기간, 역할이 드러나는가
2. 문제 정의: 어떤 문제를 해결했는지 명시되어 있는가
3. 기술 선택 근거: 왜 이 기술이나 방식을 선택했는가
4. 구현 디테일: 어떻게 설계하고 구현했는가
5. 정량적 성과: 숫자로 확인 가능한 결과가 있는가
6. 역할 명확화: 팀 규모와 본인 기여가 분명한가

반드시 JSON 객체만 반환한다. 마크다운, 설명 문장, 코드펜스는 금지한다.
응답 JSON에는 아래 키를 모두 포함해야 한다.
- feedback: 전체 코칭 피드백
- structure_diagnosis:
  - has_problem_definition: bool
  - has_tech_decision: bool
  - has_quantified_result: bool
  - has_role_clarification: bool
  - has_implementation_detail: bool
  - missing_elements: list[str]
  - priority_focus: str
- rewrite_suggestions: 1개 이상 3개 이하
  - text: 개선된 이력서 bullet 문장
  - focus: star_gap | quantification | verb_strength | job_fit | tech_decision | problem_definition
  - section: 개선 포인트가 속한 섹션명
  - rationale: 짧은 근거
  - reference_pattern: 필요할 때만 문자열, 아니면 null
- missing_elements: 6단계 체크리스트 기준 빠진 항목 리스트
- iteration_count: 현재 반복 횟수

missing_elements와 priority_focus에는 아래 표현만 사용한다.
- 프로젝트 개요
- 문제 정의
- 기술 선택 근거
- 구현 디테일
- 정량적 성과
- 역할 명확화

rewrite_suggestions.text는 바로 이력서에 붙여 넣을 수 있는 완성 문장으로 작성한다.
문제 정의, 기술 선택 근거, 구현 디테일, 정량적 성과가 자연스럽게 연결되도록 구성한다.
""".strip()

INTRO_GENERATE_SYSTEM_PROMPT = """
너는 이력서/포트폴리오 활동 소개 문장을 정리하는 Coach AI다.
사용자가 적은 활동 메모, 기여 내용, 초안 문장을 바탕으로
"어떤 활동이었는지 간단한 소개를 적어주세요" 칸에 바로 넣을 수 있는 소개글 후보를 만든다.

반드시 JSON 객체만 반환한다. 마크다운, 설명 문장, 코드펜스는 금지한다.
응답 JSON은 아래 형식을 따른다.
- intro_candidates: 1개 이상 3개 이하의 소개글 후보 리스트

규칙:
1. 한국어로 작성한다.
2. 각 후보는 1~2문장 분량의 자연스러운 소개글로 쓴다.
3. 입력에 없는 수치, 기간, 역할, 성과를 지어내지 않는다.
4. section_type이 있으면 활동 유형을 자연스럽게 드러낸다.
5. 후보끼리는 표현만 조금 다르게 하고, 핵심 사실은 유지한다.
6. RAG 문구는 표현 참고만 하고 그대로 복사하지 않는다.
""".strip()

COACH_RETRIEVER = CoachRetriever()
logger = get_logger(__name__)
CoachMode = Literal["feedback", "intro_generate"]


class IntroGenerateResponse(BaseModel):
    """One-shot activity intro candidates for the new activity flow."""

    model_config = ConfigDict(str_strip_whitespace=True)

    intro_candidates: list[str]

    @field_validator("intro_candidates")
    @classmethod
    def validate_intro_candidates(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in value:
            text = str(item).strip()
            if text and text not in normalized:
                normalized.append(text)

        if not 1 <= len(normalized) <= 3:
            raise ValueError("intro_candidates must contain between 1 and 3 items")

        return normalized


class CoachPromptInput(TypedDict, total=False):
    """Prompt builder input payload."""

    mode: CoachMode
    activity_description: str
    job_title: str
    section_type: str
    history: list[dict[str, str]]
    selected_suggestion_index: int | None


class CoachState(TypedDict):
    """Graph state for Coach AI execution."""

    mode: CoachMode
    session_id: str
    activity_text: str
    job_title: str
    section_type: str
    selected_suggestion_index: int | None
    history: list[dict[str, str]]
    rag_context: str
    rag_results: dict[str, list[dict[str, Any]]]
    feedback: str
    missing_elements: list[str]
    structure_diagnosis: dict[str, Any]
    rewrite_suggestions: list[dict[str, Any]]
    intro_candidates: list[str]
    iteration_count: int


def _get_llm() -> ChatGoogleGenerativeAI:
    """Return the configured Gemini model instance."""

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ["GOOGLE_API_KEY"],
    )


def _safe_text(value: Any) -> str:
    """Normalize arbitrary values into stripped strings."""

    return str(value).strip() if value is not None else ""


def _canonical_missing_element(value: Any) -> str | None:
    """Map arbitrary labels into the agreed missing-element vocabulary."""

    text = _safe_text(value)
    if not text:
        return None

    if text in STRUCTURE_CHECKLIST:
        return text

    lowered = text.lower()
    if lowered in MISSING_ELEMENT_ALIASES:
        return MISSING_ELEMENT_ALIASES[lowered]
    if text in MISSING_ELEMENT_ALIASES:
        return MISSING_ELEMENT_ALIASES[text]
    return None


def _normalize_missing_elements(raw_value: Any) -> list[str]:
    """Normalize missing element labels and preserve checklist priority order."""

    if not isinstance(raw_value, list):
        return []

    normalized: list[str] = []
    for item in raw_value:
        canonical = _canonical_missing_element(item)
        if canonical and canonical not in normalized:
            normalized.append(canonical)

    return sorted(normalized, key=STRUCTURE_CHECKLIST.index)


def _format_history(history: list[dict[str, str]], limit: int = 6) -> str:
    """Render recent conversation history for the prompt."""

    if not history:
        return "- 없음"

    lines: list[str] = []
    for item in history[-limit:]:
        role = "사용자" if item.get("role") == "user" else "코치"
        content = _safe_text(item.get("content"))
        if content:
            lines.append(f"- {role}: {content}")

    return "\n".join(lines) if lines else "- 없음"


def build_rag_context(
    job_keyword_patterns: list[dict],
    star_examples: list[dict],
    job_posting_snippets: list[dict],
) -> str:
    """Format retrieval results into the agreed RAG context block."""

    lines = ["[직무 키워드 패턴]"]
    if job_keyword_patterns:
        for item in job_keyword_patterns:
            label = PATTERN_TYPE_LABELS.get(_safe_text(item.get("pattern_type")), "참고")
            lines.append(f"- ({label}) {_safe_text(item.get('document'))}")
    else:
        lines.append("- 없음")

    lines.append("")
    lines.append("[이 직무의 실제 채용 공고에서는 이런 표현을 사용합니다:]")
    if job_posting_snippets:
        for item in job_posting_snippets:
            source = _safe_text(item.get("source")) or "공고"
            section_type = _safe_text(item.get("section_type")) or "표현"
            lines.append(f"- ({source}/{section_type}) {_safe_text(item.get('document'))}")
    else:
        lines.append("- 없음")

    lines.append("")
    lines.append("[STAR 개선 예시]")
    if star_examples:
        for item in star_examples:
            lines.append(f"- Before: {_safe_text(item.get('original_text'))}")
            lines.append(f"  After: {_safe_text(item.get('document'))}")
            lines.append(f"  Focus: {_safe_text(item.get('rewrite_focus')) or '없음'}")
    else:
        lines.append("- 없음")

    return "\n".join(lines)


def build_coach_prompt(
    rag_context: str,
    user_input: CoachPromptInput,
    iteration_count: int,
) -> str:
    """Build the user prompt for the coach model."""

    selected_index = user_input.get("selected_suggestion_index")
    selected_hint = (
        str(selected_index) if selected_index is not None else "없음"
    )

    return f"""
---
{rag_context}
---

[사용자 입력]
- 목표 직무: {_safe_text(user_input.get("job_title"))}
- 섹션 타입: {_safe_text(user_input.get("section_type"))}
- 활동 설명: {_safe_text(user_input.get("activity_description"))}
- 현재 반복 횟수: {iteration_count}
- 사용자가 선택한 이전 suggestion index: {selected_hint}

[최근 대화]
{_format_history(user_input.get("history", []))}

[작업 지침]
1. 먼저 6단계 구조 체크리스트로 현재 문장을 진단한다.
2. 빠진 항목을 우선순위대로 정리한다.
3. RAG 컨텍스트의 직무 패턴과 STAR 예시를 반영해 1~3개의 개선 문장을 만든다.
4. 첫 번째 suggestion에는 가장 우선순위가 높은 누락 요소를 반드시 반영한다.
5. 기술 선택 근거가 부족하면 대안 비교를 넣고, 정량 수치가 부족하면 현실적인 숫자를 포함한다.
6. JSON 객체만 반환한다.
""".strip()


def build_intro_generate_prompt(
    rag_context: str,
    user_input: CoachPromptInput,
) -> str:
    """Build the intro-generation prompt for one-shot activity summaries."""

    section_type = _safe_text(user_input.get("section_type"))
    job_title = _safe_text(user_input.get("job_title"))

    return f"""
---
{rag_context}
---

[사용자 입력]
- mode: intro_generate
- 목표 직무: {job_title or "없음"}
- 활동 유형: {section_type or "없음"}
- 기여 내용/초안: {_safe_text(user_input.get("activity_description"))}

[작업 지시]
1. 입력을 바탕으로 활동 소개글 후보를 3개 생성한다.
2. 사용자가 어떤 활동을 했는지 한눈에 이해되도록 요약한다.
3. 입력에 없는 수치, 기간, 역할, 성과는 추가하지 않는다.
4. 한 후보는 바로 description 필드에 붙여 넣을 수 있는 완성 문장으로 쓴다.
5. JSON 객체만 반환한다.
""".strip()


def _strip_code_fence(text: str) -> str:
    """Remove markdown code fences when the model wraps JSON."""

    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def _extract_json_text(raw_text: str) -> str:
    """Extract the outermost JSON object text from a model response."""

    stripped = _strip_code_fence(raw_text)
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped

    match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if match:
        return match.group(0)
    raise ValueError("JSON object not found in model response")


def _response_content_to_text(raw_content: Any) -> str:
    """Convert provider-specific content payloads into plain text."""

    if isinstance(raw_content, str):
        return raw_content
    if isinstance(raw_content, list):
        chunks: list[str] = []
        for item in raw_content:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict):
                chunks.append(_safe_text(item.get("text")))
            else:
                chunks.append(_safe_text(item))
        return "\n".join(chunk for chunk in chunks if chunk)
    return _safe_text(raw_content)


def _infer_missing_elements(activity_text: str) -> list[str]:
    """Fallback heuristic diagnosis when model output is missing or invalid."""

    text = _safe_text(activity_text)
    lowered = text.lower()
    missing: list[str] = []

    if not any(keyword in text for keyword in ["프로젝트", "서비스", "기간", "개월", "주", "분기", "역할"]):
        missing.append("프로젝트 개요")
    if not any(keyword in text for keyword in ["문제", "이슈", "한계", "원인", "병목", "불편", "리스크"]):
        missing.append("문제 정의")
    if not any(keyword in text for keyword in ["선택", "비교", "도입한 이유", "판단", "대안"]):
        missing.append("기술 선택 근거")
    if not any(keyword in text for keyword in ["구현", "설계", "구축", "개발", "적용", "자동화"]):
        missing.append("구현 디테일")
    if not re.search(r"\d", lowered):
        missing.append("정량적 성과")
    if not any(keyword in text for keyword in ["주도", "담당", "기여", "협업", "팀", "역할"]):
        missing.append("역할 명확화")

    return sorted(missing, key=STRUCTURE_CHECKLIST.index)


def _build_structure_diagnosis_from_missing(
    missing_elements: list[str],
    priority_focus: str | None = None,
) -> StructureDiagnosis:
    """Convert missing element labels into the response schema."""

    missing_set = set(missing_elements)
    normalized_priority = priority_focus if priority_focus in STRUCTURE_CHECKLIST else None

    return StructureDiagnosis(
        has_problem_definition="문제 정의" not in missing_set,
        has_tech_decision="기술 선택 근거" not in missing_set,
        has_quantified_result="정량적 성과" not in missing_set,
        has_role_clarification="역할 명확화" not in missing_set,
        has_implementation_detail="구현 디테일" not in missing_set,
        missing_elements=missing_elements,
        priority_focus=normalized_priority or (missing_elements[0] if missing_elements else "정량적 성과"),
    )


def _focus_from_priority(priority_focus: str) -> str:
    """Map the highest-priority missing element to a suggestion focus."""

    return PRIORITY_TO_FOCUS.get(priority_focus, "star_gap")


def _fallback_feedback(priority_focus: str) -> str:
    """Build a concise fallback feedback string."""

    return (
        f"현재 문장에서는 '{priority_focus}'가 가장 먼저 보강되어야 합니다. "
        "문제 상황, 선택 근거, 구현 방식, 정량 성과를 하나의 흐름으로 연결해 다시 정리해보세요."
    )


def _fallback_suggestion(priority_focus: str, feedback: str) -> RewriteSuggestion:
    """Build a minimal valid suggestion when the model output is incomplete."""

    focus = _focus_from_priority(priority_focus)
    return RewriteSuggestion(
        text=feedback,
        focus=focus,
        section=FOCUS_TO_SECTION[focus],
        rationale=f"{priority_focus}가 빠져 있어 우선 보강이 필요합니다.",
        reference_pattern=FOCUS_TO_REFERENCE_PATTERN.get(focus),
    )


def _normalize_structure_diagnosis(
    raw_value: Any,
    missing_elements: list[str],
) -> StructureDiagnosis:
    """Normalize the structure diagnosis payload and keep it consistent with missing items."""

    priority_focus: str | None = None
    if isinstance(raw_value, dict):
        priority_focus = _canonical_missing_element(raw_value.get("priority_focus"))
    return _build_structure_diagnosis_from_missing(missing_elements, priority_focus)


def _normalize_rewrite_suggestions(
    raw_value: Any,
    feedback: str,
    missing_elements: list[str],
) -> list[RewriteSuggestion]:
    """Normalize model-generated suggestions into schema objects."""

    priority_focus = missing_elements[0] if missing_elements else "정량적 성과"
    suggestions: list[RewriteSuggestion] = []

    if isinstance(raw_value, list):
        for item in raw_value[:3]:
            if not isinstance(item, dict):
                continue

            focus = _safe_text(item.get("focus"))
            if focus not in FOCUS_TO_SECTION:
                focus = _focus_from_priority(priority_focus)

            section = _safe_text(item.get("section")) or FOCUS_TO_SECTION[focus]
            rationale = _safe_text(item.get("rationale")) or f"{priority_focus} 보강이 우선입니다."
            text = _safe_text(item.get("text")) or feedback
            reference_pattern = _safe_text(item.get("reference_pattern")) or None
            if reference_pattern is None and focus in FOCUS_TO_REFERENCE_PATTERN:
                reference_pattern = FOCUS_TO_REFERENCE_PATTERN[focus]

            try:
                suggestions.append(
                    RewriteSuggestion(
                        text=text,
                        focus=focus,
                        section=section,
                        rationale=rationale,
                        reference_pattern=reference_pattern,
                    )
                )
            except Exception:
                continue

    if not suggestions:
        suggestions.append(_fallback_suggestion(priority_focus, feedback))

    return suggestions[:3]


def _fallback_intro_candidates(
    activity_text: str,
    section_type: str,
) -> list[str]:
    """Build deterministic intro candidates when the model response is unavailable."""

    base = re.sub(r"\s+", " ", _safe_text(activity_text)).strip(" -")
    if not base:
        base = "활동 내용을 정리한 경험입니다."

    section_prefix = f"{section_type} 활동으로, " if _safe_text(section_type) else ""
    candidates = [
        base,
        f"{section_prefix}{base}" if section_prefix else f"이 활동은 {base}",
        (
            f"{base} 내용을 바탕으로 진행한 {_safe_text(section_type)} 경험입니다."
            if _safe_text(section_type)
            else f"{base} 내용을 바탕으로 진행한 활동입니다."
        ),
    ]

    normalized: list[str] = []
    for item in candidates:
        text = re.sub(r"\s+", " ", _safe_text(item))
        if text and text not in normalized:
            normalized.append(text)

    return normalized[:3]


def _normalize_intro_candidates(
    raw_value: Any,
    activity_text: str,
    section_type: str,
) -> list[str]:
    """Normalize intro candidates from flexible LLM payload shapes."""

    candidates: list[str] = []
    if isinstance(raw_value, list):
        for item in raw_value:
            if isinstance(item, str):
                text = _safe_text(item)
            elif isinstance(item, dict):
                text = (
                    _safe_text(item.get("text"))
                    or _safe_text(item.get("intro"))
                    or _safe_text(item.get("candidate"))
                )
            else:
                text = _safe_text(item)

            if text and text not in candidates:
                candidates.append(text)

    if not candidates:
        candidates = _fallback_intro_candidates(activity_text, section_type)

    return candidates[:3]


def _build_intro_fallback_response(
    activity_text: str,
    section_type: str,
) -> IntroGenerateResponse:
    """Return a safe intro-generation response without the LLM."""

    return IntroGenerateResponse(
        intro_candidates=_fallback_intro_candidates(activity_text, section_type)
    )


def _parse_feedback_llm_response(
    raw_content: Any,
    activity_text: str,
    iteration_count: int,
) -> CoachResponse:
    """Parse and validate the LLM response into the CoachResponse contract."""

    raw_text = _response_content_to_text(raw_content)

    payload = json.loads(_extract_json_text(raw_text))
    if not isinstance(payload, dict):
        raise ValueError("LLM response must be a JSON object")

    raw_missing_elements = payload.get("missing_elements")
    if not raw_missing_elements and isinstance(payload.get("structure_diagnosis"), dict):
        raw_missing_elements = payload["structure_diagnosis"].get("missing_elements")

    missing_elements = _normalize_missing_elements(raw_missing_elements)
    if not missing_elements:
        raise ValueError("LLM response missing normalized missing_elements")

    structure_diagnosis = _normalize_structure_diagnosis(
        payload.get("structure_diagnosis"),
        missing_elements,
    )
    feedback = _safe_text(payload.get("feedback")) or _fallback_feedback(
        structure_diagnosis.priority_focus
    )
    rewrite_suggestions = _normalize_rewrite_suggestions(
        payload.get("rewrite_suggestions"),
        feedback,
        missing_elements,
    )

    raw_iteration = payload.get("iteration_count")
    try:
        normalized_iteration = int(raw_iteration)
    except (TypeError, ValueError):
        normalized_iteration = iteration_count

    response = CoachResponse(
        feedback=feedback,
        structure_diagnosis=structure_diagnosis,
        rewrite_suggestions=rewrite_suggestions,
        missing_elements=missing_elements,
        iteration_count=normalized_iteration,
    )
    log_event(
        logger,
        logging.INFO,
        "structure_diagnosed",
        missing=response.structure_diagnosis.missing_elements,
        priority=response.structure_diagnosis.priority_focus,
    )
    return response


def _parse_intro_generate_llm_response(
    raw_content: Any,
    activity_text: str,
    section_type: str,
) -> IntroGenerateResponse:
    """Parse and validate the intro-generation response."""

    raw_text = _response_content_to_text(raw_content)
    payload = json.loads(_extract_json_text(raw_text))
    if not isinstance(payload, dict):
        raise ValueError("LLM response must be a JSON object")

    raw_candidates = payload.get("intro_candidates")
    if raw_candidates is None:
        raw_candidates = payload.get("candidates")
    if raw_candidates is None and isinstance(payload.get("rewrite_suggestions"), list):
        raw_candidates = payload.get("rewrite_suggestions")

    candidates = _normalize_intro_candidates(raw_candidates, activity_text, section_type)
    return IntroGenerateResponse(intro_candidates=candidates)


def rag_search_node(state: CoachState) -> CoachState:
    """Retrieve job patterns and STAR examples, then build the prompt context."""

    try:
        rag_results = COACH_RETRIEVER.retrieve_for_coaching(
            job_title=state["job_title"],
            activity_text=state["activity_text"],
            section_type=state["section_type"],
        )
        job_patterns = rag_results["job_keyword_patterns"]
        job_posting_snippets = rag_results["job_posting_snippets"]
        star_examples = rag_results["star_examples"]
        rag_context = build_rag_context(job_patterns, star_examples, job_posting_snippets)
    except Exception:
        rag_results = {
            "job_keyword_patterns": [],
            "job_posting_snippets": [],
            "star_examples": [],
        }
        job_patterns = []
        job_posting_snippets = []
        star_examples = []
        rag_context = build_rag_context([], [], [])

    return {
        **state,
        "rag_context": rag_context,
        "rag_results": rag_results,
    }


async def coach_response_node(state: CoachState) -> CoachState:
    """Generate a structured coach response from the LLM."""

    prompt_input: CoachPromptInput = {
        "mode": state["mode"],
        "activity_description": state["activity_text"],
        "job_title": state["job_title"],
        "section_type": state["section_type"],
        "history": state["history"],
        "selected_suggestion_index": state["selected_suggestion_index"],
    }
    if state["mode"] == "intro_generate":
        prompt = build_intro_generate_prompt(
            rag_context=state["rag_context"],
            user_input=prompt_input,
        )
        system_prompt = INTRO_GENERATE_SYSTEM_PROMPT
    else:
        prompt = build_coach_prompt(
            rag_context=state["rag_context"],
            user_input=prompt_input,
            iteration_count=state["iteration_count"],
        )
        system_prompt = COACH_SYSTEM_PROMPT

    try:
        llm = _get_llm()
        response = await llm.ainvoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt),
            ]
        )
        if state["mode"] == "intro_generate":
            intro_response = _parse_intro_generate_llm_response(
                raw_content=response.content,
                activity_text=state["activity_text"],
                section_type=state["section_type"],
            )
        else:
            coach_response = _parse_feedback_llm_response(
                raw_content=response.content,
                activity_text=state["activity_text"],
                iteration_count=state["iteration_count"],
            )
    except Exception as exc:
        log_event(
            logger,
            logging.ERROR,
            "gemini_failed",
            session_id=state["session_id"],
            mode=state["mode"],
            job_title=state["job_title"],
            section_type=state["section_type"],
            error=str(exc),
        )
        if state["mode"] == "intro_generate":
            intro_response = _build_intro_fallback_response(
                activity_text=state["activity_text"],
                section_type=state["section_type"],
            )
            log_event(
                logger,
                logging.WARNING,
                "fallback_triggered",
                session_id=state["session_id"],
                mode=state["mode"],
                candidate_count=len(intro_response.intro_candidates),
            )
        else:
            fallback_response = generate_fallback_response(
                activity_description=state["activity_text"],
                rag_results=state["rag_results"],
                job_title=state["job_title"],
                section_type=state["section_type"],
            )
            log_event(
                logger,
                logging.WARNING,
                "fallback_triggered",
                session_id=state["session_id"],
                mode=state["mode"],
                missing=fallback_response.missing_elements,
                priority=fallback_response.structure_diagnosis.priority_focus,
            )
            coach_response = fallback_response.model_copy(
                update={
                    "feedback": (
                        f"피드백 생성 중 오류가 발생했습니다: {str(exc)}. "
                        f"{fallback_response.feedback}"
                    ),
                    "iteration_count": state["iteration_count"],
                }
            )

    if state["mode"] == "intro_generate":
        log_event(
            logger,
            logging.INFO,
            "coach_response",
            session_id=state["session_id"],
            mode=state["mode"],
            candidate_count=len(intro_response.intro_candidates),
        )
        return {
            **state,
            "intro_candidates": intro_response.intro_candidates,
        }

    log_event(
        logger,
        logging.INFO,
        "coach_response",
        session_id=state["session_id"],
        mode=state["mode"],
        suggestion_count=len(coach_response.rewrite_suggestions),
        missing=coach_response.missing_elements,
        priority=coach_response.structure_diagnosis.priority_focus,
    )

    return {
        **state,
        "feedback": coach_response.feedback,
        "missing_elements": coach_response.missing_elements,
        "structure_diagnosis": coach_response.structure_diagnosis.model_dump(),
        "rewrite_suggestions": [item.model_dump() for item in coach_response.rewrite_suggestions],
        "iteration_count": coach_response.iteration_count,
    }


def _build_coach_graph() -> StateGraph:
    """Build the LangGraph execution flow for Coach AI."""

    graph = StateGraph(CoachState)
    graph.add_node("rag_search", rag_search_node)
    graph.add_node("coach_response", coach_response_node)
    graph.set_entry_point("rag_search")
    graph.add_edge("rag_search", "coach_response")
    graph.add_edge("coach_response", END)
    return graph.compile()


_coach_graph = _build_coach_graph()


async def run_coach_graph(
    session_id: str,
    activity_text: str,
    job_title: str,
    history: list | None = None,
    section_type: str = "",
    selected_suggestion_index: int | None = None,
    mode: CoachMode = "feedback",
) -> dict:
    """Run the Coach AI graph and return a mode-specific response payload."""

    history = history or []
    log_event(
        logger,
        logging.INFO,
        "session",
        session_id=session_id,
        mode=mode,
        job_title=job_title,
        section_type=section_type,
        history_count=len(history),
    )
    initial_state: CoachState = {
        "mode": mode,
        "session_id": session_id,
        "activity_text": activity_text,
        "job_title": job_title,
        "section_type": section_type,
        "selected_suggestion_index": selected_suggestion_index,
        "history": history,
        "rag_context": "",
        "rag_results": {
            "job_keyword_patterns": [],
            "job_posting_snippets": [],
            "star_examples": [],
        },
        "feedback": "",
        "missing_elements": [],
        "structure_diagnosis": {},
        "rewrite_suggestions": [],
        "intro_candidates": [],
        "iteration_count": len(history) // 2 + 1,
    }

    result = await _coach_graph.ainvoke(initial_state)
    if mode == "intro_generate":
        response = IntroGenerateResponse(
            intro_candidates=result["intro_candidates"],
        )
        return response.model_dump()

    response = CoachResponse(
        feedback=result["feedback"],
        structure_diagnosis=StructureDiagnosis.model_validate(result["structure_diagnosis"]),
        rewrite_suggestions=[
            RewriteSuggestion.model_validate(item) for item in result["rewrite_suggestions"]
        ],
        missing_elements=result["missing_elements"],
        iteration_count=result["iteration_count"],
    )

    updated_history = history + [
        {"role": "user", "content": activity_text},
        {"role": "assistant", "content": response.feedback},
    ]

    payload = response.model_dump()
    payload["updated_history"] = updated_history
    return payload
