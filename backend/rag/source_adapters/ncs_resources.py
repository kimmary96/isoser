from __future__ import annotations

try:
    from backend.rag.source_adapters.base import ApiSourceAdapter
except ImportError:
    from rag.source_adapters.base import ApiSourceAdapter


SOURCE = ApiSourceAdapter(
    source_name="ncs_resources",
    display_name="NCS 활용자료 API",
    purpose="직무기술내용, 경력개발경로, 직무숙련기간 보강",
    key_env_name="NCS_RESOURCE_API_KEY",
    auth_param_name="ServiceKey",
    guide_url_env_name="NCS_RESOURCE_API_URL",
)
