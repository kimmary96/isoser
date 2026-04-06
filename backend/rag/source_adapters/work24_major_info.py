from __future__ import annotations

from rag.source_adapters.base import ApiSourceAdapter

SOURCE = ApiSourceAdapter(
    source_name="work24_major_info",
    display_name="고용24 학과정보 OpenAPI",
    purpose="학과명/학과 상세와 직무 연계 보강",
    key_env_name="WORK24_MAJOR_INFO_AUTH_KEY",
    auth_param_name="authKey",
    guide_url_env_name="WORK24_OPEN_API_GUIDE_URL",
)
