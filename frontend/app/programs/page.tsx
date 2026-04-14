import Link from "next/link";

import { listPrograms } from "@/lib/api/backend";
import { PROGRAM_CATEGORIES } from "@/lib/program-categories";
import type { Program } from "@/lib/types";

type ProgramsPageProps = {
  searchParams: Promise<{
    category?: string | string[];
  }>;
};

function normalizeSelectedCategory(value?: string | string[]): string {
  const category = Array.isArray(value) ? value[0] : value;

  if (!category || category === "전체") {
    return "전체";
  }

  return PROGRAM_CATEGORIES.includes(category as (typeof PROGRAM_CATEGORIES)[number])
    ? category
    : "전체";
}

function normalizeTextList(value: string[] | string | null): string[] {
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

export default async function ProgramsPage({ searchParams }: ProgramsPageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedCategory = normalizeSelectedCategory(resolvedSearchParams.category);
  let programs: Program[] = [];
  let error: string | null = null;

  try {
    programs = await listPrograms({
      category: selectedCategory !== "전체" ? selectedCategory : undefined,
      limit: 60,
      offset: 0,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "프로그램을 불러오는 중 문제가 발생했습니다.";
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">프로그램 목록</h1>
              <p className="mt-2 text-sm text-slate-600">
                관심 있는 카테고리를 선택해 현재 등록된 프로그램을 살펴보세요.
              </p>
            </div>

            <div className="-mx-2 overflow-x-auto px-2 pb-2">
              <div className="flex min-w-max gap-2">
                {PROGRAM_CATEGORIES.map((category) => {
                  const isActive = category === selectedCategory;
                  const href =
                    category === "전체"
                      ? "/programs"
                      : `/programs?category=${encodeURIComponent(category)}`;

                  return (
                    <Link
                      key={category}
                      href={href}
                      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {category}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : programs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
              <p className="text-sm text-slate-500">등록된 프로그램이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((program) => {
                const tags = normalizeTextList(program.tags);
                const skills = normalizeTextList(program.skills);
                const chips = [...tags, ...skills].slice(0, 6);

                return (
                  <article
                    key={program.id}
                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {program.category || "미분류"}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                        {program.title || "제목 미정"}
                      </h2>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1">{program.provider || "기관 정보 없음"}</span>
                      <span className="rounded-full bg-white px-3 py-1">{program.location || "지역 정보 없음"}</span>
                    </div>

                    <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">
                      {program.summary || "프로그램 소개가 아직 등록되지 않았습니다."}
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
                        className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        상세 보기
                      </Link>
                      {program.application_url ? (
                        <a
                          href={program.application_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          지원 링크 보기
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
