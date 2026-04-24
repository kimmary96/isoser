import type { ProgramCardSummary, ProgramListParams, ProgramListRow } from "./types";

export const URGENT_PROGRAM_LIMIT = 12;

function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim());
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getProgramDisplayCategories(
  program: Pick<ProgramCardSummary, "category" | "category_detail" | "display_categories">
): string[] {
  const derived = normalizeTextList(program.display_categories);
  if (derived.length) return derived.slice(0, 2);
  return [program.category, program.category_detail].filter((value): value is string => Boolean(value?.trim())).slice(0, 2);
}

export function buildUrgentProgramsParams(limit = URGENT_PROGRAM_LIMIT): ProgramListParams {
  return {
    recruiting_only: true,
    sort: "deadline",
    limit,
    offset: 0,
  };
}

export function buildUrgentProgramChips(
  program: Pick<
    ProgramListRow,
    "category" | "category_detail" | "display_categories" | "extracted_keywords" | "skills"
  >
): string[] {
  return Array.from(
    new Set([
      ...getProgramDisplayCategories(program),
      ...normalizeTextList(program.extracted_keywords),
      ...normalizeTextList(program.skills),
    ])
  ).slice(0, 4);
}
