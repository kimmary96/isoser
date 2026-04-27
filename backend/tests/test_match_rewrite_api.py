from __future__ import annotations

import pytest

try:
    from backend.routers import match as match_router
except ImportError:
    from routers import match as match_router


def _rewrite_payload() -> dict:
    return {
        "job_posting_text": (
            "백엔드 개발자를 채용합니다. Python과 FastAPI 경험이 필요하며, "
            "API 설계와 성능 최적화, 장애 대응 경험을 우대합니다. "
            "Redis와 비동기 처리 경험이 있으면 좋습니다."
        ),
        "job_title": "백엔드 개발자",
        "activity_ids": ["activity-1"],
        "section_type": "회사경력",
    }


def _rewrite_result() -> dict:
    return {
        "activity_rewrites": [
            {
                "activity_id": "activity-1",
                "original_text": "주문 API를 개선했습니다.",
                "suggestions": [
                    {
                        "text": "Redis 캐시와 비동기 처리 구조를 적용해 주문 API 응답 속도를 개선했습니다.",
                        "focus": "job_fit",
                        "section": "프로젝트 개요",
                        "rationale": "공고의 핵심 요구사항과 연결되는 표현으로 정리했습니다.",
                        "reference_pattern": "Role - Action - Result",
                    }
                ],
            }
        ],
        "job_analysis_summary": "핵심 요구사항 요약입니다.",
        "fallback_used": False,
    }


def test_match_rewrite_api_returns_chain_response(
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_run_job_posting_rewrite_chain(**kwargs):  # noqa: ANN003
        captured.update(kwargs)
        return _rewrite_result()

    monkeypatch.setattr(
        match_router,
        "run_job_posting_rewrite_chain",
        fake_run_job_posting_rewrite_chain,
    )

    response = client.post(
        "/match/rewrite",
        params={"user_id": "user-1"},
        json=_rewrite_payload(),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["activity_rewrites"][0]["activity_id"] == "activity-1"
    assert payload["fallback_used"] is False
    assert captured == {
        "user_id": "user-1",
        "job_posting_text": _rewrite_payload()["job_posting_text"],
        "job_title": "백엔드 개발자",
        "activity_ids": ["activity-1"],
        "section_type": "회사경력",
    }


def test_match_rewrite_api_wraps_chain_errors(
    client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_run_job_posting_rewrite_chain(**kwargs):  # noqa: ANN003
        raise RuntimeError("chain failed")

    monkeypatch.setattr(
        match_router,
        "run_job_posting_rewrite_chain",
        fake_run_job_posting_rewrite_chain,
    )

    response = client.post(
        "/match/rewrite",
        params={"user_id": "user-1"},
        json=_rewrite_payload(),
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "공고 기반 리라이팅 실패: chain failed"
