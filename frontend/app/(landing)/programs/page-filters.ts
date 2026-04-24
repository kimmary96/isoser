import type { ProgramSort } from "@/lib/types";

import { DEFAULT_PROGRAM_SORT, PROGRAM_SORT_LABELS } from "./program-sort";
import type { NamedFilterOption, ProgramCategoryMenuOption, ProgramsFilterChip } from "./programs-filter-bar";

export const PAGE_SIZE = 20;
export const REGION_OPTIONS = [
  "서울",
  "경기",
  "제주",
  "부산",
  "강원",
  "해외",
  "대구",
  "충북",
  "인천",
  "충남",
  "광주",
  "전북",
  "대전",
  "전남",
  "울산",
  "경북",
  "세종",
  "경남",
] as const;
export const TEACHING_METHOD_OPTIONS = ["온라인", "오프라인", "혼합"] as const;
export const COST_TYPE_OPTIONS: readonly NamedFilterOption[] = [
  { value: "naeil-card", label: "내일배움카드" },
  { value: "free-no-card", label: "무료 (내배카 X)" },
  { value: "paid", label: "유료" },
];
export const PARTICIPATION_TIME_OPTIONS: readonly NamedFilterOption[] = [
  { value: "part-time", label: "파트타임" },
  { value: "full-time", label: "풀타임" },
];
export const SOURCE_OPTIONS: readonly NamedFilterOption[] = [
  { value: "고용24", label: "고용24" },
  { value: "kstartup", label: "K-Startup" },
  { value: "sesac", label: "SeSAC" },
];
export const TARGET_OPTIONS: readonly NamedFilterOption[] = [
  { value: "청년", label: "청년" },
  { value: "여성", label: "여성" },
  { value: "중장년", label: "중장년" },
  { value: "창업", label: "창업" },
  { value: "재직자", label: "재직자" },
  { value: "구직자", label: "구직자" },
  { value: "대학생", label: "대학생" },
];
export const PROGRAM_CATEGORY_OPTIONS: readonly ProgramCategoryMenuOption[] = [
  { id: "all", label: "전체", category: "전체", dotClassName: "bg-slate-400" },
  { id: "web-development", label: "웹개발", category: "IT", dotClassName: "bg-violet-500" },
  { id: "mobile", label: "모바일", category: "IT", dotClassName: "bg-blue-500" },
  { id: "data-ai", label: "데이터·AI", category: "AI", dotClassName: "bg-emerald-500" },
  { id: "cloud-security", label: "클라우드·보안", category: "IT", dotClassName: "bg-sky-500" },
  { id: "iot-embedded-semiconductor", label: "IoT·임베디드·반도체", category: "IT", dotClassName: "bg-indigo-500" },
  { id: "game-blockchain", label: "게임·블록체인", category: "IT", dotClassName: "bg-pink-500" },
  { id: "planning-marketing-other", label: "기획·마케팅·기타", category: "경영", dotClassName: "bg-teal-500" },
  { id: "design-3d", label: "디자인·3D", category: "디자인", dotClassName: "bg-orange-500" },
  { id: "project-career-startup", label: "프로젝트·취준·창업", category: "창업", dotClassName: "bg-lime-600" },
];

export type ProgramsPageSearchParams = {
  q?: string | string[];
  category?: string | string[];
  category_detail?: string | string[];
  regions?: string | string[];
  teaching_methods?: string | string[];
  cost_types?: string | string[];
  participation_times?: string | string[];
  sources?: string | string[];
  targets?: string | string[];
  closed?: string | string[];
  scope?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};

type ProgramsHrefParams = {
  q?: string;
  categoryId?: string;
  regions?: string[];
  teachingMethods?: string[];
  costTypes?: string[];
  participationTimes?: string[];
  sources?: string[];
  targets?: string[];
  closed?: boolean;
  sort?: ProgramSort;
  page?: number;
};

function takeFirst(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDelimitedValues(value?: string | string[]): string[] {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  return candidates.flatMap((candidate) =>
    candidate
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function normalizeSelectedCategoryOption(value?: string | string[]): ProgramCategoryMenuOption {
  const rawCategory = takeFirst(value);
  if (!rawCategory || rawCategory === "전체") {
    return PROGRAM_CATEGORY_OPTIONS[0];
  }

  const byId = PROGRAM_CATEGORY_OPTIONS.find((option) => option.id === rawCategory);
  if (byId) {
    return byId;
  }

  return PROGRAM_CATEGORY_OPTIONS.find((option) => option.category === rawCategory) || PROGRAM_CATEGORY_OPTIONS[0];
}

export function normalizeQuery(value?: string | string[]): string {
  return (takeFirst(value) || "").trim();
}

export function normalizeRegions(value?: string | string[]): string[] {
  const normalized = normalizeDelimitedValues(value);
  return REGION_OPTIONS.filter((region) => normalized.includes(region));
}

export function normalizeTeachingMethods(value?: string | string[]): string[] {
  const normalized = normalizeDelimitedValues(value);
  return TEACHING_METHOD_OPTIONS.filter((method) => normalized.includes(method));
}

export function normalizeNamedOptions(
  value: string | string[] | undefined,
  options: readonly NamedFilterOption[]
): string[] {
  const normalized = normalizeDelimitedValues(value);
  return options.map((option) => option.value).filter((optionValue) => normalized.includes(optionValue));
}

export function dynamicOrFallbackOptions(
  dynamicOptions: readonly NamedFilterOption[] | null | undefined,
  fallbackOptions: readonly NamedFilterOption[]
): readonly NamedFilterOption[] {
  if (!dynamicOptions?.length) {
    return fallbackOptions;
  }

  const seen = new Set<string>();
  return dynamicOptions
    .map((option) => ({
      value: String(option.value || "").trim(),
      label: String(option.label || option.value || "").trim(),
    }))
    .filter((option) => {
      if (!option.value || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
}

export function findOptionLabel(options: readonly NamedFilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label || value;
}

export function normalizeShowClosed(value?: string | string[]): boolean {
  const closed = takeFirst(value);
  return closed === "true" || closed === "1" || closed === "on";
}

export function normalizePage(value?: string | string[]): number {
  const page = Number.parseInt(takeFirst(value) || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function buildProgramsHref(params: ProgramsHrefParams): string {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.categoryId && params.categoryId !== "all") searchParams.set("category_detail", params.categoryId);
  params.regions?.forEach((region) => searchParams.append("regions", region));
  params.teachingMethods?.forEach((method) => searchParams.append("teaching_methods", method));
  params.costTypes?.forEach((costType) => searchParams.append("cost_types", costType));
  params.participationTimes?.forEach((time) => searchParams.append("participation_times", time));
  params.sources?.forEach((source) => searchParams.append("sources", source));
  params.targets?.forEach((target) => searchParams.append("targets", target));
  if (params.q) searchParams.set("scope", "all");
  if (params.closed) searchParams.set("closed", "true");
  if (params.sort && params.sort !== DEFAULT_PROGRAM_SORT) searchParams.set("sort", params.sort);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));

  const query = searchParams.toString();
  return query ? `/programs?${query}` : "/programs";
}

export function renderActiveFilters(params: {
  q: string;
  categoryId: string;
  categoryLabel: string;
  regions: string[];
  teachingMethods: string[];
  costTypes: string[];
  participationTimes: string[];
  sources: string[];
  targets: string[];
  sourceOptions: readonly NamedFilterOption[];
  targetOptions: readonly NamedFilterOption[];
  showClosed: boolean;
  sort: ProgramSort;
}) {
  const chips: ProgramsFilterChip[] = [];
  const baseHrefParams: ProgramsHrefParams = {
    q: params.q,
    categoryId: params.categoryId,
    regions: params.regions,
    teachingMethods: params.teachingMethods,
    costTypes: params.costTypes,
    participationTimes: params.participationTimes,
    sources: params.sources,
    targets: params.targets,
    closed: params.showClosed,
    sort: params.sort,
  };
  const hrefWith = (overrides: ProgramsHrefParams) => buildProgramsHref({ ...baseHrefParams, ...overrides });

  if (params.q) {
    chips.push({ label: `검색: ${params.q}`, href: hrefWith({ q: undefined }) });
  }

  if (params.categoryId !== "all") {
    chips.push({ label: `카테고리: ${params.categoryLabel}`, href: hrefWith({ categoryId: undefined }) });
  }

  params.regions.forEach((region) => {
    chips.push({
      label: `지역: ${region}`,
      href: hrefWith({ regions: params.regions.filter((item) => item !== region) }),
    });
  });

  params.teachingMethods.forEach((method) => {
    chips.push({
      label: `수업 방식: ${method}`,
      href: hrefWith({ teachingMethods: params.teachingMethods.filter((item) => item !== method) }),
    });
  });

  params.costTypes.forEach((costType) => {
    chips.push({
      label: `비용: ${findOptionLabel(COST_TYPE_OPTIONS, costType)}`,
      href: hrefWith({ costTypes: params.costTypes.filter((item) => item !== costType) }),
    });
  });

  params.participationTimes.forEach((time) => {
    chips.push({
      label: `참여 시간: ${findOptionLabel(PARTICIPATION_TIME_OPTIONS, time)}`,
      href: hrefWith({ participationTimes: params.participationTimes.filter((item) => item !== time) }),
    });
  });

  params.sources.forEach((source) => {
    chips.push({
      label: `운영 기관: ${findOptionLabel(params.sourceOptions, source)}`,
      href: hrefWith({ sources: params.sources.filter((item) => item !== source) }),
    });
  });

  params.targets.forEach((target) => {
    chips.push({
      label: `추천 대상: ${findOptionLabel(params.targetOptions, target)}`,
      href: hrefWith({ targets: params.targets.filter((item) => item !== target) }),
    });
  });

  if (params.showClosed) {
    chips.push({ label: "최근 3개월 마감 포함", href: hrefWith({ closed: false }) });
  }

  if (params.sort !== DEFAULT_PROGRAM_SORT) {
    chips.push({
      label: `정렬: ${PROGRAM_SORT_LABELS[params.sort]}`,
      href: hrefWith({ sort: undefined }),
    });
  }

  return chips;
}
