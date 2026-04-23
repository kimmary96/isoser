from __future__ import annotations

import json
import logging
import os
import re
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
TOKEN_PATTERN = re.compile(r"[0-9A-Za-z가-힣+#]+")
RECOMMEND_RELEVANCE_WEIGHT = 0.6
RECOMMEND_URGENCY_WEIGHT = 0.4
URGENCY_WINDOW_DAYS = 30

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
    relevance_score: float | None
    reason: str
    fit_keywords: list[str]
    program: dict[str, Any]


def _safe_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _resolve_recruitment_deadline(program: Mapping[str, Any]) -> str | None:
    close_date = program.get("close_date")
    raw = close_date or program.get("deadline")
    deadline = _safe_text(raw)
    if not deadline:
        return None

    source_text = _safe_text(program.get("source")).casefold()
    end_date = _safe_text(program.get("end_date"))
    is_work24 = "고용24" in source_text or "work24" in source_text
    if is_work24 and not close_date and end_date and deadline[:10] == end_date[:10]:
        return None

    return deadline


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

    def append_text(key: str, repeat: int = 1) -> None:
        text = _safe_text(profile.get(key))
        if text:
            for _ in range(repeat):
                parts.append(f"{key}: {text}")

    append_text("bio", repeat=2)
    append_text("education")
    append_text("job_title")
    append_text("self_intro", repeat=2)

    for key in ("career", "education_history", "awards", "certifications", "languages"):
        value = profile.get(key)
        if isinstance(value, list):
            normalized = [str(item).strip() for item in value if str(item).strip()]
            if normalized:
                parts.append(f"{key}: {', '.join(normalized)}")

    skills = profile.get("skills")
    if isinstance(skills, list):
        normalized = [str(item).strip() for item in skills if str(item).strip()]
        if normalized:
            skill_text = ", ".join(normalized)
            parts.append(f"skills: {skill_text}")
            parts.append(f"skills: {skill_text}")
    return "\n".join(parts)


def _activities_document(activities: Sequence[Mapping[str, Any]]) -> str:
    lines: list[str] = []
    for activity in activities[:20]:
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

    def _urgency_score(self, program: dict) -> float:
        from datetime import date

        date_str = _resolve_recruitment_deadline(program)
        if not date_str:
            return 0.0
        try:
            target = date.fromisoformat(str(date_str)[:10])
            days_left = (target - date.today()).days
            if days_left < 0:
                return 0.0
            return max(0.0, 1.0 - days_left / 30)
        except Exception:
            return 0.0

    def _semantic_score(self, distance: float | None) -> float:
        if distance is None:
            return 0.0
        try:
            return max(0.0, min(1.0, 1.0 - float(distance)))
        except Exception:
            return 0.0

    def _final_score(self, relevance_score: float | None, urgency_score: float | None) -> float:
        relevance = float(relevance_score or 0.0)
        urgency = float(urgency_score or 0.0)
        return round(
            relevance * RECOMMEND_RELEVANCE_WEIGHT + urgency * RECOMMEND_URGENCY_WEIGHT,
            4,
        )

    def _tokenize_text(self, value: Any) -> list[str]:
        if value is None:
            return []
        text = str(value).strip().lower()
        if not text:
            return []
        tokens: list[str] = []
        for token in TOKEN_PATTERN.findall(text):
            if len(token) < 2:
                continue
            if re.fullmatch(r"[가-힣]+", token) and len(token) <= 2:
                continue
            tokens.append(token)
        return tokens

    def _profile_keywords(
        self,
        profile: Mapping[str, Any],
        activities: Sequence[Mapping[str, Any]],
    ) -> dict[str, float]:
        keywords: dict[str, float] = {}

        def add_tokens(tokens: Sequence[str], weight: float = 1.0) -> None:
            for token in tokens:
                normalized = token.strip().lower()
                if not normalized:
                    continue
                keywords[normalized] = max(keywords.get(normalized, 0.0), weight)

        for key, weight in (
            ("skills", 1.5),
            ("career", 1.0),
            ("education_history", 1.0),
            ("certifications", 1.0),
            ("bio", 1.0),
            ("self_intro", 1.2),
        ):
            value = profile.get(key)
            if isinstance(value, list):
                for item in value:
                    add_tokens(self._tokenize_text(item), weight)
            else:
                add_tokens(self._tokenize_text(value), weight)

        for activity in activities[:30]:
            for key in ("skills", "title", "role", "description"):
                value = activity.get(key)
                if isinstance(value, list):
                    for item in value:
                        add_tokens(self._tokenize_text(item), 1.0)
                else:
                    add_tokens(self._tokenize_text(value), 1.0)

        ranked_keywords = sorted(keywords.items(), key=lambda item: (-item[1], item[0]))
        return dict(ranked_keywords[:40])

    def _program_match_context(
        self,
        program: Mapping[str, Any],
        keywords: Mapping[str, float],
    ) -> tuple[list[str], float]:
        title_text = " ".join(self._tokenize_text(program.get("title") or program.get("name")))
        skills_text = " ".join(self._tokenize_text(program.get("skills")))
        category_text = " ".join(self._tokenize_text(program.get("category")))
        location_text = " ".join(self._tokenize_text(program.get("location")))
        body_text = " ".join(
            self._tokenize_text(
                " ".join(
                    str(program.get(key) or "")
                    for key in (
                        "summary",
                        "description",
                        "provider",
                        "curriculum",
                        "target",
                        "location",
                        "category",
                    )
                )
            )
        )
        matched_keywords: list[str] = []
        weighted_hits = 0.0

        for keyword, keyword_weight in keywords.items():
            if keyword in title_text:
                matched_keywords.append(keyword)
                weighted_hits += keyword_weight * 1.5
                continue
            if keyword in skills_text:
                matched_keywords.append(keyword)
                weighted_hits += keyword_weight * 1.5
                continue
            if keyword in category_text:
                matched_keywords.append(keyword)
                weighted_hits += keyword_weight * 1.1
                continue
            if keyword in location_text:
                matched_keywords.append(keyword)
                weighted_hits += keyword_weight * 0.8
                continue
            if keyword in body_text:
                matched_keywords.append(keyword)
                weighted_hits += keyword_weight * 0.6

        keyword_budget = max(1.0, sum(sorted(keywords.values(), reverse=True)[:8]))
        relevance_score = min(1.0, weighted_hits / keyword_budget)
        return matched_keywords[:5], relevance_score

    def _build_fallback_reason(
        self,
        program: Mapping[str, Any],
        matched_keywords: Sequence[str],
    ) -> str:
        if matched_keywords:
            top_keywords = ", ".join(matched_keywords[:3])
            title = _safe_text(program.get("title") or program.get("name")) or "이 과정"
            return f"{top_keywords} 경험과 연결되는 내용이 있어 {title}을 추천합니다."
        return "프로필과 활동 이력을 기준으로 현재 조건에 맞는 과정이라 추천합니다."

    def _fallback_recommend(
        self,
        *,
        profile: Mapping[str, Any],
        activities: Sequence[Mapping[str, Any]],
        programs: Sequence[Mapping[str, Any]],
        top_k: int,
    ) -> list[ProgramRecommendation]:
        keywords = self._profile_keywords(profile, activities)
        if not keywords:
            return []

        recommendations: list[ProgramRecommendation] = []
        for program in programs:
            program_id = _safe_text(program.get("id"))
            if not program_id:
                continue
            program_record = dict(program)
            from datetime import date

            date_str = _resolve_recruitment_deadline(program_record)
            if date_str:
                days_left = (date.fromisoformat(str(date_str)[:10]) - date.today()).days
            else:
                days_left = None
            matched_keywords, relevance_score = self._program_match_context(program_record, keywords)
            urgency_score = self._urgency_score(program_record)
            final_score = self._final_score(relevance_score, urgency_score)
            program_record["deadline"] = date_str
            program_record["days_left"] = days_left
            program_record["similarity_score"] = relevance_score
            program_record["relevance_score"] = relevance_score
            program_record["urgency_score"] = urgency_score
            program_record["final_score"] = final_score
            if relevance_score <= 0:
                continue
            recommendations.append(
                ProgramRecommendation(
                    program_id=program_id,
                    score=final_score,
                    relevance_score=relevance_score,
                    reason=self._build_fallback_reason(program_record, matched_keywords),
                    fit_keywords=list(matched_keywords[:3]),
                    program=program_record,
                )
            )

        recommendations.sort(
            key=lambda item: (
                item.program.get("relevance_score", 0.0),
                item.program.get("urgency_score", 0.0),
                item.program.get("final_score", 0.0),
            ),
            reverse=True,
        )
        return recommendations[:top_k]

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
        category: str | None = None,
        region: str | None = None,
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

        chroma_where: dict[str, Any] | None = None
        where_conditions: list[dict[str, Any]] = []
        if category:
            where_conditions.append({"category": {"$contains": category}})
        if region:
            where_conditions.append({"location": {"$contains": region}})
        if len(where_conditions) == 1:
            chroma_where = where_conditions[0]
        elif len(where_conditions) > 1:
            chroma_where = {"$and": where_conditions}

        search_results = self._manager.search(
            self.collection_name,
            query,
            n_results=top_k,
            where=chroma_where,
        )
        if chroma_where and not search_results:
            search_results = self._manager.search(self.collection_name, query, n_results=top_k)
        if not search_results:
            return self._fallback_recommend(
                profile=profile,
                activities=activities,
                programs=programs,
                top_k=top_k,
            )

        reasons = await self._generate_reasons(query=query, results=search_results, program_by_id=program_by_id)
        recommendations: list[ProgramRecommendation] = []

        for result in search_results:
            program_id = _safe_text(result.id)
            program = program_by_id.get(program_id)
            if not program:
                continue
            program_record = dict(program)
            from datetime import date

            date_str = _resolve_recruitment_deadline(program_record)
            if date_str:
                days_left = (date.fromisoformat(str(date_str)[:10]) - date.today()).days
            else:
                days_left = None
            urgency_score = self._urgency_score(program_record)
            semantic_score = self._semantic_score(result.score)
            final_score = self._final_score(semantic_score, urgency_score)
            program_record["deadline"] = date_str
            program_record["days_left"] = days_left
            program_record["similarity_score"] = semantic_score
            program_record["relevance_score"] = semantic_score
            program_record["urgency_score"] = urgency_score
            program_record["final_score"] = final_score
            reason_payload = reasons.get(program_id, {})
            recommendations.append(
                ProgramRecommendation(
                    program_id=program_id,
                    score=final_score,
                    relevance_score=semantic_score,
                    reason=_safe_text(reason_payload.get("reason")) or "프로필과 연관성이 높아 추천합니다.",
                    fit_keywords=[
                        str(item).strip()
                        for item in reason_payload.get("fit_keywords", [])
                        if str(item).strip()
                    ][:3],
                    program=program_record,
                )
            )

        recommendations.sort(
            key=lambda item: (
                item.program.get("relevance_score", 0.0),
                item.program.get("urgency_score", 0.0),
                item.program.get("final_score", 0.0),
            ),
            reverse=True,
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
