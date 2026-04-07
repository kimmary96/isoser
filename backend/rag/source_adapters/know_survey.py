from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from statistics import fmean
import zipfile
from xml.etree import ElementTree

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from backend.rag.runtime_config import load_backend_dotenv, resolve_backend_path
    from backend.rag.source_adapters.know_files import load_csv_rows
except ImportError:
    from rag.runtime_config import load_backend_dotenv, resolve_backend_path
    from rag.source_adapters.know_files import load_csv_rows

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_data"
DEFAULT_QUESTION_LABELS_PATH = SEED_DIR / "know_question_labels.json"
DEFAULT_SKILL_WEIGHTS_PATH = SEED_DIR / "know_skill_weights.json"
DEFAULT_TOP_K = 10

XLSX_NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
}


class RawSurveyUnavailableError(RuntimeError):
    """Raised when the repository only contains the placeholder raw survey note."""


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _column_index(cell_ref: str) -> int:
    letters = []
    for char in cell_ref:
        if char.isalpha():
            letters.append(char.upper())
        else:
            break

    index = 0
    for char in letters:
        index = index * 26 + (ord(char) - ord("A") + 1)
    return max(index - 1, 0)


def _xlsx_shared_strings(zip_file: zipfile.ZipFile) -> list[str]:
    shared_strings_path = "xl/sharedStrings.xml"
    if shared_strings_path not in zip_file.namelist():
        return []

    shared_strings_xml = ElementTree.fromstring(zip_file.read(shared_strings_path))
    strings: list[str] = []
    for item in shared_strings_xml.findall("main:si", XLSX_NS):
        parts = [text.text or "" for text in item.iterfind(".//main:t", XLSX_NS)]
        strings.append("".join(parts))
    return strings


def _xlsx_cell_value(cell: ElementTree.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")

    if cell_type == "inlineStr":
        return "".join(text.text or "" for text in cell.iterfind(".//main:t", XLSX_NS)).strip()

    value = cell.find("main:v", XLSX_NS)
    if value is None or value.text is None:
        return ""

    if cell_type == "s":
        return shared_strings[int(value.text)]
    return value.text.strip()


def read_xlsx_sheet_rows(path: Path, sheet_name: str) -> list[list[str]]:
    """Read an XLSX sheet without external dependencies."""

    with zipfile.ZipFile(path) as zip_file:
        workbook = ElementTree.fromstring(zip_file.read("xl/workbook.xml"))
        workbook_rels = ElementTree.fromstring(zip_file.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in workbook_rels.findall("pkg:Relationship", XLSX_NS)
        }
        shared_strings = _xlsx_shared_strings(zip_file)

        sheets = workbook.find("main:sheets", XLSX_NS)
        if sheets is None:
            raise RuntimeError("workbook.xml 에 sheets 노드가 없습니다.")

        sheet_target = ""
        for sheet in sheets:
            if sheet.attrib.get("name") == sheet_name:
                rel_id = sheet.attrib.get(f"{{{XLSX_NS['rel']}}}id", "")
                sheet_target = rel_map.get(rel_id, "")
                break

        if not sheet_target:
            raise RuntimeError(f"시트를 찾을 수 없습니다: {sheet_name}")

        sheet_xml = ElementTree.fromstring(zip_file.read(f"xl/{sheet_target.lstrip('/')}"))
        rows: list[list[str]] = []

        for row in sheet_xml.findall(".//main:sheetData/main:row", XLSX_NS):
            values: list[str] = []
            for cell in row.findall("main:c", XLSX_NS):
                cell_index = _column_index(cell.attrib.get("r", "A1"))
                while len(values) <= cell_index:
                    values.append("")
                values[cell_index] = _xlsx_cell_value(cell, shared_strings)
            rows.append(values)

    return rows


def _normalize_know_code(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    if text.endswith(".0"):
        text = text[:-2]
    return "".join(char for char in text if char.isdigit())


def _parse_likert(value: str | None) -> int | None:
    text = (value or "").strip()
    if not text:
        return None
    if text.endswith(".0"):
        text = text[:-2]
    if not text.isdigit():
        return None
    parsed = int(text)
    if 1 <= parsed <= 5:
        return parsed
    return None


def _round_or_none(value: float | None) -> float | None:
    return None if value is None else round(value, 4)


def _normalize_weight(mean_value: float) -> float:
    return round((mean_value - 1.0) / 4.0, 4)


def _split_label(description: str, prefix: str) -> str:
    text = description.removeprefix(prefix).strip()
    label, _, _suffix = text.rpartition("_")
    return label or text


def _header_index_map(header_row: list[str]) -> dict[str, int]:
    return {
        value.strip(): index
        for index, value in enumerate(header_row)
        if isinstance(value, str) and value.strip()
    }


def _row_value(row: list[str], header_map: dict[str, int], header_name: str) -> str:
    index = header_map.get(header_name)
    if index is None or index >= len(row):
        return ""
    return row[index].strip()


def load_codebook(codebook_path: Path) -> dict:
    """Parse the KNOW codebook into question labels and value scales."""

    description_rows = read_xlsx_sheet_rows(codebook_path, "2019년(변수설명)")
    value_rows = read_xlsx_sheet_rows(codebook_path, "2019년(변수값)")
    description_headers = _header_index_map(description_rows[0])
    value_headers = _header_index_map(value_rows[0])

    personality: dict[str, dict] = {}
    knowledge: dict[str, dict] = {}

    for row in description_rows[1:]:
        variable_name = _row_value(row, description_headers, "새변수명")
        description = _row_value(row, description_headers, "새변수설명")
        if not variable_name or not description:
            continue

        if variable_name.startswith("sq"):
            personality[variable_name] = {
                "code": variable_name,
                "label": description.removeprefix("<성격>").strip(),
                "description": description,
            }
            continue

        if not variable_name.startswith("kq"):
            continue

        base_code = variable_name.rsplit("_", 1)[0]
        metric = "importance" if variable_name.endswith("_1") else "level"
        question = knowledge.setdefault(
            base_code,
            {
                "code": base_code,
                "label": _split_label(description, "<지식>"),
                "description": description,
                "importance_code": "",
                "level_code": "",
            },
        )
        question[f"{metric}_code"] = variable_name

    value_scales: dict[str, dict[str, str]] = defaultdict(dict)
    know_code_labels: dict[str, str] = {}
    current_variable = ""

    for row in value_rows[1:]:
        variable_name = _row_value(row, value_headers, "변수명")
        variable_value = _row_value(row, value_headers, "변수값")
        variable_label = _row_value(row, value_headers, "변수값 설명")

        if variable_name:
            current_variable = variable_name
        if not current_variable or not variable_value:
            continue

        if current_variable in {"knowcode", "knowcode2019"}:
            know_code = _normalize_know_code(variable_value)
            if know_code and variable_label:
                know_code_labels[know_code] = variable_label
            continue

        value_scales[current_variable][variable_value] = variable_label

    for question in personality.values():
        question["scale"] = value_scales.get(question["code"], {})

    for question in knowledge.values():
        question["importance_scale"] = value_scales.get(question["importance_code"], {})
        question["level_scale"] = value_scales.get(question["level_code"], {})

    return {
        "metadata": {
            "generated_at": _timestamp(),
            "codebook_path": str(codebook_path),
            "personality_question_count": len(personality),
            "knowledge_question_count": len(knowledge),
            "know_code_label_count": len(know_code_labels),
        },
        "know_code_labels": dict(sorted(know_code_labels.items())),
        "personality": dict(sorted(personality.items())),
        "knowledge": dict(sorted(knowledge.items())),
    }


def build_question_labels_payload(codebook_path: Path) -> dict:
    return load_codebook(codebook_path)


def _is_placeholder_raw_csv(rows: list[dict[str, str]]) -> bool:
    if not rows:
        return False

    keys = set(rows[0].keys())
    if keys != {"note", "details"}:
        return False

    note = rows[0].get("note", "").strip()
    return note == "PII_REMOVED"


def _is_restricted_full_raw_csv(rows: list[dict[str, str]]) -> bool:
    """Block full raw survey dumps by default unless explicitly allowed."""

    if not rows:
        return False

    first_row = rows[0]
    if not isinstance(first_row, dict):
        return False

    looks_like_full_schema = {"id", "knowcode", "sq1"}.issubset(set(first_row.keys()))
    return looks_like_full_schema and len(rows) > 1000


def _resolve_job_name(rows: list[dict[str, str]], know_code: str, know_code_labels: dict[str, str]) -> str:
    counter = Counter((row.get("job") or "").strip() for row in rows if (row.get("job") or "").strip())
    if counter:
        return counter.most_common(1)[0][0]
    return know_code_labels.get(know_code, "")


def _build_personality_items(rows: list[dict[str, str]], codebook: dict[str, dict]) -> list[dict]:
    items: list[dict] = []

    for code, question in codebook.items():
        responses = [
            parsed
            for parsed in (_parse_likert(row.get(code)) for row in rows)
            if parsed is not None
        ]
        if not responses:
            continue

        mean_value = fmean(responses)
        items.append(
            {
                "type": "personality",
                "code": code,
                "label": question["label"],
                "weight": _normalize_weight(mean_value),
                "mean": _round_or_none(mean_value),
                "response_count": len(responses),
            }
        )

    return sorted(
        items,
        key=lambda item: (-item["weight"], -(item["mean"] or 0), -item["response_count"], item["label"]),
    )


def _build_knowledge_items(rows: list[dict[str, str]], codebook: dict[str, dict]) -> list[dict]:
    items: list[dict] = []

    for code, question in codebook.items():
        importance_responses = [
            parsed
            for parsed in (_parse_likert(row.get(question["importance_code"])) for row in rows)
            if parsed is not None
        ]
        if not importance_responses:
            continue

        level_responses = [
            parsed
            for parsed in (_parse_likert(row.get(question["level_code"])) for row in rows)
            if parsed is not None
        ]
        importance_mean = fmean(importance_responses)
        level_mean = fmean(level_responses) if level_responses else None

        items.append(
            {
                "type": "knowledge",
                "code": code,
                "importance_code": question["importance_code"],
                "level_code": question["level_code"],
                "label": question["label"],
                "weight": _normalize_weight(importance_mean),
                "importance_mean": _round_or_none(importance_mean),
                "level_mean": _round_or_none(level_mean),
                "response_count": len(importance_responses),
            }
        )

    return sorted(
        items,
        key=lambda item: (
            -item["weight"],
            -(item["level_mean"] or 0),
            -item["response_count"],
            item["label"],
        ),
    )


def build_skill_weights_payload(raw_csv_path: Path, codebook_path: Path, *, top_k: int = DEFAULT_TOP_K) -> dict:
    """Build per-job KNOW weights from the raw survey and the codebook."""

    codebook = load_codebook(codebook_path)
    raw_rows = load_csv_rows(raw_csv_path)
    if _is_placeholder_raw_csv(raw_rows):
        raise RawSurveyUnavailableError(
            "원자료 CSV가 PII 제거 안내 파일로 대체되어 실제 직업별 가중치를 계산할 수 없습니다."
        )
    if _is_restricted_full_raw_csv(raw_rows) and os.environ.get("KNOW_ALLOW_FULL_RAW") != "1":
        raise RawSurveyUnavailableError(
            "Full raw survey CSV is restricted by default. Set KNOW_ALLOW_FULL_RAW=1 to override."
        )

    grouped_rows: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in raw_rows:
        know_code = _normalize_know_code(row.get("knowcode")) or _normalize_know_code(row.get("knowcode2019"))
        if know_code:
            grouped_rows[know_code].append(row)

    jobs: list[dict] = []
    for know_code, rows in sorted(grouped_rows.items()):
        knowledge_items = _build_knowledge_items(rows, codebook["knowledge"])
        personality_items = _build_personality_items(rows, codebook["personality"])
        combined_top_items = sorted(
            [*knowledge_items, *personality_items],
            key=lambda item: (
                -item["weight"],
                -(item.get("level_mean") or item.get("mean") or 0),
                -item["response_count"],
                item["label"],
            ),
        )[:top_k]

        jobs.append(
            {
                "know_code": know_code,
                "job_name": _resolve_job_name(rows, know_code, codebook["know_code_labels"]),
                "response_count": len(rows),
                "knowledge_top_10": knowledge_items[:top_k],
                "personality_top_10": personality_items[:top_k],
                "top_10": combined_top_items,
            }
        )

    return {
        "metadata": {
            "generated_at": _timestamp(),
            "raw_csv_path": str(raw_csv_path),
            "codebook_path": str(codebook_path),
            "top_k": top_k,
            "job_count": len(jobs),
            "raw_row_count": len(raw_rows),
            "status": "ok",
        },
        "jobs": jobs,
    }


def build_placeholder_skill_weights_payload(
    raw_csv_path: Path,
    codebook_path: Path,
    *,
    top_k: int = DEFAULT_TOP_K,
    reason: str,
) -> dict:
    codebook = load_codebook(codebook_path)
    return {
        "metadata": {
            "generated_at": _timestamp(),
            "raw_csv_path": str(raw_csv_path),
            "codebook_path": str(codebook_path),
            "top_k": top_k,
            "job_count": 0,
            "raw_row_count": 0,
            "status": "raw_source_unavailable",
            "reason": reason,
            "personality_question_count": codebook["metadata"]["personality_question_count"],
            "knowledge_question_count": codebook["metadata"]["knowledge_question_count"],
        },
        "jobs": [],
    }


def _write_json(payload: dict, path: Path) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    load_backend_dotenv()

    raw_csv_path = resolve_backend_path(
        os.environ.get("KNOW_SURVEY_RAW_CSV_PATH"),
        "../docs/2019년_한국직업정보(KNOW)_재직자조사_성격·지식_원자료.csv",
    )
    codebook_path = resolve_backend_path(
        os.environ.get("KNOW_SURVEY_CODEBOOK_XLSX_PATH"),
        "../docs/2019년_한국직업정보(KNOW)_재직자조사_성격·지식_코드북.xlsx",
    )

    question_labels_payload = build_question_labels_payload(codebook_path)
    _write_json(question_labels_payload, DEFAULT_QUESTION_LABELS_PATH)

    try:
        skill_weights_payload = build_skill_weights_payload(raw_csv_path, codebook_path, top_k=DEFAULT_TOP_K)
    except RawSurveyUnavailableError as error:
        print(f"[know_survey] warning: {error}")
        skill_weights_payload = build_placeholder_skill_weights_payload(
            raw_csv_path,
            codebook_path,
            top_k=DEFAULT_TOP_K,
            reason=str(error),
        )

    _write_json(skill_weights_payload, DEFAULT_SKILL_WEIGHTS_PATH)

    print(f"[know_survey] wrote: {DEFAULT_QUESTION_LABELS_PATH}")
    print(f"[know_survey] wrote: {DEFAULT_SKILL_WEIGHTS_PATH}")
    print(
        "[know_survey] summary:",
        {
            "labels": question_labels_payload["metadata"]["knowledge_question_count"]
            + question_labels_payload["metadata"]["personality_question_count"],
            "jobs": skill_weights_payload["metadata"]["job_count"],
            "status": skill_weights_payload["metadata"]["status"],
        },
    )


if __name__ == "__main__":
    main()
