from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.rag.runtime_config import load_backend_dotenv
from backend.utils.supabase_admin import request_supabase

try:
    from backend.check_python_version import main as assert_python_version
except ImportError:
    from check_python_version import main as assert_python_version

DEFAULT_RULE_LIMIT = 30
DEFAULT_PROGRAMS_PER_RULE = 5
DEFAULT_FETCH_LIMIT = 500

REGION_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("온라인", ("온라인", "원격", "비대면")),
    ("서울", ("서울",)),
    ("경기", ("경기", "인천")),
    ("부산", ("부산", "울산")),
    ("대전·충청", ("대전", "충청", "세종")),
    ("대구·경북", ("대구", "경북")),
)

CATEGORY_ALIASES = {
    "IT·컴퓨터": "IT",
    "데이터": "IT",
    "SW": "IT",
    "소프트웨어": "IT",
    "AI": "AI",
    "인공지능": "AI",
    "디자인": "디자인",
    "경영": "경영",
    "창업": "창업",
}


@dataclass(frozen=True)
class RecommendationRuleSeed:
    condition_key: str
    program_ids: list[str]
    reason_template: str
    fit_keywords: list[str]
    priority: int

    def to_payload(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["updated_at"] = datetime.utcnow().isoformat() + "Z"
        return payload


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_category(value: Any) -> str | None:
    raw = _clean_text(value)
    if not raw:
        return None
    return CATEGORY_ALIASES.get(raw, raw if raw in {"AI", "IT", "디자인", "경영", "창업", "기타"} else "기타")


def normalize_region(location: Any, teaching_method: Any = None) -> str | None:
    location_text = _clean_text(location)
    teaching_text = _clean_text(teaching_method)
    if location_text:
        for label, keywords in REGION_RULES:
            if any(keyword in location_text for keyword in keywords):
                return label
    if teaching_text:
        for label, keywords in REGION_RULES:
            if any(keyword in teaching_text for keyword in keywords):
                return label
    haystack = f"{location_text} {teaching_text}".strip()
    if not haystack:
        return None
    for label, keywords in REGION_RULES:
        if any(keyword in haystack for keyword in keywords):
            return label
    return None


def normalize_support(program: dict[str, Any]) -> str | None:
    support_type = _clean_text(program.get("support_type"))
    title = _clean_text(program.get("title"))
    combined = f"{support_type} {title}"
    if any(keyword in combined for keyword in ("국비", "내일배움", "K-디지털", "무료", "전액", "지원")):
        return "국비"
    return None


def normalize_teaching_method(program: dict[str, Any]) -> str | None:
    explicit = _clean_text(program.get("teaching_method"))
    if explicit in {"온라인", "오프라인", "혼합"}:
        return explicit
    return normalize_region(program.get("location"), explicit)


def build_condition_keys(program: dict[str, Any]) -> list[str]:
    category = normalize_category(program.get("category"))
    region = normalize_region(program.get("location"), program.get("teaching_method"))
    support = normalize_support(program)
    teaching_method = normalize_teaching_method(program)

    combinations: list[tuple[str, ...]] = []
    if category and region and support:
        combinations.append((category, region, support))
    if category and region:
        combinations.append((category, region))
    if category and teaching_method == "온라인":
        combinations.append((category, "온라인"))
    if category and support:
        combinations.append((category, support))

    unique_keys: list[str] = []
    seen: set[str] = set()
    for tokens in combinations:
        key = "+".join(tokens)
        if key not in seen:
            seen.add(key)
            unique_keys.append(key)
    return unique_keys


def build_reason_template(tokens: list[str]) -> str:
    if not tokens:
        return "조건에 맞는 추천 프로그램입니다."
    if "온라인" in tokens and len(tokens) >= 2:
        return f"온라인으로 참여 가능한 {tokens[0]} 프로그램이에요."
    if len(tokens) == 3:
        return f"{tokens[1]} 지역에서 확인할 수 있는 {tokens[0]} {tokens[2]} 프로그램이에요."
    if len(tokens) == 2 and tokens[1] == "국비":
        return f"{tokens[0]} 분야에서 지원받아 참여할 수 있는 프로그램이에요."
    if len(tokens) == 2:
        return f"{tokens[1]} 조건에 맞는 {tokens[0]} 프로그램이에요."
    return f"{tokens[0]} 분야 추천 프로그램이에요."


def _sort_programs(programs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def sort_key(program: dict[str, Any]) -> tuple[str, str]:
        deadline = _clean_text(program.get("deadline") or program.get("end_date")) or "9999-12-31"
        title = _clean_text(program.get("title")) or "zzz"
        return deadline, title

    return sorted(programs, key=sort_key)


def generate_rule_seeds(
    programs: list[dict[str, Any]],
    *,
    max_rules: int = DEFAULT_RULE_LIMIT,
    max_programs_per_rule: int = DEFAULT_PROGRAMS_PER_RULE,
) -> list[RecommendationRuleSeed]:
    grouped: dict[str, list[dict[str, Any]]] = {}

    for program in programs:
        program_id = _clean_text(program.get("id"))
        if not program_id:
            continue
        for condition_key in build_condition_keys(program):
            grouped.setdefault(condition_key, []).append(program)

    seeds: list[RecommendationRuleSeed] = []
    for condition_key, grouped_programs in grouped.items():
        ordered_programs = _sort_programs(grouped_programs)
        program_ids: list[str] = []
        seen_program_ids: set[str] = set()
        for program in ordered_programs:
            program_id = _clean_text(program.get("id"))
            if not program_id or program_id in seen_program_ids:
                continue
            seen_program_ids.add(program_id)
            program_ids.append(program_id)
            if len(program_ids) >= max_programs_per_rule:
                break
        if not program_ids:
            continue

        tokens = condition_key.split("+")
        specificity = len(tokens)
        priority = specificity * 100 + min(len(grouped_programs), 99)
        seeds.append(
            RecommendationRuleSeed(
                condition_key=condition_key,
                program_ids=program_ids,
                reason_template=build_reason_template(tokens),
                fit_keywords=tokens,
                priority=priority,
            )
        )

    seeds.sort(key=lambda item: (-item.priority, item.condition_key))
    return seeds[:max_rules]


async def fetch_active_programs(limit: int = DEFAULT_FETCH_LIMIT) -> list[dict[str, Any]]:
    rows = await request_supabase(
        method="GET",
        path="/rest/v1/programs",
        params={
            "select": "id,title,category,location,deadline,end_date,support_type,teaching_method,is_active",
            "is_active": "eq.true",
            "order": "deadline.asc.nullslast",
            "limit": str(limit),
        },
    )
    return rows if isinstance(rows, list) else []


async def upsert_rule_seeds(seeds: list[RecommendationRuleSeed]) -> Any:
    payload = [seed.to_payload() for seed in seeds]
    return await request_supabase(
        method="POST",
        path="/rest/v1/recommendation_rules",
        params={"on_conflict": "condition_key"},
        payload=payload,
        prefer="resolution=merge-duplicates,return=representation",
    )


async def async_main(*, write: bool, max_rules: int, max_programs_per_rule: int, fetch_limit: int) -> int:
    load_backend_dotenv()
    programs = await fetch_active_programs(limit=fetch_limit)
    seeds = generate_rule_seeds(
        programs,
        max_rules=max_rules,
        max_programs_per_rule=max_programs_per_rule,
    )

    result = {
        "program_count": len(programs),
        "rule_count": len(seeds),
        "rules": [seed.to_payload() for seed in seeds],
        "written": False,
    }

    if write and seeds:
        rows = await upsert_rule_seeds(seeds)
        result["written"] = True
        result["upserted_count"] = len(rows) if isinstance(rows, list) else 0

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build recommendation_rules seed payloads from programs table.")
    parser.add_argument("--write", action="store_true", help="upsert generated rules into Supabase")
    parser.add_argument("--max-rules", type=int, default=DEFAULT_RULE_LIMIT)
    parser.add_argument("--max-programs-per-rule", type=int, default=DEFAULT_PROGRAMS_PER_RULE)
    parser.add_argument("--fetch-limit", type=int, default=DEFAULT_FETCH_LIMIT)
    return parser


def main() -> int:
    assert_python_version()
    parser = build_parser()
    args = parser.parse_args()
    return asyncio.run(
        async_main(
            write=args.write,
            max_rules=args.max_rules,
            max_programs_per_rule=args.max_programs_per_rule,
            fetch_limit=args.fetch_limit,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
