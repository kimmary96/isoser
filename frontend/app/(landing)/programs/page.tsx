import type { Metadata } from "next";
import Link from "next/link";

import AdSlot from "@/components/AdSlot";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { getProgramFilterOptions, listPrograms, listProgramsPage } from "@/lib/api/backend";
import { unwrapProgramListRows } from "@/lib/program-display";
import { buildUrgentProgramsParams } from "@/lib/programs-page-layout";
import { getSiteUrl } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProgramListRow } from "@/lib/types";

import {
  buildProgramsHref,
  COST_TYPE_OPTIONS,
  dynamicOrFallbackOptions,
  findOptionLabel,
  normalizeNamedOptions,
  normalizePage,
  normalizeQuery,
  normalizeRegions,
  normalizeSelectedCategoryOption,
  normalizeShowClosed,
  normalizeTeachingMethods,
  PAGE_SIZE,
  PARTICIPATION_TIME_OPTIONS,
  PROGRAM_CATEGORY_OPTIONS,
  REGION_OPTIONS,
  renderActiveFilters,
  SOURCE_OPTIONS,
  TARGET_OPTIONS,
  TEACHING_METHOD_OPTIONS,
  type ProgramsPageSearchParams,
} from "./page-filters";
import {
  ProgramsFilterBar,
  type NamedFilterOption,
} from "./programs-filter-bar";
import { ProgramBookmarkStateProvider } from "./bookmark-state-provider";
import {
  buildProgramsDisplayState,
} from "./page-helpers";
import { DEFAULT_PROGRAM_SORT, normalizeProgramSort, PROGRAM_SORT_LABELS } from "./program-sort";
import { UrgentProgramCompactCard } from "./programs-urgent-card";
import { ProgramsTable } from "./programs-table";

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

type ProgramsPageProps = {
  searchParams: Promise<ProgramsPageSearchParams>;
};

export default async function ProgramsPage({ searchParams }: ProgramsPageProps) {
  const resolvedSearchParams = await searchParams;
  const sessionContextPromise = loadProgramsPageSessionContext();
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
  const showClosedRecent = normalizeShowClosed(resolvedSearchParams.closed);
  const recruitingOnly = !showClosedRecent;
  let sourceOptions: readonly NamedFilterOption[] = SOURCE_OPTIONS;
  let targetOptions: readonly NamedFilterOption[] = TARGET_OPTIONS;

  try {
    const filterOptions = await getProgramFilterOptions({
      q: q || undefined,
      category: selectedCategory.category !== "전체" ? selectedCategory.category : undefined,
      category_detail: selectedCategory.id !== "all" ? selectedCategory.id : undefined,
      regions: selectedRegions,
      teaching_methods: selectedTeachingMethods,
      recruiting_only: recruitingOnly,
      include_closed_recent: showClosedRecent,
    });
    sourceOptions = dynamicOrFallbackOptions(filterOptions.sources, SOURCE_OPTIONS);
    targetOptions = dynamicOrFallbackOptions(filterOptions.targets, TARGET_OPTIONS);
  } catch {
    sourceOptions = SOURCE_OPTIONS;
    targetOptions = TARGET_OPTIONS;
  }

  const selectedSources = normalizeNamedOptions(resolvedSearchParams.sources, sourceOptions);
  const selectedTargets = normalizeNamedOptions(resolvedSearchParams.targets, targetOptions);
  const sort = normalizeProgramSort(resolvedSearchParams.sort);
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
    sourceOptions,
    targetOptions,
    showClosed: showClosedRecent,
    sort,
  });

  let programs: ProgramListRow[] = [];
  let promotedPrograms: ProgramListRow[] = [];
  let urgentPrograms: ProgramListRow[] = [];
  let totalCount = 0;
  let error: string | null = null;
  let isLoggedIn = false;
  let bookmarkedProgramIds: string[] = [];
  const currentFilterParams = {
    q: q || undefined,
    category: selectedCategory.category !== "전체" ? selectedCategory.category : undefined,
    category_detail: selectedCategory.id !== "all" ? selectedCategory.id : undefined,
    regions: selectedRegions,
    sources: selectedSources,
    teaching_methods: selectedTeachingMethods,
    cost_types: selectedCostTypes,
    participation_times: selectedParticipationTimes,
    targets: selectedTargets,
    recruiting_only: recruitingOnly,
    include_closed_recent: showClosedRecent,
    scope: q ? "all" : showClosedRecent ? "archive" : "default",
  };

  ({ isLoggedIn, bookmarkedProgramIds } = await sessionContextPromise);

  try {
    const [programsPage, urgentPage] = await Promise.all([
      listProgramsPage({
        ...currentFilterParams,
        sort,
        limit: PAGE_SIZE,
        offset,
      }),
      listProgramsPage(buildUrgentProgramsParams()),
    ]);
    promotedPrograms = unwrapProgramListRows(programsPage.promoted_items);
    programs = unwrapProgramListRows(programsPage.items);
    totalCount = programsPage.count ?? programsPage.items.length;
    urgentPrograms = unwrapProgramListRows(urgentPage.items);
  } catch (e) {
    promotedPrograms = [];
    try {
      [programs, urgentPrograms] = await Promise.all([
        listPrograms({
          ...currentFilterParams,
          sort,
          limit: PAGE_SIZE,
          offset,
        }),
        listPrograms(buildUrgentProgramsParams()),
      ]);
      totalCount = programs.length;
    } catch {
      error = e instanceof Error ? e.message : "프로그램을 불러오는 중 문제가 발생했습니다.";
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const { tablePrograms, displayUrgentPrograms, urgentProgramsUseStrictWindow, urgentProgramsUseUpcomingFallback } =
    buildProgramsDisplayState({
      programs,
      promotedPrograms,
      urgentPrograms,
      q,
      selectedCategoryId: selectedCategory.id,
      selectedRegionsCount: selectedRegions.length,
      selectedTeachingMethodsCount: selectedTeachingMethods.length,
      selectedCostTypesCount: selectedCostTypes.length,
      selectedParticipationTimesCount: selectedParticipationTimes.length,
      selectedSourcesCount: selectedSources.length,
      selectedTargetsCount: selectedTargets.length,
      showClosedRecent,
      sort,
    });
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
      showClosedRecent ||
      sort !== DEFAULT_PROGRAM_SORT
  );

  return (
    <>
      <LandingHeader />
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
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
            showClosedRecent={showClosedRecent}
            sort={sort}
            activeFilters={activeFilters}
            regionOptions={REGION_OPTIONS}
            teachingMethodOptions={TEACHING_METHOD_OPTIONS}
            costTypeOptions={COST_TYPE_OPTIONS}
            participationTimeOptions={PARTICIPATION_TIME_OPTIONS}
            sourceOptions={sourceOptions}
            targetOptions={targetOptions}
          />

          <ProgramBookmarkStateProvider initialBookmarkedProgramIds={bookmarkedProgramIds}>
            {displayUrgentPrograms.length > 0 ? (
              <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">Closing Soon</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">마감 임박 프로그램</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      {urgentProgramsUseStrictWindow
                        ? `현재 공개된 모집중 공고 중 D-7 이내 프로그램 ${displayUrgentPrograms.length}개입니다.`
                        : urgentProgramsUseUpcomingFallback
                          ? `현재 공개된 모집중 공고 중 가장 먼저 마감되는 프로그램 ${displayUrgentPrograms.length}개입니다.`
                          : `현재 공개된 프로그램 중 먼저 확인할 프로그램 ${displayUrgentPrograms.length}개입니다.`}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
                  {displayUrgentPrograms.map((program) => (
                    <div key={String(program.id)} className="min-w-[300px] max-w-[340px] shrink-0 snap-start md:min-w-[360px]">
                      <UrgentProgramCompactCard program={program} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="min-w-0">
              <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
                      {` · ${PROGRAM_SORT_LABELS[sort]}`}
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
                ) : tablePrograms.length === 0 ? (
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
                    <ProgramsTable
                      programs={tablePrograms}
                      isLoggedIn={isLoggedIn}
                      bookmarkedProgramIds={bookmarkedProgramIds}
                    />

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

async function loadProgramsPageSessionContext(): Promise<{
  isLoggedIn: boolean;
  bookmarkedProgramIds: string[];
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return {
        isLoggedIn: Boolean(session),
        bookmarkedProgramIds: [],
      };
    }

    const { data } = await supabase
      .from("program_bookmarks")
      .select("program_id")
      .eq("user_id", session.user.id);

    return {
      isLoggedIn: true,
      bookmarkedProgramIds: (data ?? [])
        .map((row) => String(row.program_id ?? "").trim())
        .filter(Boolean),
    };
  } catch {
    return {
      isLoggedIn: false,
      bookmarkedProgramIds: [],
    };
  }
}
