# Sentence classification rules for PDF activity parsing
import re
from dataclasses import dataclass
from typing import Literal

from chains.pdf_parser_rules import (
    CONTRIBUTION_KEYWORDS,
    CONTRIBUTION_LOWER_KEYWORDS,
    INTRO_KEYWORDS,
    INTRO_LOWER_KEYWORDS,
    METRIC_PATTERNS,
    PROJECT_ACTION_KEYWORDS,
    ROLE_ONLY_EXACT,
    ROLE_ONLY_SUFFIXES,
    SENTENCE_SCORE_WEIGHTS,
)


SentenceKind = Literal["intro", "contribution", "ignore"]


@dataclass(frozen=True)
class SentenceClassification:
    kind: SentenceKind
    score: int
    reason: str


def classify_activity_sentence(line: str) -> SentenceClassification:
    text = line.strip()
    lowered = text.lower()
    if not text:
        return SentenceClassification("ignore", 0, "empty")
    if _looks_like_role_only_line(text):
        return SentenceClassification("ignore", SENTENCE_SCORE_WEIGHTS.role_only, "role_only")

    intro = _score_intro(text, lowered)
    contribution = _score_contribution(text, lowered)
    if intro.score > 0 and intro.score >= contribution.score:
        return SentenceClassification("intro", intro.score, intro.reason)
    if _looks_like_project_only_line(text):
        return SentenceClassification("ignore", SENTENCE_SCORE_WEIGHTS.project_title_only, "project_title_only")
    if contribution.score > 0:
        return SentenceClassification("contribution", contribution.score, contribution.reason)
    return SentenceClassification("ignore", 0, "no_signal")


def looks_like_intro_line(line: str) -> bool:
    return classify_activity_sentence(line).kind == "intro"


def looks_like_contribution_line(line: str) -> bool:
    return classify_activity_sentence(line).kind == "contribution"


def _score_intro(text: str, lowered: str) -> SentenceClassification:
    score = 0
    reasons = []
    if any(keyword in text for keyword in INTRO_KEYWORDS):
        score += SENTENCE_SCORE_WEIGHTS.intro_keyword
        reasons.append("intro_keyword")
    if any(keyword in lowered for keyword in INTRO_LOWER_KEYWORDS):
        score += SENTENCE_SCORE_WEIGHTS.intro_keyword
        reasons.append("intro_lower_keyword")
    return SentenceClassification("intro", score, "+".join(reasons) or "no_intro_signal")


def _score_contribution(text: str, lowered: str) -> SentenceClassification:
    score = 0
    reasons = []
    if any(re.search(pattern, lowered) for pattern in METRIC_PATTERNS):
        score += SENTENCE_SCORE_WEIGHTS.metric
        reasons.append("metric_signal")
    if any(keyword in text for keyword in CONTRIBUTION_KEYWORDS):
        score += SENTENCE_SCORE_WEIGHTS.contribution_keyword
        reasons.append("keyword_signal")
    if any(keyword in lowered for keyword in CONTRIBUTION_LOWER_KEYWORDS):
        score += SENTENCE_SCORE_WEIGHTS.contribution_keyword
        reasons.append("lower_keyword_signal")
    return SentenceClassification("contribution", score, "+".join(reasons) or "no_contribution_signal")


def _looks_like_project_only_line(line: str) -> bool:
    return "프로젝트" in line and not any(token in line for token in PROJECT_ACTION_KEYWORDS)


def _looks_like_role_only_line(line: str) -> bool:
    normalized = line.strip()
    return bool(
        normalized
        and len(normalized) <= 20
        and (normalized.endswith(ROLE_ONLY_SUFFIXES) or normalized in ROLE_ONLY_EXACT)
    )
