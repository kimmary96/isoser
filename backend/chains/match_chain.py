import json
import os
import re
from collections import Counter
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

_ANALYSIS_PROMPT = """
당신은 채용 공고 매칭 분석가입니다.

아래 기본 점수와 사용자 정보를 참고해, 한국어로 JSON만 반환하세요.
코드블록은 사용하지 마세요.

반환 형식:
{
  "summary": "전체 총평 1~2문장",
  "support_recommendation": "적극 지원 추천 | 보완 후 지원 | 경험 보강 필요",
  "strengths": ["강점1", "강점2", "강점3"],
  "gaps": ["보완점1", "보완점2", "보완점3"],
  "resume_tips": ["팁1", "팁2", "팁3"],
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
    "그리고", "또한", "관련", "통해", "기반", "경험", "업무", "해당", "수행", "가능",
    "우대", "필수", "채용", "직무", "회사", "프로젝트", "대한", "에서", "하는", "으로",
    "입니다", "있습니다", "the", "and", "with", "for", "from", "you", "our", "team",
}

_EXPRESSION_TOKENS = {
    "기획", "운영", "개선", "문제", "분석", "설계", "사용자", "성과", "지표",
    "마케팅", "전략", "콘텐츠", "프로모션", "캠페인",
    "project", "analysis", "strategy", "growth", "performance",
}

_GROWTH_TOKENS = {
    "프로젝트", "구현", "학습", "개발", "분석", "실습", "서비스", "개선", "실험", "성과",
    "growth", "optimize", "improvement",
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
    # 기존보다 현실적인 컷으로 완화
    if score >= 80:
        return "A"
    if score >= 65:
        return "B"
    if score >= 50:
        return "C"
    return "D"


def _support_recommendation_from_score(score: int) -> str:
    if score >= 75:
        return "적극 지원 추천"
    if score >= 55:
        return "보완 후 지원"
    return "경험 보강 필요"


async def run_match_chain(
    job_posting: str,
    activities: list[dict],
    profile_context: dict | None = None,
) -> dict:
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

    # 공고-지원자 키워드 일치가 충분할 때 체감 보정
    norm_job_cnt = max(6, min(20, len(job_keywords)))
    match_ratio = len(matched_keywords) / norm_job_cnt
    score_bonus = 0
    if match_ratio >= 0.45:
        score_bonus += 8
    elif match_ratio >= 0.30:
        score_bonus += 5
    elif match_ratio >= 0.20:
        score_bonus += 3
    if any(s > 0 for _, s in activity_scores[:3]):
        score_bonus += 2

    total_score = min(100, total_score + score_bonus)
    grade = _overall_grade(total_score)
    support_recommendation = _support_recommendation_from_score(total_score)

    detailed_scores = [
        {
            "key": key,
            "label": item["label"],
            "score": item["score"],
            "max_score": item["max_score"],
            "grade": _grade_from_ratio(item["score"], item["max_score"]),
            "reason": item["reason"],
        }
        for key, item in axis_scores.items()
    ]

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

    strengths = llm_result.get("strengths") or _default_strengths(matched_keywords, recommended_activities)
    gaps = llm_result.get("gaps") or _default_gaps(missing_keywords)
    resume_tips = llm_result.get("resume_tips") or _default_resume_tips()
    highlight_keywords = llm_result.get("highlight_keywords") or matched_keywords[:5]
    summary_text = _normalize_summary_text(
        str(llm_result.get("summary") or _default_summary(total_score, strengths[:2], gaps[:2]))
    )

    return {
        "total_score": total_score,
        "grade": grade,
        "summary": summary_text,
        "support_recommendation": llm_result.get("support_recommendation") or support_recommendation,
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
            "score_bonus": score_bonus,
        },
    }


def _extract_keywords(text: str) -> set[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]{1,}|[가-힣]{2,}", text or "")
    normalized = [token.strip().lower() for token in tokens]
    filtered = [t for t in normalized if t not in _STOPWORDS and len(t) >= 2]
    freq = Counter(filtered)
    return {token for token, _ in freq.most_common(50)}


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
    normalized_job_count = max(6, min(20, job_count))

    combined_overlap = len(job_keywords.intersection(profile_keywords.union(activity_keywords)))
    job_fit_ratio = combined_overlap / normalized_job_count
    job_fit_score = min(25, int(round(job_fit_ratio * 25)))
    if combined_overlap >= 3:
        job_fit_score = max(job_fit_score, 12)
    if combined_overlap >= 5:
        job_fit_score = max(job_fit_score, 15)

    core_skill_overlap = len(job_keywords.intersection(profile_keywords))
    core_skill_ratio = core_skill_overlap / max(5, min(15, job_count))
    core_skill_score = min(20, int(round(core_skill_ratio * 20)))
    if core_skill_overlap >= 2:
        core_skill_score = max(core_skill_score, 8)
    if core_skill_overlap >= 4:
        core_skill_score = max(core_skill_score, 12)

    top_overlap = activity_scores[0][1] if activity_scores else 0
    project_ratio = min(1.0, top_overlap / 5)
    project_score = min(20, int(round(project_ratio * 20)))
    if top_overlap >= 2:
        project_score = max(project_score, 10)

    quantified_pattern = re.compile(r"\d+[\d,.%]*")
    impact_hits = 0
    for activity in activities:
        blob = f"{activity.get('title', '')} {activity.get('description', '')}"
        if quantified_pattern.search(blob):
            impact_hits += 1
    impact_score = min(15, impact_hits * 4 + (1 if impact_hits > 0 else 0))

    profile_blob = json.dumps(profile_context, ensure_ascii=False)
    activity_blob = " ".join(f"{a.get('title', '')} {a.get('description', '')}" for a in activities)
    expression_text = f"{profile_blob} {activity_blob}".lower()
    expression_hits = sum(1 for token in _EXPRESSION_TOKENS if token.lower() in expression_text)
    expression_score = min(10, expression_hits * 2)
    if expression_hits >= 2:
        expression_score = max(expression_score, 6)

    combined_text = f"{job_posting} {profile_blob} {activity_blob}".lower()
    growth_signals = sum(1 for token in _GROWTH_TOKENS if token.lower() in combined_text)
    growth_score = min(10, max(5, growth_signals // 2 + 2))

    return {
        "job_fit": {
            "label": "직무 일치도",
            "score": job_fit_score,
            "max_score": 25,
            "reason": "공고 키워드와 프로필/활동의 겹침 수준을 반영했습니다.",
        },
        "core_skills": {
            "label": "핵심 기술/역량",
            "score": core_skill_score,
            "max_score": 20,
            "reason": "프로필 텍스트에 명시된 핵심 역량 일치도를 반영했습니다.",
        },
        "project_relevance": {
            "label": "프로젝트 관련성",
            "score": project_score,
            "max_score": 20,
            "reason": "상위 활동/프로젝트의 직무 연관도를 반영했습니다.",
        },
        "impact": {
            "label": "성과 및 업무 성취",
            "score": impact_score,
            "max_score": 15,
            "reason": "숫자 기반 성과 표현 여부를 기준으로 평가했습니다.",
        },
        "expression": {
            "label": "직무 표현력",
            "score": expression_score,
            "max_score": 10,
            "reason": "직무 언어(기획/분석/전략 등) 사용 정도를 반영했습니다.",
        },
        "growth": {
            "label": "학습/성장 가능성",
            "score": growth_score,
            "max_score": 10,
            "reason": "학습/개선/프로젝트 신호를 기준으로 평가했습니다.",
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


def _normalize_summary_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    if not cleaned:
        return cleaned

    cleaned = cleaned.replace("필요가 있습니다.입니다.", "필요가 있습니다.")
    cleaned = cleaned.replace("필요합니다.입니다.", "필요합니다.")
    cleaned = cleaned.replace("권장됩니다.입니다.", "권장됩니다.")
    cleaned = cleaned.replace("좋습니다.입니다.", "좋습니다.")
    cleaned = cleaned.replace("확인됩니다.이며,", "확인되며,")

    cleaned = re.sub(r"(입니다\.)\1+", r"\1", cleaned)
    cleaned = re.sub(r"(합니다\.)\1+", r"\1", cleaned)
    cleaned = re.sub(r"(입니다|합니다|됩니다)\.이며,?\s*", r"\1. ", cleaned)

    return cleaned.strip()


def _default_summary(score: int, strengths: list[str], gaps: list[str]) -> str:
    strength_text = ", ".join(strengths) if strengths else "핵심 강점이 일부 확인됩니다."
    gap_text = ", ".join(gaps) if gaps else "추가 보완 요인은 아직 없습니다."
    return f"총점 {score}점입니다. 강점은 {strength_text} 보완이 필요한 부분은 {gap_text}"


def _default_strengths(matched_keywords: list[str], recommended_activities: list[str]) -> list[str]:
    strengths: list[str] = []
    if matched_keywords:
        strengths.append(f"공고 핵심 키워드와 일치하는 요소가 있습니다: {', '.join(matched_keywords[:3])}")
    if recommended_activities:
        strengths.append("직무와 연결되는 활동 또는 프로젝트 경험이 존재합니다.")
    strengths.append("기본 프로필과 활동 정보에서 공고 관련성이 일부 확인됩니다.")
    return strengths


def _default_gaps(missing_keywords: list[str]) -> list[str]:
    if not missing_keywords:
        return ["핵심 키워드는 대부분 포함되어 있어, 문장 표현만 보완하면 됩니다."]
    return [
        f"공고 핵심 키워드 중 일부가 부족합니다: {', '.join(missing_keywords[:3])}",
        "경험을 직무 언어로 더 직접적으로 표현할 필요가 있습니다.",
        "성과 중심 문장을 추가하면 설득력이 높아집니다.",
    ]


def _default_resume_tips() -> list[str]:
    return [
        "프로젝트에서 맡은 역할과 해결한 문제를 먼저 쓰세요.",
        "가능하면 결과를 숫자나 개선 효과로 표현하세요.",
        "공고 핵심 키워드를 이력서 문장에 자연스럽게 반영하세요.",
    ]
