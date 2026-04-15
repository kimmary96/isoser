"""Retriever layer for coaching-oriented Chroma searches."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import chromadb

try:
    from backend.logging_config import get_logger, log_event
    from backend.rag.chroma_client import (
        get_job_collection,
        get_job_posting_collection,
        get_star_collection,
    )
    from backend.rag.fallback import diagnose_structure
except ImportError:
    from logging_config import get_logger, log_event
    from rag.chroma_client import (
        get_job_collection,
        get_job_posting_collection,
        get_star_collection,
    )
    from rag.fallback import diagnose_structure

JOB_TAXONOMY_PATH = Path(__file__).parent / "seed_data" / "job_taxonomy.json"

SUPPORTED_JOB_PROFILES: dict[str, dict[str, Any]] = {
    "pm": {
        "job_bucket": "product_management",
        "job_family": "product",
        "aliases": [
            "pm",
            "po",
            "product manager",
            "product owner",
            "서비스 기획자",
            "프로덕트 매니저",
            "프로덕트 오너",
            "기획자",
        ],
    },
    "backend_engineer": {
        "job_bucket": "backend_infra",
        "job_family": "engineering",
        "aliases": [
            "backend engineer",
            "backend developer",
            "백엔드 개발자",
            "서버 개발자",
            "api 개발자",
        ],
    },
    "frontend_engineer": {
        "job_bucket": "frontend_web",
        "job_family": "engineering",
        "aliases": [
            "frontend engineer",
            "frontend developer",
            "프론트엔드 개발자",
            "react 개발자",
            "ui 개발자",
        ],
    },
    "product_designer": {
        "job_bucket": "product_design",
        "job_family": "design",
        "aliases": [
            "product designer",
            "ux/ui 디자이너",
            "ux 디자이너",
            "ui 디자이너",
            "프로덕트 디자이너",
            "서비스 디자이너",
        ],
    },
    "marketer": {
        "job_bucket": "growth_marketing",
        "job_family": "marketing",
        "aliases": [
            "marketer",
            "growth marketer",
            "performance marketer",
            "마케터",
            "그로스 마케터",
            "퍼포먼스 마케터",
            "crm 마케터",
        ],
    },
}

SEED_SLUG_ALIASES = {
    "service_planner": "pm",
}

PRIORITY_TO_PATTERN_TYPE = {
    "문제 정의": "problem_statement",
    "problem_definition": "problem_statement",
    "기술 선택 근거": "decision_statement",
    "tech_decision": "decision_statement",
    "정량적 성과": "result_statement",
    "quantification": "result_statement",
    "구현 디테일": "implementation_statement",
    "verb_strength": "implementation_statement",
}

PRIORITY_TO_ACTIVITY_TYPE = {
    "문제 정의": "problem_definition",
    "problem_definition": "problem_definition",
    "기술 선택 근거": "tech_decision",
    "tech_decision": "tech_decision",
    "정량적 성과": "quantification",
    "quantification": "quantification",
    "구현 디테일": "verb_strength",
    "verb_strength": "verb_strength",
    "역할 명확화": "job_fit",
    "job_fit": "job_fit",
    "프로젝트 개요": "star_gap",
    "star_gap": "star_gap",
}

JOB_PATTERN_SCORE_THRESHOLD = 0.10
STAR_SCORE_THRESHOLD = 0.08
logger = get_logger(__name__)


@dataclass(frozen=True)
class JobProfile:
    """Normalized job profile used by retrieval filters."""

    slug: str
    job_bucket: str | None
    job_family: str | None


def _normalize_token(value: str) -> str:
    """Normalize strings for alias matching."""

    return re.sub(r"[\s/_-]+", "", value).casefold()


@lru_cache(maxsize=1)
def _load_alias_map() -> dict[str, str]:
    """Load supported aliases from manual rules and taxonomy data."""

    alias_map: dict[str, str] = {}

    for slug, profile in SUPPORTED_JOB_PROFILES.items():
        for alias in [slug, *profile["aliases"]]:
            alias_map[_normalize_token(alias)] = slug

    if JOB_TAXONOMY_PATH.exists():
        with JOB_TAXONOMY_PATH.open(encoding="utf-8") as file:
            taxonomy = json.load(file)

        if isinstance(taxonomy, list):
            for item in taxonomy:
                if not isinstance(item, dict):
                    continue

                raw_slug = str(item.get("normalized_job_key", "")).strip()
                slug = SEED_SLUG_ALIASES.get(raw_slug, raw_slug)
                if slug not in SUPPORTED_JOB_PROFILES:
                    continue

                for alias in item.get("aliases", []):
                    if isinstance(alias, str) and alias.strip():
                        alias_map[_normalize_token(alias)] = slug

                display_name = item.get("display_name_ko")
                if isinstance(display_name, str) and display_name.strip():
                    alias_map[_normalize_token(display_name)] = slug

    return alias_map


def normalize_job_title(job_title: str) -> str:
    """Normalize a user-entered job title into a supported seed slug."""

    cleaned = job_title.strip()
    if not cleaned:
        return ""

    alias_map = _load_alias_map()
    normalized = _normalize_token(cleaned)
    if normalized in alias_map:
        return alias_map[normalized]

    for alias, slug in sorted(alias_map.items(), key=lambda item: len(item[0]), reverse=True):
        if alias and alias in normalized:
            return slug

    return cleaned


def _resolve_job_profile(job_title: str) -> JobProfile:
    """Resolve job title into slug, bucket, and family."""

    normalized_slug = normalize_job_title(job_title)
    profile = SUPPORTED_JOB_PROFILES.get(normalized_slug)

    if profile is None:
        return JobProfile(
            slug=normalized_slug,
            job_bucket=None,
            job_family=None,
        )

    return JobProfile(
        slug=normalized_slug,
        job_bucket=profile["job_bucket"],
        job_family=profile["job_family"],
    )


def _distance_to_similarity(distance: Any) -> float:
    """Convert Chroma cosine distance into a bounded similarity score."""

    try:
        numeric = float(distance)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, 1.0 - numeric)


def _tokenize_for_fallback(text: str) -> set[str]:
    """Tokenize text for local lexical fallback scoring."""

    return {
        token.lower()
        for token in re.findall(r"[0-9A-Za-z가-힣]{2,}", text or "")
        if token.strip()
    }


def _lexical_similarity(query_text: str, document_text: str) -> float:
    """Return a lightweight lexical overlap score in [0, 1]."""

    query_tokens = _tokenize_for_fallback(query_text)
    if not query_tokens:
        return 0.0
    doc_tokens = _tokenize_for_fallback(document_text)
    if not doc_tokens:
        return 0.0
    overlap = len(query_tokens.intersection(doc_tokens))
    return overlap / len(query_tokens)


class CoachRetriever:
    """Retriever that applies coaching-specific normalization and reranking."""

    def __init__(
        self,
        *,
        job_collection: chromadb.Collection | None = None,
        star_collection: chromadb.Collection | None = None,
        posting_collection: chromadb.Collection | None = None,
    ) -> None:
        self.job_collection = job_collection
        self.star_collection = star_collection
        self.posting_collection = posting_collection

    def retrieve_for_coaching(
        self,
        *,
        job_title: str,
        activity_text: str,
        section_type: str,
        priority_focus: str | None = None,
    ) -> dict[str, list[dict[str, Any]]]:
        """Retrieve reranked coaching references across all collections."""

        profile = _resolve_job_profile(job_title)
        resolved_priority = priority_focus or diagnose_structure(activity_text).priority_focus

        results = {
            "job_keyword_patterns": self._retrieve_job_keyword_patterns(
                profile=profile,
                query_text=f"{job_title} {activity_text}".strip(),
                priority_focus=resolved_priority,
            ),
            "star_examples": self._retrieve_star_examples(
                profile=profile,
                activity_text=activity_text,
                section_type=section_type,
                priority_focus=resolved_priority,
            ),
            "job_posting_snippets": self._retrieve_job_posting_snippets(
                profile=profile,
                query_text=f"{job_title} {section_type} {activity_text}".strip(),
                section_type=section_type,
            ),
        }
        log_event(
            logger,
            logging.INFO,
            "search",
            job_title=job_title,
            normalized_job_title=profile.slug,
            job_bucket=profile.job_bucket,
            section_type=section_type,
            priority_focus=resolved_priority,
            job_keyword_patterns=len(results["job_keyword_patterns"]),
            star_examples=len(results["star_examples"]),
            job_posting_snippets=len(results["job_posting_snippets"]),
        )
        return results

    def _collection_or_default(
        self,
        collection: chromadb.Collection | None,
        getter,
    ) -> chromadb.Collection | None:
        return collection if collection is not None else getter()

    def _query_records(
        self,
        collection: chromadb.Collection | None,
        *,
        query_text: str,
        n_results: int,
        where: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Query a collection and return records with metadata and distance."""

        if collection is None:
            return []

        if collection.count() == 0:
            return []

        records: list[dict[str, Any]] = []
        try:
            results = collection.query(
                query_texts=[query_text],
                n_results=n_results,
                where=where,
                include=["documents", "metadatas", "distances"],
            )

            documents = results.get("documents", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]
            ids = results.get("ids", [[]])[0]

            for index, document in enumerate(documents):
                metadata = metadatas[index] if index < len(metadatas) else {}
                distance = distances[index] if index < len(distances) else None
                item: dict[str, Any] = {
                    "id": ids[index] if index < len(ids) else None,
                    "document": document,
                    "distance": distance,
                    "similarity": _distance_to_similarity(distance),
                }
                if isinstance(metadata, dict):
                    item.update(metadata)
                records.append(item)

            return records
        except Exception as exc:
            log_event(
                logger,
                logging.WARNING,
                "retriever_query_fallback",
                error=str(exc),
                where=where or {},
                n_results=n_results,
            )

        try:
            fallback = collection.get(
                where=where,
                include=["documents", "metadatas"],
            )
        except Exception:
            return []

        ids_raw = fallback.get("ids") or []
        docs_raw = fallback.get("documents") or []
        metas_raw = fallback.get("metadatas") or []

        for index, document in enumerate(docs_raw):
            text = str(document or "")
            lexical_score = _lexical_similarity(query_text, text)
            # Keep fallback records usable even when lexical overlap is sparse.
            score = 0.20 + (0.80 * lexical_score)
            metadata = metas_raw[index] if index < len(metas_raw) else {}
            item: dict[str, Any] = {
                "id": ids_raw[index] if index < len(ids_raw) else None,
                "document": text,
                "distance": None,
                "similarity": score,
            }
            if isinstance(metadata, dict):
                item.update(metadata)
            records.append(item)

        records.sort(key=lambda row: float(row.get("similarity", 0.0)), reverse=True)
        return records[:n_results]

    def _retrieve_job_keyword_patterns(
        self,
        *,
        profile: JobProfile,
        query_text: str,
        priority_focus: str,
    ) -> list[dict[str, Any]]:
        """Retrieve and rerank job keyword patterns."""

        collection = self._collection_or_default(self.job_collection, get_job_collection)
        preferred_pattern = PRIORITY_TO_PATTERN_TYPE.get(priority_focus)
        where = {"job_bucket": profile.job_bucket} if profile.job_bucket else None
        candidates = self._query_records(
            collection,
            query_text=query_text,
            n_results=12,
            where=where,
        )

        scored: list[dict[str, Any]] = []
        for item in candidates:
            score = float(item.get("similarity", 0.0))
            if item.get("source") == "real_posting":
                score *= 1.10
            if preferred_pattern and item.get("pattern_type") == preferred_pattern:
                score *= 1.20
            item["score"] = round(score, 6)
            if score >= JOB_PATTERN_SCORE_THRESHOLD:
                scored.append(item)

        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored[:4]

    def _retrieve_star_examples(
        self,
        *,
        profile: JobProfile,
        activity_text: str,
        section_type: str,
        priority_focus: str,
    ) -> list[dict[str, Any]]:
        """Retrieve and rerank STAR examples."""

        collection = self._collection_or_default(self.star_collection, get_star_collection)
        preferred_activity = PRIORITY_TO_ACTIVITY_TYPE.get(priority_focus)
        where = {"job_family": profile.slug} if profile.slug in SUPPORTED_JOB_PROFILES else None
        candidates = self._query_records(
            collection,
            query_text=activity_text,
            n_results=10,
            where=where,
        )

        scored: list[dict[str, Any]] = []
        for item in candidates:
            score = float(item.get("similarity", 0.0))
            if item.get("section_type") == section_type:
                score *= 1.15
            if preferred_activity and item.get("activity_type") == preferred_activity:
                score *= 1.15
            item["score"] = round(score, 6)
            if score >= STAR_SCORE_THRESHOLD:
                scored.append(item)

        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored[:3]

    def _retrieve_job_posting_snippets(
        self,
        *,
        profile: JobProfile,
        query_text: str,
        section_type: str,
    ) -> list[dict[str, Any]]:
        """Retrieve top job posting snippets for the current job bucket."""

        collection = self._collection_or_default(
            self.posting_collection,
            get_job_posting_collection,
        )
        where = {"job_bucket": profile.job_bucket} if profile.job_bucket else None
        candidates = self._query_records(
            collection,
            query_text=query_text,
            n_results=6,
            where=where,
        )

        for item in candidates:
            score = float(item.get("similarity", 0.0))
            if item.get("section_type") == section_type:
                score *= 1.10
            item["score"] = round(score, 6)

        candidates.sort(key=lambda item: item["score"], reverse=True)
        return candidates[:2]


__all__ = [
    "CoachRetriever",
    "normalize_job_title",
]
