"use client";

import { useEffect, useMemo, useState } from "react";

import { recommendPrograms } from "@/lib/api/backend";
import MiniCalendar from "@/components/MiniCalendar";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Program } from "@/lib/types";

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

function toDateKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function ProgramCard({
  program,
  cardId,
}: {
  program: Program;
  cardId?: string;
}) {
  const trainingPeriodLabel = formatTrainingPeriod(program.start_date, program.end_date);
  const deadlineLabel = formatDeadline(program.deadline);
  const ddayBadge = getDdayBadge(program.days_left);
  const cardBorderClass = getCardBorderClass(program.days_left);
  const programLink = program.link || program.application_url || program.source_url;

  return (
    <article
      id={cardId}
      className={`flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${cardBorderClass}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold text-slate-950">{program.title || "제목 없음"}</h3>
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

      <div className="mb-3 text-sm text-slate-600">신청 마감: {deadlineLabel}</div>

      <div className="mb-6 text-sm font-medium text-slate-800">{formatRelevance(program.final_score)}</div>

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
  const supabase = useMemo(() => createBrowserClient(), []);

  const [userName, setUserName] = useState("사용자");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDateClick = (date: string) => {
    setSelectedDate((current) => (current === date ? null : date));
  };

  const filteredPrograms = useMemo(() => {
    if (!selectedDate) {
      return programs;
    }

    return programs.filter((program) => {
      const dateKey = program.end_date ? toDateKey(program.end_date) : null;
      return dateKey === selectedDate;
    });
  }, [programs, selectedDate]);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user ?? null;
        const accessToken = session?.access_token;

        if (!mounted) return;

        const metadataName =
          typeof user?.user_metadata?.name === "string"
            ? user.user_metadata.name
            : typeof user?.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : typeof user?.email === "string"
                ? user.email.split("@")[0]
                : "사용자";

        setUserName(formatUserName(metadataName));

        if (user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .maybeSingle();

          if (mounted && typeof profile?.name === "string" && profile.name.trim()) {
            setUserName(profile.name.trim());
          }
        }

        const data = await recommendPrograms(9, accessToken);
        const nextPrograms = (data.items ?? [])
          .map((item) => item.program)
          .filter((program): program is Program => Boolean(program))
          .slice(0, 9);

        if (!mounted) return;

        setPrograms(nextPrograms);
      } catch (e) {
        if (!mounted) return;
        setPrograms([]);
        setError(e instanceof Error ? e.message : "추천 프로그램을 불러오지 못했습니다.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            안녕하세요, {userName}님
          </h1>
        </header>

        <MiniCalendar
          programs={programs.map((program) => ({
            title: program.title || "제목 없음",
            end_date: program.end_date || undefined,
          }))}
          selectedDate={selectedDate}
          onDateClick={handleDateClick}
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              AI 맞춤 취업 지원 캘린더
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredPrograms.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPrograms.map((program, index) => {
                const dateKey = program.end_date ? toDateKey(program.end_date) : null;

                return (
                  <ProgramCard
                    key={`${program.link ?? program.title ?? "program"}-${index}`}
                    cardId={dateKey ? `card-${dateKey}` : undefined}
                    program={program}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <p className="text-sm text-slate-500">
                {error
                  ? error
                  : selectedDate
                    ? "해당 날짜에 마감되는 프로그램이 없습니다"
                    : programs.length > 0
                      ? "추천 프로그램이 없습니다"
                      : "추천 프로그램이 없습니다"}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
