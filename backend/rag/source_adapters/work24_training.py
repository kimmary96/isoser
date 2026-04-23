from __future__ import annotations

import json
import os
import re
import time
from datetime import date
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

import httpx

try:
    from backend.rag.runtime_config import load_backend_dotenv
    from backend.rag.source_adapters.base import ApiSourceAdapter
    from backend.rag.collector.normalizer import _classify_category
    from backend.rag.collector.program_field_mapping import derive_korean_region
except ImportError:
    from rag.runtime_config import load_backend_dotenv
    from rag.source_adapters.base import ApiSourceAdapter
    from rag.collector.normalizer import _classify_category
    from rag.collector.program_field_mapping import derive_korean_region

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
DEFAULT_MAX_PAGES: int | None = None
DEFAULT_SORT = "ASC"
DEFAULT_SORT_COL = "2"

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


def _add_months(base: date, months: int) -> date:
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    month_lengths = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(base.day, month_lengths[month - 1])
    return date(year, month, day)


def default_training_date_range(*, today: date | None = None, months: int = 6) -> tuple[str, str]:
    base = today or date.today()
    return base.strftime("%Y%m%d"), _add_months(base, months).strftime("%Y%m%d")


def _clean_param(value: Any) -> str | None:
    text = _clean_text(value)
    if not text or text.upper() in {"ALL", "NONE", "NULL"}:
        return None
    return text


def _normalize_sort(value: Any) -> str:
    sort = (_clean_param(value) or DEFAULT_SORT).upper()
    return sort if sort in {"ASC", "DESC"} else DEFAULT_SORT


def _normalize_sort_col(value: Any) -> str:
    sort_col = _clean_param(value) or DEFAULT_SORT_COL
    return sort_col if sort_col in {"1", "2", "3", "5"} else DEFAULT_SORT_COL


def _apply_legacy_ncs_code(
    params: dict[str, Any],
    *,
    ncs_code: str | None,
    ncs1_code: str | None,
    ncs2_code: str | None,
    ncs3_code: str | None,
    ncs4_code: str | None,
) -> None:
    code = _clean_param(ncs_code)
    if not code:
        return
    if any(_clean_param(value) for value in (ncs1_code, ncs2_code, ncs3_code, ncs4_code)):
        return

    compact = re.sub(r"\D", "", code)
    if len(compact) <= 2:
        params["srchNcs1"] = compact or code
    elif len(compact) <= 4:
        params["srchNcs2"] = compact
    elif len(compact) <= 6:
        params["srchNcs3"] = compact
    else:
        params["srchNcs4"] = compact[:8]


def build_training_list_params(
    *,
    auth_key: str | None = None,
    page_num: int,
    page_size: int,
    start_dt: str | None,
    end_dt: str | None,
    area_code: str | None = None,
    area2_code: str | None = None,
    ncs_code: str | None = None,
    ncs1_code: str | None = None,
    ncs2_code: str | None = None,
    ncs3_code: str | None = None,
    ncs4_code: str | None = None,
    weekend_code: str | None = None,
    course_type: str | None = None,
    training_category: str | None = None,
    training_type: str | None = None,
    process_name: str | None = None,
    organization_name: str | None = None,
    sort: str | None = DEFAULT_SORT,
    sort_col: str | None = DEFAULT_SORT_COL,
) -> dict[str, str]:
    params: dict[str, Any] = {
        "returnType": "JSON",
        "outType": "1",
        "pageNum": page_num,
        "pageSize": page_size,
        "srchTraStDt": start_dt,
        "srchTraEndDt": end_dt,
        "sort": _normalize_sort(sort),
        "sortCol": _normalize_sort_col(sort_col),
        "wkendSe": weekend_code,
        "srchTraArea1": area_code,
        "srchTraArea2": area2_code,
        "srchNcs1": ncs1_code,
        "srchNcs2": ncs2_code,
        "srchNcs3": ncs3_code,
        "srchNcs4": ncs4_code,
        "crseTracseSe": course_type,
        "srchTraGbn": training_category,
        "srchTraType": training_type,
        "srchTraProcessNm": process_name,
        "srchTraOrganNm": organization_name,
    }
    if auth_key:
        params[SOURCE.auth_param_name] = auth_key
    _apply_legacy_ncs_code(
        params,
        ncs_code=ncs_code,
        ncs1_code=ncs1_code,
        ncs2_code=ncs2_code,
        ncs3_code=ncs3_code,
        ncs4_code=ncs4_code,
    )
    return {
        key: str(value)
        for key, value in params.items()
        if _clean_param(value) is not None
    }


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


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _normalize_teaching_method(row: dict[str, Any]) -> str | None:
    explicit_value = _pick_first(
        row,
        (
            "TRNG_TMTH_CD_NM",
            "TRNG_TMTH_NM",
            "TRAINING_METHOD",
            "trainingMethod",
            "trainMethod",
            "trainMthdNm",
        ),
    )
    if explicit_value:
        combined = explicit_value.replace(" ", "")
    else:
        combined = " ".join(
            filter(
                None,
                (
                    _pick_first(row, ("ADDRESS", "address")),
                    _pick_first(row, ("TITLE", "title")),
                    _pick_first(row, ("SUB_TITLE", "subTitle")),
                ),
            )
        ).replace(" ", "")

    has_online = _contains_any(combined, ("온라인", "원격", "비대면"))
    has_offline = _contains_any(combined, ("오프라인", "대면", "집체", "방문"))
    if has_online and has_offline:
        return "혼합"
    if has_online:
        return "온라인"
    if has_offline:
        return "오프라인"
    return None


def _normalize_support_type(row: dict[str, Any]) -> str | None:
    subsidy_amount = _to_int(row.get("REAL_MAN") if "REAL_MAN" in row else row.get("realMan"))
    cost = _to_int(row.get("COURSE_MAN") if "COURSE_MAN" in row else row.get("courseMan"))
    support_text = " ".join(
        filter(
            None,
            (
                _pick_first(row, ("TITLE", "title")),
                _pick_first(row, ("SUB_TITLE", "subTitle")),
                _pick_first(row, ("TRAIN_TARGET", "trainTarget")),
            ),
        )
    )

    if subsidy_amount == 0:
        return "무료"
    if cost is not None and subsidy_amount is not None and subsidy_amount < cost:
        return "일부 지원"
    if _contains_any(support_text, ("무료", "전액", "100%")):
        return "무료"
    if _contains_any(support_text, ("지원", "국비", "내일배움")):
        return "일부 지원"
    return None


def _normalize_is_certified(row: dict[str, Any]) -> bool:
    explicit_value = _pick_first(
        row,
        (
            "CERTIFIED_YN",
            "certifiedYn",
            "TRNG_INSTT_CERT_YN",
            "trainInsttCertYn",
        ),
    ).upper()
    if explicit_value in {"Y", "YES", "TRUE", "1"}:
        return True

    combined = " ".join(
        filter(
            None,
            (
                _pick_first(row, ("TITLE", "title")),
                _pick_first(row, ("SUB_TITLE", "subTitle")),
            ),
        )
    )
    return _contains_any(combined, ("우수훈련기관", "5년인증", "인증 우수"))


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
        max_pages: int | None = DEFAULT_MAX_PAGES,
        client: httpx.Client | None = None,
    ) -> None:
        load_backend_dotenv()
        self.list_endpoint = (list_endpoint or DEFAULT_LIST_ENDPOINT).strip()
        self.sample_dir = sample_dir or DEFAULT_SAMPLE_DIR
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.page_size = page_size
        self.sleep_seconds = sleep_seconds
        self.max_pages = max_pages if max_pages and max_pages > 0 else None
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
        area2_code: str | None,
        ncs_code: str | None,
        ncs1_code: str | None,
        ncs2_code: str | None,
        ncs3_code: str | None,
        ncs4_code: str | None,
        weekend_code: str | None,
        course_type: str | None,
        training_category: str | None,
        training_type: str | None,
        process_name: str | None,
        organization_name: str | None,
        sort: str | None,
        sort_col: str | None,
        sample_name: str | None = None,
    ) -> Any | None:
        auth_key = self._resolve_auth_key()
        if not auth_key:
            return None
        if not self.list_endpoint:
            print("[work24_training] list endpoint is not configured.")
            return None

        last_error: Exception | None = None
        request_params = build_training_list_params(
            auth_key=auth_key,
            page_num=page_num,
            page_size=page_size,
            start_dt=start_dt,
            end_dt=end_dt,
            area_code=area_code,
            area2_code=area2_code,
            ncs_code=ncs_code,
            ncs1_code=ncs1_code,
            ncs2_code=ncs2_code,
            ncs3_code=ncs3_code,
            ncs4_code=ncs4_code,
            weekend_code=weekend_code,
            course_type=course_type,
            training_category=training_category,
            training_type=training_type,
            process_name=process_name,
            organization_name=organization_name,
            sort=sort,
            sort_col=sort_col,
        )

        for attempt in range(1, self.retry_count + 1):
            try:
                response = self.client.get(self.list_endpoint, params=request_params)
                response.raise_for_status()
                payload = self._parse_response_payload(response)
                if sample_name:
                    self._save_api_sample(sample_name, payload)
                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.retry_count:
                    time.sleep(min(0.5 * attempt, 2.0))

        request_label = sample_name or f"page_{page_num}"
        print(f"[work24_training] {request_label} request failed: {last_error}")
        return None

    @staticmethod
    def _normalize_program(row: dict[str, Any]) -> dict[str, Any]:
        title = _pick_first(row, ("TITLE", "title"))
        provider_name = _pick_first(row, ("SUB_TITLE", "subTitle"))
        target = _pick_first(row, ("TRAIN_TARGET", "trainTarget"))
        location = _pick_first(row, ("ADDRESS", "address"))
        training_area_code = _pick_first(row, ("TRNG_AREA_CD", "trngAreaCd"))
        region, region_detail = derive_korean_region(location, training_area_code)
        return {
            "hrd_id": _pick_first(row, ("TRPR_ID", "trprId")),
            "title": title,
            "category": _pick_first(row, ("NCS_CD", "ncsCd")),
            "category_label": _classify_category(title),
            "location": location,
            "region": region,
            "region_detail": region_detail,
            "start_date": _pick_first(row, ("TRA_START_DATE", "traStartDate")),
            "end_date": _pick_first(row, ("TRA_END_DATE", "traEndDate")),
            "cost": _to_int(row.get("COURSE_MAN") if "COURSE_MAN" in row else row.get("courseMan")),
            "subsidy_amount": _to_int(row.get("REAL_MAN") if "REAL_MAN" in row else row.get("realMan")),
            "target": target,
            "provider": _pick_first(row, ("TRAINST_CST_ID", "trainstCstId")),
            "provider_name": provider_name,
            "summary": provider_name or target,
            "source_url": _pick_first(row, ("TITLE_LINK", "titleLink")),
            "total_count": _to_int(row.get("scn_cnt")),
            "source": "고용24",
            "support_type": _normalize_support_type(row),
            "teaching_method": _normalize_teaching_method(row),
            "is_certified": _normalize_is_certified(row),
            "raw": row,
        }

    def fetch_list(
        self,
        page_num: int,
        page_size: int,
        start_dt: str | None = None,
        end_dt: str | None = None,
        area_code: str | None = None,
        area2_code: str | None = None,
        ncs_code: str | None = None,
        ncs1_code: str | None = None,
        ncs2_code: str | None = None,
        ncs3_code: str | None = None,
        ncs4_code: str | None = None,
        weekend_code: str | None = None,
        course_type: str | None = None,
        training_category: str | None = None,
        training_type: str | None = None,
        process_name: str | None = None,
        organization_name: str | None = None,
        sort: str | None = DEFAULT_SORT,
        sort_col: str | None = DEFAULT_SORT_COL,
    ) -> list[dict[str, Any]] | None:
        """Fetch one page of training programs and normalize to program columns."""

        try:
            payload = self._request_payload(
                page_num=page_num,
                page_size=page_size,
                start_dt=start_dt,
                end_dt=end_dt,
                area_code=area_code,
                area2_code=area2_code,
                ncs_code=ncs_code,
                ncs1_code=ncs1_code,
                ncs2_code=ncs2_code,
                ncs3_code=ncs3_code,
                ncs4_code=ncs4_code,
                weekend_code=weekend_code,
                course_type=course_type,
                training_category=training_category,
                training_type=training_type,
                process_name=process_name,
                organization_name=organization_name,
                sort=sort,
                sort_col=sort_col,
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
        area2_code: str | None = None,
        ncs_code: str | None = None,
        ncs1_code: str | None = None,
        ncs2_code: str | None = None,
        ncs3_code: str | None = None,
        ncs4_code: str | None = None,
        weekend_code: str | None = None,
        course_type: str | None = None,
        training_category: str | None = None,
        training_type: str | None = None,
        process_name: str | None = None,
        organization_name: str | None = None,
        sort: str | None = DEFAULT_SORT,
        sort_col: str | None = DEFAULT_SORT_COL,
        max_pages: int | None = None,
    ) -> list[dict[str, Any]] | None:
        """Fetch all pages using 100-item pagination with a 0.5s delay."""

        try:
            first_page_payload = self._request_payload(
                page_num=1,
                page_size=self.page_size,
                start_dt=start_dt,
                end_dt=end_dt,
                area_code=area_code,
                area2_code=area2_code,
                ncs_code=ncs_code,
                ncs1_code=ncs1_code,
                ncs2_code=ncs2_code,
                ncs3_code=ncs3_code,
                ncs4_code=ncs4_code,
                weekend_code=weekend_code,
                course_type=course_type,
                training_category=training_category,
                training_type=training_type,
                process_name=process_name,
                organization_name=organization_name,
                sort=sort,
                sort_col=sort_col,
            )
            if first_page_payload is None:
                return None

            rows = _extract_records(first_page_payload)
            programs = [self._normalize_program(row) for row in rows]
            total_count = _extract_total_count(first_page_payload)
            if total_count <= len(programs) or self.page_size <= 0:
                return programs

            total_pages = (total_count + self.page_size - 1) // self.page_size
            resolved_max_pages = max_pages if max_pages and max_pages > 0 else self.max_pages
            if resolved_max_pages:
                total_pages = min(total_pages, resolved_max_pages)
            for page_num in range(2, total_pages + 1):
                time.sleep(self.sleep_seconds)
                page_rows = self.fetch_list(
                    page_num=page_num,
                    page_size=self.page_size,
                    start_dt=start_dt,
                    end_dt=end_dt,
                    area_code=area_code,
                    area2_code=area2_code,
                    ncs_code=ncs_code,
                    ncs1_code=ncs1_code,
                    ncs2_code=ncs2_code,
                    ncs3_code=ncs3_code,
                    ncs4_code=ncs4_code,
                    weekend_code=weekend_code,
                    course_type=course_type,
                    training_category=training_category,
                    training_type=training_type,
                    process_name=process_name,
                    organization_name=organization_name,
                    sort=sort,
                    sort_col=sort_col,
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
