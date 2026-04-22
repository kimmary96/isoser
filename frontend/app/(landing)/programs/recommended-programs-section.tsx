"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getRecommendedPrograms } from "@/lib/api/app";
import type { Program } from "@/lib/types";

import ProgramCard, { isDisplayableProgram } from "./program-card";

type RecommendedProgramsSectionProps = {
  isLoggedIn: boolean;
  loginHref?: string;
  previewPrograms?: Program[];
  bookmarkedProgramIds?: string[];
};

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
  loginHref = "/login",
  previewPrograms = [],
  bookmarkedProgramIds = [],
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
        setPrograms(
          result.programs
            .filter(isDisplayableProgram)
            .filter((program) => {
              const score = program._relevance_score ?? program.relevance_score ?? program._score ?? program.final_score;
              if (typeof score !== "number" || Number.isNaN(score)) return false;
              return score <= 1 ? score >= 0.4 : score >= 40;
            })
            .slice(0, 4)
        );
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
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">Personalized Picks</p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">내 맞춤 추천 프로그램</h2>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 blur-sm md:grid-cols-3">
          {(previewPrograms.length ? previewPrograms : []).slice(0, 3).map((program) => (
            <ProgramCard key={String(program.id)} program={program} isLoggedIn={false} />
          ))}
          {previewPrograms.length === 0
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-56 rounded-2xl border border-slate-200 bg-slate-50" />
              ))
            : null}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/55 px-6">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
            <h3 className="text-xl font-semibold tracking-tight text-slate-950">로그인하고 내 맞춤 추천 받기</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">프로필과 활동 정보를 바탕으로 관련도 높은 프로그램을 보여드립니다.</p>
            <Link
              href={loginHref}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              로그인하기
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
            <ProgramCard
              key={`${typeof program.id === "string" || typeof program.id === "number" ? program.id : program.title || index}`}
              program={program}
              isLoggedIn={isLoggedIn}
              initialBookmarked={bookmarkedProgramIds.includes(String(program.id ?? ""))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
