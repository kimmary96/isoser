"""Generator for expanding STAR example seeds with review gating."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Protocol

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import ValidationError

from backend.rag.runtime_config import load_backend_dotenv
from backend.rag.schema import StarExampleSeed

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data"
DEFAULT_SEED_PATH = SEED_DIR / "star_examples.json"
DEFAULT_PATTERN_PATH = SEED_DIR / "job_keyword_patterns.json"
DEFAULT_DRAFT_JSON_PATH = SEED_DIR / "star_examples_v2_draft.json"
DEFAULT_REVIEW_CSV_PATH = SEED_DIR / "star_examples_v2_review.csv"
DEFAULT_APPROVED_JSON_PATH = SEED_DIR / "star_examples_v2_approved.json"
DEFAULT_VERSION = "v2"
DEFAULT_TARGET_TOTAL = 60
TARGET_DISTRIBUTION = {
    "star_gap": 20,
    "quantification": 14,
    "verb_strength": 8,
    "job_fit": 6,
    "tech_decision": 6,
    "problem_definition": 6,
}
TARGET_ACTIVITY_TYPES = tuple(TARGET_DISTRIBUTION.keys())
SECTION_TYPES = ("회사경력", "프로젝트", "대외활동", "학생활동", "요약")
JOB_TITLES = {
    "pm": "PM / 서비스 기획자",
    "backend_engineer": "백엔드 개발자",
    "frontend_engineer": "프론트엔드 개발자",
    "product_designer": "프로덕트 디자이너",
    "marketer": "마케터",
}
GENERATOR_SYSTEM_PROMPT = """
You generate Korean STAR example seeds for a resume coaching RAG system.
Return JSON only. No markdown, no code fences, no explanation.

Return a JSON array of objects with keys:
- section_type
- original_text
- missing_before
- rewrite_focus
- document

Rules:
- original_text must be a weak or incomplete Korean resume sentence.
- document must be a stronger rewritten sentence.
- The generated pair must reflect the requested activity_type.
- missing_before must explain what was missing before.
- Keep the examples realistic and resume-like.
""".strip()
ACTIVITY_RULES = {
    "star_gap": {
        "description": "STAR 누락 보완형",
        "required_missing_before": ["Situation", "Result"],
        "rewrite_focus": "배경, 역할, 행동, 결과 중 빠진 STAR 요소를 자연스럽게 보강",
    },
    "quantification": {
        "description": "정량화 보강형",
        "required_missing_before": ["정량화", "Result"],
        "rewrite_focus": "정성 표현을 숫자와 지표 중심 결과로 바꿔 성과를 선명하게 만듦",
    },
    "verb_strength": {
        "description": "동사/구조 개선형",
        "required_missing_before": ["강한행동동사", "구체적행동"],
        "rewrite_focus": "약한 서술을 주도적인 행동 동사와 구체적인 실행으로 강화",
    },
    "job_fit": {
        "description": "직무 맞춤 표현형",
        "required_missing_before": ["직무키워드", "문제정의"],
        "rewrite_focus": "범용 표현을 해당 직군에서 실제 쓰는 용어와 문제 구조로 전환",
    },
    "tech_decision": {
        "description": "기술 선택 근거형",
        "required_missing_before": ["기술선택근거", "대안비교"],
        "rewrite_focus": "기술 선택 근거와 대안 비교를 추가하여 의사결정 과정을 보여줌",
    },
    "problem_definition": {
        "description": "문제해결 구조형",
        "required_missing_before": ["문제정의", "Situation"],
        "rewrite_focus": "해결한 문제의 구체적 상황과 비즈니스 임팩트를 추가",
    },
}


class LLMLike(Protocol):
    """Minimal protocol for LLM clients used by the STAR generator."""

    def invoke(self, messages: list[Any]) -> Any:
        """Return a model response for the given messages."""


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _load_seed_rows(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    if not isinstance(payload, list):
        raise ValueError(f"Seed file must contain a JSON array: {path}")
    return [item for item in payload if isinstance(item, dict)]


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


def _extract_json_text(raw_text: str) -> str:
    stripped = raw_text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


class StarGenerator:
    """Generate additional STAR examples and gated review artifacts."""

    def __init__(
        self,
        *,
        seed_path: Path | None = None,
        pattern_path: Path | None = None,
        draft_json_path: Path | None = None,
        review_csv_path: Path | None = None,
        approved_json_path: Path | None = None,
        llm: LLMLike | None = None,
        model_name: str = "gemini-2.5-flash",
        version: str = DEFAULT_VERSION,
    ) -> None:
        load_backend_dotenv()
        self.seed_path = seed_path or DEFAULT_SEED_PATH
        self.pattern_path = pattern_path or DEFAULT_PATTERN_PATH
        self.draft_json_path = draft_json_path or DEFAULT_DRAFT_JSON_PATH
        self.review_csv_path = review_csv_path or DEFAULT_REVIEW_CSV_PATH
        self.approved_json_path = approved_json_path or DEFAULT_APPROVED_JSON_PATH
        self.model_name = model_name
        self.version = version
        self._llm = llm

    def _get_llm(self) -> LLMLike:
        if self._llm is not None:
            return self._llm

        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("GOOGLE_API_KEY is required to generate STAR drafts with Gemini")

        self._llm = ChatGoogleGenerativeAI(
            model=self.model_name,
            google_api_key=api_key,
        )
        return self._llm

    def load_existing_items(self) -> list[StarExampleSeed]:
        return [StarExampleSeed(**item) for item in _load_seed_rows(self.seed_path)]

    def load_reference_patterns(self) -> list[dict[str, Any]]:
        if not self.pattern_path.exists():
            return []
        return _load_seed_rows(self.pattern_path)

    def analyze_coverage(
        self,
        *,
        target_total: int = DEFAULT_TARGET_TOTAL,
        target_distribution: dict[str, int] | None = None,
    ) -> dict[str, Any]:
        """Analyze current STAR coverage and propose generation gaps."""

        items = self.load_existing_items()
        target_distribution = target_distribution or TARGET_DISTRIBUTION
        current_by_activity = Counter(item.activity_type for item in items)
        current_by_job_family = Counter(item.job_family for item in items)
        current_combo = Counter((item.job_family, item.activity_type) for item in items)
        known_job_families = sorted(current_by_job_family or JOB_TITLES)

        deficits_by_activity = {
            activity_type: max(
                target_distribution.get(activity_type, 0) - current_by_activity.get(activity_type, 0),
                0,
            )
            for activity_type in target_distribution
        }

        combo_plan: Counter[tuple[str, str]] = Counter()
        family_additional_counts: Counter[str] = Counter()

        for activity_type, deficit in deficits_by_activity.items():
            for _ in range(deficit):
                candidates = sorted(
                    known_job_families,
                    key=lambda family: (
                        current_combo.get((family, activity_type), 0) + combo_plan[(family, activity_type)],
                        current_by_job_family.get(family, 0) + family_additional_counts[family],
                        family,
                    ),
                )
                chosen_family = candidates[0]
                combo_plan[(chosen_family, activity_type)] += 1
                family_additional_counts[chosen_family] += 1

        missing_combinations = [
            {
                "job_family": family,
                "activity_type": activity_type,
                "current_count": current_combo.get((family, activity_type), 0),
            }
            for family in known_job_families
            for activity_type in TARGET_ACTIVITY_TYPES
            if current_combo.get((family, activity_type), 0) == 0
        ]

        generation_plan = [
            {
                "job_family": family,
                "job_title": JOB_TITLES.get(family, family),
                "activity_type": activity_type,
                "count": count,
            }
            for (family, activity_type), count in sorted(combo_plan.items())
            if count > 0
        ]

        return {
            "current_total": len(items),
            "target_total": target_total,
            "current_by_activity_type": dict(sorted(current_by_activity.items())),
            "target_by_activity_type": dict(sorted(target_distribution.items())),
            "deficits_by_activity_type": {k: v for k, v in deficits_by_activity.items() if v > 0},
            "current_by_job_family": dict(sorted(current_by_job_family.items())),
            "missing_combinations": missing_combinations,
            "generation_plan": generation_plan,
        }

    def _build_prompt(
        self,
        *,
        job_family: str,
        activity_type: str,
        count: int,
        reference_patterns: list[dict[str, Any]],
        existing_items: list[StarExampleSeed],
    ) -> str:
        family_title = JOB_TITLES.get(job_family, job_family)
        activity_rule = ACTIVITY_RULES[activity_type]

        relevant_examples = [
            item for item in existing_items if item.job_family == job_family and item.activity_type == activity_type
        ][:3]
        if not relevant_examples:
            relevant_examples = [item for item in existing_items if item.job_family == job_family][:3]

        example_lines: list[str] = []
        for item in relevant_examples:
            example_lines.append(f"- Before: {item.original_text}")
            example_lines.append(f"  After: {item.document}")
            example_lines.append(f"  Missing: {', '.join(item.missing_before)}")

        relevant_patterns = [
            item for item in reference_patterns if _safe_text(item.get("job_family")) == job_family
        ][:4]
        pattern_lines = [
            f"- ({_safe_text(item.get('pattern_type'))}) {_safe_text(item.get('document'))}"
            for item in relevant_patterns
            if _safe_text(item.get("document"))
        ]

        return f"""
[target]
- job_family: {job_family}
- job_title: {family_title}
- activity_type: {activity_type}
- activity_description: {activity_rule['description']}
- required_missing_before: {", ".join(activity_rule['required_missing_before'])}
- rewrite_focus: {activity_rule['rewrite_focus']}
- target_count: {count}

[reference job patterns]
{chr(10).join(pattern_lines) if pattern_lines else "- 없음"}

[reference star examples]
{chr(10).join(example_lines) if example_lines else "- 없음"}

[instructions]
1. Create exactly {count} before/after pairs for {family_title}.
2. section_type must be one of {', '.join(SECTION_TYPES)}.
3. original_text should feel incomplete or weak.
4. document should be a stronger Korean resume bullet sentence.
5. missing_before must include {", ".join(activity_rule['required_missing_before'])}.
6. rewrite_focus should match this activity type naturally.
7. Return JSON array only.
""".strip()

    def _generate_batch(
        self,
        *,
        job_family: str,
        activity_type: str,
        count: int,
        reference_patterns: list[dict[str, Any]],
        existing_items: list[StarExampleSeed],
    ) -> list[dict[str, Any]]:
        llm = self._get_llm()
        response = llm.invoke(
            [
                SystemMessage(content=GENERATOR_SYSTEM_PROMPT),
                HumanMessage(
                    content=self._build_prompt(
                        job_family=job_family,
                        activity_type=activity_type,
                        count=count,
                        reference_patterns=reference_patterns,
                        existing_items=existing_items,
                    )
                ),
            ]
        )
        payload = json.loads(_extract_json_text(_response_to_text(response)))
        if isinstance(payload, dict):
            payload = payload.get("items", [])
        if not isinstance(payload, list):
            raise ValueError("Gemini output must be a JSON array or object with an 'items' array")
        return [item for item in payload if isinstance(item, dict)]

    def generate_additional_stars(
        self,
        *,
        target_total: int = DEFAULT_TARGET_TOTAL,
        target_distribution: dict[str, int] | None = None,
    ) -> list[StarExampleSeed]:
        """Generate validated additional STAR examples for uncovered gaps."""

        existing_items = self.load_existing_items()
        coverage = self.analyze_coverage(
            target_total=target_total,
            target_distribution=target_distribution,
        )
        plan = coverage["generation_plan"]
        reference_patterns = self.load_reference_patterns()

        generated_items: list[StarExampleSeed] = []
        used_documents = {item.document for item in existing_items}
        seq = 1

        for plan_item in plan:
            raw_items = self._generate_batch(
                job_family=plan_item["job_family"],
                activity_type=plan_item["activity_type"],
                count=plan_item["count"],
                reference_patterns=reference_patterns,
                existing_items=existing_items,
            )
            for raw_item in raw_items:
                payload = {
                    "id": f"se:{self.version}:{seq:03d}",
                    "activity_type": plan_item["activity_type"],
                    "section_type": _safe_text(raw_item.get("section_type")) or "프로젝트",
                    "job_family": plan_item["job_family"],
                    "original_text": _safe_text(raw_item.get("original_text")),
                    "missing_before": [
                        _safe_text(value)
                        for value in raw_item.get("missing_before", [])
                        if _safe_text(value)
                    ],
                    "rewrite_focus": _safe_text(raw_item.get("rewrite_focus"))
                    or ACTIVITY_RULES[plan_item["activity_type"]]["rewrite_focus"],
                    "lang": "ko",
                    "version": self.version,
                    "is_active": True,
                    "document": _safe_text(raw_item.get("document")),
                }
                try:
                    validated = StarExampleSeed(**payload)
                except ValidationError:
                    continue
                if validated.document in used_documents:
                    continue
                generated_items.append(validated)
                used_documents.add(validated.document)
                seq += 1

        return generated_items

    def save_draft_json(
        self,
        items: list[StarExampleSeed],
        *,
        output_path: Path | None = None,
    ) -> Path:
        path = output_path or self.draft_json_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps([item.model_dump(mode="json") for item in items], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return path

    def save_review_csv(
        self,
        items: list[StarExampleSeed],
        *,
        output_path: Path | None = None,
    ) -> Path:
        path = output_path or self.review_csv_path
        path.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            "approve",
            "review_note",
            "id",
            "activity_type",
            "section_type",
            "job_family",
            "original_text",
            "missing_before",
            "rewrite_focus",
            "version",
            "document",
        ]
        with path.open("w", encoding="utf-8-sig", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            for item in items:
                writer.writerow(
                    {
                        "approve": "",
                        "review_note": "",
                        "id": item.id,
                        "activity_type": item.activity_type,
                        "section_type": item.section_type,
                        "job_family": item.job_family,
                        "original_text": item.original_text,
                        "missing_before": "|".join(item.missing_before),
                        "rewrite_focus": item.rewrite_focus,
                        "version": item.version,
                        "document": item.document,
                    }
                )
        return path

    def save_approved_from_review_csv(
        self,
        *,
        review_csv_path: Path | None = None,
        output_path: Path | None = None,
    ) -> list[StarExampleSeed]:
        review_path = review_csv_path or self.review_csv_path
        path = output_path or self.approved_json_path

        approved_items: list[StarExampleSeed] = []
        with review_path.open("r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            for row in reader:
                if _safe_text(row.get("approve")).upper() != "Y":
                    continue
                payload = {
                    "id": _safe_text(row.get("id")),
                    "activity_type": _safe_text(row.get("activity_type")),
                    "section_type": _safe_text(row.get("section_type")),
                    "job_family": _safe_text(row.get("job_family")),
                    "original_text": _safe_text(row.get("original_text")),
                    "missing_before": [
                        part.strip()
                        for part in _safe_text(row.get("missing_before")).split("|")
                        if part.strip()
                    ],
                    "rewrite_focus": _safe_text(row.get("rewrite_focus")),
                    "lang": "ko",
                    "version": _safe_text(row.get("version")) or self.version,
                    "is_active": True,
                    "document": _safe_text(row.get("document")),
                }
                approved_items.append(StarExampleSeed(**payload))

        self.save_draft_json(approved_items, output_path=path)
        return approved_items


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate additional STAR example seeds")
    parser.add_argument("--seed-path", type=Path, default=DEFAULT_SEED_PATH)
    parser.add_argument("--pattern-path", type=Path, default=DEFAULT_PATTERN_PATH)
    parser.add_argument("--draft-json", type=Path, default=DEFAULT_DRAFT_JSON_PATH)
    parser.add_argument("--review-csv", type=Path, default=DEFAULT_REVIEW_CSV_PATH)
    parser.add_argument("--approved-json", type=Path, default=DEFAULT_APPROVED_JSON_PATH)
    parser.add_argument("--target-total", type=int, default=DEFAULT_TARGET_TOTAL)
    parser.add_argument("--approve-only", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    generator = StarGenerator(
        seed_path=args.seed_path,
        pattern_path=args.pattern_path,
        draft_json_path=args.draft_json,
        review_csv_path=args.review_csv,
        approved_json_path=args.approved_json,
    )
    if args.approve_only:
        approved_items = generator.save_approved_from_review_csv()
        print(f"[star_generator] approved seeds: {len(approved_items)} -> {generator.approved_json_path}")
        return

    coverage = generator.analyze_coverage(target_total=args.target_total)
    drafts = generator.generate_additional_stars(target_total=args.target_total)
    generator.save_draft_json(drafts)
    generator.save_review_csv(drafts)
    print(f"[star_generator] current_total={coverage['current_total']}, draft_count={len(drafts)}")
    print(f"[star_generator] review csv: {generator.review_csv_path}")


if __name__ == "__main__":
    main()
