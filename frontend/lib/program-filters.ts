import type { ProgramListParams } from "@/lib/types";

export const PROGRAM_FILTER_CHIPS = [
  "전체",
  "마감임박",
  "AI·데이터",
  "IT·개발",
  "디자인",
  "경영",
  "창업",
  "서울",
  "경기",
  "온라인",
  "국비100%",
];

export const PROGRAM_CATEGORY_FILTER_MAP: Record<string, string> = {
  "AI·데이터": "AI",
  "IT·개발": "IT",
  디자인: "디자인",
  경영: "경영",
  창업: "창업",
};

export const PROGRAM_REGION_FILTER_MAP: Record<string, string[]> = {
  서울: ["서울"],
  경기: ["경기"],
  온라인: ["온라인"],
};

export function buildProgramFilterParams(activeChip: string, keyword: string, limit = 6): ProgramListParams {
  const params: ProgramListParams = {
    q: keyword || undefined,
    sort: "deadline",
    limit,
  };

  if (activeChip === "마감임박") {
    params.recruiting_only = true;
    return params;
  }

  const category = PROGRAM_CATEGORY_FILTER_MAP[activeChip];
  if (category) {
    params.category = category;
    return params;
  }

  const regions = PROGRAM_REGION_FILTER_MAP[activeChip];
  if (regions) {
    params.regions = regions;
    return params;
  }

  if (activeChip === "국비100%") {
    params.q = keyword ? `${keyword} 국비 100%` : "국비 100%";
  }

  return params;
}

