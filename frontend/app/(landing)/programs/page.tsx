import type { Metadata } from "next";
import Link from "next/link";

import AdSlot from "@/components/AdSlot";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { getProgramCount, listPrograms } from "@/lib/api/backend";
import { getSiteUrl } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Program, ProgramSort } from "@/lib/types";

import {
  ProgramsFilterBar,
  type NamedFilterOption,
  type ProgramCategoryMenuOption,
  type ProgramsFilterChip,
} from "./programs-filter-bar";
import { ProgramBookmarkStateProvider } from "./bookmark-state-provider";
import RecommendedProgramsSection from "./recommended-programs-section";
import ProgramCard, { isDisplayableProgram } from "./program-card";

export const metadata: Metadata = {
  title: "국비 교육·취업 지원 프로그램 목록 | 이소서",
  description:
    "카테고리, 지역, 모집중 여부와 마감 임박순 정렬로 국비 교육·취업 지원 프로그램을 빠르게 찾을 수 있는 이소서 프로그램 허브.",
  alternates: {
    canonical: "/programs",
  },
  openGraph: {
    title: "국비 교육·취업 지원 프로그램 목록 | 이소서",
    description:
      "카테고리, 지역, 모집중 여부와 마감 임박순 정렬로 국비 교육·취업 지원 프로그램을 빠르게 찾을 수 있는 이소서 프로그램 허브.",
    type: "website",
    url: getSiteUrl("/programs"),
  },
};

const PAGE_SIZE = 20;
const DEFAULT_SORT: ProgramSort = "deadline";
const REGION_OPTIONS = [
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
const TEACHING_METHOD_OPTIONS = ["온라인", "오프라인", "혼합"] as const;
const COST_TYPE_OPTIONS: readonly NamedFilterOption[] = [
  { value: "naeil-card", label: "내일배움카드" },
  { value: "free-no-card", label: "무료 (내배카 X)" },
  { value: "paid", label: "유료" },
];
const PARTICIPATION_TIME_OPTIONS: readonly NamedFilterOption[] = [
  { value: "part-time", label: "파트타임" },
  { value: "full-time", label: "풀타임" },
];
const SOURCE_OPTIONS: readonly NamedFilterOption[] = [
  { value: "고용24", label: "고용24" },
  { value: "kstartup", label: "K-Startup" },
  { value: "sesac", label: "SeSAC" },
];
const TARGET_OPTIONS: readonly NamedFilterOption[] = [
  { value: "청년", label: "청년" },
  { value: "여성", label: "여성" },
  { value: "중장년", label: "중장년" },
  { value: "창업", label: "창업" },
  { value: "재직자", label: "재직자" },
  { value: "구직자", label: "구직자" },
  { value: "대학생", label: "대학생" },
];
const SELECTION_PROCESS_OPTIONS: readonly NamedFilterOption[] = [
  { value: "서류", label: "서류" },
  { value: "면접", label: "면접" },
  { value: "테스트", label: "테스트" },
  { value: "선착순", label: "선착순" },
  { value: "추첨", label: "추첨" },
];
const EMPLOYMENT_LINK_OPTIONS: readonly NamedFilterOption[] = [
  { value: "채용연계", label: "채용 연계" },
  { value: "인턴십", label: "인턴십" },
  { value: "취업지원", label: "취업 지원" },
  { value: "멘토링", label: "멘토링" },
];
const PROGRAM_CATEGORY_OPTIONS: readonly ProgramCategoryMenuOption[] = [
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
const SORT_LABELS: Record<ProgramSort, string> = {
  deadline: "마감 임박순",
  latest: "최신순",
};

type ProgramsPageSearchParams = {
  q?: string | string[];
  category?: string | string[];
  category_detail?: string | string[];
  regions?: string | string[];
  teaching_methods?: string | string[];
  cost_types?: string | string[];
  participation_times?: string | string[];
  sources?: string | string[];
  targets?: string | string[];
  selection_processes?: string | string[];
  employment_links?: string | string[];
  closed?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};

type ProgramsPageProps = {
  searchParams: Promise<ProgramsPageSearchParams>;
};

function takeFirst(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSelectedCategoryOption(value?: string | string[]): ProgramCategoryMenuOption {
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

function normalizeQuery(value?: string | string[]): string {
  return (takeFirst(value) || "").trim();
}

function normalizeRegions(value?: string | string[]): string[] {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = candidates.flatMap((candidate) =>
    candidate
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  return REGION_OPTIONS.filter((region) => normalized.includes(region));
}

function normalizeTeachingMethods(value?: string | string[]): string[] {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = candidates.flatMap((candidate) =>
    candidate
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  return TEACHING_METHOD_OPTIONS.filter((method) => normalized.includes(method));
}

function normalizeNamedOptions(value: string | string[] | undefined, options: readonly NamedFilterOption[]): string[] {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = candidates.flatMap((candidate) =>
    candidate
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  return options.map((option) => option.value).filter((optionValue) => normalized.includes(optionValue));
}

function findOptionLabel(options: readonly NamedFilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label || value;
}

function normalizeShowClosed(value?: string | string[]): boolean {
  const closed = takeFirst(value);
  return closed === "true" || closed === "1" || closed === "on";
}

function normalizeSort(value?: string | string[]): ProgramSort {
  const sort = takeFirst(value);
  return sort === "latest" ? "latest" : DEFAULT_SORT;
}

function normalizePage(value?: string | string[]): number {
  const page = Number.parseInt(takeFirst(value) || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildProgramsHref(params: {
  q?: string;
  categoryId?: string;
  regions?: string[];
  teachingMethods?: string[];
  costTypes?: string[];
  participationTimes?: string[];
  sources?: string[];
  targets?: string[];
  selectionProcesses?: string[];
  employmentLinks?: string[];
  closed?: boolean;
  sort?: ProgramSort;
  page?: number;
}): string {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.categoryId && params.categoryId !== "all") searchParams.set("category_detail", params.categoryId);
  if (params.regions?.length) {
    params.regions.forEach((region) => searchParams.append("regions", region));
  }
  if (params.teachingMethods?.length) {
    params.teachingMethods.forEach((method) => searchParams.append("teaching_methods", method));
  }
  if (params.costTypes?.length) {
    params.costTypes.forEach((costType) => searchParams.append("cost_types", costType));
  }
  if (params.participationTimes?.length) {
    params.participationTimes.forEach((time) => searchParams.append("participation_times", time));
  }
  if (params.sources?.length) {
    params.sources.forEach((source) => searchParams.append("sources", source));
  }
  if (params.targets?.length) {
    params.targets.forEach((target) => searchParams.append("targets", target));
  }
  if (params.selectionProcesses?.length) {
    params.selectionProcesses.forEach((process) => searchParams.append("selection_processes", process));
  }
  if (params.employmentLinks?.length) {
    params.employmentLinks.forEach((link) => searchParams.append("employment_links", link));
  }
  if (params.closed) searchParams.set("closed", "true");
  if (params.sort && params.sort !== DEFAULT_SORT) searchParams.set("sort", params.sort);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));

  const query = searchParams.toString();
  return query ? `/programs?${query}` : "/programs";
}

function renderActiveFilters(params: {
  q: string;
  categoryId: string;
  categoryLabel: string;
  regions: string[];
  teachingMethods: string[];
  costTypes: string[];
  participationTimes: string[];
  sources: string[];
  targets: string[];
  selectionProcesses: string[];
  employmentLinks: string[];
  showClosed: boolean;
  sort: ProgramSort;
}) {
  const chips: ProgramsFilterChip[] = [];

  if (params.q) {
    chips.push({
      label: `검색: ${params.q}`,
      href: buildProgramsHref({
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  }

  if (params.categoryId !== "all") {
    chips.push({
      label: `카테고리: ${params.categoryLabel}`,
      href: buildProgramsHref({
        q: params.q,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  }

  params.regions.forEach((region) => {
    chips.push({
      label: `지역: ${region}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions.filter((item) => item !== region),
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  });

  params.teachingMethods.forEach((method) => {
    chips.push({
      label: `수업 방식: ${method}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods.filter((item) => item !== method),
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  });

  params.costTypes.forEach((costType) => {
    chips.push({
      label: `비용: ${findOptionLabel(COST_TYPE_OPTIONS, costType)}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes.filter((item) => item !== costType),
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  });

  params.participationTimes.forEach((time) => {
    chips.push({
      label: `참여 시간: ${findOptionLabel(PARTICIPATION_TIME_OPTIONS, time)}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes.filter((item) => item !== time),
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  });

  params.sources.forEach((source) => {
    chips.push({
      label: `운영 기관: ${findOptionLabel(SOURCE_OPTIONS, source)}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources.filter((item) => item !== source),
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  });

  params.targets.forEach((target) => {
    chips.push({
      label: `추천 대상: ${findOptionLabel(TARGET_OPTIONS, target)}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets.filter((item) => item !== target),
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  });

  params.selectionProcesses.forEach((process) => {
    chips.push({
      label: `선발 절차: ${findOptionLabel(SELECTION_PROCESS_OPTIONS, process)}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses.filter((item) => item !== process),
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  });

  params.employmentLinks.forEach((link) => {
    chips.push({
      label: `채용 연계: ${findOptionLabel(EMPLOYMENT_LINK_OPTIONS, link)}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks.filter((item) => item !== link),
        closed: params.showClosed,
        sort: params.sort,
      }),
    });
  });

  if (params.showClosed) {
    chips.push({
      label: "최근 3개월 마감 포함",
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        sort: params.sort,
      }),
    });
  }

  if (params.sort !== DEFAULT_SORT) {
    chips.push({
      label: `정렬: ${SORT_LABELS[params.sort]}`,
      href: buildProgramsHref({
        q: params.q,
        categoryId: params.categoryId,
        regions: params.regions,
        teachingMethods: params.teachingMethods,
        costTypes: params.costTypes,
        participationTimes: params.participationTimes,
        sources: params.sources,
        targets: params.targets,
        selectionProcesses: params.selectionProcesses,
        employmentLinks: params.employmentLinks,
        closed: params.showClosed,
      }),
    });
  }

  return chips;
}

export default async function ProgramsPage({ searchParams }: ProgramsPageProps) {
  const resolvedSearchParams = await searchParams;
  const q = normalizeQuery(resolvedSearchParams.q);
  const selectedCategory = normalizeSelectedCategoryOption(
    resolvedSearchParams.category_detail || resolvedSearchParams.category
  );
  const selectedRegions = normalizeRegions(resolvedSearchParams.regions);
  const selectedTeachingMethods = normalizeTeachingMethods(resolvedSearchParams.teaching_methods);
  const selectedCostTypes = normalizeNamedOptions(resolvedSearchParams.cost_types, COST_TYPE_OPTIONS);
  const selectedParticipationTimes = normalizeNamedOptions(
    resolvedSearchParams.participation_times,
    PARTICIPATION_TIME_OPTIONS
  );
  const selectedSources = normalizeNamedOptions(resolvedSearchParams.sources, SOURCE_OPTIONS);
  const selectedTargets = normalizeNamedOptions(resolvedSearchParams.targets, TARGET_OPTIONS);
  const selectedSelectionProcesses = normalizeNamedOptions(
    resolvedSearchParams.selection_processes,
    SELECTION_PROCESS_OPTIONS
  );
  const selectedEmploymentLinks = normalizeNamedOptions(resolvedSearchParams.employment_links, EMPLOYMENT_LINK_OPTIONS);
  const showClosedRecent = normalizeShowClosed(resolvedSearchParams.closed);
  const recruitingOnly = !showClosedRecent;
  const sort = normalizeSort(resolvedSearchParams.sort);
  const page = normalizePage(resolvedSearchParams.page);
  const offset = (page - 1) * PAGE_SIZE;
  const activeFilters = renderActiveFilters({
    q,
    categoryId: selectedCategory.id,
    categoryLabel: selectedCategory.label,
    regions: selectedRegions,
    teachingMethods: selectedTeachingMethods,
    costTypes: selectedCostTypes,
    participationTimes: selectedParticipationTimes,
    sources: selectedSources,
    targets: selectedTargets,
    selectionProcesses: selectedSelectionProcesses,
    employmentLinks: selectedEmploymentLinks,
    showClosed: showClosedRecent,
    sort,
  });

  let programs: Program[] = [];
  let urgentPrograms: Program[] = [];
  let totalCount = 0;
  let error: string | null = null;
  let isLoggedIn = false;
  let bookmarkedProgramIds: string[] = [];

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    isLoggedIn = Boolean(session);
    if (session?.user?.id) {
      const { data } = await supabase
        .from("program_bookmarks")
        .select("program_id")
        .eq("user_id", session.user.id);
      bookmarkedProgramIds = (data ?? [])
        .map((row) => String(row.program_id ?? "").trim())
        .filter(Boolean);
    }
  } catch {
    isLoggedIn = false;
    bookmarkedProgramIds = [];
  }

  try {
    [programs, urgentPrograms, totalCount] = await Promise.all([
      listPrograms({
        q: q || undefined,
        category: selectedCategory.category !== "전체" ? selectedCategory.category : undefined,
        category_detail: selectedCategory.id !== "all" ? selectedCategory.id : undefined,
        regions: selectedRegions,
        sources: selectedSources,
        teaching_methods: selectedTeachingMethods,
        cost_types: selectedCostTypes,
        participation_times: selectedParticipationTimes,
        targets: selectedTargets,
        selection_processes: selectedSelectionProcesses,
        employment_links: selectedEmploymentLinks,
        recruiting_only: recruitingOnly,
        include_closed_recent: showClosedRecent,
        sort,
        limit: PAGE_SIZE,
        offset,
      }),
      listPrograms({
        q: q || undefined,
        category: selectedCategory.category !== "전체" ? selectedCategory.category : undefined,
        category_detail: selectedCategory.id !== "all" ? selectedCategory.id : undefined,
        regions: selectedRegions,
        sources: selectedSources,
        teaching_methods: selectedTeachingMethods,
        cost_types: selectedCostTypes,
        participation_times: selectedParticipationTimes,
        targets: selectedTargets,
        selection_processes: selectedSelectionProcesses,
        employment_links: selectedEmploymentLinks,
        recruiting_only: true,
        sort: "deadline",
        limit: 12,
        offset: 0,
      }),
      getProgramCount({
        q: q || undefined,
        category: selectedCategory.category !== "전체" ? selectedCategory.category : undefined,
        category_detail: selectedCategory.id !== "all" ? selectedCategory.id : undefined,
        regions: selectedRegions,
        sources: selectedSources,
        teaching_methods: selectedTeachingMethods,
        cost_types: selectedCostTypes,
        participation_times: selectedParticipationTimes,
        targets: selectedTargets,
        selection_processes: selectedSelectionProcesses,
        employment_links: selectedEmploymentLinks,
        recruiting_only: recruitingOnly,
        include_closed_recent: showClosedRecent,
      }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "프로그램을 불러오는 중 문제가 발생했습니다.";
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const displayPrograms = programs.filter(isDisplayableProgram);
  const displayUrgentPrograms = urgentPrograms
    .filter(isDisplayableProgram)
    .filter((program) => typeof program.days_left === "number" && program.days_left >= 0 && program.days_left <= 7)
    .slice(0, 6);
  const previewPrograms = displayPrograms.slice(0, 3);
  const currentProgramsPath = buildProgramsHref({
    q,
    categoryId: selectedCategory.id,
    regions: selectedRegions,
    teachingMethods: selectedTeachingMethods,
    costTypes: selectedCostTypes,
    participationTimes: selectedParticipationTimes,
    sources: selectedSources,
    targets: selectedTargets,
    selectionProcesses: selectedSelectionProcesses,
    employmentLinks: selectedEmploymentLinks,
    closed: showClosedRecent,
    sort,
    page,
  });
  const loginHref = `/login?redirectedFrom=${encodeURIComponent(currentProgramsPath)}`;
  const safePage = Math.min(page, totalPages);
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (pageNumber) => pageNumber >= Math.max(1, safePage - 2) && pageNumber <= Math.min(totalPages, safePage + 2)
  );
  const hasAnyFilter = Boolean(
    q ||
      selectedCategory.id !== "all" ||
      selectedRegions.length ||
      selectedTeachingMethods.length ||
      selectedCostTypes.length ||
      selectedParticipationTimes.length ||
      selectedSources.length ||
      selectedTargets.length ||
      selectedSelectionProcesses.length ||
      selectedEmploymentLinks.length ||
      showClosedRecent ||
      sort !== DEFAULT_SORT
  );

  return (
    <>
      <LandingHeader />
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
          <ProgramsFilterBar
            q={q}
            selectedCategoryId={selectedCategory.id}
            categoryOptions={PROGRAM_CATEGORY_OPTIONS}
            selectedRegions={selectedRegions}
            selectedTeachingMethods={selectedTeachingMethods}
            selectedCostTypes={selectedCostTypes}
            selectedParticipationTimes={selectedParticipationTimes}
            selectedSources={selectedSources}
            selectedTargets={selectedTargets}
            selectedSelectionProcesses={selectedSelectionProcesses}
            selectedEmploymentLinks={selectedEmploymentLinks}
            showClosedRecent={showClosedRecent}
            sort={sort}
            activeFilters={activeFilters}
            regionOptions={REGION_OPTIONS}
            teachingMethodOptions={TEACHING_METHOD_OPTIONS}
            costTypeOptions={COST_TYPE_OPTIONS}
            participationTimeOptions={PARTICIPATION_TIME_OPTIONS}
            sourceOptions={SOURCE_OPTIONS}
            targetOptions={TARGET_OPTIONS}
            selectionProcessOptions={SELECTION_PROCESS_OPTIONS}
            employmentLinkOptions={EMPLOYMENT_LINK_OPTIONS}
          />

          <ProgramBookmarkStateProvider initialBookmarkedProgramIds={bookmarkedProgramIds}>
            <RecommendedProgramsSection
              isLoggedIn={isLoggedIn}
              loginHref={loginHref}
              previewPrograms={previewPrograms}
              bookmarkedProgramIds={bookmarkedProgramIds}
            />

            {displayUrgentPrograms.length > 0 ? (
              <section className="rounded-3xl border border-amber-100 bg-amber-50/60 p-6 shadow-sm">
                <div className="flex flex-col gap-2 border-b border-amber-100 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">Closing Soon</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">마감 임박 프로그램</h2>
                    <p className="mt-2 text-sm text-slate-600">현재 조건에서 7일 이내 마감되는 프로그램 {displayUrgentPrograms.length}개입니다.</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {displayUrgentPrograms.map((program) => (
                    <ProgramCard
                      key={String(program.id)}
                      program={program}
                      isLoggedIn={isLoggedIn}
                      initialBookmarked={bookmarkedProgramIds.includes(String(program.id ?? ""))}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="min-w-0">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <AdSlot
                  slotId="programs-results-top-banner"
                  className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                />
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {error ? "프로그램을 불러오지 못했습니다" : `전체 프로그램 ${totalCount}개`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedCategory.id === "all" ? "전체 카테고리" : selectedCategory.label}
                      {selectedRegions.length ? ` · ${selectedRegions.join(", ")}` : ""}
                      {selectedTeachingMethods.length ? ` · ${selectedTeachingMethods.join(", ")}` : ""}
                      {selectedCostTypes.length
                        ? ` · ${selectedCostTypes.map((item) => findOptionLabel(COST_TYPE_OPTIONS, item)).join(", ")}`
                        : ""}
                      {selectedParticipationTimes.length
                        ? ` · ${selectedParticipationTimes
                            .map((item) => findOptionLabel(PARTICIPATION_TIME_OPTIONS, item))
                            .join(", ")}`
                        : ""}
                      {showClosedRecent ? " · 최근 3개월 마감 포함" : " · 모집중만"}
                      {` · ${SORT_LABELS[sort]}`}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">
                    페이지 {safePage} / {totalPages}
                  </p>
                </div>

                {error ? (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-12 text-center text-sm text-rose-700">
                    {error}
                  </div>
                ) : displayPrograms.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
                    <p className="text-base font-semibold text-slate-900">
                      {hasAnyFilter ? "조건에 맞는 프로그램이 없습니다" : "현재 등록된 프로그램이 없습니다"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {hasAnyFilter
                        ? "검색어와 필터를 조정해 다른 프로그램을 찾아보세요."
                        : "동기화 이후 프로그램이 등록되면 이곳에 표시됩니다."}
                    </p>
                    {hasAnyFilter ? (
                      <div className="mt-5">
                        <Link
                          href="/programs"
                          className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          필터 초기화
                        </Link>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {displayPrograms.map((program) => (
                        <ProgramCard
                          key={String(program.id)}
                          program={program}
                          isLoggedIn={isLoggedIn}
                          initialBookmarked={bookmarkedProgramIds.includes(String(program.id ?? ""))}
                        />
                      ))}
                    </div>

                    {totalPages > 1 ? (
                      <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="페이지네이션">
                        <Link
                          href={buildProgramsHref({
                            q,
                            categoryId: selectedCategory.id,
                            regions: selectedRegions,
                            teachingMethods: selectedTeachingMethods,
                            costTypes: selectedCostTypes,
                            participationTimes: selectedParticipationTimes,
                            sources: selectedSources,
                            targets: selectedTargets,
                            selectionProcesses: selectedSelectionProcesses,
                            employmentLinks: selectedEmploymentLinks,
                            closed: showClosedRecent,
                            sort,
                            page: Math.max(1, safePage - 1),
                          })}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            safePage === 1
                              ? "pointer-events-none border-slate-200 text-slate-300"
                              : "border-slate-300 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          이전
                        </Link>
                        {visiblePages.map((pageNumber) => (
                          <Link
                            key={pageNumber}
                            href={buildProgramsHref({
                              q,
                              categoryId: selectedCategory.id,
                              regions: selectedRegions,
                              teachingMethods: selectedTeachingMethods,
                              costTypes: selectedCostTypes,
                              participationTimes: selectedParticipationTimes,
                              sources: selectedSources,
                              targets: selectedTargets,
                              selectionProcesses: selectedSelectionProcesses,
                              employmentLinks: selectedEmploymentLinks,
                              closed: showClosedRecent,
                              sort,
                              page: pageNumber,
                            })}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                              pageNumber === safePage
                                ? "bg-slate-950 text-white"
                                : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {pageNumber}
                          </Link>
                        ))}
                        <Link
                          href={buildProgramsHref({
                            q,
                            categoryId: selectedCategory.id,
                            regions: selectedRegions,
                            teachingMethods: selectedTeachingMethods,
                            costTypes: selectedCostTypes,
                            participationTimes: selectedParticipationTimes,
                            sources: selectedSources,
                            targets: selectedTargets,
                            selectionProcesses: selectedSelectionProcesses,
                            employmentLinks: selectedEmploymentLinks,
                            closed: showClosedRecent,
                            sort,
                            page: Math.min(totalPages, safePage + 1),
                          })}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                            safePage === totalPages
                              ? "pointer-events-none border-slate-200 text-slate-300"
                              : "border-slate-300 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          다음
                        </Link>
                      </nav>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          </ProgramBookmarkStateProvider>
        </div>
      </main>
    </>
  );
}
