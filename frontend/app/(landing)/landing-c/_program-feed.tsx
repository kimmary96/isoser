import Link from "next/link";

import { getProgramCompareHref, getProgramDetailHref } from "@/components/landing/program-card-helpers";
import type { ProgramListRow } from "@/lib/types";

import { chips } from "./_content";
import { displayTitle, programTagItems, providerLabel, trainingPeriodLabel } from "./_program-utils";

type LandingCOpportunityFeedProps = {
  activeChip: string;
  keyword: string;
  programs: ProgramListRow[];
  error: string | null;
};

function ProgramCard({ program }: { program: ProgramListRow }) {
  const tagItems = programTagItems(program);

  return (
    <article
      className="flex min-h-[300px] flex-col rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[0_16px_42px_rgba(10,19,37,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_58px_rgba(10,19,37,0.12)]"
    >
      <div>
        <h3 className="line-clamp-2 min-h-[3.5rem] text-xl font-black leading-7 tracking-[-0.04em] text-[var(--ink)]">
          <Link href={getProgramDetailHref(program)} className="transition hover:text-[var(--indigo)]">
            {displayTitle(program)}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-1 text-sm font-bold text-[var(--sub)]">{providerLabel(program)}</p>
        <p className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--sub)]">{trainingPeriodLabel(program)}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tagItems.map((item) => (
          <span
            key={`${program.id}-${item.label}`}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
              item.tone === "green"
                ? "bg-[rgba(16,185,129,0.12)] text-emerald-700"
                : item.tone === "amber"
                  ? "bg-[rgba(245,158,11,0.12)] text-amber-700"
                  : item.tone === "indigo"
                    ? "bg-[var(--surface-strong)] text-[var(--indigo)]"
                    : "bg-[var(--surface)] text-[var(--sub)]"
            }`}
          >
            {item.label}
          </span>
        ))}
      </div>

      <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-6">
        <Link
          href={getProgramDetailHref(program)}
          className="rounded-xl bg-[var(--blue)] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[var(--indigo)]"
        >
          과정 보기
        </Link>
        <Link
          href={getProgramCompareHref(program)}
          className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-black text-[var(--ink)] transition hover:border-[var(--indigo)] hover:text-[var(--indigo)]"
        >
          비교
        </Link>
      </div>
    </article>
  );
}

export function LandingCOpportunityFeed({ activeChip, keyword, programs, error }: LandingCOpportunityFeedProps) {
  return (
    <section className="px-5 py-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--indigo)]">Opportunity feed</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.05em]">지금 탐색할 프로그램을 빠르게 고릅니다</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--sub)]">
              비로그인 상태에서는 우선 공고를 탐색하고, 로그인 후에는 이 결과를 추천 캘린더와 문서 워크플로우로 이어 붙입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/programs" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-black text-[var(--ink)]">전체 프로그램 보기</Link>
          </div>
        </div>

        <form action="/landing-c" className="mt-8 rounded-[24px] border border-[var(--border)] bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label htmlFor="landing-c-q" className="sr-only">프로그램 검색</label>
            <input
              id="landing-c-q"
              name="q"
              type="search"
              defaultValue={keyword}
              placeholder="과정명, 기관명, 기술 검색"
              className="min-h-12 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-bold outline-none placeholder:text-[var(--muted)] focus:border-[var(--indigo)]"
            />
            <button type="submit" name="chip" value={activeChip} className="min-h-12 rounded-full bg-[var(--ink)] px-5 text-sm font-black text-white">
              적용
            </button>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {chips.map((chip) => (
              <button
                key={chip}
                type="submit"
                name="chip"
                value={chip}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
                  chip === activeChip
                    ? "border-[var(--indigo)] bg-[var(--indigo)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--sub)] hover:border-[var(--indigo)] hover:text-[var(--indigo)]"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </form>

        {error ? (
          <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50 px-6 py-10 text-sm font-bold text-rose-700">{error}</div>
        ) : programs.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center text-sm font-bold text-[var(--sub)]">
            조건에 맞는 프로그램이 없습니다. 검색어나 필터를 조정해보세요.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {programs.map((program) => (
              <ProgramCard key={`${program.id}-${program.title}`} program={program} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
