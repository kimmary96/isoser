# LangChain PDF 파싱 체인 - PyMuPDF 텍스트 추출 후 Gemini로 구조화
import json
import os
import re
from typing import Any

import fitz  # PyMuPDF
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

# 파싱 결과 스키마 예시 (Gemini에게 출력 형식 안내)
_PARSE_PROMPT = """
다음은 이력서 텍스트입니다. 아래 JSON 형식으로 구조화해서 반환하세요.
코드 블록 없이 순수 JSON만 반환하세요.
activities[].type은 반드시 아래 4개 중 하나만 사용하세요: 회사경력, 프로젝트, 대외활동, 학생활동
activities[]에는 가능한 경우 organization, team_size, team_composition, my_role, contributions도 채우세요.

중요 규칙:
1. CAREER, WORK EXPERIENCE, EXPERIENCE, PROFESSIONAL EXPERIENCE 섹션은 모두 회사경력으로 해석하세요.
2. 회사경력은 반드시 "회사명 / 직무명 / 재직기간" 단위로 끊으세요.
3. 회사 아래에 나열된 세부 프로젝트, 출시, 운영, 캠페인, 태스크는 회사경력 자체가 아니라 별도 활동(보통 프로젝트)로 분리하세요.
4. profile.career에는 문장형 소개글을 넣지 말고, 반드시 "회사명 | 직무명 | 시작일 | 종료일" 구조만 넣으세요.
5. 회사경력 소개 문단, 경력 요약 문장, 자기 PR 문장은 profile.self_intro로 보내고 profile.career에는 넣지 마세요.
6. 회사명만 있고 역할/기간이 있으면 activities에 type=회사경력으로 넣고, title은 회사명, role은 직무명, period는 재직기간으로 채우세요.

{{
  "profile": {{
    "name": "이름",
    "email": "이메일",
    "phone": "전화번호",
    "education": "최종 학력",
    "career": ["회사명 | 직무명 | 2024.09 | 2025.12", "회사명 | 직무명 | 2021.09 | 2022.08"],
    "education_history": ["학력1", "학력2"],
    "awards": ["수상경력1"],
    "certifications": ["자격증1"],
    "languages": ["외국어1"],
    "skills": ["스킬1", "스킬2"],
    "self_intro": "자기소개 초안"
  }},
  "activities": [
    {{
      "type": "회사경력 | 프로젝트 | 대외활동 | 학생활동",
      "title": "활동명",
      "organization": "소속 조직 또는 프로젝트/회사명",
      "period": "기간 (예: 2024.01 ~ 2024.06)",
      "role": "역할",
      "team_size": 5,
      "team_composition": "PM 1 / 백엔드 2 / 프론트 1",
      "my_role": "담당 역할",
      "skills": ["기술1", "기술2"],
      "contributions": ["기여 내용1", "기여 내용2"],
      "description": "상세 설명"
    }}
  ]
}}

이력서 텍스트:
{text}
"""

_ALLOWED_ACTIVITY_TYPES = {"회사경력", "프로젝트", "대외활동", "학생활동"}
_TYPE_ALIASES = {
    "인턴": "회사경력",
    "경력": "회사경력",
    "업무경험": "회사경력",
    "직무경험": "회사경력",
    "work": "회사경력",
    "experience": "회사경력",
    "프로젝트 경험": "프로젝트",
    "project": "프로젝트",
    "활동": "대외활동",
    "동아리": "대외활동",
    "봉사": "대외활동",
    "contest": "대외활동",
    "competition": "대외활동",
    "school": "학생활동",
    "학내활동": "학생활동",
    "학술활동": "학생활동",
}
_CAREER_SECTION_HEADERS = {
    "career",
    "work experience",
    "experience",
    "professional experience",
    "employment",
    "경력",
    "경력사항",
    "재직경험",
}
_NON_CAREER_SECTION_HEADERS = {
    "education",
    "skills",
    "skill",
    "projects",
    "project",
    "awards",
    "certifications",
    "certificate",
    "languages",
    "language",
    "activities",
    "activity",
    "profile",
    "summary",
    "자기소개",
    "학력",
    "기술",
    "스킬",
    "프로젝트",
    "수상",
    "자격증",
    "외국어",
    "활동",
}
_DATE_TOKEN_RE = re.compile(r"\d{4}[./-]\d{1,2}")
_DATE_RANGE_RE = re.compile(
    r"(?P<start>\d{4}[./-]\d{1,2})\s*(?:~|–|—|-)\s*(?P<end>\d{4}[./-]\d{1,2}|현재|present|Present|PRESENT)"
)
_CAREER_LINE_RE = re.compile(
    r"^(?P<company>.+?)\s+(?P<start>\d{4}[./-]\d{1,2})\s*(?:~|–|—|-)\s*(?P<end>\d{4}[./-]\d{1,2}|현재|present|Present|PRESENT)$"
)
_ACTIVITY_HEADER_RE = re.compile(
    r"^(?P<title>.+?)\s+(?P<start>\d{4}[./-]\d{1,2})\s*(?:~|–|—|-)\s*(?P<end>\d{4}[./-]\d{1,2}|현재|present|Present|PRESENT)$"
)
_ROLE_TEAM_RE = re.compile(r"^(?P<role>.+?)\s*\((?P<size>\d+)\s*인\s*:\s*(?P<composition>.+)\)$")


async def parse_resume_pdf(pdf_bytes: bytes) -> dict:
    """
    PDF 바이너리에서 텍스트를 추출하고 Gemini로 프로필·활동 목록을 구조화한다.

    Args:
        pdf_bytes: PDF 파일 바이너리

    Returns:
        profile과 activities가 포함된 딕셔너리
    """
    text = _extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        return {"profile": {}, "activities": []}

    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=os.environ["GOOGLE_API_KEY"],
        )
        prompt = _PARSE_PROMPT.format(text=text[:8000])
        response = await llm.ainvoke([HumanMessage(content=prompt)])
    except Exception as e:
        raise RuntimeError(f"AI 파싱 호출 실패: {str(e)}") from e

    return _parse_and_normalize_result(response.content, text)


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    PyMuPDF를 사용해 PDF 바이너리에서 텍스트를 추출한다.

    Args:
        pdf_bytes: PDF 파일 바이너리

    Returns:
        추출된 텍스트 문자열
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_text = [page.get_text() for page in doc]
        return "\n".join(pages_text)
    except Exception:
        return ""


def _parse_and_normalize_result(raw_content: Any, source_text: str = "") -> dict:
    """
    LLM 응답에서 JSON을 추출하고, profile/activities 스키마로 정규화한다.

    Args:
        raw_content: LLM 응답 원본 콘텐츠

    Returns:
        profile/activities가 보장된 결과 딕셔너리
    """
    text = _extract_text_from_llm_content(raw_content).strip()
    parsed: dict[str, Any]

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        json_text = _extract_json_object(text)
        if not json_text:
            return {"profile": {}, "activities": []}
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError:
            return {"profile": {}, "activities": []}

    profile = parsed.get("profile", {}) if isinstance(parsed, dict) else {}
    activities = parsed.get("activities", []) if isinstance(parsed, dict) else []

    normalized_profile = {
        "name": str(profile.get("name", "")).strip(),
        "email": str(profile.get("email", "")).strip(),
        "phone": str(profile.get("phone", "")).strip(),
        "education": str(profile.get("education", "")).strip(),
        "career": _normalize_string_list(profile.get("career")),
        "education_history": _normalize_string_list(profile.get("education_history")),
        "awards": _normalize_string_list(profile.get("awards")),
        "certifications": _normalize_string_list(profile.get("certifications")),
        "languages": _normalize_string_list(profile.get("languages")),
        "skills": _normalize_string_list(profile.get("skills")),
        "self_intro": str(profile.get("self_intro", "")).strip(),
    }

    normalized_activities = []
    if isinstance(activities, list):
        for item in activities:
            if not isinstance(item, dict):
                continue
            normalized_activities.append(
                {
                    "type": _normalize_activity_type(item.get("type")),
                    "title": _normalize_text_field(item.get("title")),
                    "organization": _normalize_text_field(item.get("organization")),
                    "period": _normalize_period(str(item.get("period", "")).strip()),
                    "role": _normalize_text_field(item.get("role")),
                    "team_size": _normalize_optional_int(item.get("team_size")),
                    "team_composition": _normalize_text_field(item.get("team_composition")),
                    "my_role": _normalize_text_field(item.get("my_role")),
                    "skills": _normalize_skills(item.get("skills")),
                    "contributions": _normalize_string_list(item.get("contributions")),
                    "description": _normalize_text_field(item.get("description")),
                }
            )

    extracted_careers = _extract_career_entries_from_text(source_text)
    extracted_activity_details = _extract_activity_details_from_text(source_text)
    normalized_profile, normalized_activities = _postprocess_career_entries(
        normalized_profile=normalized_profile,
        normalized_activities=normalized_activities,
        extracted_careers=extracted_careers,
    )
    normalized_activities = _postprocess_activity_details(
        normalized_activities=normalized_activities,
        extracted_activity_details=extracted_activity_details,
    )

    return {
        "profile": normalized_profile,
        "activities": normalized_activities,
    }


def _extract_text_from_llm_content(raw_content: Any) -> str:
    """
    LLM 콘텐츠를 문자열로 변환한다.

    Args:
        raw_content: 문자열 또는 블록 리스트 등

    Returns:
        문자열 형태의 콘텐츠
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


def _extract_json_object(text: str) -> str:
    """
    문자열에서 JSON 객체 본문을 추출한다.

    Args:
        text: 원본 텍스트

    Returns:
        JSON 객체 문자열 또는 빈 문자열
    """
    cleaned = text.replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return ""
    return cleaned[start : end + 1]


def _normalize_activity_type(raw_type: Any) -> str:
    """
    활동 타입을 DB 제약에 맞는 4개 타입 중 하나로 정규화한다.

    Args:
        raw_type: 원본 타입 값

    Returns:
        정규화된 활동 타입
    """
    text = str(raw_type or "").strip()
    if text in _ALLOWED_ACTIVITY_TYPES:
        return text

    lowered = text.lower()
    if lowered in _TYPE_ALIASES:
        return _TYPE_ALIASES[lowered]
    if text in _TYPE_ALIASES:
        return _TYPE_ALIASES[text]

    return "프로젝트"


def _normalize_skills(raw_skills: Any) -> list[str]:
    """
    skills 필드를 문자열 리스트로 정규화한다.

    Args:
        raw_skills: 원본 skills 값

    Returns:
        스킬 문자열 리스트
    """
    if isinstance(raw_skills, list):
        return [str(skill).strip() for skill in raw_skills if str(skill).strip()]
    if isinstance(raw_skills, str):
        candidates = [part.strip() for part in raw_skills.split(",")]
        return [item for item in candidates if item]
    return []


def _normalize_string_list(value: Any) -> list[str]:
    """
    임의 입력을 문자열 배열로 정규화한다.

    Args:
        value: 리스트 또는 문자열

    Returns:
        공백 제거된 문자열 리스트
    """
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _normalize_text_field(value: Any) -> str:
    text = str(value or "").strip()
    if text.lower() in {"none", "null", "n/a", "na", "-"}:
        return ""
    return text


def _normalize_optional_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if not text:
        return None
    match = re.search(r"\d+", text)
    if not match:
        return None
    return int(match.group(0))


def _normalize_period(period: str) -> str:
    match = _DATE_RANGE_RE.search(period)
    if not match:
        return period.strip()
    return _format_period(match.group("start"), match.group("end"))


def _extract_career_entries_from_text(text: str) -> list[dict[str, str]]:
    if not text.strip():
        return []

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    entries: list[dict[str, str]] = []
    in_career_section = False
    idx = 0

    while idx < len(lines):
        line = lines[idx]
        normalized = _normalize_section_header(line)

        if normalized in _CAREER_SECTION_HEADERS:
            in_career_section = True
            idx += 1
            continue

        if in_career_section and normalized in _NON_CAREER_SECTION_HEADERS:
            in_career_section = False

        if not in_career_section:
            idx += 1
            continue

        match = _CAREER_LINE_RE.match(line)
        split_period = None if match else _extract_split_period(lines, idx)
        if match or split_period:
            if match:
                company = match.group("company").strip(" -|:")
                start = match.group("start").strip()
                end = match.group("end").strip()
                role_start_idx = idx + 1
            else:
                company = line.strip(" -|:")
                start, end = split_period or ("", "")
                role_start_idx = idx + 2
            if _looks_like_project_line(company):
                idx += 1
                continue
            role = _extract_following_role(lines, role_start_idx)
            entries.append(
                {
                    "company": company,
                    "position": role,
                    "start": start,
                    "end": end,
                }
            )
        idx += 1

    return _dedupe_career_entries(entries)


def _postprocess_career_entries(
    normalized_profile: dict[str, Any],
    normalized_activities: list[dict[str, Any]],
    extracted_careers: list[dict[str, str]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    cleaned_career = []
    carry_into_intro = []
    for item in normalized_profile.get("career", []):
        if _looks_like_structured_career(item):
            cleaned_career.append(_normalize_career_string(item))
        elif item:
            carry_into_intro.append(item)

    for entry in extracted_careers:
        cleaned_career.append(_serialize_career_entry(entry))

    normalized_profile["career"] = _dedupe_career_strings(cleaned_career)

    if carry_into_intro:
        intro_parts = [normalized_profile.get("self_intro", "").strip(), " ".join(carry_into_intro).strip()]
        normalized_profile["self_intro"] = " ".join(part for part in intro_parts if part).strip()

    for entry in extracted_careers:
        period = _format_period(entry["start"], entry["end"])
        matched = False
        for activity in normalized_activities:
            if _is_matching_career_activity(activity, entry, period):
                activity["type"] = "회사경력"
                activity["title"] = entry["company"]
                activity["role"] = entry["position"]
                activity["period"] = period
                matched = True
                break

        if not matched:
            normalized_activities.append(
                {
                    "type": "회사경력",
                    "title": entry["company"],
                    "period": period,
                    "role": entry["position"],
                    "skills": [],
                    "description": "",
                }
            )

    return normalized_profile, normalized_activities


def _extract_activity_details_from_text(text: str) -> list[dict[str, Any]]:
    if not text.strip():
        return []

    lines = [line.strip(" \t•-") for line in text.splitlines() if line.strip()]
    details: list[dict[str, Any]] = []

    for idx, line in enumerate(lines):
        if _normalize_section_header(line) in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            continue
        match = _ACTIVITY_HEADER_RE.match(line)
        split_period = None if match else _extract_split_period(lines, idx)
        if not match and not split_period:
            continue

        if match:
            title = match.group("title").strip()
            period = _format_period(match.group("start"), match.group("end"))
            role_idx = idx + 1
            bullet_idx = idx + 2
        else:
            title = line.strip()
            start, end = split_period or ("", "")
            period = _format_period(start, end)
            role_idx = idx + 2
            bullet_idx = idx + 3

        role = ""
        team_size = None
        team_composition = ""
        if role_idx < len(lines):
            role_line = lines[role_idx].strip()
            role_match = _ROLE_TEAM_RE.match(role_line)
            if role_match:
                role = role_match.group("role").strip()
                team_size = int(role_match.group("size"))
                team_composition = role_match.group("composition").strip()
            elif role_line and not _ACTIVITY_HEADER_RE.match(role_line):
                role = role_line

        details.append(
            {
                "title": title,
                "organization": _extract_organization_from_title(title),
                "period": period,
                "role": role,
                "team_size": team_size,
                "team_composition": team_composition,
                **_split_following_activity_bullets(lines, bullet_idx),
            }
        )

    return details


def _postprocess_activity_details(
    normalized_activities: list[dict[str, Any]],
    extracted_activity_details: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    for detail in extracted_activity_details:
        matched = _find_matching_activity(normalized_activities, detail["title"])
        if matched is None:
            continue

        _absorb_fragment_activities(matched, normalized_activities, detail)
        matched["period"] = _normalize_period(str(matched.get("period") or detail["period"]))
        if not matched.get("organization") or _is_generic_organization(str(matched.get("organization", ""))):
            matched["organization"] = detail["organization"]
        if not matched.get("role"):
            matched["role"] = detail["role"]
        if not matched.get("my_role"):
            matched["my_role"] = matched.get("role") or detail["role"]
        if not matched.get("team_size"):
            matched["team_size"] = detail["team_size"]
        if not matched.get("team_composition"):
            matched["team_composition"] = detail["team_composition"]
        if detail["contributions"]:
            matched["contributions"] = detail["contributions"]
        current_description = _normalize_text_field(matched.get("description"))
        contribution_keys = {normalize(item) for item in _normalize_string_list(matched.get("contributions"))}
        if detail["description"] or normalize(current_description) in contribution_keys:
            matched["description"] = detail["description"]

    for activity in normalized_activities:
        activity["description"] = _normalize_text_field(activity.get("description"))
        activity["period"] = _normalize_period(str(activity.get("period", "")))
        if not activity.get("my_role"):
            activity["my_role"] = str(activity.get("role", "")).strip()
        if not activity.get("organization"):
            activity["organization"] = _extract_organization_from_title(str(activity.get("title", "")))
        if activity.get("team_size") is not None:
            activity["team_size"] = _normalize_optional_int(activity.get("team_size"))

    return normalized_activities


def _absorb_fragment_activities(
    matched: dict[str, Any],
    activities: list[dict[str, Any]],
    detail: dict[str, Any],
) -> None:
    fragment_lines = _dedupe_string_list(
        [
            *detail.get("contributions", []),
            *[line.strip() for line in str(detail.get("description", "")).split(".") if line.strip()],
        ]
    )
    fragment_keys = {normalize(line) for line in fragment_lines if line}
    if not fragment_keys:
        return

    retained: list[dict[str, Any]] = []
    absorbed_contributions = _normalize_string_list(matched.get("contributions"))
    absorbed_description = str(matched.get("description", "")).strip()

    for activity in activities:
        if activity is matched:
            retained.append(activity)
            continue

        title_key = normalize(str(activity.get("title", "")))
        description_key = normalize(str(activity.get("description", "")))
        is_fragment = title_key in fragment_keys or description_key in fragment_keys

        if not is_fragment:
            retained.append(activity)
            continue

        title = str(activity.get("title", "")).strip()
        description = str(activity.get("description", "")).strip()
        if _looks_like_contribution_line(title):
            absorbed_contributions.append(title)
        elif title and not absorbed_description:
            absorbed_description = title
        if _looks_like_contribution_line(description):
            absorbed_contributions.append(description)
        elif description and not absorbed_description:
            absorbed_description = description

    activities[:] = retained
    matched["contributions"] = _dedupe_string_list(absorbed_contributions)
    matched["description"] = absorbed_description


def _find_matching_activity(
    activities: list[dict[str, Any]],
    title: str,
) -> dict[str, Any] | None:
    normalized_title = normalize(title)
    for activity in activities:
        candidate = normalize(str(activity.get("title", "")))
        if candidate == normalized_title or candidate in normalized_title or normalized_title in candidate:
            return activity
    return None


def _extract_organization_from_title(title: str) -> str:
    for separator in ("—", "–", "-", "|", ":"):
        if separator in title:
            return title.split(separator, 1)[0].strip()
    return title.strip()


def _is_generic_organization(value: str) -> bool:
    return normalize(value) in {"팀프로젝트", "개인프로젝트", "프로젝트"}


def _extract_split_period(lines: list[str], idx: int) -> tuple[str, str] | None:
    if idx + 1 >= len(lines):
        return None
    if _DATE_TOKEN_RE.search(lines[idx]):
        return None
    match = _DATE_RANGE_RE.search(lines[idx + 1])
    if not match:
        return None
    return match.group("start"), match.group("end")


def _extract_following_contributions(lines: list[str], start_idx: int) -> list[str]:
    contributions: list[str] = []
    idx = start_idx
    while idx < len(lines):
        candidate = lines[idx].strip(" \t•-")
        if not candidate:
            idx += 1
            continue
        if _normalize_section_header(candidate) in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            break
        if _is_activity_header_at(lines, idx):
            break
        if candidate.startswith("성과:"):
            contributions.append(candidate)
            idx += 1
            continue
        if _looks_like_contribution_line(candidate):
            contributions.append(candidate)
        idx += 1
    return _dedupe_string_list(contributions)


def _split_following_activity_bullets(lines: list[str], start_idx: int) -> dict[str, Any]:
    intro_lines: list[str] = []
    contributions: list[str] = []
    idx = start_idx

    while idx < len(lines):
        candidate = lines[idx].strip(" \t•-")
        if not candidate:
            idx += 1
            continue
        if _normalize_section_header(candidate) in _CAREER_SECTION_HEADERS | _NON_CAREER_SECTION_HEADERS:
            break
        if _is_activity_header_at(lines, idx):
            break

        if _looks_like_intro_line(candidate):
            intro_lines.append(candidate)
        elif _looks_like_contribution_line(candidate):
            contributions.append(candidate)
        idx += 1

    return {
        "description": " ".join(_dedupe_string_list(intro_lines)),
        "contributions": _dedupe_string_list(contributions),
    }


def _is_activity_header_at(lines: list[str], idx: int) -> bool:
    if idx >= len(lines):
        return False
    candidate = lines[idx].strip(" \t•-")
    return bool(_ACTIVITY_HEADER_RE.match(candidate) or _extract_split_period(lines, idx))


def _looks_like_intro_line(line: str) -> bool:
    lowered = line.lower()
    return (
        "폐업" in line
        or "권고사직" in line
        or "계약종료" in line
        or "유지보수" in line
        or "maintenance" in lowered
    )


def _looks_like_contribution_line(line: str) -> bool:
    lowered = line.lower()
    metric_patterns = (
        r"\d+\s*%",
        r"\d+\s*(?:건|명|시간|분|초|배|회|개|원|만원|억원)",
        r"\d+[,.]?\d*\s*(?:k|m|ms|s)\b",
    )
    if any(re.search(pattern, lowered) for pattern in metric_patterns):
        return True

    contribution_keywords = (
        "단축",
        "절감",
        "개선",
        "최적화",
        "튜닝",
        "성과:",
        "구축",
        "설계",
        "자동화",
        "파이프라인",
        "동기화",
        "api 개발",
        "처리",
        "완료율",
        "장애",
    )
    return any(keyword in line or keyword in lowered for keyword in contribution_keywords)


def _normalize_section_header(line: str) -> str:
    return re.sub(r"[^a-zA-Z가-힣 ]", "", line).strip().lower()


def _extract_following_role(lines: list[str], start_idx: int) -> str:
    idx = start_idx
    while idx < len(lines):
        candidate = lines[idx].strip()
        normalized = _normalize_section_header(candidate)
        if not candidate:
            idx += 1
            continue
        if normalized in _CAREER_SECTION_HEADERS or normalized in _NON_CAREER_SECTION_HEADERS:
            return ""
        if _CAREER_LINE_RE.match(candidate):
            return ""
        if _DATE_RANGE_RE.search(candidate):
            idx += 1
            continue
        if _looks_like_project_line(candidate):
            return ""
        return candidate
    return ""


def _looks_like_project_line(line: str) -> bool:
    lowered = line.lower()
    return (
        "프로젝트" in line
        or "project" in lowered
        or len(line) > 40
    )


def _looks_like_structured_career(text: str) -> bool:
    parts = [part.strip() for part in text.split("|") if part.strip()]
    if len(parts) >= 4 and _DATE_TOKEN_RE.search(parts[2]):
        return True
    if len(parts) >= 3 and _DATE_RANGE_RE.search(parts[-1]):
        return True
    return False


def _normalize_career_string(text: str) -> str:
    parts = [part.strip() for part in text.split("|") if part.strip()]
    if len(parts) >= 4:
        return _serialize_career_entry(
            {
                "company": parts[0],
                "position": parts[1],
                "start": parts[2],
                "end": parts[3],
            }
        )
    if len(parts) >= 3:
        period_match = _DATE_RANGE_RE.search(parts[2])
        if period_match:
            return _serialize_career_entry(
                {
                    "company": parts[0],
                    "position": parts[1],
                    "start": period_match.group("start"),
                    "end": period_match.group("end"),
                }
            )
    return text.strip()


def _serialize_career_entry(entry: dict[str, str]) -> str:
    return " | ".join(
        [
            entry.get("company", "").strip() or "-",
            entry.get("position", "").strip() or "-",
            entry.get("start", "").strip() or "-",
            entry.get("end", "").strip() or "-",
        ]
    )


def _format_period(start: str, end: str) -> str:
    start_text = start.strip()
    end_text = end.strip()
    if not start_text and not end_text:
        return ""
    if not end_text:
        return start_text
    return f"{start_text} ~ {end_text}"


def _is_matching_career_activity(
    activity: dict[str, Any], entry: dict[str, str], period: str
) -> bool:
    title = str(activity.get("title", "")).strip()
    role = str(activity.get("role", "")).strip()
    existing_period = str(activity.get("period", "")).strip()

    if normalize(title) == normalize(entry["company"]):
        return True

    if role and entry["position"] and normalize(role) == normalize(entry["position"]):
        if existing_period and period and existing_period == period:
            return True

    return False


def _dedupe_career_entries(entries: list[dict[str, str]]) -> list[dict[str, str]]:
    seen = set()
    result = []
    for entry in entries:
        key = (
            normalize(entry.get("company", "")),
            normalize(entry.get("position", "")),
            entry.get("start", "").strip(),
            entry.get("end", "").strip(),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(entry)
    return result


def _dedupe_career_strings(items: list[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        normalized = item.strip()
        if not normalized:
            continue

        duplicate_idx = _find_duplicate_career_string_index(result, normalized)
        if duplicate_idx is None:
            result.append(normalized)
            continue

        if len(normalized) > len(result[duplicate_idx]):
            result[duplicate_idx] = normalized

    return result


def _find_duplicate_career_string_index(items: list[str], candidate: str) -> int | None:
    candidate_parts = [part.strip() for part in candidate.split("|")]
    if len(candidate_parts) < 4:
        return None

    candidate_company, candidate_position, candidate_start, candidate_end = candidate_parts[:4]
    for idx, item in enumerate(items):
        parts = [part.strip() for part in item.split("|")]
        if len(parts) < 4:
            continue

        company, position, start, end = parts[:4]
        same_timeline = (
            normalize(position) == normalize(candidate_position)
            and start == candidate_start
            and end == candidate_end
        )
        same_company = (
            normalize(company) == normalize(candidate_company)
            or normalize(company) in normalize(candidate_company)
            or normalize(candidate_company) in normalize(company)
        )
        if same_timeline and same_company:
            return idx

    return None


def _dedupe_string_list(items: list[str]) -> list[str]:
    seen = set()
    result = []
    for item in items:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def normalize(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()
