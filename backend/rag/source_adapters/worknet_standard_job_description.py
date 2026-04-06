from __future__ import annotations

from rag.source_adapters.base import ApiSourceAdapter

SOURCE = ApiSourceAdapter(
    source_name="worknet_standard_job_description",
    display_name="워크넷 표준직무기술서 API",
    purpose="직무 설명/능력단위 기반 프로파일 보강",
    key_env_name="WORKNET_STANDARD_JOB_DESCRIPTION_API_KEY",
    auth_param_name="serviceKey",
    guide_url_env_name="WORKNET_STANDARD_JOB_DESCRIPTION_API_URL",
    supports_infuser_header=True,
)
