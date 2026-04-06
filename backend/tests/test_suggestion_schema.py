from __future__ import annotations

import pytest

from backend.rag.schema import RewriteSuggestion


@pytest.mark.parametrize(
    ("focus", "section", "reference_pattern"),
    [
        ("star_gap", "STAR 구조", "Situation  Task  Action  Result"),
        ("quantification", "성과", "Technical Achievement  Quantified Impact  Business Value"),
        ("verb_strength", "구현 디테일", "Implementation Detail  Strong Action Verb"),
        ("job_fit", "역할", "Role  Contribution  Job Fit"),
        ("tech_decision", "기술적 의사결정", "Problem  Alternative Comparison  Decision"),
        ("problem_definition", "문제 정의", "Concrete Problem  Business Impact"),
    ],
)
def test_rewrite_suggestion_supports_all_focus_types(
    focus: str,
    section: str,
    reference_pattern: str,
) -> None:
    suggestion = RewriteSuggestion(
        text="문제 정의와 구현, 성과를 포함한 개선 문장입니다.",
        focus=focus,
        section=section,
        rationale="핵심 구조를 보강해 설득력을 높입니다.",
        reference_pattern=reference_pattern,
    )

    dumped = suggestion.model_dump()
    assert dumped["focus"] == focus
    assert dumped["section"] == section
    assert dumped["reference_pattern"] == reference_pattern
