# LangChain 공고 매칭 체인 - 프로필/활동 기반 하이브리드 매칭 점수 계산
import json
import os
import re
from collections import Counter
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage


_MATCH_SUMMARY_PROMPT = """
다음 매칭 분석 결과를 바탕으로 한국어 요약을 1~2문장으로 작성하세요.
코드 블록 없이 순수 JSON만 반환하세요.

{{
  "summary": "요약 문장",
  "confidence": "high | medium | low"
}}

채용 공고:
{job_posting}

프로필 요약:
{profile_text}

매칭 계산 결과:
{analysis_json}
"""

_STOPWORDS = {
    "그리고",
    "또한",
    "관련",
    "통해",
    "기반",
    "경험",
    "업무",
    "담당",
    "수행",
    "가능",
    "우대",
    "필수",
    "채용",
    "직무",
    "회사",
    "프로젝트",
    "대한",
    "에서",
    "하는",
    "으로",
    "입니다",
    "있습니다",
    "the",
    "and",
    "with",
    "for",
    "from",
    "you",
    "our",
    "team",
}


async def run_match_chain(job_posting: str, activities: list[dict], profile_context: dict | None = None) -> dict:
    """
    채용 공고와 유저 프로필/활동을 비교해 매칭 점수와 분석 결과를 반환한다.

    Args:
        job_posting: 채용 공고 텍스트
        activities: 활동 목록 (id, title, description 포함)
        profile_context: 프로필 기반 추가 정보 (스킬/경력/학력/자격증 등)

    Returns:
        match_score, matched_keywords, missing_keywords,
        recommended_activities, summary, confidence, match_basis
    """
    profile_context = profile_context or {}

    job_keywords = _extract_keywords(job_posting)
    profile_keywords = _extract_profile_keywords(profile_context)
    activity_keywords = _extract_activity_keywords(activities)

    candidate_keywords = profile_keywords.union(activity_keywords)
    matched_keywords = sorted(job_keywords.intersection(candidate_keywords))
    missing_keywords = sorted(job_keywords.difference(candidate_keywords))

    activity_scores = _score_activities_by_keywords(activities, job_keywords)
    recommended_activities = [item[0] for item in activity_scores[:3] if item[1] > 0]

    match_score, match_basis = _calculate_match_score(
        job_keywords=job_keywords,
        matched_keywords=set(matched_keywords),
        profile_keywords=profile_keywords,
        activity_scores=activity_scores,
        activities=activities,
    )

    summary_result = await _generate_summary_with_llm(
        job_posting=job_posting,
        profile_context=profile_context,
        base_result={
            "match_score": match_score,
            "matched_keywords": matched_keywords[:12],
            "missing_keywords": missing_keywords[:12],
            "recommended_activities": recommended_activities,
            "match_basis": match_basis,
        },
    )

    return {
        "match_score": match_score,
        "matched_keywords": matched_keywords[:12],
        "missing_keywords": missing_keywords[:12],
        "recommended_activities": recommended_activities,
        "summary": summary_result.get("summary")
        or _default_summary(match_score, matched_keywords[:5], missing_keywords[:5]),
        "confidence": summary_result.get("confidence")
        or _confidence_from_score(match_score),
        "match_basis": match_basis,
    }


def _extract_keywords(text: str) -> set[str]:
    """
    공고/설명 텍스트에서 핵심 키워드를 추출한다.

    Args:
        text: 원문 텍스트

    Returns:
        키워드 집합
    """
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]{1,}|[가-힣]{2,}", text or "")
    normalized = [token.strip().lower() for token in tokens]
    filtered = [t for t in normalized if t not in _STOPWORDS and len(t) >= 2]

    freq = Counter(filtered)
    top_tokens = [token for token, _ in freq.most_common(40)]
    return set(top_tokens)


def _extract_profile_keywords(profile_context: dict) -> set[str]:
    """
    프로필 컨텍스트에서 키워드를 추출한다.

    Args:
        profile_context: 프로필 정보 딕셔너리

    Returns:
        키워드 집합
    """
    chunks: list[str] = []
    for key in [
        "name",
        "education",
        "self_intro",
        "career",
        "education_history",
        "awards",
        "certifications",
        "languages",
        "skills",
    ]:
        value = profile_context.get(key)
        if isinstance(value, str):
            chunks.append(value)
        elif isinstance(value, list):
            chunks.extend(str(item) for item in value)

    return _extract_keywords("\n".join(chunks))


def _extract_activity_keywords(activities: list[dict]) -> set[str]:
    """
    활동 목록에서 키워드를 추출한다.

    Args:
        activities: 활동 목록

    Returns:
        키워드 집합
    """
    chunks: list[str] = []
    for activity in activities:
        title = str(activity.get("title", ""))
        desc = str(activity.get("description", ""))
        chunks.append(f"{title} {desc}")

    return _extract_keywords("\n".join(chunks))


def _score_activities_by_keywords(activities: list[dict], job_keywords: set[str]) -> list[tuple[str, int]]:
    """
    활동별 공고 키워드 일치 점수를 계산한다.

    Args:
        activities: 활동 목록
        job_keywords: 공고 키워드 집합

    Returns:
        (activity_id, score) 목록 (내림차순)
    """
    scores: list[tuple[str, int]] = []

    for idx, activity in enumerate(activities):
        activity_id = str(activity.get("id") or f"activity_{idx}")
        text = f"{activity.get('title', '')} {activity.get('description', '')}"
        activity_kw = _extract_keywords(text)
        overlap = len(activity_kw.intersection(job_keywords))
        scores.append((activity_id, overlap))

    scores.sort(key=lambda item: item[1], reverse=True)
    return scores


def _calculate_match_score(
    job_keywords: set[str],
    matched_keywords: set[str],
    profile_keywords: set[str],
    activity_scores: list[tuple[str, int]],
    activities: list[dict],
) -> tuple[int, dict]:
    """
    가중치 기반 매칭 점수를 계산한다.

    Args:
        job_keywords: 공고 키워드
        matched_keywords: 매칭된 키워드
        profile_keywords: 프로필 기반 키워드
        activity_scores: 활동별 일치 점수
        activities: 활동 목록

    Returns:
        (최종 점수, 점수 산식 상세)
    """
    job_count = max(1, len(job_keywords))

    keyword_ratio = len(matched_keywords) / job_count
    keyword_score = min(40, int(round(keyword_ratio * 40)))

    profile_overlap = len(job_keywords.intersection(profile_keywords))
    skill_ratio = profile_overlap / job_count
    skill_score = min(30, int(round(skill_ratio * 30)))

    top_overlap = activity_scores[0][1] if activity_scores else 0
    experience_ratio = min(1.0, top_overlap / 6)
    experience_score = min(20, int(round(experience_ratio * 20)))

    quant_score = 0
    quantified_pattern = re.compile(r"\d+[\d,.%]*")
    for activity in activities:
        blob = f"{activity.get('title', '')} {activity.get('description', '')}"
        if quantified_pattern.search(blob):
            quant_score = 10
            break

    final_score = max(0, min(100, keyword_score + skill_score + experience_score + quant_score))

    basis = {
        "weights": {
            "keyword_fit": 40,
            "profile_skill_fit": 30,
            "experience_relevance": 20,
            "quantified_impact": 10,
        },
        "components": {
            "keyword_fit": keyword_score,
            "profile_skill_fit": skill_score,
            "experience_relevance": experience_score,
            "quantified_impact": quant_score,
        },
        "job_keyword_count": len(job_keywords),
        "matched_keyword_count": len(matched_keywords),
    }
    return final_score, basis


async def _generate_summary_with_llm(job_posting: str, profile_context: dict, base_result: dict) -> dict[str, Any]:
    """
    LLM으로 요약/신뢰도를 생성한다. 실패 시 빈 딕셔너리를 반환한다.

    Args:
        job_posting: 공고 텍스트
        profile_context: 프로필 컨텍스트
        base_result: 기본 매칭 결과

    Returns:
        summary/confidence 딕셔너리
    """
    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=os.environ["GOOGLE_API_KEY"],
        )
        profile_text = json.dumps(profile_context, ensure_ascii=False)
        analysis_json = json.dumps(base_result, ensure_ascii=False)
        prompt = _MATCH_SUMMARY_PROMPT.format(
            job_posting=job_posting[:3000],
            profile_text=profile_text[:2000],
            analysis_json=analysis_json,
        )

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        return _parse_json_object(response.content)
    except Exception:
        return {}


def _parse_json_object(raw_content: Any) -> dict[str, Any]:
    """
    문자열/블록 응답에서 JSON 객체를 안전하게 추출한다.

    Args:
        raw_content: LLM 응답 원본

    Returns:
        파싱된 dict, 실패 시 빈 dict
    """
    text = _content_to_text(raw_content).strip()
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else {}
    except json.JSONDecodeError:
        cleaned = text.replace("```json", "").replace("```", "").strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return {}
        try:
            obj = json.loads(cleaned[start : end + 1])
            return obj if isinstance(obj, dict) else {}
        except json.JSONDecodeError:
            return {}


def _content_to_text(raw_content: Any) -> str:
    """
    LLM 콘텐츠를 문자열로 변환한다.

    Args:
        raw_content: 원본 콘텐츠

    Returns:
        문자열
    """
    if isinstance(raw_content, str):
        return raw_content
    if isinstance(raw_content, list):
        parts: list[str] = []
        for block in raw_content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    return str(raw_content)


def _default_summary(score: int, matched_keywords: list[str], missing_keywords: list[str]) -> str:
    """
    LLM 요약 실패 시 사용할 기본 요약 문장을 생성한다.

    Args:
        score: 매칭 점수
        matched_keywords: 매칭 키워드 일부
        missing_keywords: 부족 키워드 일부

    Returns:
        요약 문장
    """
    matched = ", ".join(matched_keywords) if matched_keywords else "핵심 매칭 키워드가 부족"
    missing = ", ".join(missing_keywords) if missing_keywords else "추가 보완 키워드 없음"
    return f"현재 공고와 {score}% 수준으로 일치합니다. 강점 키워드는 {matched}이며, 보완 키워드는 {missing}입니다."


def _confidence_from_score(score: int) -> str:
    """
    점수 기반 신뢰도를 계산한다.

    Args:
        score: 매칭 점수

    Returns:
        high | medium | low
    """
    if score >= 75:
        return "high"
    if score >= 45:
        return "medium"
    return "low"
