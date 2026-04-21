"use client";

import Link from "next/link";

import type { Program } from "@/lib/types";

import { useLandingAUser } from "./_auth";
import { getProgramDeadline, getProgramDeadlineTone, getProgramScore } from "./_shared";

type LandingAHeroSectionProps = {
  featuredPrograms: Program[];
  totalCount: number;
};

export function LandingAHeroSection({ featuredPrograms, totalCount }: LandingAHeroSectionProps) {
  const { user, authChecked } = useLandingAUser();
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
