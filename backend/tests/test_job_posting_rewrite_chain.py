from __future__ import annotations

import pytest

import backend.chains.job_posting_rewrite_chain as chain
from backend.schemas.match_rewrite import ActivityRewrite, RewriteSuggestion


class _FailingLLM:
    async def ainvoke(self, messages):  # noqa: ANN001
        raise RuntimeError("forced llm failure")


@pytest.mark.asyncio
async def test_run_job_posting_rewrite_chain_uses_fallback_when_llm_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        chain.REWRITE_RETRIEVER,
        "retrieve_for_coaching",
        lambda **kwargs: {  # noqa: ARG005
            "job_keyword_patterns": [],
            "star_examples": [],
            "job_posting_snippets": [],
        },
    )
    monkeypatch.setattr(chain, "_get_llm", lambda: _FailingLLM())

    result = await chain.run_job_posting_rewrite_chain(
        user_id="user-1",
        job_posting_text=(
            "백엔드 개발자를 채용합니다. Python과 FastAPI 경험이 필요하며, API 설계와 성능 "
            "최적화, 장애 대응 경험을 우대합니다. Redis와 비동기 처리 경험이 있으면 "
            "좋습니다. 협업과 문제 해결 능력을 중요하게 봅니다."
        ),
        job_title="백엔드 개발자",
        section_type="회사경력",
        activities=[
            {
                "id": "activity-1",
                "title": "주문 API 개선",
                "role": "백엔드 개발",
                "skills": ["Python", "Redis"],
                "description": "주문 API를 개선하고 캐시를 적용해 응답 속도를 개선했습니다.",
            }
        ],
    )

    assert result.fallback_used is True
    assert len(result.activity_rewrites) == 1
    assert result.activity_rewrites[0].activity_id == "activity-1"
    assert 1 <= len(result.activity_rewrites[0].suggestions) <= 3


@pytest.mark.asyncio
async def test_run_job_posting_rewrite_chain_auto_selects_scored_activities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    processed_ids: list[str] = []

    async def fake_generate_activity_rewrite(**kwargs):  # noqa: ANN003
        activity = kwargs["activity"]
        processed_ids.append(activity["id"])
        return (
            ActivityRewrite(
                activity_id=activity["id"],
                original_text=activity["description"],
                suggestions=[
                    RewriteSuggestion(
                        text=activity["description"],
                        focus="job_fit",
                        section="프로젝트 개요",
                        rationale="테스트용 suggestion입니다.",
                        reference_pattern="Role - Action - Result",
                    )
                ],
            ),
            False,
        )

    monkeypatch.setattr(chain, "_generate_activity_rewrite", fake_generate_activity_rewrite)

    result = await chain.run_job_posting_rewrite_chain(
        user_id="user-1",
        job_posting_text=(
            "Redis 기반 API 성능 최적화와 장애 대응 경험이 있는 백엔드 개발자를 찾습니다. "
            "비동기 처리와 캐시 설계 경험이 중요합니다."
        ),
        job_title="백엔드 개발자",
        section_type="회사경력",
        activities=[
            {
                "id": "activity-1",
                "description": "Redis 캐시를 적용해 주문 API 응답 속도를 개선했습니다.",
            },
            {
                "id": "activity-2",
                "description": "비동기 처리 구조를 도입해 장애 대응 자동화를 구현했습니다.",
            },
            {
                "id": "activity-3",
                "description": "사내 위키 문서를 정리했습니다.",
            },
        ],
    )

    assert processed_ids == ["activity-1", "activity-2"]
    assert [item.activity_id for item in result.activity_rewrites] == ["activity-1", "activity-2"]
    assert result.fallback_used is False


@pytest.mark.asyncio
async def test_run_job_posting_rewrite_chain_respects_requested_activity_ids(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    processed_ids: list[str] = []

    async def fake_generate_activity_rewrite(**kwargs):  # noqa: ANN003
        activity = kwargs["activity"]
        processed_ids.append(activity["id"])
        return (
            ActivityRewrite(
                activity_id=activity["id"],
                original_text=activity["description"],
                suggestions=[
                    RewriteSuggestion(
                        text=activity["description"],
                        focus="job_fit",
                        section="프로젝트 개요",
                        rationale="테스트용 suggestion입니다.",
                        reference_pattern="Role - Action - Result",
                    )
                ],
            ),
            False,
        )

    monkeypatch.setattr(chain, "_generate_activity_rewrite", fake_generate_activity_rewrite)

    result = await chain.run_job_posting_rewrite_chain(
        user_id="user-1",
        job_posting_text=(
            "Python 백엔드 개발자를 채용합니다. API 설계, 성능 최적화, Redis 경험을 "
            "우대하며 협업 능력을 중요하게 봅니다."
        ),
        job_title="백엔드 개발자",
        activity_ids=["activity-2"],
        section_type="회사경력",
        activities=[
            {
                "id": "activity-1",
                "description": "Redis 캐시를 적용해 주문 API 응답 속도를 개선했습니다.",
            },
            {
                "id": "activity-2",
                "description": "비동기 처리 구조를 도입해 장애 대응 자동화를 구현했습니다.",
            },
        ],
    )

    assert processed_ids == ["activity-2"]
    assert [item.activity_id for item in result.activity_rewrites] == ["activity-2"]


def test_build_activity_prompt_text_includes_activity_evidence_packet() -> None:
    prompt = chain._build_activity_prompt_text(
        {
            "id": "activity-1",
            "type": "프로젝트",
            "title": "주문 API 개선",
            "organization": "이소서",
            "period": "2026.01 ~ 2026.03",
            "team_size": 4,
            "team_composition": "백엔드 2, 프론트엔드 1, PM 1",
            "my_role": "백엔드 개발",
            "role": "개발자",
            "skills": ["Python", "Redis"],
            "contributions": ["Redis 캐시 설계", "비동기 주문 처리 구현"],
            "description": "주문 API 응답 속도를 개선했습니다.",
            "star_situation": "주문량 증가로 응답 지연이 발생했습니다.",
            "star_task": "API 지연을 줄이는 것이 목표였습니다.",
            "star_action": "캐시와 비동기 처리 구조를 적용했습니다.",
            "star_result": "응답 시간이 단축되었습니다.",
        }
    )

    assert "활동 유형: 프로젝트" in prompt
    assert "팀 구성: 백엔드 2, 프론트엔드 1, PM 1" in prompt
    assert "내 역할: 백엔드 개발" in prompt
    assert "기여 내용:" in prompt
    assert "- Redis 캐시 설계" in prompt
    assert "STAR Result: 응답 시간이 단축되었습니다." in prompt
