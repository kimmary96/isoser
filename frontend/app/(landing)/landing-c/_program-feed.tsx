import Link from "next/link";

import { getProgramCompareHref, getProgramDetailHref } from "@/components/landing/program-card-helpers";
import { ProgramDeadlineBadge } from "@/components/programs/program-deadline-badge";
import type { ProgramListRow } from "@/lib/types";

import { chips } from "./_content";
import { displayTitle, programTagItems, providerLabel, trainingPeriodLabel } from "./_program-utils";

type LandingCOpportunityFeedProps = {
  activeChip: string;
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
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-h-[3.5rem] text-xl font-black leading-7 tracking-[-0.04em] text-[var(--ink)]">
            <Link href={getProgramDetailHref(program)} className="transition hover:text-[var(--indigo)]">
              {displayTitle(program)}
            </Link>
          </h3>
          <ProgramDeadlineBadge program={program} />
        </div>
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

function getOpportunityChipHref(chip: string): string {
  if (chip === "전체") {
    return "/landing-c";
  }

  return `/landing-c?chip=${encodeURIComponent(chip)}`;
}

export function LandingCOpportunityFeed({ activeChip, programs, error }: LandingCOpportunityFeedProps) {
  return (
    <section className="px-5 py-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--indigo)]">Opportunity feed</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.05em]">자주찾는 검색어로 공고를 빠르게 탐색합니다</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--sub)]">
              더 많은 공고를 탐색하고 싶다면 &apos;프로그램 더보기&apos; 버튼을 누르세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/programs" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-black text-[var(--ink)]">프로그램 더보기</Link>
          </div>
        </div>

        <div className="mt-8 rounded-[24px] border border-[var(--border)] bg-white p-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((chip) => (
              <Link
                key={chip}
                href={getOpportunityChipHref(chip)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
                  chip === activeChip
                    ? "border-[var(--indigo)] bg-[var(--indigo)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--sub)] hover:border-[var(--indigo)] hover:text-[var(--indigo)]"
                }`}
              >
                {chip}
              </Link>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50 px-6 py-10 text-sm font-bold text-rose-700">{error}</div>
        ) : programs.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center text-sm font-bold text-[var(--sub)]">
            조건에 맞는 프로그램이 없습니다. 프로그램 더보기에서 더 많은 공고를 확인해보세요.
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
