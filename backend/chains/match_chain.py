# LangChain 공고 매칭 체인 - 채용 공고와 활동 목록 비교 분석
import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

_MATCH_PROMPT = """
채용 공고와 유저의 활동 목록을 비교해 매칭 분석 결과를 JSON으로 반환하세요.
코드 블록 없이 순수 JSON만 반환하세요.

{{
  "match_score": 0~100 사이 정수,
  "matched_keywords": ["공고에서 요구하고 유저가 보유한 키워드"],
  "missing_keywords": ["공고에서 요구하지만 유저가 부족한 키워드"],
  "recommended_activities": ["가장 관련 높은 활동 id 목록"],
  "summary": "매칭 결과 1~2문장 요약"
}}

채용 공고:
{job_posting}

유저 활동 목록:
{activities_text}
"""


async def run_match_chain(job_posting: str, activities: list[dict]) -> dict:
    """
    채용 공고와 유저 활동 목록을 비교해 매칭 점수와 분석 결과를 반환한다.

    Args:
        job_posting: 채용 공고 텍스트
        activities: 활동 목록 (id, title, description 포함)

    Returns:
        match_score, matched_keywords, missing_keywords,
        recommended_activities, summary
    """
    activities_text = "\n".join([
        f"[{a.get('id', 'N/A')}] {a.get('title', '')}: {a.get('description', '')}"
        for a in activities
    ])

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ["GOOGLE_API_KEY"],
    )

    prompt = _MATCH_PROMPT.format(
        job_posting=job_posting[:4000],
        activities_text=activities_text[:3000],
    )

    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        result = json.loads(response.content.strip())
    except json.JSONDecodeError:
        result = {
            "match_score": 0,
            "matched_keywords": [],
            "missing_keywords": [],
            "recommended_activities": [],
            "summary": "분석 결과를 파싱하는 데 실패했습니다. 다시 시도해주세요.",
        }

    return result
