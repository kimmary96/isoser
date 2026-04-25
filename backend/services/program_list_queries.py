from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Mapping, Sequence


PROGRAM_DEADLINE_SORTS = {"default", "deadline"}
PROGRAM_COMPUTED_SORTS = {"start_soon", "cost_low", "cost_high", "duration_short", "duration_long"}
PROGRAM_POPULAR_SORTS = {"popular"}
PROGRAM_SORT_OPTIONS = PROGRAM_DEADLINE_SORTS | PROGRAM_COMPUTED_SORTS | PROGRAM_POPULAR_SORTS | {"latest"}
PROGRAM_SEARCH_SCAN_LIMIT = 10000
PROGRAM_SEARCH_SCAN_PAGE_SIZE = 1000
PROGRAM_SEARCH_INDEX_COLUMN = "search_text"


def program_order_clause(sort: str) -> str:
    if sort == "latest":
        return "created_at.desc.nullslast"
    if sort == "start_soon":
        return "start_date.asc.nullslast"
    if sort == "cost_low":
        return "cost.asc.nullslast"
    if sort == "cost_high":
        return "cost.desc.nullslast"
    return "deadline.asc.nullslast"


def requires_resolved_deadline_scan(
    *,
    recruiting_only: bool,
    include_closed_recent: bool,
    sort: str,
) -> bool:
    return include_closed_recent or recruiting_only or sort in PROGRAM_DEADLINE_SORTS or sort in PROGRAM_COMPUTED_SORTS


def bounded_resolved_deadline_scan_limit(limit: int | None) -> int:
    if limit is None:
        return PROGRAM_SEARCH_SCAN_LIMIT
    return min(
        PROGRAM_SEARCH_SCAN_LIMIT,
        max(PROGRAM_SEARCH_SCAN_PAGE_SIZE, limit * 20),
    )


def build_program_query_params(
    *,
    select: str,
    category: str | None,
    category_detail: str | None,
    region_detail: str | None,
    recruiting_only: bool,
    include_closed_recent: bool,
    sort: str,
    limit: int | None,
    offset: int | None,
    has_keyword_search: bool,
    today_kst: date,
    normalized_teaching_methods: Sequence[str],
    normalized_region_keywords: Sequence[str],
    normalized_sources: Sequence[str],
    search_filter: str | None,
    parent_categories: Mapping[str, str],
) -> dict[str, Any]:
    effective_sort = sort if sort in PROGRAM_SORT_OPTIONS else "deadline"
    params: dict[str, Any] = {
        "select": select,
        "order": program_order_clause(effective_sort),
    }

    should_scan_resolved_deadline = requires_resolved_deadline_scan(
        recruiting_only=recruiting_only,
        include_closed_recent=include_closed_recent,
        sort=effective_sort,
    )
    if limit is not None:
        if should_scan_resolved_deadline:
            params["limit"] = str(
                PROGRAM_SEARCH_SCAN_LIMIT
                if has_keyword_search
                else bounded_resolved_deadline_scan_limit(limit)
            )
        else:
            params["limit"] = str(limit)
    elif has_keyword_search or should_scan_resolved_deadline:
        params["limit"] = str(PROGRAM_SEARCH_SCAN_LIMIT)

    if offset is not None and not should_scan_resolved_deadline:
        params["offset"] = str(offset)

    if include_closed_recent:
        params["deadline"] = f"gte.{(today_kst - timedelta(days=90)).isoformat()}"
    elif should_scan_resolved_deadline:
        params["deadline"] = f"gte.{today_kst.isoformat()}"

    effective_category = category or parent_categories.get(str(category_detail or "").strip())
    if effective_category:
        params["category"] = f"eq.{effective_category}"
    if region_detail:
        params["region_detail"] = f"eq.{region_detail}"
    if normalized_teaching_methods:
        quoted_values = ",".join(f'"{value}"' for value in normalized_teaching_methods)
        params["teaching_method"] = f"in.({quoted_values})"
    if normalized_region_keywords:
        params["or"] = "(" + ",".join(f"location.ilike.*{keyword}*" for keyword in normalized_region_keywords) + ")"
    if normalized_sources:
        quoted_sources = ",".join(f'"{source}"' for source in normalized_sources)
        params["source"] = f"in.({quoted_sources})"
    if search_filter:
        params[PROGRAM_SEARCH_INDEX_COLUMN] = search_filter
    return params
