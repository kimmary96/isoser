from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

try:
    from backend.logging_config import get_logger, log_event
    from backend.rag.chroma_client import SearchResult, get_chroma_manager
except ImportError:
    from logging_config import get_logger, log_event
    from rag.chroma_client import SearchResult, get_chroma_manager

logger = get_logger(__name__)

PROGRAM_RECOMMEND_PROMPT = """
너는 사용자의 경력 프로필에 맞는 훈련 과정을 추천하는 커리어 코치다.
아래 후보 과정을 보고, 사용자의 프로필과 가장 잘 맞는 이유를 한국어로 한두 문장으로 설명하라.
반드시 JSON 객체만 반환한다.

반환 형식:
{
  "items": [
    {
      "program_id": "과정 id",
      "reason": "추천 이유",
      "fit_keywords": ["키워드1", "키워드2", "키워드3"]
    }
  ]
}
""".strip()


@dataclass(slots=True)
class ProgramRecommendation:
    program_id: str
    score: float | None
    reason: str
    fit_keywords: list[str]
    program: dict[str, Any]


def _safe_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _program_document(program: Mapping[str, Any]) -> str:
    parts: list[str] = []
    for key in (
        "title",
        "name",
        "summary",
        "description",
        "category",
        "location",
        "provider",
        "tags",
        "skills",
        "curriculum",
    ):
        value = program.get(key)
        if isinstance(value, list):
            normalized = [str(item).strip() for item in value if str(item).strip()]
            if normalized:
                parts.append(f"{key}: {', '.join(normalized)}")
            continue
        text = _safe_text(value)
        if text:
            parts.append(f"{key}: {text}")
    return "\n".join(parts)


def _program_metadata(program: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "category": _safe_text(program.get("category")),
        "location": _safe_text(program.get("location")),
        "is_active": bool(program.get("is_active", True)),
        "provider": _safe_text(program.get("provider")),
    }


def _profile_document(profile: Mapping[str, Any]) -> str:
    parts: list[str] = []
    for key in (
        "name",
        "bio",
        "education",
        "self_intro",
        "portfolio_url",
    ):
        text = _safe_text(profile.get(key))
        if text:
            parts.append(f"{key}: {text}")

    for key in ("career", "education_history", "awards", "certifications", "languages", "skills"):
        value = profile.get(key)
        if isinstance(value, list):
            normalized = [str(item).strip() for item in value if str(item).strip()]
            if normalized:
                parts.append(f"{key}: {', '.join(normalized)}")
    return "\n".join(parts)


def _activities_document(activities: Sequence[Mapping[str, Any]]) -> str:
    lines: list[str] = []
    for activity in activities[:10]:
        title = _safe_text(activity.get("title"))
        role = _safe_text(activity.get("role"))
        description = _safe_text(activity.get("description"))
        skills = activity.get("skills")
        skill_text = ""
        if isinstance(skills, list):
            normalized = [str(item).strip() for item in skills if str(item).strip()]
            if normalized:
                skill_text = f" | skills: {', '.join(normalized)}"
        chunk = " / ".join(part for part in (title, role, description) if part)
        if chunk:
            lines.append(f"- {chunk}{skill_text}")
    return "\n".join(lines)


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}
    try:
        payload = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


class ProgramsRAG:
    """Program recommendation helper backed by the shared ChromaManager."""

    collection_name = "programs"

    def __init__(self) -> None:
        self._manager = get_chroma_manager()

    def sync(self, programs: Sequence[Mapping[str, Any]]) -> int:
        ids: list[str] = []
        documents: list[str] = []
        metadatas: list[dict[str, Any]] = []

        for program in programs:
            program_id = _safe_text(program.get("id"))
            if not program_id:
                continue
            document = _program_document(program)
            if not document:
                continue
            ids.append(program_id)
            documents.append(document)
            metadatas.append(_program_metadata(program))

        synced_count = self._manager.upsert_documents(
            self.collection_name,
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )
        log_event(logger, logging.INFO, "programs_rag_synced", synced_count=synced_count)
        return synced_count

    async def recommend(
        self,
        *,
        profile: Mapping[str, Any],
        activities: Sequence[Mapping[str, Any]],
        programs: Sequence[Mapping[str, Any]],
        top_k: int = 5,
    ) -> list[ProgramRecommendation]:
        if not programs or top_k <= 0:
            return []

        program_by_id = {_safe_text(program.get("id")): dict(program) for program in programs}
        query = "\n".join(
            part
            for part in (
                _profile_document(profile),
                _activities_document(activities),
            )
            if part
        ).strip()
        if not query:
            return []

        search_results = self._manager.search(self.collection_name, query, n_results=top_k)
        if not search_results:
            return []

        reasons = await self._generate_reasons(query=query, results=search_results, program_by_id=program_by_id)
        recommendations: list[ProgramRecommendation] = []

        for result in search_results:
            program_id = _safe_text(result.id)
            program = program_by_id.get(program_id)
            if not program:
                continue
            reason_payload = reasons.get(program_id, {})
            recommendations.append(
                ProgramRecommendation(
                    program_id=program_id,
                    score=result.score,
                    reason=_safe_text(reason_payload.get("reason")) or "프로필과 연관성이 높아 추천합니다.",
                    fit_keywords=[
                        str(item).strip()
                        for item in reason_payload.get("fit_keywords", [])
                        if str(item).strip()
                    ][:3],
                    program=program,
                )
            )

        return recommendations

    async def _generate_reasons(
        self,
        *,
        query: str,
        results: Sequence[SearchResult],
        program_by_id: Mapping[str, Mapping[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            return {}

        candidate_lines: list[str] = []
        for result in results:
            program_id = _safe_text(result.id)
            program = program_by_id.get(program_id)
            if not program:
                continue
            candidate_lines.append(
                json.dumps(
                    {
                        "program_id": program_id,
                        "title": program.get("title") or program.get("name"),
                        "category": program.get("category"),
                        "location": program.get("location"),
                        "description": _safe_text(program.get("description") or program.get("summary"))[:400],
                    },
                    ensure_ascii=False,
                )
            )

        if not candidate_lines:
            return {}

        prompt = "\n".join(
            [
                "[사용자 프로필 요약]",
                query[:2500],
                "",
                "[추천 후보 과정]",
                *candidate_lines,
            ]
        )

        try:
            llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=api_key)
            response = await llm.ainvoke(
                [
                    SystemMessage(content=PROGRAM_RECOMMEND_PROMPT),
                    HumanMessage(content=prompt),
                ]
            )
        except Exception as exc:
            log_event(logger, logging.WARNING, "programs_rag_reason_failed", error=str(exc))
            return {}

        payload = _extract_json_object(str(response.content))
        items = payload.get("items")
        if not isinstance(items, list):
            return {}

        mapped: dict[str, dict[str, Any]] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            program_id = _safe_text(item.get("program_id"))
            if not program_id:
                continue
            mapped[program_id] = item
        return mapped

