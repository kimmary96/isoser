import type { ProgramSort } from "@/lib/types";

type ProgramSortOption = {
  value: ProgramSort;
  label: string;
};

const PROGRAM_SORT_DEFINITIONS = [
  { value: "default", label: "기본 정렬" },
  { value: "deadline", label: "마감 임박순" },
  { value: "popular", label: "인기순" },
  { value: "start_soon", label: "개강 빠른순" },
  { value: "cost_low", label: "비용 낮은순" },
  { value: "cost_high", label: "비용 높은순" },
  { value: "duration_short", label: "짧은 기간순" },
  { value: "duration_long", label: "긴 기간순" },
] as const satisfies readonly ProgramSortOption[];

export const DEFAULT_PROGRAM_SORT: ProgramSort = "default";

export const PROGRAM_SORT_OPTIONS: readonly ProgramSortOption[] = PROGRAM_SORT_DEFINITIONS;

export const PROGRAM_SORT_LABELS: Record<ProgramSort, string> = Object.fromEntries(
  PROGRAM_SORT_DEFINITIONS.map((option) => [option.value, option.label])
) as Record<ProgramSort, string>;

const PROGRAM_SORT_VALUES = new Set<ProgramSort>(PROGRAM_SORT_DEFINITIONS.map((option) => option.value));

export function isProgramSort(value: string): value is ProgramSort {
  return PROGRAM_SORT_VALUES.has(value as ProgramSort);
}

export function normalizeProgramSort(value?: string | string[]): ProgramSort {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue && isProgramSort(rawValue) ? rawValue : DEFAULT_PROGRAM_SORT;
}
