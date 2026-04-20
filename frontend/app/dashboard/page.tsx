"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardCalendarSection } from "@/app/dashboard/_components/dashboard-calendar-section";
import { getDashboardMe, getRecommendedPrograms } from "@/lib/api/app";
import type { RecommendedProgram } from "@/lib/types";

function formatUserName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || "사용자";
}

function formatMonthDay(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function formatTrainingPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  const start = formatMonthDay(startDate);
  const end = formatMonthDay(endDate);

  if (start && end) {
    return `${start} ~ ${end}`;
  }

  if (start) {
    return `${start} ~ 정보 없음`;
  }

  if (end) {
    return `정보 없음 ~ ${end}`;
  }

  return "정보 없음";
}

function formatDeadline(value: string | null | undefined): string {
  const formatted = formatMonthDay(value);
  return formatted ? `${formatted}까지` : "정보 없음";
}

function formatRelevance(score: number | null | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return "관련도 0%";
  }

  const percent = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return `관련도 ${percent}%`;
}

function formatSource(source: string | null | undefined): string {
  if (source === "work24_training") {
    return "Work24 훈련과정";
  }

  return source || "출처 미상";
}

function getCardBorderClass(daysLeft: number | null | undefined): string {
  if (typeof daysLeft !== "number" || Number.isNaN(daysLeft) || daysLeft > 14) {
    return "border-l-4 border-l-green-400";
  }

  if (daysLeft <= 7) {
    return "border-l-4 border-l-red-500";
  }

  return "border-l-4 border-l-yellow-400";
}

function getDdayBadge(daysLeft: number | null | undefined) {
  if (typeof daysLeft !== "number" || Number.isNaN(daysLeft) || daysLeft < 0) {
    return null;
  }

  if (daysLeft <= 7) {
    return {
      label: `D-${daysLeft}`,
      className: "bg-red-100 text-red-700",
    };
  }

  if (daysLeft <= 14) {
    return {
      label: `D-${daysLeft}`,
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: `D-${daysLeft}`,
    className: "bg-green-100 text-green-700",
  };
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-5 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-24 rounded bg-slate-100" />
        </div>
        <div className="h-7 w-14 rounded-full bg-slate-100" />
      </div>
      <div className="mb-5 h-4 w-20 rounded bg-slate-100" />
      <div className="mb-6 h-4 w-24 rounded bg-slate-200" />
      <div className="h-4 w-20 rounded bg-slate-100" />
    </div>
  );
}

function ProgramCard({ program }: { program: RecommendedProgram }) {
  const trainingPeriodLabel = formatTrainingPeriod(program.start_date, program.end_date);
  const deadlineLabel = formatDeadline(program.deadline);
  const ddayBadge = getDdayBadge(program.days_left);
  const cardBorderClass = getCardBorderClass(program.days_left);
  const programLink = program.link || program.application_url || program.source_url;
  const visibleKeywords = program.fitKeywords.filter(Boolean).slice(0, 3);

  return (
    <article
      className={`flex min-h-[280px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${cardBorderClass}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold text-slate-950">
            {program.title || "제목 없음"}
          </h3>
          <p className="mt-2 text-sm text-slate-500">{formatSource(program.source)}</p>
        </div>
        {ddayBadge ? (
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ddayBadge.className}`}
          >
            {ddayBadge.label}
          </span>
        ) : null}
      </div>

      <div className="mb-2 text-sm text-slate-600">훈련 기간: {trainingPeriodLabel}</div>
      <div className="mb-3 text-sm text-slate-600">지원 마감: {deadlineLabel}</div>
      <div className="mb-3 text-sm font-medium text-slate-800">
        {formatRelevance(program.score ?? program.final_score)}
      </div>

      <p className="mb-4 line-clamp-3 text-sm leading-6 text-slate-600">{program.reason}</p>

      {visibleKeywords.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {visibleKeywords.map((keyword) => (
            <span
              key={`${program.id ?? program.title ?? "program"}-${keyword}`}
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto">
        {programLink ? (
          <a
            href={programLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            자세히 보기
          </a>
        ) : (
          <span className="text-sm text-slate-400">링크 없음</span>
        )}
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [userName, setUserName] = useState("사용자");
  const [programs, setPrograms] = useState<RecommendedProgram[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programError, setProgramError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      const [meResult, programResult] = await Promise.allSettled([
        getDashboardMe(),
        getRecommendedPrograms(),
      ]);

      if (!mounted) return;

      if (meResult.status === "fulfilled") {
        setUserName(formatUserName(meResult.value.user?.displayName));
      } else {
        setUserName("사용자");
      }

      if (programResult.status === "fulfilled") {
        setPrograms(programResult.value.programs.slice(0, 6));
        setProgramError(null);
      } else {
        setPrograms([]);
        setProgramError(programResult.reason instanceof Error ? programResult.reason.message : "추천 프로그램을 불러오지 못했습니다.");
      }

      setLoadingPrograms(false);
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            안녕하세요, {userName}님
          </h1>
        </header>

        <DashboardCalendarSection />

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
                Recommended
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                맞춤 추천 프로그램
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                현재 프로필 기준으로 우선 확인할 만한 프로그램만 추렸습니다.
              </p>
            </div>
            <Link
              href="/dashboard/profile"
              className="text-sm font-semibold text-sky-700 transition hover:text-sky-800"
            >
              프로필 관리
            </Link>
          </div>

          {loadingPrograms ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={`dashboard-program-skeleton-${index}`} />
              ))}
            </div>
          ) : programError ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10">
              <p className="text-base font-semibold text-slate-900">추천 목록을 불러오지 못했습니다.</p>
              <p className="mt-2 text-sm text-slate-500">{programError}</p>
            </div>
          ) : programs.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10">
              <p className="text-base font-semibold text-slate-900">아직 추천 가능한 프로그램이 없습니다.</p>
              <p className="mt-2 text-sm text-slate-500">
                프로필과 활동 정보를 더 채우면 맞춤 추천 품질이 올라갑니다.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((program, index) => (
                <ProgramCard
                  key={`${typeof program.id === "string" || typeof program.id === "number" ? program.id : program.title || index}`}
                  program={program}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
