from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.rag.schema import JobKeywordPatternSeed, StarExampleSeed


@pytest.mark.parametrize(
    "pattern_type",
    [
        "result_statement",
        "problem_statement",
        "decision_statement",
        "implementation_statement",
    ],
)
def test_job_keyword_pattern_seed_accepts_all_pattern_types(pattern_type: str) -> None:
    seed = JobKeywordPatternSeed(
        id="jk:test:v1:001",
        job_title="백엔드 개발자",
        job_family="engineering",
        job_bucket="backend_infra",
        section_types=["프로젝트"],
        keywords=["redis", "cache"],
        source="real_posting",
        pattern_type=pattern_type,
        document="문제와 구현, 성과를 포함한 예시 문장입니다.",
    )

    assert seed.pattern_type == pattern_type


def test_job_keyword_pattern_seed_rejects_unknown_pattern_type() -> None:
    with pytest.raises(ValidationError):
        JobKeywordPatternSeed(
            id="jk:test:v1:001",
            job_title="백엔드 개발자",
            job_family="engineering",
            job_bucket="backend_infra",
            section_types=["프로젝트"],
            keywords=["redis", "cache"],
            source="real_posting",
            pattern_type="unknown_pattern",
            document="문제와 구현, 성과를 포함한 예시 문장입니다.",
        )


@pytest.mark.parametrize(
    "activity_type",
    [
        "star_gap",
        "quantification",
        "verb_strength",
        "job_fit",
        "tech_decision",
        "problem_definition",
    ],
)
def test_star_example_seed_accepts_all_activity_types(activity_type: str) -> None:
    seed = StarExampleSeed(
        id="se:v1:001",
        activity_type=activity_type,
        section_type="프로젝트",
        job_family="backend_engineer",
        original_text="서비스 성능을 개선했습니다.",
        missing_before=["Situation"],
        rewrite_focus="누락 요소를 보강합니다.",
        document="기존 병목 문제를 정의하고 구현과 결과를 포함한 개선 문장입니다.",
    )

    assert seed.activity_type == activity_type


def test_star_example_seed_rejects_unknown_activity_type() -> None:
    with pytest.raises(ValidationError):
        StarExampleSeed(
            id="se:v1:001",
            activity_type="unknown_focus",
            section_type="프로젝트",
            job_family="backend_engineer",
            original_text="서비스 성능을 개선했습니다.",
            missing_before=["Situation"],
            rewrite_focus="누락 요소를 보강합니다.",
            document="기존 병목 문제를 정의하고 구현과 결과를 포함한 개선 문장입니다.",
        )
