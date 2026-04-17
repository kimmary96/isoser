import type { Metadata } from "next";
import Link from "next/link";

import { LandingANavBar, LandingATickerBar } from "@/app/(landing)/landing-a/_components";
import AdSlot from "@/components/AdSlot";
import { getProgramCount, listPrograms } from "@/lib/api/backend";
import { PROGRAM_CATEGORIES } from "@/lib/program-categories";
import { getSiteUrl } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Program, ProgramSort } from "@/lib/types";

import RecommendedProgramsSection from "./recommended-programs-section";

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
const SORT_OPTIONS: { value: ProgramSort; label: string }[] = [
  { value: "deadline", label: "마감 임박순" },
  { value: "latest", label: "최신순" },
];
const REGION_OPTIONS = ["서울", "경기", "부산", "대전·충청", "대구·경북", "온라인"] as const;

type ProgramsPageSearchParams = {
  q?: string | string[];
  category?: string | string[];
  regions?: string | string[];
  recruiting?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};

type ProgramsPageProps = {
  searchParams: Promise<ProgramsPageSearchParams>;
};

function takeFirst(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeSelectedCategory(value?: string | string[]): string {
  const category = takeFirst(value);
  if (!category || category === "전체") {
    return "전체";
  }

  return PROGRAM_CATEGORIES.includes(category as (typeof PROGRAM_CATEGORIES)[number]) ? category : "전체";
}

function normalizeQuery(value?: string | string[]): string {
  return (takeFirst(value) || "").trim();
}

function normalizeSort(value?: string | string[]): ProgramSort {
  const sort = takeFirst(value);
  return sort === "latest" ? "latest" : "deadline";
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

function normalizeRecruiting(value?: string | string[]): boolean {
  const recruiting = takeFirst(value);
  return recruiting === "true" || recruiting === "1" || recruiting === "on";
}

function normalizePage(value?: string | string[]): number {
  const page = Number.parseInt(takeFirst(value) || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildProgramsHref(params: {
  q?: string;
  category?: string;
  regions?: string[];
  recruiting?: boolean;
  sort?: ProgramSort;
  page?: number;
}): string {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.category && params.category !== "전체") searchParams.set("category", params.category);
  if (params.regions?.length) {
    params.regions.forEach((region) => searchParams.append("regions", region));
  }
  if (params.recruiting) searchParams.set("recruiting", "true");
  if (params.sort && params.sort !== "deadline") searchParams.set("sort", params.sort);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));

  const query = searchParams.toString();
  return query ? `/programs?${query}` : "/programs";
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "일정 추후 공지";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function getDeadlineBadge(program: Program): { label: string; tone: string } | null {
  const rawDate = program.deadline || program.end_date;
  if (!rawDate) return null;

  const deadlineDate = new Date(rawDate);
  if (Number.isNaN(deadlineDate.getTime())) {
    return { label: formatDateLabel(rawDate), tone: "bg-slate-100 text-slate-600" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  const daysLeft = Math.floor((deadlineDate.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) {
    return { label: "마감", tone: "bg-slate-200 text-slate-700" };
  }
  if (daysLeft <= 3) {
    return { label: `D-${daysLeft}`, tone: "bg-rose-100 text-rose-700" };
  }
  if (daysLeft <= 7) {
    return { label: `D-${daysLeft}`, tone: "bg-amber-100 text-amber-700" };
  }

  return { label: `D-${daysLeft}`, tone: "bg-emerald-100 text-emerald-700" };
}

function renderActiveFilters(params: {
  q: string;
  category: string;
  regions: string[];
  recruiting: boolean;
  sort: ProgramSort;
}) {
  const chips: { label: string; href: string }[] = [];

  if (params.q) {
    chips.push({
      label: `검색: ${params.q}`,
      href: buildProgramsHref({
        category: params.category,
        regions: params.regions,
        recruiting: params.recruiting,
        sort: params.sort,
      }),
    });
  }

  if (params.category !== "전체") {
    chips.push({
      label: `카테고리: ${params.category}`,
      href: buildProgramsHref({
        q: params.q,
        regions: params.regions,
        recruiting: params.recruiting,
        sort: params.sort,
      }),
    });
  }

  params.regions.forEach((region) => {
    chips.push({
      label: `지역: ${region}`,
      href: buildProgramsHref({
        q: params.q,
        category: params.category,
        regions: params.regions.filter((item) => item !== region),
        recruiting: params.recruiting,
        sort: params.sort,
      }),
    });
  });

  if (params.recruiting) {
    chips.push({
      label: "모집중만",
      href: buildProgramsHref({
        q: params.q,
        category: params.category,
        regions: params.regions,
        sort: params.sort,
      }),
    });
  }

  return chips;
}

export default async function ProgramsPage({ searchParams }: ProgramsPageProps) {
  const resolvedSearchParams = await searchParams;
  const q = normalizeQuery(resolvedSearchParams.q);
  const selectedCategory = normalizeSelectedCategory(resolvedSearchParams.category);
  const selectedRegions = normalizeRegions(resolvedSearchParams.regions);
  const recruitingOnly = normalizeRecruiting(resolvedSearchParams.recruiting);
  const sort = normalizeSort(resolvedSearchParams.sort);
  const page = normalizePage(resolvedSearchParams.page);
  const offset = (page - 1) * PAGE_SIZE;
  const activeFilters = renderActiveFilters({
    q,
    category: selectedCategory,
    regions: selectedRegions,
    recruiting: recruitingOnly,
    sort,
  });

  let programs: Program[] = [];
  let totalCount = 0;
  let error: string | null = null;
  let isLoggedIn = false;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    isLoggedIn = Boolean(session);
  } catch {
    isLoggedIn = false;
  }

  try {
    [programs, totalCount] = await Promise.all([
      listPrograms({
        q: q || undefined,
        category: selectedCategory !== "전체" ? selectedCategory : undefined,
        regions: selectedRegions,
        recruiting_only: recruitingOnly,
        sort,
        limit: PAGE_SIZE,
        offset,
      }),
      getProgramCount({
        q: q || undefined,
        category: selectedCategory !== "전체" ? selectedCategory : undefined,
        regions: selectedRegions,
        recruiting_only: recruitingOnly,
      }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "프로그램을 불러오는 중 문제가 발생했습니다.";
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (pageNumber) => pageNumber >= Math.max(1, safePage - 2) && pageNumber <= Math.min(totalPages, safePage + 2)
  );
  const hasAnyFilter = Boolean(q || selectedCategory !== "전체" || selectedRegions.length || recruitingOnly);

  return (
    <>
      <LandingATickerBar />
      <LandingANavBar />
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
          <section className="rounded-3xl bg-slate-950 px-8 py-10 text-white shadow-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-200">Programs Hub</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  국가 취업 지원 프로그램 허브
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                  훈련 과정과 지원 프로그램을 한곳에서 찾고, 검색과 필터로 현재 열려 있는 기회를 빠르게
                  좁혀보세요.
                </p>
              </div>
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 sm:min-w-64">
                <div>
                  <p className="text-slate-400">현재 결과</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{error ? "-" : `${totalCount}개`}</p>
                </div>
                <div>
                  <p className="text-slate-400">정렬</p>
                  <p className="mt-1 font-medium text-white">
                    {SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "마감 임박순"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <RecommendedProgramsSection isLoggedIn={isLoggedIn} />

          <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <form
                method="GET"
                action="/programs"
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div>
                  <label htmlFor="q" className="text-sm font-semibold text-slate-900">
                    검색
                  </label>
                  <input
                    id="q"
                    name="q"
                    type="search"
                    defaultValue={q}
                    placeholder="프로그램명으로 검색"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  />
                </div>

                <div className="mt-6">
                  <label htmlFor="sort" className="text-sm font-semibold text-slate-900">
                    정렬
                  </label>
                  <select
                    id="sort"
                    name="sort"
                    defaultValue={sort}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      name="recruiting"
                      value="true"
                      defaultChecked={recruitingOnly}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    모집중만 보기
                  </label>
                </div>

                <fieldset className="mt-6">
                  <legend className="text-sm font-semibold text-slate-900">카테고리</legend>
                  <div className="mt-3 grid gap-2">
                    {PROGRAM_CATEGORIES.map((category) => (
                      <label
                        key={category}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                      >
                        <input
                          type="radio"
                          name="category"
                          value={category}
                          defaultChecked={selectedCategory === category}
                          className="h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="mt-6">
                  <legend className="text-sm font-semibold text-slate-900">지역</legend>
                  <div className="mt-3 grid gap-2">
                    {REGION_OPTIONS.map((region) => (
                      <label
                        key={region}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          name="regions"
                          value={region}
                          defaultChecked={selectedRegions.includes(region)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        {region}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6 flex gap-3">
                  <button
                    type="submit"
                    className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    필터 적용
                  </button>
                  <Link
                    href="/programs"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    초기화
                  </Link>
                </div>
              </form>
            </aside>

            <section className="min-w-0">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <AdSlot
                  slotId="programs-results-top-banner"
                  className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                />
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {error ? "프로그램을 불러오지 못했습니다" : `결과 ${totalCount}개`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedCategory === "전체" ? "전체 카테고리" : selectedCategory}
                      {selectedRegions.length ? ` · ${selectedRegions.join(", ")}` : ""}
                      {recruitingOnly ? " · 모집중만" : ""}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">
                    페이지 {safePage} / {totalPages}
                  </p>
                </div>

                {activeFilters.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeFilters.map((chip) => (
                      <Link
                        key={`${chip.label}-${chip.href}`}
                        href={chip.href}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        {chip.label} ×
                      </Link>
                    ))}
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-12 text-center text-sm text-rose-700">
                    {error}
                  </div>
                ) : programs.length === 0 ? (
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
                      {programs.map((program) => {
                        const tags = normalizeTextList(program.tags);
                        const skills = normalizeTextList(program.skills);
                        const chips = [...tags, ...skills].slice(0, 4);
                        const deadlineBadge = getDeadlineBadge(program);
                        const externalLink = program.application_url || program.link || program.source_url;
                        const compareHref =
                          typeof program.id === "string" || typeof program.id === "number"
                            ? `/compare?ids=${encodeURIComponent(String(program.id))}`
                            : "/compare";

                        return (
                          <article
                            key={program.id}
                            className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  {program.source || "출처 미상"}
                                </p>
                                <h2 className="mt-2 line-clamp-2 text-xl font-semibold tracking-tight text-slate-950">
                                  {program.title || "제목 미정"}
                                </h2>
                              </div>
                              {deadlineBadge ? (
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${deadlineBadge.tone}`}
                                >
                                  {deadlineBadge.label}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                              <span className="rounded-full bg-white px-3 py-1">{program.category || "미분류"}</span>
                              <span className="rounded-full bg-white px-3 py-1">{program.provider || "기관 정보 없음"}</span>
                              <span className="rounded-full bg-white px-3 py-1">{program.location || "지역 정보 없음"}</span>
                            </div>

                            <p className="mt-4 text-sm font-medium text-slate-700">
                              일정 {formatDateLabel(program.start_date)} - {formatDateLabel(program.end_date)}
                            </p>

                            <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">
                              {program.summary || program.description || "프로그램 소개가 아직 등록되지 않았습니다."}
                            </p>

                            <div className="mt-5 flex flex-wrap gap-2">
                              {chips.length > 0 ? (
                                chips.map((chip) => (
                                  <span
                                    key={`${program.id}-${chip}`}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                                  >
                                    #{chip}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">태그 정보 없음</span>
                              )}
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2">
                              <Link
                                href={`/programs/${program.id}`}
                                className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                              >
                                상세 보기
                              </Link>
                              <Link
                                href={compareHref}
                                className="inline-flex rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 transition hover:bg-orange-100"
                              >
                                비교에 추가
                              </Link>
                              {externalLink ? (
                                <a
                                  href={externalLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                                >
                                  지원 링크
                                </a>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {totalPages > 1 ? (
                      <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="페이지네이션">
                        <Link
                          href={buildProgramsHref({
                            q,
                            category: selectedCategory,
                            regions: selectedRegions,
                            recruiting: recruitingOnly,
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
                              category: selectedCategory,
                              regions: selectedRegions,
                              recruiting: recruitingOnly,
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
                            category: selectedCategory,
                            regions: selectedRegions,
                            recruiting: recruitingOnly,
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
          </section>
        </div>
      </main>
    </>
  );
}
