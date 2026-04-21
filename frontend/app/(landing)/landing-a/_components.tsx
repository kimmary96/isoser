"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { getDashboardMe } from "@/lib/api/app";
import type { Program } from "@/lib/types";

import {
  chipOptions,
  featurePreviews,
  tickerLoop,
  toneClassMap,
  workspaceStages,
} from "./_content";
import { landingAStyles } from "./_styles";

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

function getProgramScore(program: Program): number {
  const rawScore = program.relevance_score ?? program.final_score ?? program._score ?? 0;
  return rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);
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
    <nav className="sticky top-9 z-[230] isolate border-b border-[var(--border)] bg-white/92 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <Link href="/landing-a" className="relative z-[1] flex items-center gap-3">
          <div>
            <div className="text-xl font-extrabold tracking-[-0.05em] text-[var(--ink)]">
              이소<span className="text-[var(--sky)]">서</span>
            </div>
            <p className="hidden text-[10px] uppercase tracking-[0.28em] text-[var(--muted)] sm:block">
              Public Program Finder
            </p>
          </div>
        </Link>

        <div className="ml-auto hidden items-center gap-7 text-sm text-[var(--sub)] md:flex">
          <Link href="/programs" className={`relative z-[1] transition hover:text-[var(--ink)] ${isProgramsActive ? "text-[var(--ink)]" : ""}`}>
            프로그램 탐색
          </Link>
          <Link href="/compare" className={`relative z-[1] transition hover:text-[var(--ink)] ${isCompareActive ? "text-[var(--ink)]" : ""}`}>
            비교
          </Link>
          <Link href="/dashboard" className={`relative z-[1] transition hover:text-[var(--ink)] ${isDashboardActive ? "text-[var(--ink)]" : ""}`}>
            워크스페이스
          </Link>
        </div>

        {authChecked && user ? (
          <Link
            href="/dashboard"
            className="relative z-[1] inline-flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-white"
          >
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={`${user.displayName} 프로필 이미지`}
                width={32}
                height={32}
                sizes="32px"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">
                {getHeaderInitial(user.displayName)}
              </div>
            )}
            <span className="hidden sm:inline">{user.displayName}</span>
            <span className="text-[var(--sub)]">워크스페이스</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="relative z-[1] rounded-full bg-[var(--fire)] px-4 py-2 text-sm font-bold text-white shadow-[0_12px_32px_rgba(249,115,22,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--fire-lo)]"
          >
            무료로 시작하기
          </Link>
        )}
      </div>
    </nav>
  );
}

export function LandingAHeader() {
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

  return (
    <header className="sticky top-0 z-[230] border-b border-[var(--border)] bg-white/92 px-3 py-3 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-4">
        <Link href="/landing-a" className="shrink-0 text-xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">
          이소<span className="text-[var(--sky)]">서</span>
        </Link>

        <nav aria-label="랜딩 A 주요 이동" className="ml-auto hidden items-center gap-6 text-sm font-semibold text-[var(--sub)] md:flex">
          <Link href="/programs" className="transition hover:text-[var(--ink)]">
            프로그램 상세
          </Link>
          <Link href="/compare" className="transition hover:text-[var(--ink)]">
            비교
          </Link>
          <Link href="/dashboard#recommend-calendar" className="transition hover:text-[var(--ink)]">
            대시보드
          </Link>
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 md:ml-0">
          <Link
            href="/programs"
            className="rounded-full border border-[var(--border)] bg-white px-2.5 py-2 text-xs font-semibold text-[var(--sub)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] sm:px-3 md:hidden"
          >
            상세
          </Link>
          <Link
            href="/compare"
            className="rounded-full border border-[var(--border)] bg-white px-2.5 py-2 text-xs font-semibold text-[var(--sub)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] sm:px-3 md:hidden"
          >
            비교
          </Link>
          <Link
            href="/dashboard#recommend-calendar"
            className="rounded-full border border-[var(--border)] bg-white px-2.5 py-2 text-xs font-semibold text-[var(--sub)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] sm:px-3 md:hidden"
          >
            대시보드
          </Link>

          {authChecked && user ? (
            <Link
              href="/dashboard/profile"
              className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-white sm:px-3 sm:py-2 sm:text-sm"
            >
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={`${user.displayName} 프로필 이미지`}
                  width={28}
                  height={28}
                  sizes="28px"
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">
                  {getHeaderInitial(user.displayName)}
                </span>
              )}
              <span className="hidden max-w-24 truncate sm:inline">{user.displayName}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[var(--fire)] px-3 py-2 text-xs font-bold text-white shadow-[0_12px_32px_rgba(249,115,22,0.18)] transition hover:bg-[var(--fire-lo)] sm:px-4 sm:text-sm"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

type LandingAHeroSectionProps = {
  featuredPrograms: Program[];
  totalCount: number;
};

export function LandingAHeroSection({ featuredPrograms, totalCount }: LandingAHeroSectionProps) {
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

  const ctaHref = authChecked && user ? "/dashboard#recommend-calendar" : "/login";
  const compactPrograms = featuredPrograms.slice(0, 2);

  return (
    <section className="landing-hero relative overflow-hidden px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <div className="relative z-10 mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,0.95fr)_360px] lg:items-center">
        <div className="rounded-[2rem] bg-[#071a36] p-7 text-white shadow-xl shadow-slate-900/10 sm:p-9">
          <div className="flex items-center justify-between gap-4">
            <Link href="/landing-a" className="text-xl font-extrabold tracking-[-0.04em] text-white">
              이소<span className="text-[var(--sky)]">서</span>
            </Link>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-sky-200 sm:block">
              Program Finder
            </p>
          </div>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">
            Public Support Programs
          </p>
          <h1 className="mt-4 max-w-3xl text-[1.75rem] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-4xl lg:text-[3.1rem]">
            흩어진 국비·지역 프로그램을
            <br />
            내 이력 기반으로 추천받고 바로 지원하세요
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            이력과 활동을 등록하면 나에게 맞는 프로그램을 추천하고,
            <br />
            지원에 필요한 이력서·포트폴리오까지 바로 준비합니다.
          </p>

          <div className="mt-7">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              내게 맞는 프로그램 추천받기
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-2xl font-semibold tracking-[-0.04em] text-white">{totalCount}</div>
              <p className="mt-1 text-xs leading-5 text-slate-300">탐색 가능한 프로그램</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-2xl font-semibold tracking-[-0.04em] text-white">D-Day</div>
              <p className="mt-1 text-xs leading-5 text-slate-300">마감 우선 탐색</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-2xl font-semibold tracking-[-0.04em] text-white">추천</div>
              <p className="mt-1 text-xs leading-5 text-slate-300">로그인 후 캘린더 연결</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 text-slate-950 shadow-xl shadow-slate-900/5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Live board</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">이번 주 우선 확인</h2>
            </div>
            <Link href="/dashboard#recommend-calendar" className="shrink-0 text-sm font-semibold text-blue-700">
              캘린더 →
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {compactPrograms.map((program) => (
              <div
                key={`${program.id}-${program.title}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {[program.source, program.location].filter(Boolean).join(" · ") || "Program signal"}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
                      {program.title || "제목 미정"}
                    </h3>
                  </div>
                  <div className={`shrink-0 text-base font-semibold tracking-[-0.03em] ${getProgramDeadlineTone(program)}`}>
                    {getProgramDeadline(program)}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{program.category || "카테고리 미분류"}</span>
                  <span>관련도 {Math.max(getProgramScore(program), 0)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Next step</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              로그인하면 추천 캘린더에서 마감 일정과 우선순위를 이어서 확인합니다.
            </p>
          </div>
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
              {programs.map((program) => {
                const chips = [...normalizeTextList(program.tags), ...normalizeTextList(program.skills)].slice(0, 4);
                const externalLink = program.application_url || program.link || program.source_url;
                const score = getProgramScore(program);

                return (
                  <article
                    key={`${program.id}-${program.title}`}
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
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="section-shell soft-panel mx-auto max-w-6xl rounded-[32px] px-6 py-8 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--blue)]">Circular flow</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[var(--ink)]">
            탐색한 프로그램은 다음 지원 준비로 이어집니다
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {workspaceStages.map((stage) => (
            <div key={stage.step} className="rounded-[24px] border border-[var(--border)] bg-white px-4 py-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">
                {stage.step}
              </span>
              <h3 className="mt-4 text-base font-bold tracking-[-0.03em] text-[var(--ink)]">{stage.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--sub)]">{stage.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingAPreviewSection() {
  return (
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--blue)]">Product preview</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[var(--ink)]">
            AI를 통해 이력서를 준비하고, 공고 매칭과 출력까지
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--sub)]">
            대시보드에서 이어질 핵심 기능을 미리 확인할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {featurePreviews.map((preview) => (
            <article
              key={preview.title}
              className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-[0_16px_44px_rgba(10,19,37,0.05)]"
            >
              <div className="relative aspect-[16/10] bg-[var(--surface)]">
                <Image
                  src={preview.imageSrc}
                  alt={preview.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="px-6 py-5">
                <h3 className="text-xl font-bold tracking-[-0.04em] text-[var(--ink)]">{preview.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--sub)]">{preview.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingACtaSection() {
  return (
    <section className="px-5 pb-14 sm:px-8 lg:px-12">
      <div className="compare-shell mx-auto flex max-w-6xl flex-col gap-6 overflow-hidden rounded-[32px] px-6 py-10 text-[var(--ink)] sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Final CTA</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.05em] text-[var(--ink)] sm:text-4xl">
            준비가 되었다면
            <br />
            이력서를 준비해 보세요.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--sub)]">
            흩어진 경력 한 번에 정리하고, 원하는 공고에 맞춰 작성해 보세요
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-[var(--fire)] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--fire-lo)]"
          >
            무료로 시작하기
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]"
          >
            대시보드 미리 보기
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingAFooter() {
  return (
    <footer className="bg-white px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-[var(--border)] pt-8 text-sm text-[var(--sub)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-extrabold tracking-[-0.04em] text-[var(--ink)]">
            이소<span className="text-[var(--sky)]">서</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--sub)]">
            공공 취업 지원 탐색을 시작점으로, 개인화 추천과 문서 워크플로우까지 연결하는 커리어 SaaS.
          </p>
        </div>
        <div className="text-sm text-[var(--muted)]">© 2026 Isoser. Career support workspace.</div>
      </div>
    </footer>
  );
}

export function LandingAStyleTag() {
  return <style jsx global>{landingAStyles}</style>;
}
