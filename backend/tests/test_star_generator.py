from __future__ import annotations

import csv
import json
from pathlib import Path
import tempfile

from backend.rag.generators.star_generator import StarGenerator


def _write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def test_analyze_coverage_identifies_new_type_gaps() -> None:
    with tempfile.TemporaryDirectory(dir=".") as tmp_dir:
        tmp_path = Path(tmp_dir)
        seed_path = tmp_path / "star_examples.json"
        pattern_path = tmp_path / "job_keyword_patterns.json"

        _write_json(
            seed_path,
            [
                {
                    "id": "se:v1:001",
                    "activity_type": "star_gap",
                    "section_type": "회사경력",
                    "job_family": "pm",
                    "original_text": "온보딩을 개선했습니다.",
                    "missing_before": ["Situation", "Result"],
                    "rewrite_focus": "STAR 구조 보강",
                    "lang": "ko",
                    "version": "v1",
                    "is_active": True,
                    "document": "기존 온보딩 퍼널의 이탈 문제를 분석해 전환율을 개선했습니다.",
                },
                {
                    "id": "se:v1:002",
                    "activity_type": "quantification",
                    "section_type": "프로젝트",
                    "job_family": "backend_engineer",
                    "original_text": "성능을 개선했습니다.",
                    "missing_before": ["정량화", "Result"],
                    "rewrite_focus": "숫자 보강",
                    "lang": "ko",
                    "version": "v1",
                    "is_active": True,
                    "document": "API 응답속도를 40% 개선했습니다.",
                },
            ],
        )
        _write_json(pattern_path, [])

        generator = StarGenerator(seed_path=seed_path, pattern_path=pattern_path)
        coverage = generator.analyze_coverage()

        assert coverage["current_total"] == 2
        assert coverage["deficits_by_activity_type"]["tech_decision"] == 6
        assert coverage["deficits_by_activity_type"]["problem_definition"] == 6
        assert coverage["generation_plan"]


def test_generate_additional_stars_and_review_csv(monkeypatch) -> None:
    with tempfile.TemporaryDirectory(dir=".") as tmp_dir:
        tmp_path = Path(tmp_dir)
        seed_path = tmp_path / "star_examples.json"
        pattern_path = tmp_path / "job_keyword_patterns.json"
        review_csv_path = tmp_path / "star_examples_v2_review.csv"

        _write_json(
            seed_path,
            [
                {
                    "id": "se:v1:001",
                    "activity_type": "star_gap",
                    "section_type": "회사경력",
                    "job_family": "pm",
                    "original_text": "온보딩을 개선했습니다.",
                    "missing_before": ["Situation", "Result"],
                    "rewrite_focus": "STAR 구조 보강",
                    "lang": "ko",
                    "version": "v1",
                    "is_active": True,
                    "document": "기존 온보딩 퍼널의 이탈 문제를 분석해 전환율을 개선했습니다.",
                }
            ],
        )
        _write_json(
            pattern_path,
            [
                {
                    "id": "jk:pm:v1:001",
                    "job_title": "PM / 서비스 기획자",
                    "job_family": "pm",
                    "job_bucket": "product_management",
                    "section_types": ["회사경력"],
                    "keywords": ["온보딩", "전환율"],
                    "source": "real_posting",
                    "pattern_type": "result_statement",
                    "lang": "ko",
                    "version": "v1",
                    "is_active": True,
                    "document": "온보딩 전환율을 21%에서 33%로 개선했습니다.",
                }
            ],
        )

        def fake_generate_batch(
            self: StarGenerator,
            *,
            job_family: str,
            activity_type: str,
            count: int,
            reference_patterns,
            existing_items,
        ):
            return [
                {
                    "section_type": "프로젝트",
                    "original_text": f"{job_family} {activity_type} 원문 {index + 1}",
                    "missing_before": ["기술선택근거", "대안비교"]
                    if activity_type == "tech_decision"
                    else ["문제정의", "Situation"],
                    "rewrite_focus": "보강 초점",
                    "document": f"{job_family} {activity_type} 개선 문장 {index + 1}입니다.",
                }
                for index in range(count)
            ]

        monkeypatch.setattr(StarGenerator, "_generate_batch", fake_generate_batch)

        generator = StarGenerator(
            seed_path=seed_path,
            pattern_path=pattern_path,
            review_csv_path=review_csv_path,
        )
        drafts = generator.generate_additional_stars(
            target_distribution={
                "star_gap": 1,
                "quantification": 1,
                "verb_strength": 1,
                "job_fit": 1,
                "tech_decision": 2,
                "problem_definition": 2,
            }
        )

        assert len(drafts) == 7
        assert any(item.activity_type == "tech_decision" for item in drafts)
        assert any(item.activity_type == "problem_definition" for item in drafts)

        generator.save_review_csv(drafts)
        with review_csv_path.open("r", encoding="utf-8-sig", newline="") as file:
            rows = list(csv.DictReader(file))

        assert len(rows) == 7
        assert rows[0]["approve"] == ""
        assert rows[0]["id"].startswith("se:v2:")


def test_save_approved_from_review_csv_filters_y_only() -> None:
    with tempfile.TemporaryDirectory(dir=".") as tmp_dir:
        tmp_path = Path(tmp_dir)
        review_csv_path = tmp_path / "star_examples_v2_review.csv"
        approved_json_path = tmp_path / "star_examples_v2_approved.json"

        with review_csv_path.open("w", encoding="utf-8-sig", newline="") as file:
            writer = csv.DictWriter(
                file,
                fieldnames=[
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
                ],
            )
            writer.writeheader()
            writer.writerows(
                [
                    {
                        "approve": "Y",
                        "review_note": "",
                        "id": "se:v2:001",
                        "activity_type": "tech_decision",
                        "section_type": "회사경력",
                        "job_family": "backend_engineer",
                        "original_text": "Redis를 사용했습니다.",
                        "missing_before": "기술선택근거|대안비교",
                        "rewrite_focus": "기술 선택 근거를 보강",
                        "version": "v2",
                        "document": "Redis와 RabbitMQ를 비교해 Redis를 선택한 이유를 설명했습니다.",
                    },
                    {
                        "approve": "N",
                        "review_note": "",
                        "id": "se:v2:002",
                        "activity_type": "problem_definition",
                        "section_type": "프로젝트",
                        "job_family": "pm",
                        "original_text": "온보딩을 개선했습니다.",
                        "missing_before": "문제정의|Situation",
                        "rewrite_focus": "문제 정의 추가",
                        "version": "v2",
                        "document": "기존 온보딩 퍼널의 이탈 원인을 정의하고 개선했습니다.",
                    },
                ],
            )

        generator = StarGenerator(
            review_csv_path=review_csv_path,
            approved_json_path=approved_json_path,
        )
        approved = generator.save_approved_from_review_csv()

        assert len(approved) == 1
        saved = json.loads(approved_json_path.read_text(encoding="utf-8"))
        assert len(saved) == 1
        assert saved[0]["activity_type"] == "tech_decision"
