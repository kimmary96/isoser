import { listProgramsPage } from "@/lib/api/backend";
import { fetchBackendResponse } from "@/lib/api/backend-endpoint";
import { toRecommendationProgramCardItem } from "@/lib/program-card-items";
import { getProgramId, isRecruitingProgramSummary } from "@/lib/program-display";
import type { ProgramCardItem, ProgramRecommendResponse } from "@/lib/types";

import { COMPARE_COPY } from "./compare-copy";
import { normalizeTextList } from "./compare-formatters";
import type { CompareProgram } from "./compare-value-getters";

const COMPARE_SUGGESTION_LIMIT = 4;
const COMPARE_SUGGESTION_POOL_LIMIT = 12;
const COMPARE_RECOMMEND_TIMEOUT_MS = 3500;

type CompareSuggestionSource =
  | "bookmark"
  | "recommendation"
  | "similar"
  | "public";

export type CompareSuggestionOptions = {
  accessToken: string | null;
  activePrograms: CompareProgram[];
  canonicalIds: string[];
  initialBookmarkedItems: ProgramCardItem[];
};

export type CompareSuggestionResult = {
  suggestions: ProgramCardItem[];
  error: string | null;
};

function getSuggestionReason(source: CompareSuggestionSource): string {
  if (source === "bookmark") return COMPARE_COPY.suggestionReasons.bookmark;
  if (source === "recommendation") return COMPARE_COPY.suggestionReasons.recommendation;
  if (source === "similar") return COMPARE_COPY.suggestionReasons.similar;
  return COMPARE_COPY.suggestionReasons.public;
}

function withCompareSuggestionContext(
  item: ProgramCardItem,
  source: CompareSuggestionSource
): ProgramCardItem {
  const reason =
    source === "similar"
      ? item.context?.reason?.trim() || getSuggestionReason(source)
      : getSuggestionReason(source);
  return {
    program: item.program,
    context: {
      ...item.context,
      surface: `compare_suggestion_${source}`,
      reason,
    },
  };
}

function addSuggestionCandidates(
  target: ProgramCardItem[],
  items: ProgramCardItem[],
  source: CompareSuggestionSource,
  seenIds: Set<string>
) {
  for (const item of items) {
    if (target.length >= COMPARE_SUGGESTION_LIMIT) return;

    const programId = getProgramId(item.program);
    if (!programId || seenIds.has(programId) || !isRecruitingProgramSummary(item.program)) {
      continue;
    }

    seenIds.add(programId);
    target.push(withCompareSuggestionContext(item, source));
  }
}

function cleanSuggestionText(value: string | number | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text || text === "정보 없음" || text === "데이터 미수집") {
    return null;
  }
  return text;
}

function collectSimilarityKeywords(programs: CompareProgram[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const program of programs) {
    const detail = program.detail ?? null;
    const candidates = [
      ...normalizeTextList(detail?.extracted_keywords),
      ...normalizeTextList(program.extracted_keywords),
      ...normalizeTextList(program.skills),
      ...normalizeTextList(detail?.display_categories),
      ...normalizeTextList(program.display_categories),
      detail?.ncs_name,
      detail?.ncs_code,
      detail?.category_detail,
      program.category_detail,
      detail?.category,
      program.category,
      detail?.location,
      program.location,
    ];

    for (const candidate of candidates) {
      const text = cleanSuggestionText(candidate);
      if (!text) continue;

      const normalized = text.toLowerCase();
      if (seen.has(normalized)) continue;

      seen.add(normalized);
      keywords.push(text);
      if (keywords.length >= 3) {
        return keywords;
      }
    }
  }

  return keywords;
}

async function loadComparePersonalizedSuggestions(
  accessToken: string | null
): Promise<ProgramCardItem[]> {
  if (!accessToken) {
    return [];
  }

  const response = await fetchBackendResponse(
    "/programs/recommend",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ top_k: COMPARE_SUGGESTION_POOL_LIMIT }),
    },
    { timeoutMs: COMPARE_RECOMMEND_TIMEOUT_MS }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || COMPARE_COPY.errors.personalizedCandidates);
  }

  const data = (await response.json()) as ProgramRecommendResponse;
  return (data.items ?? [])
    .map(toRecommendationProgramCardItem)
    .filter((item): item is ProgramCardItem => Boolean(item));
}

async function loadCompareSimilarSuggestions(
  activePrograms: CompareProgram[]
): Promise<ProgramCardItem[]> {
  const keywords = collectSimilarityKeywords(activePrograms);
  const items: ProgramCardItem[] = [];
  const seenIds = new Set<string>();

  for (const keyword of keywords) {
    const page = await listProgramsPage({
      q: keyword,
      scope: "all",
      limit: COMPARE_SUGGESTION_POOL_LIMIT,
      sort: "default",
      recruiting_only: true,
    });

    for (const item of page.items) {
      const programId = getProgramId(item.program);
      if (!programId || seenIds.has(programId)) continue;

      seenIds.add(programId);
      items.push({
        program: item.program,
        context: {
          ...item.context,
          reason: `${keyword} 키워드 유사`,
        },
      });
    }

    if (items.length >= COMPARE_SUGGESTION_POOL_LIMIT) {
      break;
    }
  }

  return items;
}

async function loadComparePublicSuggestions(): Promise<ProgramCardItem[]> {
  const page = await listProgramsPage({
    limit: COMPARE_SUGGESTION_POOL_LIMIT,
    sort: "default",
    recruiting_only: true,
  });

  return page.items.map((item) => ({
    program: item.program,
    context: item.context,
  }));
}

export async function loadCompareSuggestions({
  accessToken,
  activePrograms,
  canonicalIds,
  initialBookmarkedItems,
}: CompareSuggestionOptions): Promise<CompareSuggestionResult> {
  const suggestions: ProgramCardItem[] = [];
  const seenIds = new Set(canonicalIds);
  const errors: string[] = [];

  addSuggestionCandidates(suggestions, initialBookmarkedItems, "bookmark", seenIds);

  const loaders: Array<{
    source: Exclude<CompareSuggestionSource, "bookmark">;
    load: () => Promise<ProgramCardItem[]>;
  }> = [
    {
      source: "similar",
      load: () => loadCompareSimilarSuggestions(activePrograms),
    },
    {
      source: "recommendation",
      load: () => loadComparePersonalizedSuggestions(accessToken),
    },
    {
      source: "public",
      load: loadComparePublicSuggestions,
    },
  ];

  for (const loader of loaders) {
    if (suggestions.length >= COMPARE_SUGGESTION_LIMIT) break;

    try {
      const items = await loader.load();
      addSuggestionCandidates(suggestions, items, loader.source, seenIds);
    } catch {
      errors.push(COMPARE_COPY.errors.candidates);
    }
  }

  return {
    suggestions,
    error: suggestions.length === 0 && errors.length > 0 ? COMPARE_COPY.errors.candidates : null,
  };
}
