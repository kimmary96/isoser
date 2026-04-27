"""공고 본문 기반 활동 리라이팅 체인."""

from __future__ import annotations

import json
import logging
import re
import asyncio
import contextlib
from collections import Counter
from typing import Any

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

try:
    from backend.chains.match_chain import _extract_keywords, _score_activities_by_keywords
    from backend.logging_config import get_logger, log_event
    from backend.rag.fallback import generate_fallback_response
    from backend.rag.retrievers import CoachRetriever
    from backend.schemas.match_rewrite import (
        ActivityRewrite,
        MatchRewriteResponse,
        RewriteSuggestion as MatchRewriteSuggestion,
    )
except ImportError:
    from chains.match_chain import _extract_keywords, _score_activities_by_keywords
    from logging_config import get_logger, log_event
    from rag.fallback import generate_fallback_response
    from rag.retrievers import CoachRetriever
    from schemas.match_rewrite import (
        ActivityRewrite,
        MatchRewriteResponse,
        RewriteSuggestion as MatchRewriteSuggestion,
    )

from utils.supabase_admin import build_service_headers, get_supabase_admin_settings

AUTO_SELECTED_ACTIVITY_LIMIT = 5
ACTIVITY_TEXT_LIMIT = 1000
JOB_POSTING_TEXT_LIMIT = 2000
SUMMARY_KEYWORD_LIMIT = 6
SUMMARY_LINE_LIMIT = 3
ACTIVITY_SELECT_COLUMNS = (
    "id,user_id,type,title,organization,team_size,team_composition,my_role,"
    "contributions,period,role,skills,description,star_situation,star_task,"
    "star_action,star_result,is_visible"
)
ALLOWED_ACTIVITY_SECTION_TYPES = {"회사경력", "프로젝트", "대외활동", "학생활동"}

FOCUS_DEFAULT_REFERENCE_PATTERN = {
    "star_gap": "Situation - Task - Action - Result",
    "quantification": "Technical Achievement - Quantified Impact - Business Value",
    "verb_strength": "Action - Implementation - Outcome",
    "job_fit": "Role - Action - Result",
    "tech_decision": "Problem - Alternative Comparison - Decision",
    "problem_definition": "Problem - Cause - Action - Result",
}

FOCUS_TO_SECTION = {
    "star_gap": "프로젝트 개요",
    "quantification": "성과",
    "verb_strength": "구현",
    "job_fit": "프로젝트 개요",
    "tech_decision": "기술적 의사결정",
    "problem_definition": "문제 정의",
}

SECTION_ALIASES = {
    "프로젝트 개요": "프로젝트 개요",
    "개요": "프로젝트 개요",
    "star 구조": "프로젝트 개요",
    "역할": "프로젝트 개요",
    "역할 명확화": "프로젝트 개요",
    "문제 정의": "문제 정의",
    "문제정의": "문제 정의",
    "기술적 의사결정": "기술적 의사결정",
    "기술 선택 근거": "기술적 의사결정",
    "기술선택": "기술적 의사결정",
    "구현": "구현",
    "구현 디테일": "구현",
    "성과": "성과",
    "정량적 성과": "성과",
    "트러블슈팅": "트러블슈팅",
    "장애 대응": "트러블슈팅",
}

TROUBLESHOOTING_KEYWORDS = ("장애", "이슈", "문제", "트러블슈팅", "에러", "복구", "병목", "실패")

SYSTEM_PROMPT = """
너는 이력서 bullet을 채용 공고 기준으로 재작성하는 Rewrite Coach AI다.
반드시 사용자의 원문 사실만 재배열하고 구조화해야 하며, 없는 수치나 성과를 만들면 안 된다.
자동 치환은 금지되고, 사용자가 선택할 수 있는 suggestion만 제공한다.

아래 6단계 구조 체크리스트를 기준으로 공고 적합성을 보강한다.
1. 프로젝트 개요 (Overview)
2. 문제 정의 (Problem Definition)
3. 기술적 의사결정 (Technical Decision)
4. 구현 (Implementation)
5. 성과 (Results)
6. 트러블슈팅 (Troubleshooting)

반드시 JSON 객체만 반환한다. 마크다운, 코드블록, 설명 문장은 금지한다.
응답 형식:
{
  "feedback": "짧은 총평",
  "rewrite_suggestions": [
    {
      "text": "리라이팅 문장",
      "focus": "star_gap | quantification | verb_strength | job_fit | tech_decision | problem_definition",
      "section": "프로젝트 개요 | 문제 정의 | 기술적 의사결정 | 구현 | 성과 | 트러블슈팅",
      "rationale": "왜 이렇게 고쳤는지",
      "reference_pattern": "적용 패턴명"
    }
  ]
}

규칙:
- rewrite_suggestions는 1개 이상 3개 이하로 생성한다.
- text는 바로 이력서에 붙여넣을 수 있는 완성 문장이어야 한다.
- 공고 요구사항을 반영하되 원문에 없는 숫자, 성과, 역할을 새로 만들지 않는다.
- 숫자 근거가 원문에 없으면 정성적 결과로 유지하고 rationale에서 보완 필요성을 설명한다.
""".strip()

REWRITE_PROMPT_TEMPLATE = """
[채용 공고 핵심 요약]
{job_analysis_summary}

[지원 직무]
{job_title}

[섹션 타입]
{section_type}

[활동 원문]
{activity_text}

[채용 공고 원문 일부]
{job_posting_excerpt}

[RAG 컨텍스트]
{rag_context}

[작업 지침]
1. 활동 원문의 사실은 유지한다.
2. 공고에 맞게 표현, 구조, 강조점만 조정한다.
3. 문제 정의, 기술적 의사결정, 구현, 성과, 트러블슈팅 중 필요한 축을 보강한다.
4. 없는 수치나 성과는 만들지 않는다.
5. JSON 객체만 반환한다.
""".strip()

logger = get_logger(__name__)
REWRITE_RETRIEVER = CoachRetriever()


def _safe_text(value: Any) -> str:
    """임의 값을 공백 제거된 문자열로 정규화합니다."""

    return str(value).strip() if value is not None else ""


def _truncate_text(text: str, limit: int) -> str:
    """모델 입력 길이를 제한합니다."""

    normalized = _safe_text(text)
    if len(normalized) <= limit:
        return normalized
    return normalized[:limit].rstrip() + "..."


async def _fetch_activities_from_supabase(
    *,
    user_id: str,
    activity_ids: list[str],
    section_type: str,
) -> list[dict[str, Any]]:
    """Supabase activities 테이블에서 대상 활동을 조회합니다."""

    try:
        settings = get_supabase_admin_settings()
    except Exception as exc:
        raise RuntimeError("Supabase activity lookup is not configured") from exc

    if not settings.url or not settings.service_role_key:
        raise RuntimeError("Supabase activity lookup is not configured")

    params: dict[str, str] = {
        "select": ACTIVITY_SELECT_COLUMNS,
        "user_id": f"eq.{user_id}",
        "is_visible": "eq.true",
        "order": "updated_at.desc",
    }

    if activity_ids:
        encoded_ids = ",".join(activity_ids)
        params["id"] = f"in.({encoded_ids})"
    elif section_type in ALLOWED_ACTIVITY_SECTION_TYPES:
        params["type"] = f"eq.{section_type}"

    endpoint = f"{settings.url}/rest/v1/activities"
    async with httpx.AsyncClient(timeout=settings.timeout_seconds, trust_env=False) as client:
        response = await client.get(
            endpoint,
            params=params,
            headers=build_service_headers(settings.service_role_key),
        )

    if response.is_success:
        rows = response.json()
        return rows if isinstance(rows, list) else []

    detail = response.text
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        detail = str(body.get("message") or body.get("hint") or body.get("details") or detail)
    raise RuntimeError(f"Supabase activities lookup failed ({response.status_code}): {detail}")


def _build_activity_original_text(activity: dict[str, Any]) -> str:
    """응답용 original_text를 구성합니다."""

    description = _safe_text(activity.get("description"))
    if description:
        return description

    contributions = activity.get("contributions")
    if isinstance(contributions, list):
        contribution_lines = [
            str(item).strip()
            for item in contributions
            if str(item).strip()
        ]
        if contribution_lines:
            return " / ".join(contribution_lines[:3])

    fallback_parts = [
        _safe_text(activity.get("title")),
        _safe_text(activity.get("my_role")),
        _safe_text(activity.get("role")),
    ]
    fallback = " / ".join(part for part in fallback_parts if part)
    return fallback or "활동 설명이 비어 있습니다."


def _build_activity_prompt_text(activity: dict[str, Any]) -> str:
    """프롬프트에 넣을 활동 텍스트를 구성합니다."""

    pieces: list[str] = []
    title = _safe_text(activity.get("title"))
    activity_type = _safe_text(activity.get("type"))
    organization = _safe_text(activity.get("organization"))
    period = _safe_text(activity.get("period"))
    team_size = activity.get("team_size")
    team_composition = _safe_text(activity.get("team_composition"))
    my_role = _safe_text(activity.get("my_role"))
    role = _safe_text(activity.get("role"))
    skills = activity.get("skills")
    contributions = activity.get("contributions")
    description = _safe_text(activity.get("description"))
    star_situation = _safe_text(activity.get("star_situation"))
    star_task = _safe_text(activity.get("star_task"))
    star_action = _safe_text(activity.get("star_action"))
    star_result = _safe_text(activity.get("star_result"))

    if title:
        pieces.append(f"제목: {title}")
    if activity_type:
        pieces.append(f"활동 유형: {activity_type}")
    if organization:
        pieces.append(f"조직: {organization}")
    if period:
        pieces.append(f"기간: {period}")
    if isinstance(team_size, int) and team_size > 0:
        pieces.append(f"팀 규모: {team_size}명")
    if team_composition:
        pieces.append(f"팀 구성: {team_composition}")
    if my_role:
        pieces.append(f"내 역할: {my_role}")
    if role:
        pieces.append(f"기존 역할 표기: {role}")
    if isinstance(skills, list):
        normalized_skills = [str(skill).strip() for skill in skills if str(skill).strip()]
        if normalized_skills:
            pieces.append(f"기술/스킬: {', '.join(normalized_skills)}")
    if isinstance(contributions, list):
        normalized_contributions = [
            str(item).strip()
            for item in contributions
            if str(item).strip()
        ]
        if normalized_contributions:
            contribution_text = "\n- ".join(normalized_contributions[:6])
            pieces.append(f"기여 내용:\n- {contribution_text}")
    if description:
        pieces.append(f"설명: {description}")
    if star_situation:
        pieces.append(f"STAR Situation: {star_situation}")
    if star_task:
        pieces.append(f"STAR Task: {star_task}")
    if star_action:
        pieces.append(f"STAR Action: {star_action}")
    if star_result:
        pieces.append(f"STAR Result: {star_result}")

    return _truncate_text("\n".join(pieces), ACTIVITY_TEXT_LIMIT)


def _extract_ranked_keywords(text: str, *, limit: int = SUMMARY_KEYWORD_LIMIT) -> list[str]:
    """공고에서 상위 키워드를 추출합니다."""

    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]{1,}|[가-힣]{2,}", text or "")
    normalized = [token.strip().lower() for token in tokens]
    filtered = [token for token in normalized if len(token) >= 2]
    ranked = [token for token, _ in Counter(filtered).most_common(limit)]
    return ranked


def _extract_job_analysis_summary(job_posting_text: str, job_title: str) -> str:
    """공고 핵심 요구사항을 2~3줄로 요약합니다."""

    normalized_text = _safe_text(job_posting_text)
    keywords = _extract_ranked_keywords(normalized_text, limit=SUMMARY_KEYWORD_LIMIT)
    sentences = [
        line.strip(" -•\t")
        for line in re.split(r"[\n\r]+|(?<=[.!?])\s+", normalized_text)
        if line.strip()
    ]
    picked_sentences: list[str] = []
    for sentence in sentences:
        if any(keyword in sentence.lower() for keyword in keywords[:4]):
            picked_sentences.append(sentence)
        if len(picked_sentences) >= 2:
            break

    summary_lines = [
        f"지원 직무: {job_title}",
        f"핵심 키워드: {', '.join(keywords[:5]) or '없음'}",
    ]
    if picked_sentences:
        summary_lines.append(f"주요 요구사항: {' / '.join(picked_sentences[:2])}")

    return "\n".join(summary_lines[:SUMMARY_LINE_LIMIT])


def _select_target_activities(
    *,
    activities: list[dict[str, Any]],
    job_posting_text: str,
    activity_ids: list[str],
) -> list[dict[str, Any]]:
    """리라이팅 대상 활동을 확정합니다."""

    if activity_ids:
        selected_id_set = set(activity_ids)
        return [item for item in activities if _safe_text(item.get("id")) in selected_id_set]

    job_keywords = _extract_keywords(job_posting_text)
    ranked = _score_activities_by_keywords(activities, job_keywords)
    ranked_ids = [activity_id for activity_id, score in ranked if score > 0][:AUTO_SELECTED_ACTIVITY_LIMIT]

    if ranked_ids:
        ranked_id_set = set(ranked_ids)
        selected = [item for item in activities if _safe_text(item.get("id")) in ranked_id_set]
        # Keep original input order for deterministic UX and test expectations.
        return selected

    return activities[:AUTO_SELECTED_ACTIVITY_LIMIT]


def _build_rag_context(
    *,
    job_keyword_patterns: list[dict[str, Any]],
    star_examples: list[dict[str, Any]],
    job_posting_snippets: list[dict[str, Any]],
) -> str:
    """프롬프트용 RAG 컨텍스트를 구성합니다."""

    lines = ["[직무 패턴]"]
    if job_keyword_patterns:
        for item in job_keyword_patterns[:3]:
            lines.append(f"- {_safe_text(item.get('document'))}")
    else:
        lines.append("- 없음")

    lines.append("")
    lines.append("[STAR 예시]")
    if star_examples:
        for item in star_examples[:3]:
            lines.append(f"- Before: {_safe_text(item.get('original_text'))}")
            lines.append(f"  After: {_safe_text(item.get('document'))}")
    else:
        lines.append("- 없음")

    lines.append("")
    lines.append("[공고 표현]")
    if job_posting_snippets:
        for item in job_posting_snippets[:2]:
            source = _safe_text(item.get("source")) or "공고"
            section = _safe_text(item.get("section_type")) or "표현"
            lines.append(f"- ({source}/{section}) {_safe_text(item.get('document'))}")
    else:
        lines.append("- 없음")

    return "\n".join(lines)


def _response_content_to_text(raw_content: Any) -> str:
    """Gemini 응답 content를 문자열로 변환합니다."""

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


def _item_value(item: Any, key: str) -> Any:
    """dict 또는 Pydantic 모델에서 값을 안전하게 조회합니다."""

    if isinstance(item, dict):
        return item.get(key)
    return getattr(item, key, None)


def _strip_code_fence(text: str) -> str:
    """응답의 코드 펜스를 제거합니다."""

    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def _extract_json_text(raw_text: str) -> str:
    """응답에서 JSON 객체 본문을 추출합니다."""

    stripped = _strip_code_fence(raw_text)
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped

    match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if match:
        return match.group(0)
    raise ValueError("JSON object not found in model response")


def _looks_like_troubleshooting(text: str) -> bool:
    """트러블슈팅 문맥 여부를 대략 판별합니다."""

    lowered = _safe_text(text).lower()
    return any(keyword in lowered for keyword in TROUBLESHOOTING_KEYWORDS)


def _normalize_section(raw_section: Any, *, focus: str, text: str) -> str:
    """응답 섹션명을 허용된 6단계 섹션명으로 정규화합니다."""

    candidate = _safe_text(raw_section)
    if candidate:
        lowered = candidate.lower()
        if lowered in SECTION_ALIASES:
            return SECTION_ALIASES[lowered]
        if candidate in SECTION_ALIASES:
            return SECTION_ALIASES[candidate]

    if _looks_like_troubleshooting(text):
        return "트러블슈팅"
    return FOCUS_TO_SECTION.get(focus, "프로젝트 개요")


def _normalize_match_rewrite_suggestions(raw_value: Any) -> list[MatchRewriteSuggestion]:
    """Gemini 응답의 suggestion 목록을 스키마로 정규화합니다."""

    suggestions: list[MatchRewriteSuggestion] = []
    if not isinstance(raw_value, list):
        return suggestions

    for item in raw_value[:3]:
        if not isinstance(item, dict):
            continue

        focus = _safe_text(item.get("focus"))
        if focus not in FOCUS_DEFAULT_REFERENCE_PATTERN:
            continue

        text = _safe_text(item.get("text"))
        rationale = _safe_text(item.get("rationale"))
        if not text or not rationale:
            continue

        reference_pattern = _safe_text(item.get("reference_pattern")) or FOCUS_DEFAULT_REFERENCE_PATTERN[focus]
        section = _normalize_section(item.get("section"), focus=focus, text=text)

        try:
            suggestions.append(
                MatchRewriteSuggestion(
                    text=text,
                    focus=focus,
                    section=section,
                    rationale=rationale,
                    reference_pattern=reference_pattern,
                )
            )
        except Exception:
            continue

    return suggestions[:3]


def _convert_fallback_suggestions(
    suggestions: list[Any],
) -> list[MatchRewriteSuggestion]:
    """기존 Coach fallback suggestion을 rewrite 스키마로 변환합니다."""

    converted: list[MatchRewriteSuggestion] = []
    for item in suggestions[:3]:
        focus = _safe_text(_item_value(item, "focus"))
        if focus not in FOCUS_DEFAULT_REFERENCE_PATTERN:
            continue

        text = _safe_text(_item_value(item, "text"))
        rationale = _safe_text(_item_value(item, "rationale"))
        reference_pattern = (
            _safe_text(_item_value(item, "reference_pattern"))
            or FOCUS_DEFAULT_REFERENCE_PATTERN[focus]
        )

        try:
            converted.append(
                MatchRewriteSuggestion(
                    text=text,
                    focus=focus,
                    section=_normalize_section(
                        _item_value(item, "section"),
                        focus=focus,
                        text=text,
                    ),
                    rationale=rationale or "기본 fallback 로직을 사용했습니다.",
                    reference_pattern=reference_pattern,
                )
            )
        except Exception:
            continue
    return converted[:3]


def _build_fallback_activity_rewrite(
    *,
    activity_id: str,
    original_text: str,
    activity_text: str,
    job_title: str,
    section_type: str,
    rag_results: dict[str, list[dict[str, Any]]],
) -> ActivityRewrite:
    """Gemini 또는 JSON 파싱 실패 시 활동별 fallback 결과를 생성합니다."""

    fallback_response = generate_fallback_response(
        activity_description=activity_text,
        rag_results=rag_results,
        job_title=job_title,
        section_type=section_type,
    )
    suggestions = _convert_fallback_suggestions(fallback_response.rewrite_suggestions)
    if not suggestions:
        suggestions = [
            MatchRewriteSuggestion(
                text=original_text,
                focus="star_gap",
                section="프로젝트 개요",
                rationale="기본 fallback 로직에서 원문 유지 제안만 생성되었습니다.",
                reference_pattern=FOCUS_DEFAULT_REFERENCE_PATTERN["star_gap"],
            )
        ]
    return ActivityRewrite(
        activity_id=activity_id,
        original_text=original_text,
        suggestions=suggestions,
    )


def _get_llm() -> ChatGoogleGenerativeAI:
    """Gemini 모델 인스턴스를 반환합니다."""

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ["GOOGLE_API_KEY"],
    )


def _llm_timeout_seconds() -> float:
    """Gemini 호출 timeout 값을 반환합니다."""

    raw_value = os.getenv("GOOGLE_API_TIMEOUT_SECONDS")
    try:
        return float(raw_value) if raw_value else 20.0
    except ValueError:
        return 20.0


async def _ainvoke_with_timeout(
    llm: ChatGoogleGenerativeAI,
    messages: list[SystemMessage | HumanMessage],
) -> Any:
    """LLM 호출을 task로 감싸 timeout 시 정리 누락 경고를 방지합니다."""

    task = asyncio.create_task(llm.ainvoke(messages))
    try:
        return await asyncio.wait_for(task, timeout=_llm_timeout_seconds())
    except Exception:
        if not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        raise


async def _generate_activity_rewrite(
    *,
    activity: dict[str, Any],
    job_posting_text: str,
    job_analysis_summary: str,
    job_title: str,
    section_type: str,
) -> tuple[ActivityRewrite, bool]:
    """단일 활동에 대한 rewrite suggestions를 생성합니다."""

    activity_id = _safe_text(activity.get("id"))
    original_text = _build_activity_original_text(activity)
    activity_text = _build_activity_prompt_text(activity)
    retrieval_query_text = f"{activity_text}\n{job_analysis_summary}".strip()

    rag_results = {
        "job_keyword_patterns": [],
        "star_examples": [],
        "job_posting_snippets": [],
    }
    retrieval_fallback_used = False

    try:
        retrieved = REWRITE_RETRIEVER.retrieve_for_coaching(
            job_title=job_title,
            activity_text=retrieval_query_text,
            section_type=section_type,
        )
        rag_results = {
            "job_keyword_patterns": (retrieved.get("job_keyword_patterns") or [])[:3],
            "star_examples": (retrieved.get("star_examples") or [])[:3],
            "job_posting_snippets": (retrieved.get("job_posting_snippets") or [])[:2],
        }
    except Exception as exc:
        retrieval_fallback_used = True
        log_event(
            logger,
            logging.WARNING,
            "rewrite_chroma_failed",
            activity_id=activity_id,
            section_type=section_type,
            error=str(exc),
        )

    rag_context = _build_rag_context(**rag_results)
    prompt = REWRITE_PROMPT_TEMPLATE.format(
        job_analysis_summary=job_analysis_summary,
        job_title=job_title,
        section_type=section_type,
        activity_text=activity_text,
        job_posting_excerpt=_truncate_text(job_posting_text, JOB_POSTING_TEXT_LIMIT),
        rag_context=rag_context,
    )

    try:
        llm = _get_llm()
        response = await _ainvoke_with_timeout(
            llm,
            [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=prompt),
            ],
        )
        payload = json.loads(_extract_json_text(_response_content_to_text(response.content)))
        suggestions = _normalize_match_rewrite_suggestions(payload.get("rewrite_suggestions"))
        if not suggestions:
            raise ValueError("rewrite_suggestions not found")

        activity_rewrite = ActivityRewrite(
            activity_id=activity_id,
            original_text=original_text,
            suggestions=suggestions,
        )
        return activity_rewrite, retrieval_fallback_used
    except Exception as exc:
        log_event(
            logger,
            logging.WARNING,
            "rewrite_llm_failed",
            activity_id=activity_id,
            section_type=section_type,
            error=str(exc),
        )
        fallback_rewrite = _build_fallback_activity_rewrite(
            activity_id=activity_id,
            original_text=original_text,
            activity_text=activity_text,
            job_title=job_title,
            section_type=section_type,
            rag_results=rag_results,
        )
        return fallback_rewrite, True


async def run_job_posting_rewrite_chain(
    *,
    user_id: str,
    job_posting_text: str,
    job_title: str,
    activity_ids: list[str] | None = None,
    section_type: str = "회사경력",
    activities: list[dict[str, Any]] | None = None,
) -> MatchRewriteResponse:
    """공고 본문 기반 활동 리라이팅 결과를 생성합니다."""

    normalized_activity_ids = activity_ids or []
    source_activities = activities
    if source_activities is None:
        source_activities = await _fetch_activities_from_supabase(
            user_id=user_id,
            activity_ids=normalized_activity_ids,
            section_type=section_type,
        )

    selected_activities = _select_target_activities(
        activities=source_activities,
        job_posting_text=job_posting_text,
        activity_ids=normalized_activity_ids,
    )
    job_analysis_summary = _extract_job_analysis_summary(job_posting_text, job_title)

    if not selected_activities:
        return MatchRewriteResponse(
            activity_rewrites=[],
            job_analysis_summary=job_analysis_summary,
            fallback_used=False,
        )

    fallback_used = False
    activity_rewrites: list[ActivityRewrite] = []
    for activity in selected_activities:
        rewrite, rewrite_fallback_used = await _generate_activity_rewrite(
            activity=activity,
            job_posting_text=job_posting_text,
            job_analysis_summary=job_analysis_summary,
            job_title=job_title,
            section_type=section_type,
        )
        activity_rewrites.append(rewrite)
        fallback_used = fallback_used or rewrite_fallback_used

    log_event(
        logger,
        logging.INFO,
        "match_rewrite_completed",
        user_id=user_id,
        activity_count=len(activity_rewrites),
        fallback_used=fallback_used,
        section_type=section_type,
    )

    return MatchRewriteResponse(
        activity_rewrites=activity_rewrites,
        job_analysis_summary=job_analysis_summary,
        fallback_used=fallback_used,
    )


__all__ = ["run_job_posting_rewrite_chain"]
