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
    source_name="work24_job_duty",
    display_name="Work24 Job Duty OpenAPI",
    purpose="Build a job profile corpus from Work24 job duty data.",
    key_env_name="WORK24_JOB_DUTY_AUTH_KEY",
    auth_param_name="authKey",
    guide_url_env_name="WORK24_OPEN_API_GUIDE_URL",
)

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data"
DEFAULT_OUTPUT_PATH = SEED_DIR / "job_profile_corpus.jsonl"
DEFAULT_SAMPLE_DIR = SEED_DIR / "api_samples" / "work24_job_duty"

LIST_ENDPOINT_ENV = "WORK24_JOB_DUTY_LIST_ENDPOINT"
DETAIL_ENDPOINT_ENV = "WORK24_JOB_DUTY_DETAIL_ENDPOINT"
FALLBACK_AUTH_KEY_ENV = "WORK24_OPEN_API_AUTH_KEY"
LIST_WORD_ENV = "WORK24_JOB_DUTY_LIST_WORD"

DEFAULT_PAGE_SIZE = 100
DEFAULT_SLEEP_SECONDS = 0.5
REQUEST_TIMEOUT_SECONDS = 30
REQUEST_RETRY_COUNT = 3

LIST_CONTAINER_KEYS = (
    "jobs",
    "jobList",
    "job_list",
    "result",
    "results",
    "data",
    "items",
    "item",
    "body",
    "response",
)
TOTAL_COUNT_KEYS = (
    "totalCount",
    "totalCnt",
    "total_count",
    "total",
    "count",
)

JOB_CODE_KEYS = (
    "ablt_unit",
    "abltUnit",
    "jobCode",
    "job_code",
    "jobCd",
    "job_cd",
    "dutyCd",
    "duty_cd",
    "dtyCd",
    "job_scla_cd",
    "jobSclaCd",
    "job_sdvn_cd",
    "jobSdvnCd",
    "ncsCode",
    "code",
)
DETAIL_CODE_KEYS = (
    "ablt_unit",
    "abltUnit",
    "job_sdvn_cd",
    "jobSdvnCd",
    "code",
)
JOB_NAME_KEYS = (
    "jobName",
    "job_name",
    "jobNm",
    "job_nm",
    "dutyName",
    "duty_name",
    "dutyNm",
    "job_scfn",
    "jobScfn",
    "job_mcn",
    "jobMcn",
    "job_lcfn",
    "jobLcfn",
    "ncsName",
    "name",
    "title",
    "job_sdvn",
    "jobSdvn",
)
DESCRIPTION_KEYS = (
    "description",
    "jobDescription",
    "job_description",
    "jobDesc",
    "job_desc",
    "jobCont",
    "job_cont",
    "summary",
    "summaryText",
    "summary_text",
    "jobDictionary",
    "jobDataDictionary",
    "dutyCont",
    "duty_cont",
    "dtyCont",
)
KEY_TASK_KEYS = (
    "keyTasks",
    "key_tasks",
    "mainTasks",
    "main_tasks",
    "jobTasks",
    "job_tasks",
    "taskList",
    "tasks",
    "job_sdvn",
    "jobSdvn",
)
REQUIRED_SKILL_KEYS = (
    "requiredSkills",
    "required_skills",
    "skillList",
    "skills",
    "knwg_tchn_attd",
    "knwgTchnAttd",
    "knowledgeSkillAttitude",
)
ABILITY_DESCRIPTION_KEYS = (
    "ablt_def",
    "abltDef",
    "abilityDefinition",
    "ability_description",
)

LINE_BREAK_SPLITTER = re.compile(r"[\r\n]+|[;|]+")
INLINE_ITEM_SPLITTER = re.compile(r"\s*[\u00b7\u318d\u2022]\s*|\s*,\s*")


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z_-]+", "_", value).strip("_")
    return slug or "sample"


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return re.sub(r"\s+", " ", text)


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


def _collect_text_fragments(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        text = _clean_text(value)
        return [text] if text else []
    if isinstance(value, (int, float)):
        return [str(value)]
    if isinstance(value, list):
        fragments: list[str] = []
        for item in value:
            fragments.extend(_collect_text_fragments(item))
        return fragments
    if isinstance(value, dict):
        fragments: list[str] = []
        for item in value.values():
            fragments.extend(_collect_text_fragments(item))
        return fragments
    return []


def _unique_texts(values: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = _clean_text(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def _split_list_values(values: list[str]) -> list[str]:
    items: list[str] = []
    for value in values:
        for chunk in LINE_BREAK_SPLITTER.split(value):
            chunk = chunk.strip()
            if not chunk:
                continue
            if any(marker in chunk for marker in ("\u00b7", "\u318d", "\u2022", ",")):
                pieces = [piece.strip() for piece in INLINE_ITEM_SPLITTER.split(chunk) if piece.strip()]
                if len(pieces) > 1:
                    items.extend(pieces)
                    continue
            items.append(chunk)
    return _unique_texts(items)


def _iter_record_dicts(value: Any) -> list[dict[str, Any]]:
    relevant_keys = (
        JOB_CODE_KEYS
        + JOB_NAME_KEYS
        + DESCRIPTION_KEYS
        + KEY_TASK_KEYS
        + REQUIRED_SKILL_KEYS
        + ABILITY_DESCRIPTION_KEYS
    )

    if isinstance(value, list):
        records: list[dict[str, Any]] = []
        for item in value:
            records.extend(_iter_record_dicts(item))
        return records

    if not isinstance(value, dict):
        return []

    if any(key in value for key in relevant_keys):
        return [value]

    for key in LIST_CONTAINER_KEYS:
        nested = value.get(key)
        if nested is not None:
            records = _iter_record_dicts(nested)
            if records:
                return records

    records: list[dict[str, Any]] = []
    for nested in value.values():
        records.extend(_iter_record_dicts(nested))
    return records


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


class Work24JobDutyAdapter:
    """Collect Work24 job duty records and export a profile corpus."""

    def __init__(
        self,
        *,
        list_endpoint: str | None = None,
        detail_endpoint: str | None = None,
        list_word: str | None = None,
        output_path: Path | None = None,
        sample_dir: Path | None = None,
        timeout_seconds: int = REQUEST_TIMEOUT_SECONDS,
        retry_count: int = REQUEST_RETRY_COUNT,
        page_size: int = DEFAULT_PAGE_SIZE,
        sleep_seconds: float = DEFAULT_SLEEP_SECONDS,
        client: httpx.Client | None = None,
    ) -> None:
        load_backend_dotenv()
        self.list_endpoint = list_endpoint or os.getenv(LIST_ENDPOINT_ENV, "").strip()
        self.detail_endpoint = detail_endpoint or os.getenv(DETAIL_ENDPOINT_ENV, "").strip()
        self.list_word = (list_word or os.getenv(LIST_WORD_ENV, "")).strip()
        self.output_path = output_path or DEFAULT_OUTPUT_PATH
        self.sample_dir = sample_dir or DEFAULT_SAMPLE_DIR
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.page_size = page_size
        self.sleep_seconds = sleep_seconds
        self.client = client or httpx.Client(timeout=self.timeout_seconds)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.sample_dir.mkdir(parents=True, exist_ok=True)
        self.saved_samples: list[str] = []

    def _resolve_auth_key(self) -> str:
        specific_key = os.getenv(SOURCE.key_env_name, "").strip()
        fallback_key = os.getenv(FALLBACK_AUTH_KEY_ENV, "").strip()
        api_key = specific_key or fallback_key
        if not api_key:
            raise ValueError(
                f"{SOURCE.key_env_name} or {FALLBACK_AUTH_KEY_ENV} must be configured."
            )
        return api_key

    def _resolve_list_word(self, word: str | None = None) -> str:
        resolved_word = (word or self.list_word).strip()
        if not resolved_word:
            raise ValueError(
                f"fetch_job_list requires a search keyword via argument or {LIST_WORD_ENV}."
            )
        return resolved_word

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
        endpoint_url: str,
        *,
        params: dict[str, Any] | None = None,
        sample_name: str,
    ) -> Any:
        if not endpoint_url:
            raise ValueError(f"{sample_name} endpoint is not configured.")

        last_error: Exception | None = None
        extra_params = {"returnType": "JSON", **(params or {})}

        for attempt in range(1, self.retry_count + 1):
            try:
                request_params = {
                    key: str(value)
                    for key, value in extra_params.items()
                    if value not in (None, "")
                }
                request_params[SOURCE.auth_param_name] = self._resolve_auth_key()
                response = self.client.get(
                    endpoint_url,
                    params=request_params,
                )
                response.raise_for_status()
                payload = self._parse_response_payload(response)
                self._save_api_sample(sample_name, payload)
                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.retry_count:
                    time.sleep(min(0.5 * attempt, 2.0))

        raise RuntimeError(f"{sample_name} request failed after {self.retry_count} retries") from last_error

    def fetch_job_list(self, word: str | None = None) -> list[dict[str, Any]]:
        """Fetch all list records using 100-item pages with a 0.5s delay."""

        all_items: list[dict[str, Any]] = []
        page_no = 1
        search_word = self._resolve_list_word(word)

        while True:
            payload = self._request_payload(
                self.list_endpoint,
                params={
                    "word": search_word,
                    "startPage": page_no,
                    "display": self.page_size,
                    "returnType": "JSON",
                },
                sample_name=f"job_list_page_{page_no}",
            )
            page_items = _iter_record_dicts(payload)
            if not page_items:
                break

            all_items.extend(page_items)
            total_count = _extract_total_count(payload)

            if len(page_items) < self.page_size:
                break
            if total_count and len(all_items) >= total_count:
                break

            page_no += 1
            time.sleep(self.sleep_seconds)

        return all_items

    def fetch_job_detail(self, job_code: str) -> dict[str, Any]:
        """Fetch one detailed job record."""

        normalized_code = _clean_text(job_code)
        if not normalized_code:
            raise ValueError("job_code is required for detail lookup.")
        if not self.detail_endpoint:
            raise ValueError(f"{DETAIL_ENDPOINT_ENV} is not configured.")

        payload = self._request_payload(
            self.detail_endpoint,
            params={
                "code": normalized_code,
                "returnType": "JSON",
            },
            sample_name=f"job_detail_{normalized_code}",
        )
        if isinstance(payload, dict):
            return payload
        return {"result": payload}

    def parse_job_description(self, raw: Any) -> dict[str, Any]:
        """Normalize raw Work24 payload into a compact corpus row."""

        records = _iter_record_dicts(raw)
        if not records and isinstance(raw, dict):
            records = [raw]

        job_code = ""
        job_name = ""
        description_fragments: list[str] = []
        key_task_fragments: list[str] = []
        skill_fragments: list[str] = []

        for record in records:
            if not job_code:
                job_code = _pick_first(record, JOB_CODE_KEYS)
            if not job_name:
                job_name = _pick_first(record, JOB_NAME_KEYS)

            for key in DESCRIPTION_KEYS + ABILITY_DESCRIPTION_KEYS:
                if key in record:
                    description_fragments.extend(_collect_text_fragments(record.get(key)))
            for key in KEY_TASK_KEYS:
                if key in record:
                    key_task_fragments.extend(_collect_text_fragments(record.get(key)))
            for key in REQUIRED_SKILL_KEYS:
                if key in record:
                    skill_fragments.extend(_collect_text_fragments(record.get(key)))

        description = "\n".join(_unique_texts(description_fragments))
        key_tasks = _split_list_values(key_task_fragments)
        required_skills = _split_list_values(skill_fragments)

        return {
            "job_code": job_code,
            "job_name": job_name,
            "description": description,
            "key_tasks": key_tasks,
            "required_skills": required_skills,
            "source": SOURCE.source_name,
        }

    def build_corpus(self, word: str | None = None) -> list[dict[str, Any]]:
        """Run the end-to-end list/detail/normalization pipeline."""

        corpus: list[dict[str, Any]] = []
        seen_keys: set[str] = set()

        for item in self.fetch_job_list(word=word):
            job_code = _pick_first(item, DETAIL_CODE_KEYS)
            raw_payload: Any = item

            if job_code:
                try:
                    raw_payload = self.fetch_job_detail(job_code)
                except Exception:
                    raw_payload = item

            parsed = self.parse_job_description(raw_payload)
            dedupe_key = parsed["job_code"] or parsed["job_name"]
            if not dedupe_key or dedupe_key in seen_keys:
                continue
            if not parsed["description"] and not parsed["key_tasks"] and not parsed["required_skills"]:
                continue

            seen_keys.add(dedupe_key)
            corpus.append(parsed)

        return corpus

    def save_to_jsonl(
        self,
        corpus: list[dict[str, Any]] | None = None,
        output_path: Path | None = None,
    ) -> Path:
        """Persist the corpus as JSONL."""

        rows = corpus if corpus is not None else self.build_corpus()
        target_path = output_path or self.output_path
        target_path.parent.mkdir(parents=True, exist_ok=True)

        with target_path.open("w", encoding="utf-8") as file:
            for row in rows:
                file.write(json.dumps(row, ensure_ascii=False) + "\n")

        return target_path


def main() -> None:
    adapter = Work24JobDutyAdapter()
    corpus = adapter.build_corpus()
    output_path = adapter.save_to_jsonl(corpus)
    print(f"[work24_job_duty] corpus rows: {len(corpus)}")
    print(f"[work24_job_duty] wrote: {output_path}")


if __name__ == "__main__":
    main()
