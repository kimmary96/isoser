"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getRecommendedPrograms } from "@/lib/api/app";
import type { Program } from "@/lib/types";

type RecommendedProgramsSectionProps = {
  isLoggedIn: boolean;
};

function formatScore(score: number | null | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return "관련도 정보 없음";
  }

  const percent = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return `관련도 ${percent}%`;
}

function getRecommendedReason(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function formatDateRange(program: Program): string {
  if (!program.start_date && !program.end_date) {
    return "일정 추후 공지";
  }

  const start = program.start_date ? new Date(program.start_date) : null;
  const end = program.end_date ? new Date(program.end_date) : null;

  const formatPart = (value: Date | null, raw: string | null | undefined) => {
    if (!value || Number.isNaN(value.getTime())) {
      return raw || "정보 없음";
    }

    return value.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  };

  return `${formatPart(start, program.start_date)} - ${formatPart(end, program.end_date)}`;
}

function RecommendedProgramCard({ program }: { program: Program }) {
  const recommendedReason = getRecommendedReason(program._reason);
  const scoreLabel = formatScore(
    program._relevance_score ?? program.relevance_score ?? program._score ?? program.final_score
  );
  const detailHref =
    typeof program.id === "string" || typeof program.id === "number"
      ? `/programs/${encodeURIComponent(String(program.id))}`
      : "/programs";

  return (
    <Link
      href={detailHref}
      className="group flex h-full flex-col rounded-3xl border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-500">For You</p>
          <h3 className="mt-2 line-clamp-2 text-lg font-semibold tracking-tight text-slate-950">
            {program.title || "제목 미정"}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
          {scoreLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
        <span className="rounded-full bg-slate-50 px-3 py-1">{program.category || "미분류"}</span>
        <span className="rounded-full bg-slate-50 px-3 py-1">{program.location || "지역 정보 없음"}</span>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-700">{formatDateRange(program)}</p>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {program.summary || program.description || "프로그램 소개가 아직 등록되지 않았습니다."}
      </p>

      <p className="mt-4 line-clamp-1 rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
        {recommendedReason || "내 프로필과 활동 정보를 바탕으로 추천된 프로그램입니다."}
      </p>

      <span className="mt-5 text-sm font-medium text-sky-700 transition group-hover:text-sky-800">
        상세 페이지로 이동
      </span>
    </Link>
  );
}

function RecommendationSkeleton() {
  return (
    <section className="rounded-3xl border border-sky-100 bg-sky-50/70 p-6 shadow-sm">
      <div className="animate-pulse">
        <div className="h-5 w-40 rounded bg-sky-100" />
        <div className="mt-3 h-4 w-64 rounded bg-sky-100" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-sky-100 bg-white p-5">
              <div className="h-4 w-16 rounded bg-slate-100" />
              <div className="mt-3 h-5 w-3/4 rounded bg-slate-200" />
              <div className="mt-6 h-4 w-full rounded bg-slate-100" />
              <div className="mt-3 h-4 w-5/6 rounded bg-slate-100" />
              <div className="mt-6 h-10 rounded-2xl bg-sky-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function RecommendedProgramsSection({
  isLoggedIn,
}: RecommendedProgramsSectionProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(isLoggedIn);
  const [shouldHide, setShouldHide] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setPrograms([]);
      setLoading(false);
      setShouldHide(false);
      return;
    }

    let mounted = true;

    const loadRecommendedPrograms = async () => {
      setLoading(true);
      setShouldHide(false);

      try {
        const result = await getRecommendedPrograms();
        if (!mounted) return;
        setPrograms(result.programs.slice(0, 4));
      } catch (error) {
        console.error("Failed to load recommended programs", error);
        if (!mounted) return;
        setShouldHide(true);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadRecommendedPrograms();

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  if (shouldHide) {
    return null;
  }

  if (!isLoggedIn) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">Personalized Picks</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">로그인하면 맞춤 프로그램을 추천해드립니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              프로필과 활동 정보를 바탕으로 지금 지원하기 좋은 프로그램을 바로 보여드립니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              로그인하기
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              대시보드 보기
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return <RecommendationSkeleton />;
  }

  return (
    <section className="rounded-3xl border border-sky-100 bg-sky-50/70 p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">Personalized Picks</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">내 맞춤 추천 프로그램</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            로그인한 사용자 기준으로 지금 확인할 만한 프로그램만 추려서 보여드립니다.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-semibold text-sky-700 transition hover:text-sky-800">
          전체 추천 보기
        </Link>
      </div>

      {programs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-sky-200 bg-white px-6 py-10 text-center">
          <p className="text-base font-semibold text-slate-900">아직 추천할 프로그램이 없습니다</p>
          <p className="mt-2 text-sm text-slate-500">
            프로필을 완성하면 맞춤 추천이 가능합니다.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard/profile"
              className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              프로필 편집하기
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {programs.map((program, index) => (
            <RecommendedProgramCard
              key={`${typeof program.id === "string" || typeof program.id === "number" ? program.id : program.title || index}`}
              program={program}
            />
          ))}
        </div>
      )}
    </section>
  );
}
