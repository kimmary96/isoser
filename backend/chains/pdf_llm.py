# Gemini PDF parsing client - API key rotation and model invocation
import os
import re
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

_GEMINI_API_KEY_ENV_NAMES = (
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY_FALLBACK",
    "GEMINI_API_KEY_FALLBACK",
)
_GEMINI_API_KEYS_ENV_NAMES = ("GOOGLE_API_KEYS", "GEMINI_API_KEYS")

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

async def invoke_parse_llm(text: str) -> Any:
    prompt = _PARSE_PROMPT.format(text=text[:8000])
    last_error: Exception | None = None

    for _, api_key in _iter_gemini_api_keys():
        try:
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=api_key,
            )
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            return response.content
        except Exception as exc:
            last_error = exc
            continue

    if last_error is not None:
        raise RuntimeError(f"AI 파싱 호출 실패: {str(last_error)}") from last_error
    raise RuntimeError("AI 파싱 호출 실패: Gemini API 키가 설정되지 않았습니다.")


def _iter_gemini_api_keys() -> list[tuple[str, str]]:
    keys: list[tuple[str, str]] = []
    seen: set[str] = set()

    for env_name in _GEMINI_API_KEY_ENV_NAMES:
        api_key = os.getenv(env_name, "").strip()
        if api_key and api_key not in seen:
            keys.append((env_name, api_key))
            seen.add(api_key)

    for env_name in _GEMINI_API_KEYS_ENV_NAMES:
        for idx, api_key in enumerate(_split_env_list(os.getenv(env_name, "")), start=1):
            if api_key and api_key not in seen:
                keys.append((f"{env_name}[{idx}]", api_key))
                seen.add(api_key)

    return keys


def _split_env_list(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"[,;\n]", value) if item.strip()]


