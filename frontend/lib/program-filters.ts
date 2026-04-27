import {
  formatProgramCostLabel,
  getProgramOutOfPocketAmount,
  getProgramTrainingModeLabel,
  hasTomorrowLearningCardRequirement,
} from "@/lib/program-display";
import type { ProgramListParams, ProgramListRow } from "@/lib/types";

export type ProgramFilterChipDefinition =
  | { label: string; kind: "all" }
  | { label: string; kind: "category"; category: string; matchTerms?: readonly string[] }
  | { label: string; kind: "region"; regions: readonly string[] }
  | { label: string; kind: "teaching-method"; teachingMethods: readonly string[] }
  | { label: string; kind: "cost"; costTypes: readonly string[] };

export const PROGRAM_FILTER_CHIP_DEFINITIONS: readonly ProgramFilterChipDefinition[] = [
  { label: "전체", kind: "all" },
  { label: "무료", kind: "cost", costTypes: ["free-no-card", "naeil-card"] },
  { label: "AI·데이터", kind: "category", category: "AI" },
  { label: "IT·개발", kind: "category", category: "IT" },
  { label: "디자인", kind: "category", category: "디자인" },
  { label: "경영", kind: "category", category: "경영" },
  {
    label: "창업",
    kind: "category",
    category: "창업",
    matchTerms: ["k-startup", "kstartup", "창업진흥원", "예비창업", "스타트업", "창업"],
  },
  { label: "서울", kind: "region", regions: ["서울"] },
  { label: "경기", kind: "region", regions: ["경기"] },
  { label: "온라인", kind: "teaching-method", teachingMethods: ["온라인"] },
] as const;

export const PROGRAM_FILTER_CHIPS = PROGRAM_FILTER_CHIP_DEFINITIONS.map((chip) => chip.label);

export function getProgramFilterChipDefinition(
  activeChip: string | null | undefined
): ProgramFilterChipDefinition | null {
  if (!activeChip) {
    return PROGRAM_FILTER_CHIP_DEFINITIONS[0] ?? null;
  }

  return PROGRAM_FILTER_CHIP_DEFINITIONS.find((chip) => chip.label === activeChip) ?? null;
}

export function isAllProgramFilterChip(activeChip: string | null | undefined): boolean {
  return getProgramFilterChipDefinition(activeChip)?.kind === "all";
}

function inferProgramCostType(program: ProgramListRow): string | null {
  const outOfPocketAmount = getProgramOutOfPocketAmount(program);
  if (outOfPocketAmount !== null) {
    if (outOfPocketAmount === 0) {
      return hasTomorrowLearningCardRequirement(program) ? "naeil-card" : "free-no-card";
    }
    return "paid";
  }

  const explicitCostType = typeof program.cost_type === "string" ? program.cost_type.trim() : "";
  if (explicitCostType === "free-no-card" || explicitCostType === "naeil-card" || explicitCostType === "paid") {
    return explicitCostType;
  }

  if (hasTomorrowLearningCardRequirement(program)) {
    return "naeil-card";
  }

  if (typeof program.cost_type === "string" && program.cost_type.trim()) {
    return null;
  }

  if (typeof program.cost === "number") {
    if (program.cost === 0) {
      return "free-no-card";
    }
    if (program.cost > 0) {
      return "paid";
    }
  }

  const costText = [formatProgramCostLabel(program), program.support_type]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  if (/무료|전액\s*지원|자부담\s*0/i.test(costText)) {
    return "free-no-card";
  }

  return null;
}

function buildProgramFilterMatchText(program: ProgramListRow): string {
  return [
    program.title,
    program.provider,
    program.source,
    program.summary,
    program.description,
    program.category,
    program.category_detail,
    program.location,
    ...(Array.isArray(program.tags) ? program.tags : []),
    ...(Array.isArray(program.skills) ? program.skills : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

export function matchesProgramKeyword(
  program: ProgramListRow,
  keyword: string | null | undefined
): boolean {
  const normalizedKeyword = String(keyword ?? "").trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return buildProgramFilterMatchText(program).includes(normalizedKeyword);
}

export function matchesProgramFilterChip(
  program: ProgramListRow,
  activeChip: string | null | undefined
): boolean {
  const chip = getProgramFilterChipDefinition(activeChip);
  if (!chip || chip.kind === "all") {
    return true;
  }

  if (chip.kind === "category") {
    if (program.category === chip.category) {
      return true;
    }

    if (chip.matchTerms?.length) {
      const haystack = buildProgramFilterMatchText(program);
      return chip.matchTerms.some((term) => haystack.includes(term.toLowerCase()));
    }

    return false;
  }

  if (chip.kind === "region") {
    const locationText = [program.location]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    return chip.regions.some((region) => locationText.includes(region));
  }

  if (chip.kind === "teaching-method") {
    const trainingMode = getProgramTrainingModeLabel(program);
    return Boolean(trainingMode && chip.teachingMethods.includes(trainingMode));
  }

  if (chip.kind === "cost") {
    const inferredCostType = inferProgramCostType(program);
    return Boolean(inferredCostType && chip.costTypes.includes(inferredCostType));
  }

  return true;
}

export function buildProgramFilterParams(activeChip: string, keyword: string, limit = 6): ProgramListParams {
  const chip = getProgramFilterChipDefinition(activeChip);
  const params: ProgramListParams = {
    q: keyword || undefined,
    recruiting_only: true,
    sort: chip?.kind === "all" ? "default" : "deadline",
    limit,
  };

  if (!chip || chip.kind === "all") {
    return params;
  }

  if (chip.kind === "category") {
    params.category = chip.category;
    return params;
  }

  if (chip.kind === "cost") {
    params.cost_types = [...chip.costTypes];
    return params;
  }

  if (chip.kind === "region") {
    params.regions = [...chip.regions];
    return params;
  }

  if (chip.kind === "teaching-method") {
    params.teaching_methods = [...chip.teachingMethods];
    return params;
  }

  return params;
}
