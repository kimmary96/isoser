from __future__ import annotations

from rag.source_adapters.ncs_reference import SOURCE as NCS_REFERENCE_SOURCE
from rag.source_adapters.ncs_resources import SOURCE as NCS_RESOURCES_SOURCE
from rag.source_adapters.work24_common_codes import SOURCE as WORK24_COMMON_CODES_SOURCE
from rag.source_adapters.work24_job_support import SOURCE as WORK24_JOB_SUPPORT_SOURCE
from rag.source_adapters.work24_job_duty import SOURCE as WORK24_JOB_DUTY_SOURCE
from rag.source_adapters.work24_job_info import SOURCE as WORK24_JOB_INFO_SOURCE
from rag.source_adapters.work24_major_info import SOURCE as WORK24_MAJOR_INFO_SOURCE
from rag.source_adapters.work24_training import SOURCE as WORK24_TRAINING_SOURCE
from rag.source_adapters.worknet_standard_job_description import (
    SOURCE as WORKNET_STANDARD_JOB_DESCRIPTION_SOURCE,
)

ALL_API_SOURCES = [
    WORK24_MAJOR_INFO_SOURCE,
    WORK24_JOB_DUTY_SOURCE,
    WORK24_COMMON_CODES_SOURCE,
    WORK24_JOB_INFO_SOURCE,
    WORK24_TRAINING_SOURCE,
    WORK24_JOB_SUPPORT_SOURCE,
    WORKNET_STANDARD_JOB_DESCRIPTION_SOURCE,
    NCS_REFERENCE_SOURCE,
    NCS_RESOURCES_SOURCE,
]
