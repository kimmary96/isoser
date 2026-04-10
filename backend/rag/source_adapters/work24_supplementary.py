from __future__ import annotations

import json
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

import httpx

try:
    from backend.rag.runtime_config import load_backend_dotenv
    from backend.rag.source_adapters.base import ApiSourceAdapter
except ImportError:
    from rag.runtime_config import load_backend_dotenv
    from rag.source_adapters.base import ApiSourceAdapter


JOB_INFO_SOURCE = ApiSourceAdapter(
    source_name="work24_job_info",
    display_name="Work24 Job Info OpenAPI",
    purpose="Collect job names and descriptions from Work24.",
    key_env_name="WORK24_JOB_INFO_AUTH_KEY",
    auth_param_name="authKey",
    guide_url_env_name="WORK24_OPEN_API_GUIDE_URL",
)

COMMON_CODES_SOURCE = ApiSourceAdapter(
    source_name="work24_common_codes",
    display_name="Work24 Common Codes OpenAPI",
    purpose="Collect Work24 common code mappings.",
    key_env_name="WORK24_COMMON_CODES_AUTH_KEY",
    auth_param_name="authKey",
    guide_url_env_name="WORK24_OPEN_API_GUIDE_URL",
)

MAJOR_INFO_SOURCE = ApiSourceAdapter(
    source_name="work24_major_info",
    display_name="Work24 Major Info OpenAPI",
    purpose="Collect major-to-job relationship data from Work24.",
    key_env_name="WORK24_MAJOR_INFO_AUTH_KEY",
    auth_param_name="authKey",
    guide_url_env_name="WORK24_OPEN_API_GUIDE_URL",
)

SOURCE_NAME = "work24_supplementary"
SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data"
DEFAULT_OUTPUT_PATH = SEED_DIR / "work24_supplement.json"
DEFAULT_SAMPLE_DIR = SEED_DIR / "api_samples" / SOURCE_NAME

JOB_INFO_LIST_ENDPOINT_ENV = "WORK24_JOB_INFO_LIST_ENDPOINT"
JOB_INFO_DETAIL_ENDPOINT_ENV = "WORK24_JOB_INFO_DETAIL_ENDPOINT"
COMMON_CODES_ENDPOINT_ENV = "WORK24_COMMON_CODES_ENDPOINT"
MAJOR_INFO_LIST_ENDPOINT_ENV = "WORK24_MAJOR_INFO_LIST_ENDPOINT"
MAJOR_INFO_GENERAL_DETAIL_ENDPOINT_ENV = "WORK24_MAJOR_INFO_GENERAL_DETAIL_ENDPOINT"
MAJOR_INFO_SPECIAL_DETAIL_ENDPOINT_ENV = "WORK24_MAJOR_INFO_SPECIAL_DETAIL_ENDPOINT"

DEFAULT_JOB_INFO_LIST_ENDPOINT = (
    "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo212L01.do"
)
DEFAULT_JOB_INFO_DETAIL_ENDPOINT = (
    "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo212D01.do"
)
DEFAULT_COMMON_CODES_ENDPOINT = (
    "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo21L01.do"
)
DEFAULT_MAJOR_INFO_LIST_ENDPOINT = (
    "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo213L01.do"
)
DEFAULT_MAJOR_INFO_GENERAL_DETAIL_ENDPOINT = (
    "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo213D01.do"
)
DEFAULT_MAJOR_INFO_SPECIAL_DETAIL_ENDPOINT = (
    "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo213D02.do"
)

REQUEST_TIMEOUT_SECONDS = 30
REQUEST_RETRY_COUNT = 3
DETAIL_SLEEP_SECONDS = 0.1

LIST_CONTAINER_KEYS = (
    "response",
    "body",
    "result",
    "results",
    "data",
    "items",
    "item",
    "list",
)
CHILD_CONTAINER_KEYS = ("oneDepth", "twoDepth", "threeDepth", "fourDepth", "children", "childList")
CODE_KEYS = (
    "jobCd",
    "jobClcd",
    "majorCd",
    "knowSchDptId",
    "knowDptId",
    "empCurtState1Id",
    "empCurtState2Id",
    "code",
    "superCd",
)
NAME_KEYS = (
    "jobNm",
    "jobClcdNM",
    "majorNm",
    "knowDtlSchDptNm",
    "knowSchDptNm",
    "knowDptNm",
    "name",
)
COMMON_CODE_LABELS = {
    "1": "region",
    "2": "job_classification",
    "3": "license",
    "4": "industrial_complex",
    "5": "subway",
    "6": "major",
    "7": "language",
    "8": "major_series",
    "9": "strong_company",
}


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z_-]+", "_", value).strip("_")
    return slug or "sample"


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text


def _normalize_name(value: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]+", "", value.lower())


def _ensure_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _pick_first(mapping: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        text = _clean_text(mapping.get(key))
        if text:
            return text
    return ""


def _xml_to_dict(element: ElementTree.Element) -> Any:
    children = list(element)
    if not children:
        return (element.text or "").strip()
    grouped: dict[str, list[Any]] = {}
    for child in children:
        grouped.setdefault(child.tag, []).append(_xml_to_dict(child))
    return {key: values[0] if len(values) == 1 else values for key, values in grouped.items()}


def _find_first_value(value: Any, keys: tuple[str, ...]) -> Any:
    if isinstance(value, dict):
        for key in keys:
            if key in value and value[key] not in (None, "", []):
                return value[key]
        for nested in value.values():
            found = _find_first_value(nested, keys)
            if found not in (None, "", []):
                return found
    elif isinstance(value, list):
        for item in value:
            found = _find_first_value(item, keys)
            if found not in (None, "", []):
                return found
    return None


def _extract_records(value: Any, record_keys: tuple[str, ...]) -> list[dict[str, Any]]:
    if isinstance(value, list):
        rows: list[dict[str, Any]] = []
        for item in value:
            rows.extend(_extract_records(item, record_keys))
        return rows
    if not isinstance(value, dict):
        return []
    if any(key in value for key in record_keys):
        return [value]
    for key in LIST_CONTAINER_KEYS:
        nested = value.get(key)
        if nested is None:
            continue
        rows = _extract_records(nested, record_keys)
        if rows:
            return rows
    rows: list[dict[str, Any]] = []
    for nested in value.values():
        rows.extend(_extract_records(nested, record_keys))
    return rows


def _extract_major_refs(value: Any) -> list[dict[str, str]]:
    rows = _extract_records(value, ("majorCd", "majorNm"))
    results: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        major_code = _pick_first(row, ("majorCd",))
        major_name = _pick_first(row, ("majorNm",))
        if not major_code and not major_name:
            continue
        key = (major_code, major_name)
        if key in seen:
            continue
        seen.add(key)
        results.append({"major_id": major_code, "major_name": major_name})
    return results


def _extract_named_strings(value: Any, record_keys: tuple[str, ...], target_keys: tuple[str, ...]) -> list[str]:
    results: list[str] = []
    seen: set[str] = set()
    for row in _extract_records(value, record_keys):
        text = _pick_first(row, target_keys)
        if not text or text in seen:
            continue
        seen.add(text)
        results.append(text)
    return results


class Work24SupplementaryAdapter:
    """Collect Work24 supplementary datasets and join them by job_code."""

    def __init__(
        self,
        *,
        job_info_list_endpoint: str | None = None,
        job_info_detail_endpoint: str | None = None,
        common_codes_endpoint: str | None = None,
        major_info_list_endpoint: str | None = None,
        major_info_general_detail_endpoint: str | None = None,
        major_info_special_detail_endpoint: str | None = None,
        output_path: Path | None = None,
        sample_dir: Path | None = None,
        timeout_seconds: int = REQUEST_TIMEOUT_SECONDS,
        retry_count: int = REQUEST_RETRY_COUNT,
        detail_sleep_seconds: float = DETAIL_SLEEP_SECONDS,
        client: httpx.Client | None = None,
    ) -> None:
        load_backend_dotenv()
        self.job_info_list_endpoint = (
            job_info_list_endpoint
            or os.getenv(JOB_INFO_LIST_ENDPOINT_ENV, "").strip()
            or DEFAULT_JOB_INFO_LIST_ENDPOINT
        )
        self.job_info_detail_endpoint = (
            job_info_detail_endpoint
            or os.getenv(JOB_INFO_DETAIL_ENDPOINT_ENV, "").strip()
            or DEFAULT_JOB_INFO_DETAIL_ENDPOINT
        )
        self.common_codes_endpoint = (
            common_codes_endpoint
            or os.getenv(COMMON_CODES_ENDPOINT_ENV, "").strip()
            or DEFAULT_COMMON_CODES_ENDPOINT
        )
        self.major_info_list_endpoint = (
            major_info_list_endpoint
            or os.getenv(MAJOR_INFO_LIST_ENDPOINT_ENV, "").strip()
            or DEFAULT_MAJOR_INFO_LIST_ENDPOINT
        )
        self.major_info_general_detail_endpoint = (
            major_info_general_detail_endpoint
            or os.getenv(MAJOR_INFO_GENERAL_DETAIL_ENDPOINT_ENV, "").strip()
            or DEFAULT_MAJOR_INFO_GENERAL_DETAIL_ENDPOINT
        )
        self.major_info_special_detail_endpoint = (
            major_info_special_detail_endpoint
            or os.getenv(MAJOR_INFO_SPECIAL_DETAIL_ENDPOINT_ENV, "").strip()
            or DEFAULT_MAJOR_INFO_SPECIAL_DETAIL_ENDPOINT
        )
        self.output_path = output_path or DEFAULT_OUTPUT_PATH
        self.sample_dir = sample_dir or DEFAULT_SAMPLE_DIR
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.detail_sleep_seconds = detail_sleep_seconds
        self.client = client or httpx.Client(timeout=self.timeout_seconds)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.sample_dir.mkdir(parents=True, exist_ok=True)
        self.saved_samples: list[str] = []
        self.failures: list[dict[str, str]] = []

    def _record_failure(self, code: str, stage: str, error: Exception | str) -> None:
        self.failures.append({"code": code, "stage": stage, "error": str(error)})

    def _save_api_sample(self, sample_name: str, payload: Any) -> None:
        sample_path = self.sample_dir / f"{_safe_slug(sample_name)}.json"
        sample_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        saved = str(sample_path)
        if saved not in self.saved_samples:
            self.saved_samples.append(saved)

    def _parse_response_payload(self, response: httpx.Response) -> Any:
        content_type = response.headers.get("content-type", "").lower()
        if "xml" in content_type or response.text.lstrip().startswith("<"):
            return _xml_to_dict(ElementTree.fromstring(response.text))
        if "json" in content_type:
            return response.json()
        try:
            return response.json()
        except Exception:
            return {"raw_text": response.text}

    def _request_payload(
        self,
        endpoint_url: str,
        *,
        source: ApiSourceAdapter,
        params: dict[str, Any],
        sample_name: str,
    ) -> Any:
        last_error: Exception | None = None
        for attempt in range(1, self.retry_count + 1):
            try:
                request_params = {
                    key: str(value)
                    for key, value in params.items()
                    if value not in (None, "")
                }
                request_params[source.auth_param_name] = source.get_api_key()
                response = self.client.get(endpoint_url, params=request_params)
                response.raise_for_status()
                payload = self._parse_response_payload(response)
                self._save_api_sample(sample_name, payload)
                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.retry_count:
                    time.sleep(min(0.5 * attempt, 2.0))
        raise RuntimeError(f"{sample_name} request failed after {self.retry_count} retries") from last_error

    def fetch_job_info(self) -> list[dict[str, Any]]:
        payload = self._request_payload(
            self.job_info_list_endpoint,
            source=JOB_INFO_SOURCE,
            params={"returnType": "XML", "target": "JOBCD"},
            sample_name="job_info_list",
        )
        list_rows = _extract_records(payload, ("jobCd", "jobNm", "jobClcd", "jobClcdNM"))
        results: list[dict[str, Any]] = []
        for row in list_rows:
            job_code = _pick_first(row, ("jobCd",))
            if not job_code:
                continue
            detail = self._request_payload(
                self.job_info_detail_endpoint,
                source=JOB_INFO_SOURCE,
                params={
                    "returnType": "XML",
                    "target": "JOBDTL",
                    "jobGb": "1",
                    "jobCd": job_code,
                    "dtlGb": "1",
                },
                sample_name=f"job_info_detail_{job_code}",
            )
            summary_row: dict[str, Any] = {}
            raw_summary = _find_first_value(detail, ("jobSum",))
            if isinstance(raw_summary, dict):
                summary_row = raw_summary
            else:
                summary = _extract_records(detail, ("jobCd", "jobSum", "way", "jobLrclNm")) or [{}]
                summary_row = summary[0] if isinstance(summary[0], dict) else {}
            results.append(
                {
                    "job_code": job_code,
                    "job_name": _pick_first(row, ("jobNm",)) or _pick_first(summary_row, ("jobNm",)),
                    "job_class_code": _pick_first(row, ("jobClcd",)),
                    "job_class_name": _pick_first(row, ("jobClcdNM",)),
                    "large_class_name": _pick_first(summary_row, ("jobLrclNm",)),
                    "middle_class_name": _pick_first(summary_row, ("jobMdclNm",)),
                    "small_class_name": _pick_first(summary_row, ("jobSmclNm",)),
                    "description": _pick_first(summary_row, ("jobSum",)),
                    "career_path": _pick_first(summary_row, ("way",)),
                    "related_major_refs": _extract_major_refs(_find_first_value(detail, ("relMajorList",))),
                    "source_ref": f"{JOB_INFO_SOURCE.source_name}:{job_code}",
                }
            )
            time.sleep(self.detail_sleep_seconds)
        return results

    def fetch_common_codes(self) -> dict[str, Any]:
        def flatten_nodes(value: Any, *, dtl_gb: str, label: str, parent_code: str = "", depth: int = 1) -> list[dict[str, str]]:
            if isinstance(value, list):
                rows: list[dict[str, str]] = []
                for item in value:
                    rows.extend(flatten_nodes(item, dtl_gb=dtl_gb, label=label, parent_code=parent_code, depth=depth))
                return rows
            if not isinstance(value, dict):
                return []
            rows: list[dict[str, str]] = []
            code = _pick_first(value, CODE_KEYS)
            name = _pick_first(value, NAME_KEYS)
            current_parent = _pick_first(value, ("superCd",)) or parent_code
            next_parent = parent_code
            next_depth = depth
            if code and name:
                rows.append(
                    {
                        "dtl_gb": dtl_gb,
                        "label": label,
                        "code": code,
                        "name": name,
                        "super_code": current_parent,
                        "depth": str(depth),
                    }
                )
                next_parent = code
                next_depth = depth + 1
            for key in CHILD_CONTAINER_KEYS:
                if key in value:
                    rows.extend(
                        flatten_nodes(value[key], dtl_gb=dtl_gb, label=label, parent_code=next_parent, depth=next_depth)
                    )
            if not rows:
                for nested in value.values():
                    if isinstance(nested, (dict, list)):
                        rows.extend(
                            flatten_nodes(nested, dtl_gb=dtl_gb, label=label, parent_code=parent_code, depth=depth)
                        )
            return rows

        records: list[dict[str, str]] = []
        by_dtl_gb: dict[str, list[dict[str, str]]] = {}
        for dtl_gb, label in COMMON_CODE_LABELS.items():
            payload = self._request_payload(
                self.common_codes_endpoint,
                source=COMMON_CODES_SOURCE,
                params={"returnType": "XML", "target": "CMCD", "dtlGb": dtl_gb},
                sample_name=f"common_codes_{dtl_gb}",
            )
            flattened = flatten_nodes(payload, dtl_gb=dtl_gb, label=label)
            deduped: list[dict[str, str]] = []
            seen: set[tuple[str, str, str]] = set()
            for row in flattened:
                key = (row["dtl_gb"], row["code"], row["name"])
                if key in seen:
                    continue
                seen.add(key)
                deduped.append(row)
                records.append(row)
            by_dtl_gb[dtl_gb] = deduped
        return {"records": records, "by_dtl_gb": by_dtl_gb}

    def fetch_major_info(self) -> list[dict[str, Any]]:
        payload = self._request_payload(
            self.major_info_list_endpoint,
            source=MAJOR_INFO_SOURCE,
            params={"returnType": "XML", "target": "MAJORCD", "srchType": "A", "keyword": ""},
            sample_name="major_info_list",
        )
        list_rows = _extract_records(payload, ("empCurtState1Id", "empCurtState2Id", "knowDtlSchDptNm"))
        results: list[dict[str, Any]] = []
        for row in list_rows:
            major_gb = _pick_first(row, ("majorGb",)) or "1"
            series_id = _pick_first(row, ("empCurtState1Id",))
            major_id = _pick_first(row, ("empCurtState2Id",))
            if not series_id or not major_id:
                continue
            detail = self._request_payload(
                self.major_info_general_detail_endpoint if major_gb == "1" else self.major_info_special_detail_endpoint,
                source=MAJOR_INFO_SOURCE,
                params={
                    "returnType": "XML",
                    "target": "MAJORDTL",
                    "majorGb": major_gb,
                    "empCurtState1Id": series_id,
                    "empCurtState2Id": major_id,
                },
                sample_name=f"major_info_detail_{major_gb}_{series_id}_{major_id}",
            )
            summary = _extract_records(detail, ("knowDptNm", "schDptIntroSum", "knowSchDptId")) or [{}]
            summary_row = summary[0]
            results.append(
                {
                    "major_gb": major_gb,
                    "series_id": series_id,
                    "major_id": major_id,
                    "series_name": _pick_first(row, ("knowSchDptNm",)) or _pick_first(summary_row, ("knowSchDptNm",)),
                    "major_name": _pick_first(row, ("knowDtlSchDptNm",)) or _pick_first(summary_row, ("knowDptNm",)),
                    "intro_summary": _pick_first(summary_row, ("schDptIntroSum",)),
                    "aptitude_interest": _pick_first(summary_row, ("aptdIntrstCont",)),
                    "what_study": _pick_first(summary_row, ("whatStudy",)),
                    "how_prepare": _pick_first(summary_row, ("howPrepare",)),
                    "job_prospect": _pick_first(summary_row, ("jobPropect", "jobProspect")),
                    "related_job_names": _extract_named_strings(
                        _find_first_value(detail, ("relAdvanJobsList",)),
                        ("knowJobNm",),
                        ("knowJobNm",),
                    ),
                    "source_ref": f"{MAJOR_INFO_SOURCE.source_name}:{major_gb}:{series_id}:{major_id}",
                }
            )
            time.sleep(self.detail_sleep_seconds)
        return results

    def build_supplement(self) -> dict[str, Any]:
        job_items = self.fetch_job_info()
        common_codes = self.fetch_common_codes()
        major_items = self.fetch_major_info()

        job_name_index: dict[str, list[str]] = defaultdict(list)
        for job in job_items:
            normalized = _normalize_name(job.get("job_name", ""))
            job_code = job.get("job_code", "").strip()
            if normalized and job_code:
                job_name_index[normalized].append(job_code)

        job_class_map = {
            row["code"]: row
            for row in common_codes["by_dtl_gb"].get("2", [])
            if row.get("code")
        }
        major_series_map = {
            row["code"]: row
            for row in common_codes["by_dtl_gb"].get("8", [])
            if row.get("code")
        }
        major_by_id = {
            item["major_id"]: item
            for item in major_items
            if item.get("major_id")
        }

        majors_by_job_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for major in major_items:
            linked_codes: set[str] = set()
            for related_job_name in major.get("related_job_names", []):
                linked_codes.update(job_name_index.get(_normalize_name(related_job_name), []))
            for job_code in linked_codes:
                majors_by_job_code[job_code].append(major)

        items: list[dict[str, Any]] = []
        for job in job_items:
            job_code = job.get("job_code", "").strip()
            if not job_code:
                continue

            related_majors: list[dict[str, Any]] = []
            seen_major_ids: set[str] = set()
            for ref in job.get("related_major_refs", []):
                major_id = ref.get("major_id", "").strip()
                enriched = dict(major_by_id.get(major_id, {}))
                if not enriched:
                    enriched = {
                        "major_id": major_id,
                        "major_name": ref.get("major_name", ""),
                        "series_id": "",
                        "series_name": "",
                        "major_gb": "",
                        "intro_summary": "",
                        "aptitude_interest": "",
                        "what_study": "",
                        "how_prepare": "",
                        "job_prospect": "",
                        "related_job_names": [],
                        "source_ref": "",
                    }
                if enriched.get("series_id"):
                    series_row = major_series_map.get(enriched["series_id"], {})
                    enriched["series_code_name"] = series_row.get("name", "")
                major_key = enriched.get("major_id", "") or enriched.get("major_name", "")
                if major_key and major_key not in seen_major_ids:
                    seen_major_ids.add(major_key)
                    related_majors.append(enriched)

            for major in majors_by_job_code.get(job_code, []):
                major_key = major.get("major_id", "") or major.get("major_name", "")
                if not major_key or major_key in seen_major_ids:
                    continue
                seen_major_ids.add(major_key)
                enriched = dict(major)
                if enriched.get("series_id"):
                    series_row = major_series_map.get(enriched["series_id"], {})
                    enriched["series_code_name"] = series_row.get("name", "")
                related_majors.append(enriched)

            job_classification = {
                "code": job.get("job_class_code", ""),
                "name": job.get("job_class_name", ""),
                "large_name": job.get("large_class_name", ""),
                "middle_name": job.get("middle_class_name", ""),
                "small_name": job.get("small_class_name", ""),
            }
            mapped = job_class_map.get(job_classification["code"], {})
            if mapped:
                job_classification["common_code_name"] = mapped.get("name", "")
                job_classification["common_code_super"] = mapped.get("super_code", "")

            items.append(
                {
                    "job_code": job_code,
                    "job_name": job.get("job_name", ""),
                    "description": job.get("description", ""),
                    "career_path": job.get("career_path", ""),
                    "job_classification": job_classification,
                    "related_majors": related_majors,
                    "source_refs": [
                        job.get("source_ref", ""),
                        JOB_INFO_SOURCE.get_guide_url() or "",
                        COMMON_CODES_SOURCE.get_guide_url() or "",
                        MAJOR_INFO_SOURCE.get_guide_url() or "",
                    ],
                }
            )

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": SOURCE_NAME,
            "guide_urls": {
                "job_info": JOB_INFO_SOURCE.get_guide_url(),
                "common_codes": COMMON_CODES_SOURCE.get_guide_url(),
                "major_info": MAJOR_INFO_SOURCE.get_guide_url(),
            },
            "job_count": len(job_items),
            "common_code_count": len(common_codes["records"]),
            "major_count": len(major_items),
            "supplement_count": len(items),
            "failed_count": len(self.failures),
            "sample_files": self.saved_samples,
            "failed_items": self.failures,
            "items": items,
        }

    def save_to_json(
        self,
        payload: dict[str, Any] | None = None,
        output_path: Path | None = None,
    ) -> Path:
        data = payload if payload is not None else self.build_supplement()
        target_path = output_path or self.output_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return target_path


def main() -> None:
    adapter = Work24SupplementaryAdapter()
    payload = adapter.build_supplement()
    output_path = adapter.save_to_json(payload)
    print(f"[work24_supplementary] supplement items: {payload['supplement_count']}")
    print(f"[work24_supplementary] failures: {payload['failed_count']}")
    print(f"[work24_supplementary] wrote: {output_path}")


if __name__ == "__main__":
    main()
