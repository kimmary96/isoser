"use client";

import Link from "next/link";

import {
  getProgramCompareHref,
  getProgramDeadline,
  getProgramDeadlineTone,
  getProgramDetailHref,
  getProgramScore,
  normalizeTextList,
} from "@/components/landing/program-card-helpers";
import type { ProgramListRow } from "@/lib/types";

import { chipOptions } from "./_content";

type FilterBarProps = {
  activeChip: string;
  keyword: string;
};

function getChipButtonClass(chip: string, activeChip: string): string {
  const active = chip === activeChip;
  const urgencyChip = chip === "마감임박";

  if (active && urgencyChip) {
    return "border-[var(--fire)] bg-[var(--fire)] text-white";
  }

  if (active) {
    return "border-[var(--ink)] bg-[var(--ink)] text-white";
  }

  if (urgencyChip) {
    return "border-[rgba(249,115,22,0.35)] bg-[rgba(249,115,22,0.05)] text-[var(--fire)]";
  }

  return "border-[var(--border)] bg-white text-[var(--sub)] hover:border-[var(--blue)] hover:text-[var(--blue)]";
}

export function LandingAFilterBar({ activeChip, keyword }: FilterBarProps) {
  return (
    <section className="sticky top-[61px] z-[160] border-b border-[var(--border)] bg-white/92 px-5 py-4 backdrop-blur sm:px-8 lg:px-12">
      <form method="GET" action="/landing-a" className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:w-[360px]">
          <label htmlFor="landing-a-keyword" className="text-sm text-[var(--muted)]">
            검색
          </label>
          <input
            id="landing-a-keyword"
            name="q"
            type="search"
            defaultValue={keyword}
            aria-label="프로그램 검색"
            placeholder="과정명, 기관명, 기술 검색"
            className="w-full border-none bg-transparent text-sm font-medium text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            name="chip"
            value={activeChip}
            className="shrink-0 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--ink-soft)]"
          >
            적용
          </button>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
          <div className="flex min-w-max gap-2">
            {chipOptions.map((chip) => (
              <button
                key={chip}
                type="submit"
                name="chip"
                value={chip}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${getChipButtonClass(chip, activeChip)}`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </form>
    </section>
  );
}

type LandingAProgramsSectionProps = {
  programs: ProgramListRow[];
  totalCount: number;
  activeChip: string;
  keyword: string;
  error: string | null;
};

type ProgramCardProps = {
  program: ProgramListRow;
};

function ProgramCard({ program }: ProgramCardProps) {
  const chips = [...normalizeTextList(program.tags), ...normalizeTextList(program.skills)].slice(0, 4);
  const externalLink = program.application_url || program.link || program.source_url;
  const score = getProgramScore(program);

  return (
    <article
      className={`rounded-[28px] border bg-white p-6 shadow-[0_16px_44px_rgba(10,19,37,0.05)] transition hover:-translate-y-1 hover:shadow-[0_22px_56px_rgba(10,19,37,0.1)] ${
        typeof program.days_left === "number" && program.days_left <= 3
          ? "border-[rgba(239,68,68,0.3)]"
          : "border-[rgba(216,227,242,0.95)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            {[program.source, program.location].filter(Boolean).join(" · ") || "프로그램 정보"}
          </p>
          <h3 className="mt-3 text-lg font-bold leading-7 tracking-[-0.03em] text-[var(--ink)]">
            {program.title || "제목 미정"}
          </h3>
        </div>
        <div className={`text-xl font-extrabold tracking-[-0.05em] ${getProgramDeadlineTone(program)}`}>
          {getProgramDeadline(program)}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--blue)]">
          {program.category || "카테고리 미분류"}
        </span>
        {chips.map((chip) => (
          <span
            key={`${program.id}-${chip}`}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--sub)]"
          >
            {chip}
          </span>
        ))}
      </div>

      <p className="mt-5 text-sm leading-7 text-[var(--sub)]">
        {program.summary || program.description || "프로그램 요약이 아직 등록되지 않았습니다."}
      </p>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[var(--sub)]">
          <span>이소서 관련도</span>
          <span>{Math.max(score, 0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--blue),#7EA9FF)]"
            style={{ width: `${Math.max(0, Math.min(score, 100))}%` }}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {externalLink ? (
          <a
            href={externalLink}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-full bg-[var(--ink)] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[var(--ink-soft)]"
          >
            지원 정보 보기
          </a>
        ) : (
          <Link
            href={getProgramDetailHref(program)}
            className="flex-1 rounded-full bg-[var(--ink)] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[var(--ink-soft)]"
          >
            자세히 보기
          </Link>
        )}
        <Link
          href={getProgramCompareHref(program)}
          className="rounded-full border border-[var(--border)] px-4 py-3 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]"
        >
          비교
        </Link>
      </div>
    </article>
  );
}

export function LandingAProgramsSection({
  programs,
  totalCount,
  activeChip,
  keyword,
  error,
}: LandingAProgramsSectionProps) {
  return (
    <section className="px-5 py-14 sm:px-8 lg:px-12">
      <div className="program-shell mx-auto max-w-6xl rounded-[32px] border border-[var(--border)] px-6 py-8 shadow-[0_22px_60px_rgba(10,19,37,0.06)] sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--blue)]">Opportunity feed</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[var(--ink)]">
              지금 프로그램을 빠르게 탐색해 보세요
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--sub)]">마감, 지역, 분야를 기준으로 먼저 확인할 프로그램을 좁혀보세요.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/programs"
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-4 py-2 font-semibold text-[var(--ink)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]"
            >
              전체 프로그램 보기
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-full bg-[var(--blue)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--blue-lo)]"
            >
              로그인 후 추천 연결
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 px-6 py-10 text-sm text-rose-700">
            {error}
          </div>
        ) : programs.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center">
            <p className="text-base font-semibold text-[var(--ink)]">조건에 맞는 프로그램이 없습니다.</p>
            <p className="mt-2 text-sm text-[var(--sub)]">
              {keyword ? `"${keyword}" 검색어와 ` : ""}
              {activeChip !== "전체" ? `${activeChip} 필터를 ` : ""}
              조정해보세요.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-3 border-b border-[var(--border)] pb-5 text-sm text-[var(--sub)] sm:flex-row sm:items-center sm:justify-between">
              <p>현재 조건에 맞는 프로그램 {totalCount}개 중 상위 {programs.length}개를 보여드립니다.</p>
              <p>탐색 후 로그인하면 추천 캘린더와 문서 준비 흐름으로 이어집니다.</p>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {programs.map((program) => (
                <ProgramCard key={`${program.id}-${program.title}`} program={program} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
