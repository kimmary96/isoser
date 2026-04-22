from chains.pdf_sentence_scorer import (
    classify_activity_sentence,
    looks_like_contribution_line,
    looks_like_intro_line,
)
from chains.pdf_parser_rules import ROLE_ONLY_EXACT, SENTENCE_SCORE_WEIGHTS


def test_intro_line_detects_contextual_non_performance_sentences() -> None:
    assert looks_like_intro_line("Python/FastAPI 기반 REST API 개발 및 유지보수")
    assert looks_like_intro_line("회사 폐업으로 전원 권고사직")
    assert looks_like_intro_line("계약종료 후 프로젝트를 정리")


def test_contribution_line_detects_metrics_and_action_keywords() -> None:
    assert looks_like_contribution_line("인덱스 튜닝으로 평균 쿼리 지연 38% 단축")
    assert looks_like_contribution_line("거래 자동 분류 배치 구축으로 일 3시간 수동 작업 절감")
    assert looks_like_contribution_line("부스 동선 설계, 인력 배치, 운영 시나리오 설계")
    assert looks_like_contribution_line("WebSocket 기반 라이더 위치 실시간 갱신 기능 개발")


def test_project_title_only_line_is_not_contribution() -> None:
    assert not looks_like_contribution_line("구미산단미래놀이터 체험 부스 운영프로젝트")
    assert not looks_like_contribution_line("회사 프로젝트 - PM/운영")
    assert not looks_like_contribution_line("백엔드 개발자")


def test_classify_activity_sentence_returns_kind_and_reason() -> None:
    intro = classify_activity_sentence("회사 폐업으로 전원 권고사직")
    contribution = classify_activity_sentence("WebSocket 기반 라이더 위치 실시간 갱신 기능 개발")
    ignored = classify_activity_sentence("백엔드 개발자")

    assert intro.kind == "intro"
    assert intro.reason == "intro_keyword"
    assert contribution.kind == "contribution"
    assert contribution.score > 0
    assert ignored.kind == "ignore"
    assert ignored.reason == "role_only"


def test_sentence_scorer_uses_shared_role_rules() -> None:
    assert "공사기사" in ROLE_ONLY_EXACT
    assert classify_activity_sentence("공사기사").kind == "ignore"
    assert classify_activity_sentence("데이터 엔지니어").kind == "ignore"
    assert classify_activity_sentence("서비스 기획자").kind == "ignore"
    assert classify_activity_sentence("프로덕트 매니저").kind == "ignore"


def test_sentence_scorer_uses_shared_score_weights() -> None:
    intro = classify_activity_sentence("회사 폐업으로 전원 권고사직")
    metric = classify_activity_sentence("인덱스 튜닝으로 평균 쿼리 지연 38% 단축")

    assert intro.score == SENTENCE_SCORE_WEIGHTS.intro_keyword
    assert metric.score >= SENTENCE_SCORE_WEIGHTS.metric


def test_classify_activity_sentence_returns_specific_contribution_reasons() -> None:
    metric_only = classify_activity_sentence("일 15,000건 이상 주문 지연 없이 처리")
    keyword_only = classify_activity_sentence("WebSocket 기반 라이더 위치 실시간 갱신 기능 개발")
    mixed = classify_activity_sentence("인덱스 튜닝으로 평균 쿼리 지연 38% 단축")

    assert metric_only.reason == "metric_signal+keyword_signal"
    assert keyword_only.reason == "keyword_signal"
    assert mixed.reason == "metric_signal+keyword_signal"
