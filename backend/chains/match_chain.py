import json
import os
import re
from collections import Counter
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage


_ANALYSIS_PROMPT = """
당신은 채용 공고 분석 전문가입니다.
아래 정보를 보고 지원자와 채용 공고의 적합도를 한국어로 분석하세요.

반드시 코드 블록 없이 순수 JSON만 반환하세요.

반환 형식:
{
  "summary": "전체 총평 1~2문장",
  "support_recommendation": "적극 지원 추천 | 보완 후 지원 | 경험 보강 필요",
  "strengths": ["강점1", "강점2", "강점3"],
  "gaps": ["보완점1", "보완점2", "보완점3"],
  "resume_tips": ["이력서 팁1", "이력서 팁2", "이력서 팁3"],
  "highlight_keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"]
}

채용 공고:
{job_posting}

지원자 프로필:
{profile_text}

기본 분석 결과:
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


def _grade_from_ratio(score: int, max_score: int) -> str:
    if max_score <= 0:
        return "-"
    ratio = score / max_score
    if ratio >= 0.9:
        return "A+"
    if ratio >= 0.8:
        return "A"
    if ratio >= 0.7:
        return "B+"
    if ratio >= 0.6:
        return "B"
    if ratio >= 0.5:
        return "C+"
    if ratio >= 0.4:
        return "C"
    return "D"


def _overall_grade(score: int) -> str:
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    return "D"


def _support_recommendation_from_score(score: int) -> str:
    if score >= 80:
        return "적극 지원 추천"
    if score >= 60:
        return "보완 후 지원"
    return "경험 보강 필요"


async def run_match_chain(
    job_posting: str,
    activities: list[dict],
    profile_context: dict | None = None,
) -> dict:
    """
    공고와 지원자 정보 기반 상세 매칭 리포트를 생성한다.
    """
    profile_context = profile_context or {}

    job_keywords = _extract_keywords(job_posting)
    profile_keywords = _extract_profile_keywords(profile_context)
    activity_keywords = _extract_activity_keywords(activities)
    candidate_keywords = profile_keywords.union(activity_keywords)

    matched_keywords = sorted(job_keywords.intersection(candidate_keywords))
    missing_keywords = sorted(job_keywords.difference(candidate_keywords))

    activity_scores = _score_activities_by_keywords(activities, job_keywords)

    axis_scores = _calculate_axis_scores(
        job_posting=job_posting,
        activities=activities,
        profile_context=profile_context,
        job_keywords=job_keywords,
        profile_keywords=profile_keywords,
        activity_keywords=activity_keywords,
        matched_keywords=set(matched_keywords),
        missing_keywords=set(missing_keywords),
        activity_scores=activity_scores,
    )

    total_score = sum(item["score"] for item in axis_scores.values())
    grade = _overall_grade(total_score)
    support_recommendation = _support_recommendation_from_score(total_score)

    detailed_scores = []
    for key, item in axis_scores.items():
        detailed_scores.append(
            {
                "key": key,
                "label": item["label"],
                "score": item["score"],
                "max_score": item["max_score"],
                "grade": _grade_from_ratio(item["score"], item["max_score"]),
                "reason": item["reason"],
            }
        )

    recommended_activities = [item[0] for item in activity_scores[:3] if item[1] > 0]

    base_result = {
        "total_score": total_score,
        "grade": grade,
        "support_recommendation": support_recommendation,
        "matched_keywords": matched_keywords[:12],
        "missing_keywords": missing_keywords[:12],
        "recommended_activities": recommended_activities,
        "radar_scores": {key: value["score"] for key, value in axis_scores.items()},
        "detailed_scores": detailed_scores,
    }

    llm_result = await _generate_analysis_with_llm(
        job_posting=job_posting,
        profile_context=profile_context,
        base_result=base_result,
    )

    strengths = llm_result.get("strengths") or _default_strengths(
        matched_keywords=matched_keywords,
        recommended_activities=recommended_activities,
    )
    gaps = llm_result.get("gaps") or _default_gaps(missing_keywords=missing_keywords)
    resume_tips = llm_result.get("resume_tips") or _default_resume_tips()
    highlight_keywords = llm_result.get("highlight_keywords") or matched_keywords[:5]

    return {
        "total_score": total_score,
        "grade": grade,
        "summary": llm_result.get("summary")
        or _default_summary(total_score, strengths[:2], gaps[:2]),
        "support_recommendation": llm_result.get("support_recommendation")
        or support_recommendation,
        "radar_scores": {key: value["score"] for key, value in axis_scores.items()},
        "detailed_scores": detailed_scores,
        "strengths": strengths[:3],
        "gaps": gaps[:3],
        "resume_tips": resume_tips[:3],
        "highlight_keywords": highlight_keywords[:5],
        "matched_keywords": matched_keywords[:12],
        "missing_keywords": missing_keywords[:12],
        "recommended_activities": recommended_activities,
        "match_basis": {
            "job_keyword_count": len(job_keywords),
            "matched_keyword_count": len(matched_keywords),
            "profile_keyword_count": len(profile_keywords),
            "activity_keyword_count": len(activity_keywords),
            "axis_weights": {key: value["max_score"] for key, value in axis_scores.items()},
        },
    }


def _extract_keywords(text: str) -> set[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]{1,}|[가-힣]{2,}", text or "")
    normalized = [token.strip().lower() for token in tokens]
    filtered = [t for t in normalized if t not in _STOPWORDS and len(t) >= 2]

    freq = Counter(filtered)
    top_tokens = [token for token, _ in freq.most_common(50)]
    return set(top_tokens)


def _extract_profile_keywords(profile_context: dict) -> set[str]:
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
    chunks: list[str] = []
    for activity in activities:
        title = str(activity.get("title", ""))
        desc = str(activity.get("description", ""))
        chunks.append(f"{title} {desc}")

    return _extract_keywords("\n".join(chunks))


def _score_activities_by_keywords(activities: list[dict], job_keywords: set[str]) -> list[tuple[str, int]]:
    scores: list[tuple[str, int]] = []

    for idx, activity in enumerate(activities):
        activity_id = str(activity.get("id") or f"activity_{idx}")
        text = f"{activity.get('title', '')} {activity.get('description', '')}"
        activity_kw = _extract_keywords(text)
        overlap = len(activity_kw.intersection(job_keywords))
        scores.append((activity_id, overlap))

    scores.sort(key=lambda item: item[1], reverse=True)
    return scores


def _calculate_axis_scores(
    job_posting: str,
    activities: list[dict],
    profile_context: dict,
    job_keywords: set[str],
    profile_keywords: set[str],
    activity_keywords: set[str],
    matched_keywords: set[str],
    missing_keywords: set[str],
    activity_scores: list[tuple[str, int]],
) -> dict:
    job_count = max(1, len(job_keywords))

    # 1) 직무 일치도 25
    combined_overlap = len(job_keywords.intersection(profile_keywords.union(activity_keywords)))
    job_fit_ratio = combined_overlap / job_count
    job_fit_score = min(25, int(round(job_fit_ratio * 25)))
    job_fit_reason = (
        "공고 핵심 업무와 유사한 경험이 다수 확인됩니다."
        if job_fit_score >= 20
        else "공고와 연결되는 경험은 있으나 직접적인 직무 표현은 일부 부족합니다."
        if job_fit_score >= 13
        else "공고 핵심 업무와 직접 연결되는 경험 표현이 부족합니다."
    )

    # 2) 핵심 기술/역량 20
    core_skill_overlap = len(job_keywords.intersection(profile_keywords))
    core_skill_ratio = core_skill_overlap / job_count
    core_skill_score = min(20, int(round(core_skill_ratio * 20)))
    core_skill_reason = (
        "핵심 기술과 역량이 프로필에 잘 반영되어 있습니다."
        if core_skill_score >= 16
        else "일부 핵심 기술은 확인되지만 필수 역량 표현은 더 보완이 필요합니다."
        if core_skill_score >= 10
        else "공고에서 요구하는 핵심 기술/역량과의 연결이 약합니다."
    )

    # 3) 프로젝트 관련성 20
    top_overlap = activity_scores[0][1] if activity_scores else 0
    project_ratio = min(1.0, top_overlap / 8)
    project_score = min(20, int(round(project_ratio * 20)))
    project_reason = (
        "직무와 직접 관련된 프로젝트 경험이 확인됩니다."
        if project_score >= 16
        else "직무와 유사한 프로젝트 경험은 있으나 연결성 설명이 조금 더 필요합니다."
        if project_score >= 10
        else "프로젝트 경험이 직무와 직접적으로 연결되기에는 다소 약합니다."
    )

    # 4) 성과 및 임팩트 15
    quantified_pattern = re.compile(r"\d+[\d,.%]*")
    impact_hits = 0
    for activity in activities:
        blob = f"{activity.get('title', '')} {activity.get('description', '')}"
        if quantified_pattern.search(blob):
            impact_hits += 1
    impact_score = min(15, impact_hits * 5)
    impact_reason = (
        "성과가 수치 또는 결과 중심으로 비교적 잘 표현되어 있습니다."
        if impact_score >= 12
        else "성과 표현은 있으나 정량적 설득력은 조금 더 보강할 수 있습니다."
        if impact_score >= 6
        else "프로젝트 결과나 수치 중심 성과 표현이 부족합니다."
    )

    # 5) 직무 표현력 10
    expression_tokens = {"기획", "협업", "운영", "개선", "문제", "분석", "설계", "사용자", "성과", "지표"}
    profile_blob = json.dumps(profile_context, ensure_ascii=False)
    activity_blob = " ".join(f"{a.get('title', '')} {a.get('description', '')}" for a in activities)
    expression_text = f"{profile_blob} {activity_blob}"
    expression_hits = sum(1 for token in expression_tokens if token in expression_text)
    expression_score = min(10, expression_hits)
    expression_reason = (
        "직무 언어와 역할 중심 표현이 비교적 잘 드러납니다."
        if expression_score >= 8
        else "직무 관련 경험은 있으나 채용 공고 언어로 번역된 표현은 더 보완이 필요합니다."
        if expression_score >= 4
        else "경험은 존재할 수 있으나 직무 관점에서 읽히는 표현이 약합니다."
    )

    # 6) 학습/성장 가능성 10
    growth_signals = 0
    growth_keywords = {"프로젝트", "구현", "학습", "개발", "분석", "실습", "부트캠프", "서비스"}
    combined_text = f"{job_posting} {profile_blob} {activity_blob}"
    for token in growth_keywords:
        if token in combined_text:
            growth_signals += 1
    growth_score = min(10, max(4, growth_signals // 2))
    growth_reason = (
        "현재까지의 학습 흐름과 프로젝트 방향성이 직무와 잘 맞습니다."
        if growth_score >= 8
        else "직무 전환 또는 성장 가능성은 있으나 설득력 있는 연결은 조금 더 필요합니다."
        if growth_score >= 5
        else "현재 경험만으로는 성장 방향성이 뚜렷하게 드러나지 않습니다."
    )

    return {
        "job_fit": {
            "label": "직무 일치도",
            "score": job_fit_score,
            "max_score": 25,
            "reason": job_fit_reason,
        },
        "core_skills": {
            "label": "핵심 기술/역량",
            "score": core_skill_score,
            "max_score": 20,
            "reason": core_skill_reason,
        },
        "project_relevance": {
            "label": "프로젝트 관련성",
            "score": project_score,
            "max_score": 20,
            "reason": project_reason,
        },
        "impact": {
            "label": "성과 및 임팩트",
            "score": impact_score,
            "max_score": 15,
            "reason": impact_reason,
        },
        "expression": {
            "label": "직무 표현력",
            "score": expression_score,
            "max_score": 10,
            "reason": expression_reason,
        },
        "growth": {
            "label": "학습/성장 가능성",
            "score": growth_score,
            "max_score": 10,
            "reason": growth_reason,
        },
    }


async def _generate_analysis_with_llm(job_posting: str, profile_context: dict, base_result: dict) -> dict[str, Any]:
    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=os.environ["GOOGLE_API_KEY"],
        )
        profile_text = json.dumps(profile_context, ensure_ascii=False)
        analysis_json = json.dumps(base_result, ensure_ascii=False)
        prompt = _ANALYSIS_PROMPT.format(
            job_posting=job_posting[:3000],
            profile_text=profile_text[:2000],
            analysis_json=analysis_json[:3000],
        )

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        return _parse_json_object(response.content)
    except Exception:
        return {}


def _parse_json_object(raw_content: Any) -> dict[str, Any]:
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


def _default_summary(score: int, strengths: list[str], gaps: list[str]) -> str:
    strength_text = ", ".join(strengths) if strengths else "핵심 강점이 일부 확인됩니다"
    gap_text = ", ".join(gaps) if gaps else "추가 보완 포인트는 크지 않습니다"
    return f"총점 {score}점입니다. 강점은 {strength_text}이며, 보완이 필요한 부분은 {gap_text}입니다."


def _default_strengths(matched_keywords: list[str], recommended_activities: list[str]) -> list[str]:
    strengths = []
    if matched_keywords:
        strengths.append(f"공고 핵심 키워드와 일치하는 요소가 있습니다: {', '.join(matched_keywords[:3])}")
    if recommended_activities:
        strengths.append("직무와 연결되는 활동 또는 프로젝트 경험이 존재합니다.")
    strengths.append("기본 프로필과 활동 정보에서 공고 관련성이 일부 확인됩니다.")
    return strengths


def _default_gaps(missing_keywords: list[str]) -> list[str]:
    if not missing_keywords:
        return ["핵심 누락 키워드는 크지 않지만 표현 보완은 필요할 수 있습니다."]
    return [
        f"공고 핵심 키워드 중 일부가 부족합니다: {', '.join(missing_keywords[:3])}",
        "경험을 직무 언어로 더 직접적으로 표현할 필요가 있습니다.",
        "성과 중심 문장 보강이 필요할 수 있습니다.",
    ]


def _default_resume_tips() -> list[str]:
    return [
        "프로젝트에서 맡은 역할과 해결한 문제를 먼저 쓰세요.",
        "가능하면 결과를 숫자나 개선 효과 중심으로 표현하세요.",
        "공고의 핵심 키워드를 이력서 문장에 자연스럽게 반영하세요.",
    ]