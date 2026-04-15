from __future__ import annotations

from rag.source_adapters.base import ApiSourceAdapter

SOURCE = ApiSourceAdapter(
    source_name="work24_common_codes",
    display_name="고용24 공통코드 OpenAPI",
    purpose="직종/분류 코드 정규화",
    key_env_name="WORK24_COMMON_CODES_AUTH_KEY",
    key_env_aliases=("공통코드",),
    auth_param_name="authKey",
    guide_url_env_name="WORK24_OPEN_API_GUIDE_URL",
)
