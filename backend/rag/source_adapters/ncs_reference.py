from __future__ import annotations

import json
import os
import re
import time
from collections import Counter
from datetime import UTC, datetime
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


SOURCE = ApiSourceAdapter(
    source_name="ncs_reference",
    display_name="NCS 기준정보 조회 API",
    purpose="NCS 분류 체계와 능력단위 기반 taxonomy 보강",
    key_env_name="NCS_REFERENCE_API_KEY",
    auth_param_name="serviceKey",
    guide_url_env_name="NCS_REFERENCE_API_URL",
)

RESOURCE_SOURCE = ApiSourceAdapter(
    source_name="ncs_resources",
    display_name="NCS 활용자료 API",
    purpose="직무기술내용, 경력개발경로, 직무숙련기간 보강",
    key_env_name="NCS_RESOURCE_API_KEY",
    auth_param_name="ServiceKey",
    guide_url_env_name="NCS_RESOURCE_API_URL",
)

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data"
DEFAULT_SUPPLEMENT_PATH = SEED_DIR / "ncs_taxonomy_supplement.json"
DEFAULT_SAMPLE_DIR = SEED_DIR / "api_samples" / "ncs_reference"

REQUEST_RETRY_COUNT = 3
REQUEST_TIMEOUT_SECONDS = 30
PAGE_SIZE = 500
DEFAULT_REFERENCE_BASE_URL = "https://apis.data.go.kr/B490007/hrdkapi"
DEFAULT_RESOURCE_ENDPOINT = "http://apis.data.go.kr/B490007/ncsUsage/openapi17"
REFERENCE_BASE_URL_ENV = "NCS_REFERENCE_BASE_URL"
RESOURCE_ENDPOINT_ENV = "NCS_REFERENCE_JOB_DESCRIPTIONS_ENDPOINT"

REFERENCE_OPERATIONS = {
    "large": "NCS001",
    "middle": "NCS002",
    "small": "NCS003",
    "sub": "NCS004",
    "unit": "NCS005",
}

LIST_CONTAINER_KEYS = (
    "item",
    "items",
    "data",
    "list",
    "result",
    "results",
    "body",
    "response",
)

KEYWORD_STOPWORDS = {
    "관련",
    "직무",
    "업무",
    "수행",
    "관리",
    "이해",
    "활용",
    "기반",
    "통한",
    "위한",
    "능력",
    "단위",
    "요소",
    "처리",
    "운영",
    "개발",
    "구현",
    "설계",
    "분석",
    "적용",
}


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", value).strip("_")
    return slug or "sample"


def _pick_first(mapping: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = mapping.get(key)
        if value is None:
            continue
        text = str(value).strip()
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

    payload: dict[str, Any] = {}
    for key, values in grouped.items():
        payload[key] = values[0] if len(values) == 1 else values
    return payload


def _iter_dict_items(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        items: list[dict[str, Any]] = []
        for entry in value:
            items.extend(_iter_dict_items(entry))
        return items

    if not isinstance(value, dict):
        return []

    if any(isinstance(raw, (str, int, float)) for raw in value.values()):
        has_ncs_marker = any(
            key in value
            for key in (
                "NCS_LCLAS_CD",
                "NCS_MCLAS_CD",
                "NCS_SCLAS_CD",
                "NCS_SUBD_CD",
                "NCS_CL_CD",
                "ncsLclasCd",
                "ncsMclasCd",
                "ncsSclasCd",
                "ncsSubdCd",
                "ncsClCd",
            )
        )
        if has_ncs_marker:
            return [value]

    for key in LIST_CONTAINER_KEYS:
        nested = value.get(key)
        if nested is None:
            continue
        items = _iter_dict_items(nested)
        if items:
            return items

    items: list[dict[str, Any]] = []
    for nested in value.values():
        items.extend(_iter_dict_items(nested))
    return items


class NCSReferenceAdapter:
    """Fetch and normalize NCS reference and usage data into a supplement file."""

    def __init__(
        self,
        *,
        reference_base_url: str | None = None,
        resource_endpoint: str | None = None,
        sample_dir: Path | None = None,
        output_path: Path | None = None,
        timeout_seconds: int = REQUEST_TIMEOUT_SECONDS,
        retry_count: int = REQUEST_RETRY_COUNT,
        page_size: int = PAGE_SIZE,
        client: httpx.Client | None = None,
    ) -> None:
        load_backend_dotenv()
        self.reference_base_url = (
            reference_base_url
            or ""
        ).strip() or (
            os.getenv(REFERENCE_BASE_URL_ENV, "").strip()
            or DEFAULT_REFERENCE_BASE_URL
        ).rstrip("/")
        self.resource_endpoint = (
            (resource_endpoint or "").strip()
            or os.getenv(RESOURCE_ENDPOINT_ENV, "").strip()
            or DEFAULT_RESOURCE_ENDPOINT
        )
        self.sample_dir = sample_dir or DEFAULT_SAMPLE_DIR
        self.output_path = output_path or DEFAULT_SUPPLEMENT_PATH
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.page_size = page_size
        self.client = client or httpx.Client(timeout=self.timeout_seconds)
        self.sample_dir.mkdir(parents=True, exist_ok=True)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)

        self.saved_samples: list[str] = []
        self.failures: list[dict[str, str]] = []
        self._classification_cache: list[dict[str, Any]] | None = None
        self._classification_index: dict[str, dict[str, Any]] = {}
        self._ability_unit_cache: dict[str, list[dict[str, Any]]] = {}
        self._resource_cache: dict[str, list[dict[str, Any]]] = {}

    def _record_failure(self, ncs_code: str, stage: str, error: Exception | str) -> None:
        self.failures.append(
            {
                "ncs_code": ncs_code,
                "stage": stage,
                "error": str(error),
            }
        )

    def _parse_response_payload(self, response: httpx.Response) -> Any:
        content_type = response.headers.get("content-type", "").lower()

        if "json" in content_type:
            return response.json()

        if "xml" in content_type or response.text.lstrip().startswith("<"):
            root = ElementTree.fromstring(response.text)
            return _xml_to_dict(root)

        try:
            return response.json()
        except Exception:
            return {"raw_text": response.text}

    def _save_api_sample(self, sample_name: str, payload: Any) -> str:
        sample_path = self.sample_dir / f"{_safe_slug(sample_name)}.json"
        sample_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        saved = str(sample_path)
        if saved not in self.saved_samples:
            self.saved_samples.append(saved)
        return saved

    def _extract_error_message(self, payload: Any) -> str | None:
        if not isinstance(payload, dict):
            return None

        header = payload.get("response", {}).get("header", {})
        result_code = str(header.get("resultCode") or "").strip()
        result_msg = str(header.get("resultMsg") or "").strip()
        if result_code and result_code not in {"00", "000"}:
            return result_msg or result_code

        top_code = str(payload.get("code") or "").strip()
        top_message = str(payload.get("message") or "").strip()
        if top_code and top_code not in {"00", "000"}:
            return top_message or top_code

        return None

    def _extract_total_count(self, payload: Any) -> int:
        if not isinstance(payload, dict):
            return 0

        candidates = [
            payload.get("totalCount"),
            payload.get("totalCnt"),
            payload.get("totCnt"),
            payload.get("response", {}).get("body", {}).get("totalCount"),
            payload.get("response", {}).get("body", {}).get("totalCnt"),
            payload.get("response", {}).get("body", {}).get("totCnt"),
        ]
        for candidate in candidates:
            try:
                return int(candidate)
            except (TypeError, ValueError):
                continue
        return 0

    def _request_payload(
        self,
        endpoint_url: str,
        *,
        auth_param_name: str,
        api_key: str,
        params: dict[str, Any],
        sample_name: str,
    ) -> Any:
        last_error: Exception | None = None

        for attempt in range(1, self.retry_count + 1):
            try:
                response = self.client.get(
                    endpoint_url,
                    params={auth_param_name: api_key, **params},
                )
                response.raise_for_status()
                payload = self._parse_response_payload(response)
                self._save_api_sample(sample_name, payload)

                error_message = self._extract_error_message(payload)
                if error_message:
                    raise RuntimeError(error_message)

                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.retry_count:
                    time.sleep(0.5 * attempt)

        raise RuntimeError(
            f"{sample_name} request failed after {self.retry_count} retries"
        ) from last_error

    def _fetch_paginated(
        self,
        endpoint_url: str,
        *,
        auth_param_name: str,
        api_key: str,
        base_params: dict[str, Any],
        sample_prefix: str,
    ) -> list[dict[str, Any]]:
        all_items: list[dict[str, Any]] = []
        page_no = 1

        while True:
            payload = self._request_payload(
                endpoint_url,
                auth_param_name=auth_param_name,
                api_key=api_key,
                params={**base_params, "pageNo": page_no},
                sample_name=f"{sample_prefix}_page_{page_no}",
            )
            page_items = _iter_dict_items(payload)
            if not page_items:
                break

            all_items.extend(page_items)
            total_count = self._extract_total_count(payload)
            if len(page_items) < self.page_size:
                break
            if total_count and len(all_items) >= total_count:
                break
            page_no += 1

        return all_items

    def _fetch_reference_items(
        self,
        operation: str,
        *,
        params: dict[str, Any],
        sample_prefix: str,
    ) -> list[dict[str, Any]]:
        return self._fetch_paginated(
            f"{self.reference_base_url}/{operation}",
            auth_param_name=SOURCE.auth_param_name,
            api_key=SOURCE.get_api_key(),
            base_params={
                "numOfRows": self.page_size,
                "USG_YN": "Y",
                "type": "json",
                **params,
            },
            sample_prefix=sample_prefix,
        )

    def _fetch_resource_items(self, large_code: str) -> list[dict[str, Any]]:
        if large_code not in self._resource_cache:
            self._resource_cache[large_code] = self._fetch_paginated(
                self.resource_endpoint,
                auth_param_name=RESOURCE_SOURCE.auth_param_name,
                api_key=RESOURCE_SOURCE.get_api_key(),
                base_params={
                    "numOfRows": self.page_size,
                    "returnType": "json",
                    "ncsLclasCd": large_code,
                },
                sample_prefix=f"job_descriptions_{large_code}",
            )
        return list(self._resource_cache[large_code])

    @staticmethod
    def _make_tree_code(
        large_code: str,
        middle_code: str,
        small_code: str,
        sub_code: str,
    ) -> str:
        return ":".join([large_code, middle_code, small_code, sub_code])

    def _build_classification_tree(self, limit_lclas: int | None = None) -> list[dict[str, Any]]:
        """Collect the large/middle/small/sub classification tree."""

        self._classification_index = {}
        tree: list[dict[str, Any]] = []
        seen_tree_codes: set[str] = set()
        large_rows = self._fetch_reference_items(
            REFERENCE_OPERATIONS["large"],
            params={},
            sample_prefix="classification_large",
        )
        processed_large_codes = 0

        for large in large_rows:
            large_code = _pick_first(large, ("NCS_LCLAS_CD",))
            large_name = _pick_first(large, ("NCS_LCLAS_CDNM",))
            if not large_code:
                continue
            processed_large_codes += 1
            if limit_lclas is not None and processed_large_codes > limit_lclas:
                break

            try:
                middle_rows = self._fetch_reference_items(
                    REFERENCE_OPERATIONS["middle"],
                    params={"NCS_LCLAS_CD": large_code},
                    sample_prefix=f"classification_middle_{large_code}",
                )
            except Exception as exc:
                self._record_failure(large_code, "classification_middle", exc)
                print(f"[ncs_reference][warning] middle classification skipped - {large_code}: {exc}")
                continue

            for middle in middle_rows:
                middle_code = _pick_first(middle, ("NCS_MCLAS_CD",))
                middle_name = _pick_first(middle, ("NCS_MCLAS_CDNM",))
                if not middle_code:
                    continue

                try:
                    small_rows = self._fetch_reference_items(
                        REFERENCE_OPERATIONS["small"],
                        params={
                            "NCS_LCLAS_CD": large_code,
                            "NCS_MCLAS_CD": middle_code,
                        },
                        sample_prefix=f"classification_small_{large_code}_{middle_code}",
                    )
                except Exception as exc:
                    branch_code = f"{large_code}:{middle_code}"
                    self._record_failure(branch_code, "classification_small", exc)
                    print(f"[ncs_reference][warning] small classification skipped - {branch_code}: {exc}")
                    continue

                for small in small_rows:
                    small_code = _pick_first(small, ("NCS_SCLAS_CD",))
                    small_name = _pick_first(small, ("NCS_SCLAS_CDNM",))
                    if not small_code:
                        continue

                    try:
                        sub_rows = self._fetch_reference_items(
                            REFERENCE_OPERATIONS["sub"],
                            params={
                                "NCS_LCLAS_CD": large_code,
                                "NCS_MCLAS_CD": middle_code,
                                "NCS_SCLAS_CD": small_code,
                            },
                            sample_prefix=f"classification_sub_{large_code}_{middle_code}_{small_code}",
                        )
                    except Exception as exc:
                        branch_code = f"{large_code}:{middle_code}:{small_code}"
                        self._record_failure(branch_code, "classification_sub", exc)
                        print(f"[ncs_reference][warning] sub classification skipped - {branch_code}: {exc}")
                        continue

                    for sub in sub_rows:
                        sub_code = _pick_first(sub, ("NCS_SUBD_CD",))
                        sub_name = _pick_first(sub, ("NCS_SUBD_CDNM",))
                        if not sub_code:
                            continue

                        tree_code = self._make_tree_code(
                            large_code,
                            middle_code,
                            small_code,
                            sub_code,
                        )
                        if tree_code in seen_tree_codes:
                            continue
                        seen_tree_codes.add(tree_code)
                        record = {
                            "ncs_code": tree_code,
                            "ncs_name": sub_name or small_name or middle_name or large_name,
                            "large_code": large_code,
                            "large_name": large_name,
                            "middle_code": middle_code,
                            "middle_name": middle_name,
                            "small_code": small_code,
                            "small_name": small_name,
                            "sub_code": sub_code,
                            "sub_name": sub_name,
                            "job_description": _pick_first(sub, ("DUTY_DEF",)),
                            "source_ref": f"NCS_REFERENCE:{tree_code}",
                            "raw": sub,
                        }
                        tree.append(record)
                        self._classification_index[tree_code] = record

        return tree

    def fetch_classification(self, limit_lclas: int | None = None) -> list[dict[str, Any]]:
        """Collect the large/middle/small/sub classification tree."""

        if limit_lclas is None:
            if self._classification_cache is None:
                self._classification_cache = self._build_classification_tree()
            return list(self._classification_cache)

        if self._classification_cache is not None:
            selected_large_codes: list[str] = []
            for item in self._classification_cache:
                large_code = item.get("large_code", "").strip()
                if not large_code or large_code in selected_large_codes:
                    continue
                selected_large_codes.append(large_code)
                if len(selected_large_codes) >= limit_lclas:
                    break

            allowed_large_codes = set(selected_large_codes)
            return [
                item
                for item in self._classification_cache
                if item.get("large_code", "").strip() in allowed_large_codes
            ]

        return self._build_classification_tree(limit_lclas=limit_lclas)

    def fetch_ability_units(self, ncs_code: str) -> list[dict[str, Any]]:
        """Collect ability-unit rows for one sub-classification path."""

        if ncs_code in self._ability_unit_cache:
            return list(self._ability_unit_cache[ncs_code])

        classification = self._classification_index.get(ncs_code)
        if classification is None:
            self.fetch_classification()
            classification = self._classification_index.get(ncs_code)
        if classification is None:
            return []

        rows = self._fetch_reference_items(
            REFERENCE_OPERATIONS["unit"],
            params={
                "NCS_LCLAS_CD": classification["large_code"],
                "NCS_MCLAS_CD": classification["middle_code"],
                "NCS_SCLAS_CD": classification["small_code"],
                "NCS_SUBD_CD": classification["sub_code"],
            },
            sample_prefix=f"ability_units_{_safe_slug(ncs_code)}",
        )

        normalized: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row in rows:
            classification_code = _pick_first(row, ("NCS_CL_CD",))
            ability_unit_code = _pick_first(row, ("NCS_COMPE_UNIT_CD", "NCS_CL_CD"))
            ability_unit_name = _pick_first(row, ("COMPE_UNIT_NAME",))
            description = _pick_first(row, ("COMPE_UNIT_DEF",))
            if not ability_unit_name:
                continue

            dedupe_key = classification_code or ability_unit_name
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            normalized.append(
                {
                    "ncs_code": ncs_code,
                    "ncs_cl_cd": classification_code,
                    "ability_unit_code": ability_unit_code,
                    "ability_unit_name": ability_unit_name,
                    "description": description,
                    "level": _pick_first(row, ("COMPE_UNIT_LEVEL",)),
                    "source_ref": f"NCS_REFERENCE_UNIT:{classification_code or ability_unit_code}",
                    "raw": row,
                }
            )

        self._ability_unit_cache[ncs_code] = normalized
        return list(normalized)

    def fetch_job_descriptions(self, ncs_code: str) -> list[dict[str, Any]]:
        """Collect NCS usage/job-description rows for one sub-classification path."""

        classification = self._classification_index.get(ncs_code)
        if classification is None:
            self.fetch_classification()
            classification = self._classification_index.get(ncs_code)
        if classification is None:
            return []

        rows = self._fetch_resource_items(classification["large_code"])
        filtered = [
            row
            for row in rows
            if _pick_first(row, ("ncsLclasCd",)) == classification["large_code"]
            and _pick_first(row, ("ncsMclasCd",)) == classification["middle_code"]
            and _pick_first(row, ("ncsSclasCd",)) == classification["small_code"]
            and _pick_first(row, ("ncsSubdCd",)) == classification["sub_code"]
        ]

        normalized: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        duty_description = classification.get("job_description", "").strip()
        if duty_description:
            normalized.append(
                {
                    "ncs_code": ncs_code,
                    "title": classification.get("sub_name", "") or classification.get("ncs_name", ""),
                    "description": duty_description,
                    "source_ref": f"NCS_REFERENCE_DUTY:{ncs_code}",
                    "raw": classification.get("raw", {}),
                }
            )
            seen.add((normalized[0]["title"], normalized[0]["description"]))

        for row in filtered:
            title = _pick_first(row, ("compeUnitName",))
            row_ncs_cl_cd = _pick_first(row, ("ncsClCd",))
            description_parts = [
                _pick_first(row, ("relQualfMtr",)),
                _pick_first(row, ("befDutyExprc",)),
                _pick_first(row, ("dutyExperPerd",)),
                _pick_first(row, ("downUrl",)),
            ]
            description = "\n".join(part for part in description_parts if part)
            if not title or not description:
                continue

            dedupe_key = (title, description)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            normalized.append(
                {
                    "ncs_code": ncs_code,
                    "title": title,
                    "description": description,
                    "source_ref": f"NCS_RESOURCE:{row_ncs_cl_cd or title}",
                    "raw": row,
                }
            )

        return normalized

    def extract_keywords(self, ability_units: list[dict[str, Any]]) -> list[str]:
        """Extract high-signal keywords from ability-unit names and descriptions."""

        counter: Counter[str] = Counter()

        for item in ability_units:
            source_text = " ".join(
                filter(
                    None,
                    [
                        str(item.get("ability_unit_name", "")).strip(),
                        str(item.get("description", "")).strip(),
                    ],
                )
            )
            for token in re.findall(r"[A-Za-z][A-Za-z0-9+#./_-]{1,}|[가-힣]{2,}", source_text):
                normalized = token.strip().lower()
                if normalized in KEYWORD_STOPWORDS:
                    continue
                if len(normalized) < 2:
                    continue
                counter[normalized] += 1

        return [token for token, _ in counter.most_common(20)]

    def build_taxonomy_supplement(self, limit_lclas: int | None = None) -> dict[str, Any]:
        """Run the end-to-end classification -> ability-unit -> description pipeline."""

        classification_items = self.fetch_classification(limit_lclas=limit_lclas)
        total_classification_count = (
            len(self._classification_cache)
            if self._classification_cache is not None
            else None
        )

        records: list[dict[str, Any]] = []

        for item in classification_items:
            ncs_code = item.get("ncs_code", "").strip()
            if not ncs_code:
                continue

            try:
                ability_units = self.fetch_ability_units(ncs_code)
            except Exception as exc:
                self._record_failure(ncs_code, "ability_units", exc)
                print(f"[ncs_reference][warning] ability units skipped - {ncs_code}: {exc}")
                ability_units = []

            try:
                job_descriptions = self.fetch_job_descriptions(ncs_code)
            except Exception as exc:
                self._record_failure(ncs_code, "job_descriptions", exc)
                print(f"[ncs_reference][warning] job descriptions skipped - {ncs_code}: {exc}")
                job_descriptions = []

            records.append(
                {
                    "ncs_code": ncs_code,
                    "ncs_name": item.get("ncs_name", ""),
                    "classification": {
                        "large_code": item.get("large_code", ""),
                        "large_name": item.get("large_name", ""),
                        "middle_code": item.get("middle_code", ""),
                        "middle_name": item.get("middle_name", ""),
                        "small_code": item.get("small_code", ""),
                        "small_name": item.get("small_name", ""),
                        "sub_code": item.get("sub_code", ""),
                        "sub_name": item.get("sub_name", ""),
                    },
                    "ability_units": ability_units,
                    "job_descriptions": job_descriptions,
                    "keywords": self.extract_keywords(ability_units),
                    "source_ref": item.get("source_ref", f"NCS_REFERENCE:{ncs_code}"),
                }
            )

        return {
            "generated_at": datetime.now(UTC).isoformat(),
            "source": SOURCE.source_name,
            "guide_url": SOURCE.get_guide_url(),
            "resource_guide_url": RESOURCE_SOURCE.get_guide_url(),
            "classification_count": len(classification_items),
            "total_classification_count": total_classification_count,
            "limit_lclas": limit_lclas,
            "supplement_count": len(records),
            "failed_count": len(self.failures),
            "sample_files": self.saved_samples,
            "failed_items": self.failures,
            "items": records,
        }

    def save_to_file(self, payload: dict[str, Any] | None = None) -> Path:
        """Persist the supplement file to seed_data/ncs_taxonomy_supplement.json."""

        if payload is None:
            payload = self.build_taxonomy_supplement()

        self.output_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return self.output_path


def main() -> None:
    """Run the NCS supplement pipeline and write the result to disk."""

    adapter = NCSReferenceAdapter()
    payload = adapter.build_taxonomy_supplement()
    output_path = adapter.save_to_file(payload)
    print(f"[ncs_reference] classification items: {payload['classification_count']}")
    print(f"[ncs_reference] supplement items: {payload['supplement_count']}")
    print(f"[ncs_reference] failures: {payload['failed_count']}")
    print(f"[ncs_reference] wrote: {output_path}")


if __name__ == "__main__":
    main()
