from __future__ import annotations

import json
from pathlib import Path

from backend.routers import programs


def _load_examples() -> dict[str, object]:
    fixture_path = Path(__file__).parent / "fixtures" / "program_list_api_examples.json"
    return json.loads(fixture_path.read_text(encoding="utf-8"))


def test_program_list_api_example_responses_match_current_schemas() -> None:
    examples = _load_examples()

    browse_response = programs.ProgramListPageResponse.model_validate(examples["list_browse"]["response"])
    count_response = programs.ProgramCountResponse.model_validate(examples["count"]["response"])
    filter_options_response = programs.ProgramFilterOptionsResponse.model_validate(examples["filter_options"]["response"])

    assert browse_response.source == "read_model"
    assert browse_response.mode == "browse"
    assert browse_response.items[0].program.category_detail == "data-ai"
    assert count_response.count == 42
    assert filter_options_response.sources[0].label == "K-Startup"


def test_program_list_api_example_params_use_supported_contract_keys() -> None:
    examples = _load_examples()
    supported_keys = {
        "q",
        "category",
        "category_detail",
        "scope",
        "region_detail",
        "regions",
        "sources",
        "teaching_methods",
        "cost_types",
        "participation_times",
        "targets",
        "selection_processes",
        "employment_links",
        "recruiting_only",
        "include_closed_recent",
        "sort",
        "limit",
        "offset",
        "cursor",
    }

    list_browse_keys = set(examples["list_browse"]["params"].keys())
    count_keys = set(examples["count"]["params"].keys())
    filter_option_keys = set(examples["filter_options"]["params"].keys())

    assert list_browse_keys <= supported_keys
    assert count_keys <= supported_keys
    assert filter_option_keys <= supported_keys
