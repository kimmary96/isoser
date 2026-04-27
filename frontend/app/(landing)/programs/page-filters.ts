import type { ProgramSort } from "@/lib/types";
import { countActiveProgramFilterGroups, resolvePublicProgramListScope } from "@/lib/program-list-scope";

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
  { value: "other", label: "기타 기관" },
];
export const TARGET_OPTIONS: readonly NamedFilterOption[] = [
  { value: "청년", label: "청년" },
  { value: "여성", label: "여성" },
  { value: "창업", label: "창업" },
  { value: "재직자", label: "재직자" },
  { value: "대학생", label: "대학생" },
];
export const PROGRAM_CATEGORY_OPTIONS: readonly ProgramCategoryMenuOption[] = [
  { id: "all", label: "전체", category: "전체", dotClassName: "bg-slate-400" },
  { id: "ncs-01", label: "사업관리", category: "전체", dotClassName: "bg-lime-600" },
  { id: "ncs-02", label: "경영·회계·사무", category: "전체", dotClassName: "bg-teal-500" },
  { id: "ncs-03", label: "금융·보험", category: "전체", dotClassName: "bg-cyan-500" },
  { id: "ncs-04", label: "교육·자연·사회과학", category: "전체", dotClassName: "bg-amber-500" },
  { id: "ncs-05", label: "법률·경찰·소방·교도·국방", category: "전체", dotClassName: "bg-zinc-500" },
  { id: "ncs-06", label: "보건·의료", category: "전체", dotClassName: "bg-rose-500" },
  { id: "ncs-07", label: "사회복지·종교", category: "전체", dotClassName: "bg-pink-500" },
  { id: "ncs-08", label: "문화·예술·디자인·방송", category: "전체", dotClassName: "bg-orange-500" },
  { id: "ncs-09", label: "운전·운송", category: "전체", dotClassName: "bg-blue-500" },
  { id: "ncs-10", label: "영업판매", category: "전체", dotClassName: "bg-emerald-500" },
  { id: "ncs-11", label: "경비·청소", category: "전체", dotClassName: "bg-gray-500" },
  { id: "ncs-12", label: "이용·숙박·여행·오락·스포츠", category: "전체", dotClassName: "bg-yellow-500" },
  { id: "ncs-13", label: "음식서비스", category: "전체", dotClassName: "bg-red-500" },
  { id: "ncs-14", label: "건설", category: "전체", dotClassName: "bg-stone-500" },
  { id: "ncs-15", label: "기계", category: "전체", dotClassName: "bg-slate-500" },
  { id: "ncs-16", label: "재료", category: "전체", dotClassName: "bg-neutral-500" },
  { id: "ncs-17", label: "화학·바이오", category: "전체", dotClassName: "bg-green-500" },
  { id: "ncs-18", label: "섬유·의복", category: "전체", dotClassName: "bg-fuchsia-500" },
  { id: "ncs-19", label: "전기·전자", category: "전체", dotClassName: "bg-indigo-500" },
  { id: "ncs-20", label: "정보통신", category: "전체", dotClassName: "bg-violet-500" },
  { id: "ncs-21", label: "식품가공", category: "전체", dotClassName: "bg-red-400" },
  { id: "ncs-22", label: "인쇄·목재·가구·공예", category: "전체", dotClassName: "bg-orange-700" },
  { id: "ncs-23", label: "환경·에너지·안전", category: "전체", dotClassName: "bg-sky-500" },
  { id: "ncs-24", label: "농림어업", category: "전체", dotClassName: "bg-emerald-700" },
];
const LEGACY_CATEGORY_OPTION_ALIASES: Record<string, string> = {
  "web-development": "ncs-20",
  mobile: "ncs-20",
  "data-ai": "ncs-20",
  "cloud-security": "ncs-20",
  "iot-embedded-semiconductor": "ncs-19",
  "game-blockchain": "ncs-20",
  "planning-marketing-other": "ncs-02",
  "design-3d": "ncs-08",
  "project-career-startup": "ncs-01",
  IT: "ncs-20",
  AI: "ncs-20",
  경영: "ncs-02",
  디자인: "ncs-08",
  창업: "ncs-01",
};

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

  const alias = LEGACY_CATEGORY_OPTION_ALIASES[rawCategory];
  if (alias) {
    return PROGRAM_CATEGORY_OPTIONS.find((option) => option.id === alias) || PROGRAM_CATEGORY_OPTIONS[0];
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

function normalizeOptionLookupToken(value: string): string {
  return value.toLowerCase().replace(/[\s\-_]+/g, "");
}

function getCanonicalSourceOption(value: string, label: string): NamedFilterOption | null {
  const lookup = normalizeOptionLookupToken(`${value}${label}`);

  if (!lookup) {
    return null;
  }

  if (lookup.includes("kstartup") || lookup.includes("창업진흥원")) {
    return SOURCE_OPTIONS.find((option) => option.value === "kstartup") || null;
  }

  if (lookup.includes("sesac") || lookup.includes("새싹") || lookup.includes("서울소프트웨어아카데미")) {
    return SOURCE_OPTIONS.find((option) => option.value === "sesac") || null;
  }

  if (lookup.includes("고용24") || lookup.includes("work24")) {
    return SOURCE_OPTIONS.find((option) => option.value === "고용24") || null;
  }

  if (lookup === "other" || lookup.includes("기타기관")) {
    return SOURCE_OPTIONS.find((option) => option.value === "other") || null;
  }

  return null;
}

export function canonicalizeSourceFilterOption(option: NamedFilterOption): NamedFilterOption {
  const value = String(option.value || "").trim();
  const label = String(option.label || option.value || "").trim();
  return getCanonicalSourceOption(value, label) || { value, label };
}

export function dynamicOrFallbackOptions(
  dynamicOptions: readonly NamedFilterOption[] | null | undefined,
  fallbackOptions: readonly NamedFilterOption[],
  canonicalizeOption?: (option: NamedFilterOption) => NamedFilterOption
): readonly NamedFilterOption[] {
  if (!dynamicOptions?.length) {
    return fallbackOptions;
  }

  const seen = new Set<string>();
  return [...dynamicOptions, ...fallbackOptions]
    .map((option) =>
      canonicalizeOption
        ? canonicalizeOption(option)
        : {
            value: String(option.value || "").trim(),
            label: String(option.label || option.value || "").trim(),
          }
    )
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
  if (params.closed) searchParams.set("closed", "true");
  const scope = resolvePublicProgramListScope({
    keyword: params.q,
    includeClosedRecent: params.closed,
    activeFilterGroupCount: countActiveProgramFilterGroups({
      categoryId: params.categoryId,
      regions: params.regions,
      teachingMethods: params.teachingMethods,
      costTypes: params.costTypes,
      participationTimes: params.participationTimes,
      sources: params.sources,
      targets: params.targets,
    }),
  });
  if (scope !== "default") searchParams.set("scope", scope);
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
