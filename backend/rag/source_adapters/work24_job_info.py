from __future__ import annotations

from rag.source_adapters.base import ApiSourceAdapter

SOURCE = ApiSourceAdapter(
    source_name="work24_job_info",
    display_name="고용24 직업정보 OpenAPI",
    purpose="직업명, 직업설명, 분류 메타데이터 보강",
    key_env_name="WORK24_JOB_INFO_AUTH_KEY",
    auth_param_name="authKey",
    guide_url_env_name="WORK24_OPEN_API_GUIDE_URL",
)
