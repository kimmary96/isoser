from __future__ import annotations

import json
import os
import re
import time
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
    source_name="work24_training",
    display_name="고용24 국민내일배움카드 훈련과정 OpenAPI",
    purpose="훈련과정 목록 수집 및 프로그램 메타데이터 정규화",
    key_env_name="WORK24_TRAINING_AUTH_KEY",
    auth_param_name="authKey",
    guide_url_env_name="WORK24_OPEN_API_GUIDE_URL",
)

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data"
DEFAULT_SAMPLE_DIR = SEED_DIR / "api_samples" / "work24_training"
DEFAULT_LIST_ENDPOINT = "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L01.do"

REQUEST_TIMEOUT_SECONDS = 30
REQUEST_RETRY_COUNT = 3
DEFAULT_PAGE_SIZE = 100
DEFAULT_SLEEP_SECONDS = 0.5

LIST_CONTAINER_KEYS = (
    "response",
    "body",
    "result",
    "results",
    "data",
    "items",
    "item",
    "list",
    "srchList",
)
TOTAL_COUNT_KEYS = ("scn_cnt", "totalCount", "totalCnt", "total_count", "total", "count")


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z_-]+", "_", value).strip("_")
    return slug or "sample"


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text


def _to_int(value: Any) -> int | None:
    text = _clean_text(value)
    if not text:
        return None
    digits = re.sub(r"[^\d-]", "", text)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


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

    payload: dict[str, Any] = {}
    for key, values in grouped.items():
        payload[key] = values[0] if len(values) == 1 else values
    return payload


def _extract_records(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        rows: list[dict[str, Any]] = []
        for item in value:
            rows.extend(_extract_records(item))
        return rows
    if not isinstance(value, dict):
        return []

    if any(
        key in value
        for key in (
            "TRPR_ID",
            "TITLE",
            "NCS_CD",
            "ADDRESS",
            "trprId",
            "title",
            "ncsCd",
            "address",
        )
    ):
        return [value]

    for key in LIST_CONTAINER_KEYS:
        nested = value.get(key)
        if nested is None:
            continue
        rows = _extract_records(nested)
        if rows:
            return rows

    rows: list[dict[str, Any]] = []
    for nested in value.values():
        rows.extend(_extract_records(nested))
    return rows


def _extract_total_count(payload: Any) -> int:
    if isinstance(payload, dict):
        for key in TOTAL_COUNT_KEYS:
            raw_value = payload.get(key)
            if raw_value not in (None, ""):
                try:
                    return int(raw_value)
                except (TypeError, ValueError):
                    pass
        for nested in payload.values():
            total = _extract_total_count(nested)
            if total:
                return total
    elif isinstance(payload, list):
        for item in payload:
            total = _extract_total_count(item)
            if total:
                return total
    return 0


class Work24TrainingAdapter:
    """Collect Work24 training program rows and normalize them to program records."""

    def __init__(
        self,
        *,
        list_endpoint: str | None = None,
        sample_dir: Path | None = None,
        timeout_seconds: int = REQUEST_TIMEOUT_SECONDS,
        retry_count: int = REQUEST_RETRY_COUNT,
        page_size: int = DEFAULT_PAGE_SIZE,
        sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
        client: httpx.Client | None = None,
    ) -> None:
        load_backend_dotenv()
        self.list_endpoint = (list_endpoint or DEFAULT_LIST_ENDPOINT).strip()
        self.sample_dir = sample_dir or DEFAULT_SAMPLE_DIR
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.page_size = page_size
        self.sleep_seconds = sleep_seconds
        self.client = client or httpx.Client(timeout=self.timeout_seconds, trust_env=False)
        self.sample_dir.mkdir(parents=True, exist_ok=True)
        self.saved_samples: list[str] = []

    def _resolve_auth_key(self) -> str | None:
        api_key = os.getenv(SOURCE.key_env_name, "").strip()
        if not api_key:
            print(f"[work24_training] {SOURCE.key_env_name} is not configured.")
            return None
        return api_key

    def _save_api_sample(self, sample_name: str, payload: Any) -> Path:
        sample_path = self.sample_dir / f"{_safe_slug(sample_name)}.json"
        sample_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        saved = str(sample_path)
        if saved not in self.saved_samples:
            self.saved_samples.append(saved)
        return sample_path

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

    def _request_payload(
        self,
        *,
        page_num: int,
        page_size: int,
        start_dt: str | None,
        end_dt: str | None,
        area_code: str | None,
        ncs_code: str | None,
        sample_name: str,
    ) -> Any | None:
        auth_key = self._resolve_auth_key()
        if not auth_key:
            return None
        if not self.list_endpoint:
            print("[work24_training] list endpoint is not configured.")
            return None

        last_error: Exception | None = None
        params = {
            "returnType": "JSON",
            "outType": "1",
            "pageNum": page_num,
            "pageSize": page_size,
            "srchTraStDt": start_dt,
            "srchTraEndDt": end_dt,
            "srchTraArea1": area_code,
            "srchNcsCd": ncs_code,
        }

        for attempt in range(1, self.retry_count + 1):
            try:
                request_params = {
                    key: str(value)
                    for key, value in params.items()
                    if value not in (None, "")
                }
                request_params[SOURCE.auth_param_name] = auth_key
                response = self.client.get(self.list_endpoint, params=request_params)
                response.raise_for_status()
                payload = self._parse_response_payload(response)
                self._save_api_sample(sample_name, payload)
                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.retry_count:
                    time.sleep(min(0.5 * attempt, 2.0))

        print(f"[work24_training] {sample_name} request failed: {last_error}")
        return None

    @staticmethod
    def _normalize_program(row: dict[str, Any]) -> dict[str, Any]:
        return {
            "hrd_id": _pick_first(row, ("TRPR_ID", "trprId")),
            "title": _pick_first(row, ("TITLE", "title")),
            "category": _pick_first(row, ("NCS_CD", "ncsCd")),
            "location": _pick_first(row, ("ADDRESS", "address")),
            "start_date": _pick_first(row, ("TRA_START_DATE", "traStartDate")),
            "end_date": _pick_first(row, ("TRA_END_DATE", "traEndDate")),
            "cost": _to_int(row.get("COURSE_MAN") if "COURSE_MAN" in row else row.get("courseMan")),
            "subsidy_amount": _to_int(row.get("REAL_MAN") if "REAL_MAN" in row else row.get("realMan")),
            "target": _pick_first(row, ("TRAIN_TARGET", "trainTarget")),
            "provider": _pick_first(row, ("TRAINST_CST_ID", "trainstCstId")),
            "source_url": _pick_first(row, ("TITLE_LINK", "titleLink")),
            "total_count": _to_int(row.get("scn_cnt")),
            "source": SOURCE.source_name,
            "raw": row,
        }

    def fetch_list(
        self,
        page_num: int,
        page_size: int,
        start_dt: str | None = None,
        end_dt: str | None = None,
        area_code: str | None = None,
        ncs_code: str | None = None,
    ) -> list[dict[str, Any]] | None:
        """Fetch one page of training programs and normalize to program columns."""

        try:
            payload = self._request_payload(
                page_num=page_num,
                page_size=page_size,
                start_dt=start_dt,
                end_dt=end_dt,
                area_code=area_code,
                ncs_code=ncs_code,
                sample_name=f"training_list_page_{page_num}",
            )
            if payload is None:
                return None
            return [self._normalize_program(row) for row in _extract_records(payload)]
        except Exception as exc:
            print(f"[work24_training] fetch_list failed: {exc}")
            return None

    def fetch_all(
        self,
        start_dt: str | None = None,
        end_dt: str | None = None,
        area_code: str | None = None,
        ncs_code: str | None = None,
    ) -> list[dict[str, Any]] | None:
        """Fetch all pages using 100-item pagination with a 0.5s delay."""

        try:
            first_page_payload = self._request_payload(
                page_num=1,
                page_size=self.page_size,
                start_dt=start_dt,
                end_dt=end_dt,
                area_code=area_code,
                ncs_code=ncs_code,
                sample_name="training_list_page_1",
            )
            if first_page_payload is None:
                return None

            rows = _extract_records(first_page_payload)
            programs = [self._normalize_program(row) for row in rows]
            total_count = _extract_total_count(first_page_payload)
            if total_count <= len(programs) or self.page_size <= 0:
                return programs

            total_pages = (total_count + self.page_size - 1) // self.page_size
            for page_num in range(2, total_pages + 1):
                time.sleep(self.sleep_seconds)
                page_rows = self.fetch_list(
                    page_num=page_num,
                    page_size=self.page_size,
                    start_dt=start_dt,
                    end_dt=end_dt,
                    area_code=area_code,
                    ncs_code=ncs_code,
                )
                if page_rows is None:
                    continue
                programs.extend(page_rows)

            return programs
        except Exception as exc:
            print(f"[work24_training] fetch_all failed: {exc}")
            return None


def main() -> None:
    adapter = Work24TrainingAdapter()
    rows = adapter.fetch_all()
    print(f"[work24_training] rows: {len(rows or [])}")


if __name__ == "__main__":
    main()
