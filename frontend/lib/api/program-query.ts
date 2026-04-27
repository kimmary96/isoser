import type { ProgramListParams, ProgramSort } from "@/lib/types";

type RecommendationSearchParams = {
  category?: string;
  region?: string;
  forceRefresh?: boolean;
  topK?: number | string | null;
};

type CompareSearchParams = {
  q?: string;
  limit?: number;
  sort?: ProgramSort;
  recruitingOnly?: boolean;
};

function appendSingleValue(searchParams: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    searchParams.set(key, value);
  }
}

function appendNumericValue(searchParams: URLSearchParams, key: string, value: number | undefined) {
  if (typeof value === "number") {
    searchParams.set(key, String(value));
  }
}

function appendBooleanFlag(searchParams: URLSearchParams, key: string, value: boolean | undefined) {
  if (value) {
    searchParams.set(key, "true");
  }
}

function appendMultiValue(searchParams: URLSearchParams, key: string, values: string[] | undefined) {
  values?.forEach((value) => {
    if (value) {
      searchParams.append(key, value);
    }
  });
}

export function buildPathWithSearchParams(path: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function buildProgramListSearchParams(params?: ProgramListParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  appendSingleValue(searchParams, "q", params?.q);
  appendSingleValue(searchParams, "category", params?.category);
  appendSingleValue(searchParams, "category_detail", params?.category_detail);
  appendSingleValue(searchParams, "scope", params?.scope);
  appendSingleValue(searchParams, "region_detail", params?.region_detail);
  appendMultiValue(searchParams, "regions", params?.regions);
  appendMultiValue(searchParams, "sources", params?.sources);
  appendMultiValue(searchParams, "teaching_methods", params?.teaching_methods);
  appendMultiValue(searchParams, "cost_types", params?.cost_types);
  appendMultiValue(searchParams, "participation_times", params?.participation_times);
  appendMultiValue(searchParams, "targets", params?.targets);
  appendMultiValue(searchParams, "selection_processes", params?.selection_processes);
  appendMultiValue(searchParams, "employment_links", params?.employment_links);
  appendBooleanFlag(searchParams, "recruiting_only", params?.recruiting_only);
  appendBooleanFlag(searchParams, "include_closed_recent", params?.include_closed_recent);
  appendSingleValue(searchParams, "sort", params?.sort);
  appendNumericValue(searchParams, "limit", params?.limit);
  appendNumericValue(searchParams, "offset", params?.offset);
  appendSingleValue(searchParams, "cursor", params?.cursor);

  return searchParams;
}

export function buildRecommendationSearchParams(
  params?: RecommendationSearchParams
): URLSearchParams {
  const searchParams = new URLSearchParams();

  appendSingleValue(searchParams, "category", params?.category);
  appendSingleValue(searchParams, "region", params?.region);
  appendBooleanFlag(searchParams, "force_refresh", params?.forceRefresh);

  if (params?.topK !== null && params?.topK !== undefined && String(params.topK).trim()) {
    searchParams.set("top_k", String(params.topK).trim());
  }

  return searchParams;
}

export function buildCompareSearchParams(params?: CompareSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  appendSingleValue(searchParams, "q", params?.q);
  appendNumericValue(searchParams, "limit", params?.limit);
  appendSingleValue(searchParams, "sort", params?.sort);
  appendBooleanFlag(searchParams, "recruiting_only", params?.recruitingOnly);

  return searchParams;
}
