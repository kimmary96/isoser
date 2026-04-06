"""Corpus-driven generator for v2 job keyword pattern seeds."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import ValidationError

from backend.rag.runtime_config import load_backend_dotenv
from backend.rag.schema import JobKeywordPatternSeed

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data"
DEFAULT_CORPUS_PATH = SEED_DIR / "job_profile_corpus.jsonl"
DEFAULT_TAXONOMY_PATH = SEED_DIR / "job_taxonomy.json"
DEFAULT_DRAFT_JSON_PATH = SEED_DIR / "job_keyword_patterns_v2_draft.json"
DEFAULT_REVIEW_CSV_PATH = SEED_DIR / "job_keyword_patterns_v2_review.csv"
DEFAULT_APPROVED_JSON_PATH = SEED_DIR / "job_keyword_patterns_v2_approved.json"
DEFAULT_VERSION = "v2"
DEFAULT_SEEDS_PER_JOB = 30
DEFAULT_SOURCE = "ncs"
DEFAULT_SECTION_TYPES = ("회사경력", "프로젝트", "대외활동", "학생활동", "요약")
PATTERN_TYPES = (
    "result_statement",
    "problem_statement",
    "decision_statement",
    "implementation_statement",
)
PATTERN_TYPE_LABELS = {
    "result_statement": "성과 중심 문장",
    "problem_statement": "문제 정의 문장",
    "decision_statement": "기술 선택 근거 문장",
    "implementation_statement": "구현 설명 문장",
}
PATTERN_TYPE_RULES = {
    "result_statement": "~하여 ~를 N% 개선/달성했습니다. 숫자와 비즈니스 임팩트를 함께 드러냅니다.",
    "problem_statement": "기존 방식의 문제, 병목, 불편, 장애 원인을 먼저 설명합니다.",
    "decision_statement": "A와 B를 비교하고 왜 이 선택을 했는지 근거를 명확히 씁니다.",
    "implementation_statement": "어떤 구조/아키텍처/패턴으로 어떻게 구현했는지 설명합니다.",
}
TARGET_JOB_CONFIG = {
    "pm": {
        "job_title": "PM / 서비스 기획자",
        "job_family": "product",
        "job_bucket": "product_management",
    },
    "backend_engineer": {
        "job_title": "백엔드 개발자",
        "job_family": "engineering",
        "job_bucket": "backend_infra",
    },
    "frontend_engineer": {
        "job_title": "프론트엔드 개발자",
        "job_family": "engineering",
        "job_bucket": "frontend_web",
    },
    "product_designer": {
        "job_title": "프로덕트 디자이너",
        "job_family": "design",
        "job_bucket": "product_design",
    },
    "marketer": {
        "job_title": "마케터",
        "job_family": "marketing",
        "job_bucket": "growth_marketing",
    },
}
TEXT_FIELD_KEYS = (
    "job_name",
    "job_title",
    "title",
    "description",
    "summary_text",
    "summary",
    "job_descriptions",
    "ability_units",
    "key_tasks",
    "required_skills",
    "keywords",
    "ncs_units",
    "career_path",
    "experience_hint",
)
ROW_SOURCE_KEYS = ("source", "source_id", "job_code", "ncs_code")
TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9+#./_-]{1,}|[가-힣]{2,20}")
SENTENCE_SPLITTER = re.compile(r"[\n\r]+|(?<=[.!?])\s+")
STOPWORDS = {
    "및",
    "등",
    "업무",
    "관련",
    "기반",
    "통한",
    "활용",
    "담당",
    "수행",
    "개선",
    "구현",
    "설계",
    "사용",
    "프로젝트",
    "서비스",
    "기능",
    "개발",
    "운영",
    "지원",
    "관리",
}
GENERATOR_SYSTEM_PROMPT = """
You generate Korean resume bullet-style seed data for Chroma RAG.
Return JSON only. No markdown, no code fences, no explanations.

You will receive:
- target job information
- a single pattern_type
- the number of bullets to create
- extracted corpus expressions

Return a JSON array of objects with keys:
- section_types: array of 1 or 2 values chosen from ["회사경력","프로젝트","대외활동","학생활동","요약"]
- keywords: array of 3 to 6 concise keywords
- document: one Korean resume bullet sentence

Rules:
- Use realistic Korean resume phrasing, not textbook definitions.
- Reflect the requested pattern_type only.
- Keep each document unique.
- Reuse corpus expressions naturally.
- Do not generate ids, version, source, job_family, or job_bucket. They are added later.
""".strip()


class LLMLike(Protocol):
    """Minimal protocol for LLM clients used by the generator."""

    def invoke(self, messages: list[Any]) -> Any:
        """Return a model response for the given messages."""


@dataclass(slots=True)
class CorpusJobContext:
    """Normalized corpus context for one target job family."""

    job_slug: str
    job_title: str
    job_family: str
    job_bucket: str
    expressions: list[str]
    corpus_rows: list[dict[str, Any]]


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _unique_preserve(values: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = _safe_text(value)
        if not text or text in seen:
            continue
        seen.add(text)
        ordered.append(text)
    return ordered


def _iter_text_values(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [_safe_text(value)] if _safe_text(value) else []
    if isinstance(value, (int, float)):
        return [str(value)]
    if isinstance(value, list):
        items: list[str] = []
        for item in value:
            items.extend(_iter_text_values(item))
        return items
    if isinstance(value, dict):
        items: list[str] = []
        for item in value.values():
            items.extend(_iter_text_values(item))
        return items
    return []


def _split_phrases(text: str) -> list[str]:
    phrases: list[str] = []
    for chunk in re.split(r"[\n\r;|]+", text):
        chunk = _safe_text(chunk)
        if not chunk:
            continue
        for sentence in SENTENCE_SPLITTER.split(chunk):
            sentence = _safe_text(sentence)
            if sentence:
                phrases.append(sentence)
    return phrases


def extract_core_expressions(row: dict[str, Any], *, max_items: int = 24) -> list[str]:
    """Extract reusable core expressions from a corpus row."""

    phrases: list[str] = []
    for key in TEXT_FIELD_KEYS:
        if key not in row:
            continue
        for raw_value in _iter_text_values(row.get(key)):
            phrases.extend(_split_phrases(raw_value))

    return _unique_preserve(phrases)[:max_items]


def extract_keywords(text: str, *, max_items: int = 8) -> list[str]:
    """Extract compact keyword tokens from a sentence."""

    tokens = [token for token in TOKEN_PATTERN.findall(text) if token not in STOPWORDS]
    return _unique_preserve(tokens)[:max_items]


def build_pattern_type_plan(total_count: int) -> dict[str, int]:
    """Distribute counts across the four pattern types as evenly as possible."""

    if total_count < len(PATTERN_TYPES):
        raise ValueError("total_count must be at least the number of pattern types")

    base, remainder = divmod(total_count, len(PATTERN_TYPES))
    plan = {pattern_type: base for pattern_type in PATTERN_TYPES}
    for pattern_type in PATTERN_TYPES[:remainder]:
        plan[pattern_type] += 1
    return plan


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            payload = json.loads(stripped)
            if not isinstance(payload, dict):
                raise ValueError(f"Corpus row {line_number} must be a JSON object")
            rows.append(payload)
    return rows


def _build_alias_index(taxonomy_rows: list[dict[str, Any]]) -> list[tuple[str, str]]:
    alias_pairs: list[tuple[str, str]] = []
    for row in taxonomy_rows:
        job_slug = _safe_text(row.get("normalized_job_key"))
        if job_slug not in TARGET_JOB_CONFIG:
            continue

        aliases = [row.get("display_name_ko")] + list(row.get("aliases", []))
        for alias in aliases:
            alias_text = _safe_text(alias).casefold()
            if alias_text:
                alias_pairs.append((alias_text, job_slug))

    alias_pairs.sort(key=lambda item: len(item[0]), reverse=True)
    return alias_pairs


def _resolve_job_slug(row: dict[str, Any], alias_index: list[tuple[str, str]]) -> str | None:
    direct_keys = (
        _safe_text(row.get("normalized_job_key")),
        _safe_text(row.get("job_slug")),
    )
    for direct_key in direct_keys:
        if direct_key in TARGET_JOB_CONFIG:
            return direct_key

    title_candidates = (
        _safe_text(row.get("job_name")),
        _safe_text(row.get("job_title")),
        _safe_text(row.get("title")),
    )
    searchable_text = " ".join(candidate for candidate in title_candidates if candidate).casefold()
    if not searchable_text:
        searchable_text = " ".join(_iter_text_values(row))
        searchable_text = searchable_text.casefold()

    for alias, job_slug in alias_index:
        if alias and alias in searchable_text:
            return job_slug
    return None


def _extract_json_text(raw_text: str) -> str:
    stripped = raw_text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def _response_to_text(response: Any) -> str:
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if text:
                    parts.append(str(text))
            else:
                text = getattr(item, "text", None)
                if text:
                    parts.append(str(text))
        return "\n".join(parts)
    return str(content)


class PatternGenerator:
    """Generate v2 `job_keyword_patterns` drafts from a corpus and review CSV."""

    def __init__(
        self,
        *,
        corpus_path: Path | None = None,
        taxonomy_path: Path | None = None,
        draft_json_path: Path | None = None,
        review_csv_path: Path | None = None,
        approved_json_path: Path | None = None,
        llm: LLMLike | None = None,
        model_name: str = "gemini-2.5-flash",
        version: str = DEFAULT_VERSION,
        seed_source: str = DEFAULT_SOURCE,
    ) -> None:
        load_backend_dotenv()
        self.corpus_path = corpus_path or DEFAULT_CORPUS_PATH
        self.taxonomy_path = taxonomy_path or DEFAULT_TAXONOMY_PATH
        self.draft_json_path = draft_json_path or DEFAULT_DRAFT_JSON_PATH
        self.review_csv_path = review_csv_path or DEFAULT_REVIEW_CSV_PATH
        self.approved_json_path = approved_json_path or DEFAULT_APPROVED_JSON_PATH
        self.model_name = model_name
        self.version = version
        self.seed_source = seed_source
        self._llm = llm
        self._taxonomy_rows: list[dict[str, Any]] | None = None

    def load_taxonomy_rows(self) -> list[dict[str, Any]]:
        """Load the canonical taxonomy rows used for alias matching."""

        if self._taxonomy_rows is None:
            payload = _load_json(self.taxonomy_path)
            if not isinstance(payload, list):
                raise ValueError("job_taxonomy.json must contain a JSON array")
            self._taxonomy_rows = payload
        return self._taxonomy_rows

    def load_corpus_rows(self) -> list[dict[str, Any]]:
        """Load the JSONL corpus rows."""

        if not self.corpus_path.exists():
            raise FileNotFoundError(
                f"Corpus file not found: {self.corpus_path}. "
                "Generate it first with the Work24/NCS source adapters.",
            )
        return _load_jsonl(self.corpus_path)

    def build_job_contexts(
        self,
        *,
        job_slugs: list[str] | None = None,
        limit_rows: int | None = None,
    ) -> list[CorpusJobContext]:
        """Map raw corpus rows into target-job contexts."""

        selected_job_slugs = job_slugs or list(TARGET_JOB_CONFIG.keys())
        alias_index = _build_alias_index(self.load_taxonomy_rows())
        grouped_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
        grouped_expressions: dict[str, list[str]] = defaultdict(list)

        for row in self.load_corpus_rows():
            job_slug = _resolve_job_slug(row, alias_index)
            if job_slug not in selected_job_slugs:
                continue

            if limit_rows is not None and len(grouped_rows[job_slug]) >= limit_rows:
                continue

            grouped_rows[job_slug].append(row)
            grouped_expressions[job_slug].extend(extract_core_expressions(row))

        contexts: list[CorpusJobContext] = []
        for job_slug in selected_job_slugs:
            job_config = TARGET_JOB_CONFIG[job_slug]
            expressions = _unique_preserve(grouped_expressions[job_slug])[:40]
            contexts.append(
                CorpusJobContext(
                    job_slug=job_slug,
                    job_title=job_config["job_title"],
                    job_family=job_config["job_family"],
                    job_bucket=job_config["job_bucket"],
                    expressions=expressions,
                    corpus_rows=grouped_rows[job_slug],
                )
            )

        return contexts

    def _get_llm(self) -> LLMLike:
        if self._llm is not None:
            return self._llm

        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("GOOGLE_API_KEY is required to generate pattern drafts with Gemini")

        self._llm = ChatGoogleGenerativeAI(
            model=self.model_name,
            google_api_key=api_key,
        )
        return self._llm

    def build_generation_prompt(
        self,
        context: CorpusJobContext,
        *,
        pattern_type: str,
        target_count: int,
    ) -> str:
        """Build the per-batch Gemini prompt."""

        expressions_block = "\n".join(f"- {expression}" for expression in context.expressions[:30]) or "- 없음"
        row_sources: list[str] = []
        for row in context.corpus_rows[:8]:
            references = [_safe_text(row.get(key)) for key in ROW_SOURCE_KEYS]
            reference = " / ".join(part for part in references if part)
            if reference:
                row_sources.append(f"- {reference}")
        source_block = "\n".join(row_sources) or "- 없음"

        return f"""
[target job]
- job_slug: {context.job_slug}
- job_title: {context.job_title}
- job_family: {context.job_family}
- job_bucket: {context.job_bucket}

[pattern type]
- pattern_type: {pattern_type}
- meaning: {PATTERN_TYPE_LABELS[pattern_type]}
- rule: {PATTERN_TYPE_RULES[pattern_type]}
- target_count: {target_count}

[corpus expressions]
{expressions_block}

[sample corpus references]
{source_block}

[instructions]
1. Create exactly {target_count} Korean resume bullet sentences for {context.job_title}.
2. Keep the sentences grounded in the corpus expressions.
3. Use realistic resume phrasing that could be embedded as seed data.
4. Avoid duplicates and boilerplate textbook wording.
5. Return JSON array only.
""".strip()

    def rewrite_patterns_with_gemini(
        self,
        context: CorpusJobContext,
        *,
        pattern_type: str,
        target_count: int,
    ) -> list[dict[str, Any]]:
        """Generate raw pattern candidates for one job/pattern batch."""

        llm = self._get_llm()
        prompt = self.build_generation_prompt(
            context,
            pattern_type=pattern_type,
            target_count=target_count,
        )
        response = llm.invoke(
            [
                SystemMessage(content=GENERATOR_SYSTEM_PROMPT),
                HumanMessage(content=prompt),
            ]
        )
        raw_text = _extract_json_text(_response_to_text(response))
        payload = json.loads(raw_text)

        if isinstance(payload, dict):
            items = payload.get("items", [])
        else:
            items = payload

        if not isinstance(items, list):
            raise ValueError("Gemini output must be a JSON array or an object with an 'items' array")
        return [item for item in items if isinstance(item, dict)]

    def _map_candidate_to_seed(
        self,
        context: CorpusJobContext,
        *,
        pattern_type: str,
        seq: int,
        candidate: dict[str, Any],
    ) -> JobKeywordPatternSeed:
        section_types = candidate.get("section_types") or ["회사경력"]
        if isinstance(section_types, str):
            section_types = [section_types]
        section_types = [
            section
            for section in (_safe_text(value) for value in section_types)
            if section in DEFAULT_SECTION_TYPES
        ] or ["회사경력"]

        document = _safe_text(candidate.get("document"))
        keywords = candidate.get("keywords")
        if isinstance(keywords, str):
            keywords = [part.strip() for part in re.split(r"[,/|]", keywords) if part.strip()]
        keyword_values = [
            _safe_text(value)
            for value in (keywords if isinstance(keywords, list) else [])
            if _safe_text(value)
        ]
        if len(keyword_values) < 2:
            keyword_values = extract_keywords(document)
        if len(keyword_values) < 2:
            keyword_values.extend(extract_keywords(" ".join(context.expressions[:6])))
        keyword_values = _unique_preserve(keyword_values)[:6]

        payload = {
            "id": f"jk:{context.job_slug}:{self.version}:{seq:03d}",
            "job_title": context.job_title,
            "job_family": context.job_family,
            "job_bucket": context.job_bucket,
            "section_types": section_types,
            "keywords": keyword_values,
            "source": self.seed_source,
            "pattern_type": pattern_type,
            "lang": "ko",
            "version": self.version,
            "is_active": True,
            "document": document,
        }
        return JobKeywordPatternSeed(**payload)

    def generate_draft_patterns(
        self,
        *,
        per_job: int = DEFAULT_SEEDS_PER_JOB,
        job_slugs: list[str] | None = None,
        limit_rows: int | None = None,
    ) -> list[JobKeywordPatternSeed]:
        """Generate validated v2 draft seeds."""

        plan = build_pattern_type_plan(per_job)
        contexts = self.build_job_contexts(job_slugs=job_slugs, limit_rows=limit_rows)
        drafts: list[JobKeywordPatternSeed] = []

        for context in contexts:
            if not context.expressions:
                raise ValueError(f"No corpus expressions found for job_slug='{context.job_slug}'")

            used_documents: set[str] = set()
            seq = 1
            for pattern_type in PATTERN_TYPES:
                raw_candidates = self.rewrite_patterns_with_gemini(
                    context,
                    pattern_type=pattern_type,
                    target_count=plan[pattern_type],
                )

                for candidate in raw_candidates:
                    try:
                        seed = self._map_candidate_to_seed(
                            context,
                            pattern_type=pattern_type,
                            seq=seq,
                            candidate=candidate,
                        )
                    except ValidationError:
                        continue

                    if seed.document in used_documents:
                        continue

                    drafts.append(seed)
                    used_documents.add(seed.document)
                    seq += 1

        return drafts

    def save_draft_json(
        self,
        patterns: list[JobKeywordPatternSeed],
        *,
        output_path: Path | None = None,
    ) -> Path:
        """Save all generated draft patterns as JSON."""

        path = output_path or self.draft_json_path
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = [pattern.model_dump(mode="json") for pattern in patterns]
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def save_review_csv(
        self,
        patterns: list[JobKeywordPatternSeed],
        *,
        output_path: Path | None = None,
    ) -> Path:
        """Save a reviewer-facing CSV with an approve column."""

        path = output_path or self.review_csv_path
        path.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            "approve",
            "review_note",
            "id",
            "job_title",
            "job_family",
            "job_bucket",
            "pattern_type",
            "source",
            "version",
            "section_types",
            "keywords",
            "document",
        ]

        with path.open("w", encoding="utf-8-sig", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            for pattern in patterns:
                writer.writerow(
                    {
                        "approve": "",
                        "review_note": "",
                        "id": pattern.id,
                        "job_title": pattern.job_title,
                        "job_family": pattern.job_family,
                        "job_bucket": pattern.job_bucket,
                        "pattern_type": pattern.pattern_type,
                        "source": pattern.source,
                        "version": pattern.version,
                        "section_types": "|".join(pattern.section_types),
                        "keywords": "|".join(pattern.keywords),
                        "document": pattern.document,
                    }
                )
        return path

    def save_approved_from_review_csv(
        self,
        *,
        review_csv_path: Path | None = None,
        output_path: Path | None = None,
    ) -> list[JobKeywordPatternSeed]:
        """Create a final JSON file from rows marked approve=Y."""

        review_path = review_csv_path or self.review_csv_path
        path = output_path or self.approved_json_path

        approved_items: list[JobKeywordPatternSeed] = []
        with review_path.open("r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            for row in reader:
                if _safe_text(row.get("approve")).upper() != "Y":
                    continue
                payload = {
                    "id": _safe_text(row.get("id")),
                    "job_title": _safe_text(row.get("job_title")),
                    "job_family": _safe_text(row.get("job_family")),
                    "job_bucket": _safe_text(row.get("job_bucket")),
                    "section_types": [
                        part.strip()
                        for part in _safe_text(row.get("section_types")).split("|")
                        if part.strip()
                    ],
                    "keywords": [
                        part.strip()
                        for part in _safe_text(row.get("keywords")).split("|")
                        if part.strip()
                    ],
                    "source": _safe_text(row.get("source")) or self.seed_source,
                    "pattern_type": _safe_text(row.get("pattern_type")),
                    "lang": "ko",
                    "version": _safe_text(row.get("version")) or self.version,
                    "is_active": True,
                    "document": _safe_text(row.get("document")),
                }
                approved_items.append(JobKeywordPatternSeed(**payload))

        self.save_draft_json(approved_items, output_path=path)
        return approved_items


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate v2 job keyword pattern draft seeds from a corpus",
    )
    parser.add_argument("--corpus-path", type=Path, default=DEFAULT_CORPUS_PATH)
    parser.add_argument("--taxonomy-path", type=Path, default=DEFAULT_TAXONOMY_PATH)
    parser.add_argument("--draft-json", type=Path, default=DEFAULT_DRAFT_JSON_PATH)
    parser.add_argument("--review-csv", type=Path, default=DEFAULT_REVIEW_CSV_PATH)
    parser.add_argument("--approved-json", type=Path, default=DEFAULT_APPROVED_JSON_PATH)
    parser.add_argument("--per-job", type=int, default=DEFAULT_SEEDS_PER_JOB)
    parser.add_argument("--limit-rows", type=int, default=None)
    parser.add_argument(
        "--job-slugs",
        nargs="*",
        default=list(TARGET_JOB_CONFIG.keys()),
        choices=list(TARGET_JOB_CONFIG.keys()),
    )
    parser.add_argument(
        "--approve-only",
        action="store_true",
        help="Read the review CSV and emit only approve=Y rows to the approved JSON file.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    generator = PatternGenerator(
        corpus_path=args.corpus_path,
        taxonomy_path=args.taxonomy_path,
        draft_json_path=args.draft_json,
        review_csv_path=args.review_csv,
        approved_json_path=args.approved_json,
    )

    if args.approve_only:
        approved_items = generator.save_approved_from_review_csv()
        print(
            f"[pattern_generator] approved seeds: {len(approved_items)} "
            f"-> {generator.approved_json_path}"
        )
        return

    patterns = generator.generate_draft_patterns(
        per_job=args.per_job,
        job_slugs=args.job_slugs,
        limit_rows=args.limit_rows,
    )
    generator.save_draft_json(patterns)
    generator.save_review_csv(patterns)
    print(
        f"[pattern_generator] generated drafts: {len(patterns)} "
        f"-> {generator.draft_json_path}"
    )
    print(f"[pattern_generator] review csv: {generator.review_csv_path}")


if __name__ == "__main__":
    main()
