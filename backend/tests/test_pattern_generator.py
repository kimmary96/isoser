from __future__ import annotations

import csv
import json
from pathlib import Path
import tempfile

from backend.rag.generators.pattern_generator import (
    PatternGenerator,
    build_pattern_type_plan,
    extract_core_expressions,
)


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


def test_build_pattern_type_plan_balances_counts() -> None:
    plan = build_pattern_type_plan(30)

    assert sum(plan.values()) == 30
    assert set(plan) == {
        "result_statement",
        "problem_statement",
        "decision_statement",
        "implementation_statement",
    }
    assert max(plan.values()) - min(plan.values()) == 1


def test_extract_core_expressions_reads_mixed_fields() -> None:
    row = {
        "job_name": "백엔드 개발자",
        "description": "대용량 주문 데이터를 처리하고 성능을 개선합니다.",
        "key_tasks": ["API 설계", "비동기 처리 구조 개선"],
        "required_skills": ["Python", "Redis", "MySQL"],
    }

    expressions = extract_core_expressions(row)

    assert "대용량 주문 데이터를 처리하고 성능을 개선합니다." in expressions
    assert "API 설계" in expressions
    assert "비동기 처리 구조 개선" in expressions
    assert "Python" in expressions


def test_generate_drafts_and_review_csv(monkeypatch) -> None:
    with tempfile.TemporaryDirectory(dir=".") as tmp_dir:
        tmp_path = Path(tmp_dir)
        taxonomy_path = tmp_path / "job_taxonomy.json"
        corpus_path = tmp_path / "job_profile_corpus.jsonl"
        draft_json_path = tmp_path / "job_keyword_patterns_v2_draft.json"
        review_csv_path = tmp_path / "job_keyword_patterns_v2_review.csv"
        approved_json_path = tmp_path / "job_keyword_patterns_v2_approved.json"

        _write_json(
            taxonomy_path,
            [
                {
                    "normalized_job_key": "pm",
                    "display_name_ko": "PM / 서비스 기획자",
                    "aliases": ["PM", "서비스 기획자"],
                },
                {
                    "normalized_job_key": "backend_engineer",
                    "display_name_ko": "백엔드 개발자",
                    "aliases": ["백엔드 개발자", "Backend Engineer"],
                },
            ],
        )
        _write_jsonl(
            corpus_path,
            [
                {
                    "normalized_job_key": "pm",
                    "job_name": "PM / 서비스 기획자",
                    "description": "온보딩 퍼널과 사용자 리서치 결과를 분석합니다.",
                    "key_tasks": ["리서치 분석", "A/B 테스트 설계"],
                    "required_skills": ["SQL", "Amplitude", "PRD"],
                    "source": "work24",
                    "job_code": "PM-001",
                },
                {
                    "normalized_job_key": "backend_engineer",
                    "job_name": "백엔드 개발자",
                    "description": "API 성능 최적화와 데이터 마이그레이션을 수행합니다.",
                    "key_tasks": ["캐시 설계", "CI/CD 구축"],
                    "required_skills": ["Python", "Redis", "MySQL"],
                    "source": "work24",
                    "job_code": "BE-001",
                },
            ],
        )

        def fake_rewrite(self: PatternGenerator, context, *, pattern_type: str, target_count: int):
            base_keyword = context.job_slug.split("_")[0]
            return [
                {
                    "section_types": ["회사경력"],
                    "keywords": [base_keyword, pattern_type, f"skill{i}"],
                    "document": (
                        f"{context.job_title} {pattern_type} 예시 {i + 1}번으로 "
                        f"{context.expressions[0]} 기반 성과 문장을 작성했습니다."
                    ),
                }
                for i in range(target_count)
            ]

        monkeypatch.setattr(PatternGenerator, "rewrite_patterns_with_gemini", fake_rewrite)

        generator = PatternGenerator(
            corpus_path=corpus_path,
            taxonomy_path=taxonomy_path,
            draft_json_path=draft_json_path,
            review_csv_path=review_csv_path,
            approved_json_path=approved_json_path,
        )

        patterns = generator.generate_draft_patterns(
            per_job=4,
            job_slugs=["pm", "backend_engineer"],
        )

        assert len(patterns) == 8
        assert {pattern.version for pattern in patterns} == {"v2"}
        assert {pattern.source for pattern in patterns} == {"ncs"}
        assert {pattern.pattern_type for pattern in patterns} == {
            "result_statement",
            "problem_statement",
            "decision_statement",
            "implementation_statement",
        }

        generator.save_draft_json(patterns)
        generator.save_review_csv(patterns)

        saved_drafts = json.loads(draft_json_path.read_text(encoding="utf-8"))
        assert len(saved_drafts) == 8

        with review_csv_path.open("r", encoding="utf-8-sig", newline="") as file:
            rows = list(csv.DictReader(file))

        assert len(rows) == 8
        assert rows[0]["approve"] == ""
        assert rows[0]["id"].startswith("jk:")


def test_save_approved_from_review_csv_filters_only_y(monkeypatch) -> None:
    with tempfile.TemporaryDirectory(dir=".") as tmp_dir:
        tmp_path = Path(tmp_dir)
        taxonomy_path = tmp_path / "job_taxonomy.json"
        corpus_path = tmp_path / "job_profile_corpus.jsonl"
        review_csv_path = tmp_path / "job_keyword_patterns_v2_review.csv"
        approved_json_path = tmp_path / "job_keyword_patterns_v2_approved.json"

        _write_json(
            taxonomy_path,
            [
                {
                    "normalized_job_key": "pm",
                    "display_name_ko": "PM / 서비스 기획자",
                    "aliases": ["PM"],
                }
            ],
        )
        _write_jsonl(
            corpus_path,
            [
                {
                    "normalized_job_key": "pm",
                    "job_name": "PM / 서비스 기획자",
                    "description": "지표와 실험을 통해 제품을 개선합니다.",
                    "key_tasks": ["A/B 테스트 설계"],
                    "required_skills": ["SQL", "Amplitude"],
                }
            ],
        )

        def fake_rewrite(self: PatternGenerator, context, *, pattern_type: str, target_count: int):
            return [
                {
                    "section_types": ["프로젝트"],
                    "keywords": ["실험", "지표", pattern_type],
                    "document": f"{context.job_title} {pattern_type} 예시 {i + 1}번 문장입니다.",
                }
                for i in range(target_count)
            ]

        monkeypatch.setattr(PatternGenerator, "rewrite_patterns_with_gemini", fake_rewrite)

        generator = PatternGenerator(
            corpus_path=corpus_path,
            taxonomy_path=taxonomy_path,
            review_csv_path=review_csv_path,
            approved_json_path=approved_json_path,
        )

        patterns = generator.generate_draft_patterns(per_job=4, job_slugs=["pm"])
        generator.save_review_csv(patterns)

        with review_csv_path.open("r", encoding="utf-8-sig", newline="") as file:
            rows = list(csv.DictReader(file))

        rows[0]["approve"] = "Y"
        rows[1]["approve"] = "N"
        rows[2]["approve"] = "y"
        rows[3]["approve"] = ""

        with review_csv_path.open("w", encoding="utf-8-sig", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        approved = generator.save_approved_from_review_csv()

        assert len(approved) == 2
        saved = json.loads(approved_json_path.read_text(encoding="utf-8"))
        assert len(saved) == 2
        assert all(item["version"] == "v2" for item in saved)
