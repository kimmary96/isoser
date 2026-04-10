"""역할 입력값에 맞는 기술 태그 추천 API 라우터."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter()

ROLE_SKILL_MAP_PATH = Path(__file__).resolve().parent.parent / "data" / "role_skill_map.json"


class SkillSuggestResponse(BaseModel):
    """GET /skills/suggest 응답 모델."""

    model_config = ConfigDict(str_strip_whitespace=True)

    input_role: str
    normalized_job_key: str
    display_name_ko: str
    job_family: str
    job_bucket: str
    matched_alias: str | None = None
    recommended_skill_tags: list[str] = Field(default_factory=list)
    evidence_keywords: list[str] = Field(default_factory=list)
    source_refs: list[str] = Field(default_factory=list)


@lru_cache(maxsize=1)
def _load_role_skill_map() -> dict[str, Any]:
    """기술 태그 추천용 정적 매핑 데이터를 로드한다."""

    with ROLE_SKILL_MAP_PATH.open(encoding="utf-8") as file:
        return json.load(file)


def _normalize_role_text(value: str) -> str:
    """한글/영문 역할 문자열을 비교 가능한 형태로 정규화한다."""

    return re.sub(r"[^0-9a-z가-힣]+", "", value.casefold())


def _build_effective_alias_index(
    roles: dict[str, Any], alias_index: dict[str, str]
) -> list[tuple[str, str, str]]:
    """roles와 alias_index를 합쳐 실제 비교에 사용할 인덱스를 만든다."""

    merged_alias_index: dict[str, str] = {}
    for alias, job_key in alias_index.items():
        merged_alias_index[str(alias)] = str(job_key)

    for job_key, role_entry in roles.items():
        if not isinstance(role_entry, dict):
            continue

        merged_alias_index.setdefault(str(job_key), str(job_key))

        display_name = role_entry.get("display_name_ko")
        if isinstance(display_name, str) and display_name.strip():
            merged_alias_index.setdefault(display_name, str(job_key))

        job_bucket = role_entry.get("job_bucket")
        if isinstance(job_bucket, str) and job_bucket.strip():
            merged_alias_index.setdefault(job_bucket, str(job_key))

        for alias in role_entry.get("aliases", []):
            if isinstance(alias, str) and alias.strip():
                merged_alias_index.setdefault(alias, str(job_key))

    rows: list[tuple[str, str, str]] = []
    for alias, job_key in merged_alias_index.items():
        normalized_alias = _normalize_role_text(str(alias))
        if not normalized_alias:
            continue
        rows.append((normalized_alias, str(alias), str(job_key)))

    rows.sort(key=lambda item: len(item[0]), reverse=True)
    return rows


def _resolve_role_key(
    role: str, roles: dict[str, Any], alias_index: dict[str, str]
) -> tuple[str | None, str | None]:
    """입력 역할 문자열을 role_skill_map 기준 canonical job key로 매핑한다."""

    normalized_role = _normalize_role_text(role)
    if not normalized_role:
        return None, None

    for normalized_alias, raw_alias, job_key in _build_effective_alias_index(
        roles, alias_index
    ):
        if normalized_role == normalized_alias:
            return job_key, raw_alias

    for normalized_alias, raw_alias, job_key in _build_effective_alias_index(
        roles, alias_index
    ):
        if normalized_alias in normalized_role or normalized_role in normalized_alias:
            return job_key, raw_alias

    return None, None


@router.get("/suggest", response_model=SkillSuggestResponse)
async def suggest_skills(
    role: str = Query(..., min_length=1, description="사용자가 입력한 역할 문자열"),
    limit: int | None = Query(None, ge=1, le=30, description="반환할 최대 기술 태그 수"),
):
    """역할 입력값에 맞는 기술 태그를 추천한다."""

    role_text = role.strip()
    if not role_text:
        raise HTTPException(status_code=400, detail="role을 입력해주세요.")

    try:
        payload = _load_role_skill_map()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="role_skill_map.json을 찾을 수 없습니다.") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"role_skill_map.json 파싱 실패: {exc}") from exc

    roles = payload.get("roles", {})
    alias_index = payload.get("alias_index", {})

    if not isinstance(roles, dict) or not isinstance(alias_index, dict):
        raise HTTPException(status_code=500, detail="role_skill_map.json 구조가 올바르지 않습니다.")

    job_key, matched_alias = _resolve_role_key(role_text, roles, alias_index)
    if job_key is None or job_key not in roles:
        raise HTTPException(status_code=404, detail="입력한 역할에 대한 기술 태그 추천 데이터를 찾을 수 없습니다.")

    role_entry = roles[job_key]
    if not isinstance(role_entry, dict):
        raise HTTPException(status_code=500, detail="role_skill_map.json 역할 데이터가 올바르지 않습니다.")

    default_limit = payload.get("selection_policy", {}).get("default_limit", 12)
    applied_limit = limit or int(default_limit)

    return SkillSuggestResponse.model_validate(
        {
            "input_role": role_text,
            "normalized_job_key": job_key,
            "display_name_ko": role_entry.get("display_name_ko", job_key),
            "job_family": role_entry.get("job_family", ""),
            "job_bucket": role_entry.get("job_bucket", ""),
            "matched_alias": matched_alias,
            "recommended_skill_tags": list(role_entry.get("recommended_skill_tags", []))[:applied_limit],
            "evidence_keywords": list(role_entry.get("evidence_keywords", [])),
            "source_refs": list(role_entry.get("source_refs", [])),
        }
    )
