"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { getDashboardMe } from "@/lib/api/app";
import type { Program } from "@/lib/types";

import {
  chipOptions,
  compareCards,
  flowSteps,
  tickerLoop,
  toneClassMap,
} from "./_content";

type HeaderUser = {
  displayName: string;
  avatarUrl: string | null;
} | null;

function getHeaderInitial(name: string | null | undefined) {
  const initial = name?.trim()?.slice(0, 1);
  return initial ? initial.toUpperCase() : "U";
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

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "일정 추후 공지";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function getProgramDeadline(program: Program): string {
  if (typeof program.days_left === "number") {
    if (program.days_left < 0) return "마감";
    if (program.days_left === 0) return "D-Day";
    return `D-${program.days_left}`;
  }

  if (program.deadline) {
    return formatDateLabel(program.deadline);
  }

  return "일정 추후 공지";
}

function getProgramDeadlineTone(program: Program): string {
  if (typeof program.days_left !== "number") return "text-[var(--green)]";
  if (program.days_left <= 3) return "text-[var(--red)]";
  if (program.days_left <= 7) return "text-[var(--fire)]";
  if (program.days_left <= 14) return "text-[var(--amber)]";
  return "text-[var(--green)]";
}

function getProgramDetailHref(program: Program): string {
  return typeof program.id === "string" || typeof program.id === "number" ? `/programs/${program.id}` : "/programs";
}

function getProgramCompareHref(program: Program): string {
  return typeof program.id === "string" || typeof program.id === "number"
    ? `/compare?ids=${encodeURIComponent(String(program.id))}`
    : "/compare";
}

export function LandingATickerBar() {
  return (
    <div className="sticky top-0 z-[220] h-9 overflow-hidden bg-[var(--red)] text-white">
      <div className="ticker-track flex h-full min-w-max items-center">
        {tickerLoop.map((item, index) => (
          <div key={`${item.text}-${index}`} className="ticker-item inline-flex items-center gap-3 px-6">
            <span className={`h-2 w-2 rounded-full ${toneClassMap[item.tone]}`} />
            <span className="text-[11px] font-bold tracking-[0.02em] sm:text-xs">{item.text}</span>
            <span className="opacity-50">|</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingANavBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<HeaderUser>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const result = await getDashboardMe();
        if (!mounted) return;
        setUser(
          result.user
            ? {
                displayName: result.user.displayName,
                avatarUrl: result.user.avatarUrl,
              }
            : null
        );
      } catch {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) {
          setAuthChecked(true);
        }
      }
    };

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const isCompareActive = pathname.startsWith("/compare");
  const isProgramsActive = pathname.startsWith("/programs") && !isCompareActive;
  const isDashboardActive = pathname.startsWith("/dashboard");

  return (
    <nav className="sticky top-9 z-[210] border-b border-white/10 bg-[rgba(10,15,30,0.96)] px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <Link href="/landing-a" className="text-xl font-extrabold tracking-[-0.04em] text-white">
          이소<span className="text-[var(--sky)]">서</span>
        </Link>
        <div className="ml-auto hidden items-center gap-7 text-sm text-white/60 md:flex">
          <Link
            href="/programs"
            className={`transition hover:text-white ${isProgramsActive ? "text-white" : ""}`}
          >
            프로그램
          </Link>
          <Link
            href="/compare"
            className={`transition hover:text-white ${isCompareActive ? "text-white" : ""}`}
          >
            부트캠프 비교
          </Link>
          <Link
            href="/dashboard"
            className={`transition hover:text-white ${isDashboardActive ? "text-white" : ""}`}
          >
            내 프로필
          </Link>
        </div>
        {authChecked && user ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={`${user.displayName} 프로필 이미지`}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
                {getHeaderInitial(user.displayName)}
              </div>
            )}
            <span>{user.displayName}</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-[var(--fire)] px-4 py-2 text-sm font-bold text-white shadow-[0_6px_24px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)]"
          >
            무료로 시작하기
          </Link>
        )}
      </div>
    </nav>
  );
}

type LandingAHeroSectionProps = {
  featuredPrograms: Program[];
  totalCount: number;
};

export function LandingAHeroSection({ featuredPrograms, totalCount }: LandingAHeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[var(--ink)] px-5 pb-14 pt-16 text-center sm:px-8 sm:pb-16 sm:pt-20 lg:px-12">
      <div className="hero-glow absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(249,115,22,0.45)] bg-[rgba(249,115,22,0.08)] px-4 py-2 text-xs font-bold text-[#FB923C]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#FB923C]" />
          지금 {totalCount}개 프로그램 확인 가능
        </div>

        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
          취업 지원 정보,
          <br />
          <span className="hero-gradient-blue">흩어진 채로</span> 두면
          <br />
          <span className="hero-gradient-fire">기회를 놓칩니다</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
          고용24, HRD넷, K-디지털, 서울시 일자리까지
          <br />
          AI가 내 상황에 맞는 순서로 정리해드립니다.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featuredPrograms.map((program) => (
            <div
              key={`${program.id}-${program.title}`}
              className={`rounded-2xl border bg-white/5 px-5 py-5 text-left backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[rgba(249,115,22,0.45)] hover:bg-[rgba(249,115,22,0.08)] ${
                typeof program.days_left === "number" && program.days_left <= 3
                  ? "border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.08)]"
                  : "border-white/10"
              }`}
            >
              <div
                className={`text-3xl font-extrabold tracking-[-0.04em] ${getProgramDeadlineTone(program)}`}
              >
                {getProgramDeadline(program)}
              </div>
              <div className="mt-3 text-sm font-bold leading-6 text-white">{program.title || "제목 미정"}</div>
              <div className="mt-2 text-xs text-[var(--muted)]">
                {[program.source, program.location].filter(Boolean).join(" · ") || "프로그램 정보 확인"}
              </div>
            </div>
          ))}

          <Link
            href="/programs?sort=deadline"
            className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-5 py-5 text-sm font-medium text-[var(--muted)] transition hover:border-white/35 hover:text-white"
          >
            + 마감 임박 더 보기
          </Link>
        </div>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-xl bg-[var(--fire)] px-7 py-4 text-sm font-bold text-white shadow-[0_8px_28px_rgba(249,115,22,0.32)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)]"
          >
            AI 맞춤 추천 받기
          </Link>
          <Link
            href="/programs"
            className="rounded-xl border border-white/15 bg-white/[0.08] px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            전체 프로그램 보기
          </Link>
        </div>
      </div>
    </section>
  );
}

type FilterBarProps = {
  activeChip: string;
  keyword: string;
};

export function LandingAFilterBar({ activeChip, keyword }: FilterBarProps) {
  return (
    <section className="sticky top-[100px] z-[160] border-b border-[var(--border)] bg-white/[0.95] px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] backdrop-blur sm:px-8 lg:px-12">
      <form method="GET" action="/landing-a" className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:w-[320px]">
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
            className="shrink-0 text-xs font-semibold text-[var(--blue)] transition hover:text-[var(--blue-lo)]"
          >
            적용
          </button>
        </div>
        <div className="hidden h-6 w-px bg-[var(--border)] lg:block" />
        <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
          <div className="flex min-w-max gap-2">
            {chipOptions.map((chip) => {
              const active = chip === activeChip;
              const urgencyChip = chip === "마감임박";

              return (
                <button
                  key={chip}
                  type="submit"
                  name="chip"
                  value={chip}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? urgencyChip
                        ? "border-[var(--fire)] bg-[var(--fire)] text-white"
                        : "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : urgencyChip
                        ? "border-[rgba(249,115,22,0.35)] bg-[rgba(249,115,22,0.05)] text-[var(--fire)]"
                        : "border-[var(--border)] bg-white text-[var(--sub)] hover:border-[var(--blue)] hover:text-[var(--blue)]"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </section>
  );
}

type LandingAProgramsSectionProps = {
  programs: Program[];
  totalCount: number;
  activeChip: string;
  keyword: string;
  error: string | null;
};

export function LandingAProgramsSection({
  programs,
  totalCount,
  activeChip,
  keyword,
  error,
}: LandingAProgramsSectionProps) {
  return (
    <section className="px-5 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--ink)]">
              마감 임박 프로그램{" "}
              <span className="ml-2 rounded bg-[var(--red)] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">
                D-7 이내
              </span>
            </h2>
            <p className="mt-2 text-sm text-[var(--sub)]">정보 허브에서 바로 확인할 수 있는 주요 프로그램만 먼저 정리했습니다.</p>
          </div>
          <Link href="/programs" className="text-sm font-semibold text-[var(--blue)]">
            전체보기 →
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-sm text-rose-700">
            {error}
          </div>
        ) : programs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center">
            <p className="text-base font-semibold text-[var(--ink)]">조건에 맞는 프로그램이 없습니다.</p>
            <p className="mt-2 text-sm text-[var(--sub)]">
              {keyword ? `"${keyword}" 검색어와 ` : ""}{activeChip !== "전체" ? `${activeChip} 필터를 ` : ""}조정해보세요.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-[var(--sub)]">
              현재 조건에 맞는 프로그램 {totalCount}개 중 상위 {programs.length}개를 보여드립니다.
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((program) => {
                const chips = [...normalizeTextList(program.tags), ...normalizeTextList(program.skills)].slice(0, 4);
                const externalLink = program.application_url || program.link || program.source_url;
                const rawScore = program.relevance_score ?? program.final_score ?? program._score ?? 0;
                const score = rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);

                return (
                  <article
                    key={`${program.id}-${program.title}`}
                    className={`relative rounded-2xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(15,23,42,0.1)] ${
                      typeof program.days_left === "number" && program.days_left <= 3
                        ? "border-[rgba(239,68,68,0.35)]"
                        : "border-[rgba(34,197,94,0.28)]"
                    }`}
                  >
                    {program.is_ad ? (
                      <span className="absolute right-4 top-4 rounded border border-[rgba(37,99,235,0.3)] px-2 py-1 text-[10px] font-bold text-[var(--blue)]">
                        광고
                      </span>
                    ) : null}

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-[var(--muted)]">
                        {[program.source, program.location].filter(Boolean).join(" · ") || "프로그램 정보"}
                      </span>
                      <span className={`text-lg font-extrabold tracking-[-0.04em] ${getProgramDeadlineTone(program)}`}>
                        {getProgramDeadline(program)}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold leading-7 tracking-[-0.02em] text-[var(--ink)]">
                      {program.title || "제목 미정"}
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[var(--blue)]">
                        {program.category || "카테고리 미분류"}
                      </span>
                      {chips.map((chip) => (
                        <span
                          key={`${program.id}-${chip}`}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--sub)]"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-[var(--sub)]">
                      {program.summary || program.description || "프로그램 요약이 아직 등록되지 않았습니다."}
                    </p>

                    <div className="mt-5 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,var(--blue),#818CF8)]"
                          style={{ width: `${Math.max(0, Math.min(score, 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-[var(--blue)]">관련도 {Math.max(score, 0)}%</span>
                    </div>

                    <div className="mt-5 flex gap-2">
                      {externalLink ? (
                        <a
                          href={externalLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 rounded-lg bg-[var(--blue)] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[var(--blue-lo)]"
                        >
                          지원하기
                        </a>
                      ) : (
                        <Link
                          href={getProgramDetailHref(program)}
                          className="flex-1 rounded-lg bg-[var(--blue)] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[var(--blue-lo)]"
                        >
                          자세히 보기
                        </Link>
                      )}
                      <Link
                        href={getProgramCompareHref(program)}
                        className="rounded-lg border border-[rgba(249,115,22,0.3)] bg-[rgba(249,115,22,0.08)] px-4 py-3 text-sm font-bold text-[var(--fire)] transition hover:bg-[var(--fire)] hover:text-white"
                      >
                        비교추가
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function LandingAComparisonSection() {
  return (
    <section id="compare" className="px-5 pb-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[var(--ink)] px-6 py-10 sm:px-8 lg:px-11">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-white">부트캠프 비교 분석</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              최대 3개를 나란히 놓고 조건과 관련도를 빠르게 비교할 수 있습니다.
            </p>
          </div>
          <Link
            href="/compare"
            className="rounded-lg bg-[var(--fire)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--fire-lo)]"
          >
            + 비교 추가
          </Link>
        </div>

        <div className="relative z-10 mt-8 grid gap-4 lg:grid-cols-3">
          {compareCards.map((card) => (
            <article
              key={card.title}
              className={`relative rounded-2xl border px-5 pb-5 pt-6 ${
                card.winner ? "border-[rgba(249,115,22,0.5)] bg-[rgba(249,115,22,0.08)]" : "border-white/10 bg-white/[0.06]"
              }`}
            >
              {card.winner ? (
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--fire)] px-4 py-1 text-[10px] font-extrabold tracking-[0.08em] text-white">
                  나에게 가장 적합
                </span>
              ) : null}
              <h3 className="text-base font-bold leading-6 text-white">{card.title}</h3>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted)]">마감</span>
                  <span
                    className={`font-semibold ${
                      card.deadlineTone === "red"
                        ? "text-[#F87171]"
                        : card.deadlineTone === "amber"
                          ? "text-[#FCD34D]"
                          : "text-white/[0.75]"
                    }`}
                  >
                    {card.deadline}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted)]">국비 지원</span>
                  <span className={card.winner ? "font-extrabold text-[var(--fire)]" : "font-semibold text-white/[0.85]"}>
                    {card.subsidy}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted)]">기간</span>
                  <span className="font-semibold text-white/[0.85]">{card.duration}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted)]">특징</span>
                  <span className={card.winner ? "font-extrabold text-[var(--fire)]" : "font-semibold text-white/[0.85]"}>
                    {card.outcome}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={
                      card.winner
                        ? "h-full rounded-full bg-[linear-gradient(90deg,var(--fire),#FBBF24)]"
                        : "h-full rounded-full bg-[linear-gradient(90deg,var(--sky),#818CF8)]"
                    }
                    style={{ width: `${card.match}%` }}
                  />
                </div>
                <span className={card.winner ? "text-sm font-extrabold text-[var(--fire)]" : "text-sm font-extrabold text-[var(--sky)]"}>
                  {card.match}%
                </span>
              </div>

              <Link
                href={card.winner ? "/programs?sort=deadline" : "/compare"}
                className={`mt-5 block w-full rounded-lg px-4 py-3 text-center text-sm font-bold transition ${
                  card.winner
                    ? "bg-[var(--fire)] text-white hover:bg-[var(--fire-lo)]"
                    : "border border-white/12 bg-white/[0.08] text-white/80 hover:bg-white/12"
                }`}
              >
                {card.winner ? "지금 지원하기" : "자세히 보기"}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingAFlowSection() {
  return (
    <section id="flow" className="px-5 pb-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl rounded-[28px] border border-[var(--border)] bg-white px-6 py-10 sm:px-8 lg:px-11">
        <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--ink)]">이소서로 취업 지원하는 방법</h2>

        <div className="mt-8 grid gap-y-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-0">
          {flowSteps.map((step, index) => (
            <div key={step.step} className="relative px-0 sm:px-2 lg:px-5">
              {index < flowSteps.length - 1 ? (
                <span className="absolute right-[-10px] top-4 hidden text-2xl text-[var(--muted)] lg:block">→</span>
              ) : null}
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-extrabold tracking-[-0.03em] ${
                  step.tone === "blue"
                    ? "bg-[#EFF6FF] text-[var(--blue)]"
                    : step.tone === "amber"
                      ? "bg-[#FEF3C7] text-[var(--amber)]"
                      : step.tone === "orange"
                        ? "bg-[#FFF7ED] text-[var(--fire)]"
                        : "bg-[#F0FDF4] text-[var(--green)]"
                }`}
              >
                {step.step}
              </div>
              <h3 className="mt-4 text-base font-bold text-[var(--ink)]">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--sub)]">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingACtaSection() {
  return (
    <section className="px-5 pb-12 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,var(--ink)_0%,var(--ink-soft)_100%)] px-6 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-11">
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.04em] text-white">
            프로필 등록하면
            <br />
            AI가 딱 맞는 것만 골라드립니다
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/[0.55]">
            성과저장소 데이터 기반 개인화 추천, 이력서·포트폴리오 초안 생성,
            <br />
            전체 기능 무료로 바로 시작할 수 있습니다.
          </p>
        </div>
        <Link
          href="/login"
          className="relative z-10 inline-flex w-full items-center justify-center rounded-xl bg-[var(--fire)] px-7 py-4 text-sm font-bold text-white shadow-[0_8px_28px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)] lg:w-auto"
        >
          Google로 시작하기
        </Link>
      </div>
    </section>
  );
}

export function LandingAFooter() {
  return (
    <footer className="bg-[var(--ink)] px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-extrabold tracking-[-0.04em] text-white">
            이소<span className="text-[var(--sky)]">서</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">국가 취업 지원 정보 허브 · AI 추천 · 이력서·포트폴리오 생성</p>
        </div>
        <p>© 2026 Isoser</p>
      </div>
    </footer>
  );
}
