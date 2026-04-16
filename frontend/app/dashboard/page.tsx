"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import MiniCalendar from "@/components/MiniCalendar";
import { getDashboardMe, getRecommendedPrograms } from "@/lib/api/app";
import type { Program } from "@/lib/types";

const CATEGORY_OPTIONS = [
  { label: "전체", value: null },
  { label: "IT·컴퓨터", value: "IT" },
  { label: "디자인", value: "디자인" },
  { label: "경영·마케팅", value: "경영" },
  { label: "어학", value: "어학" },
] as const;

const REGION_OPTIONS = [
  { label: "전체", value: null },
  { label: "서울", value: "서울" },
  { label: "경기", value: "경기" },
  { label: "온라인", value: "온라인" },
] as const;

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

function getRecommendedReason(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function getFitKeywords(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((keyword) => keyword.trim()).filter(Boolean).slice(0, 3);
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

  if (daysLeft === 0) {
    return {
      label: "마감 D-Day",
      className: "bg-red-100 text-red-700",
    };
  }

  if (daysLeft <= 7) {
    return {
      label: `마감 D-${daysLeft}`,
      className: "bg-orange-100 text-orange-700",
    };
  }

  return null;
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
      <div className="mb-4 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-slate-100" />
        <div className="h-6 w-16 rounded-full bg-slate-100" />
      </div>
      <div className="mb-6 h-4 w-full rounded bg-slate-100" />
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
  const recommendedReason = getRecommendedReason(program._reason);
  const fitKeywords = getFitKeywords(program._fit_keywords);

  return (
    <article
      id={cardId}
      className={`flex min-h-[260px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${cardBorderClass}`}
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

      <div className="mb-3 text-sm font-medium text-slate-800">
        {formatRelevance(program._relevance_score ?? program.relevance_score ?? program._score ?? program.final_score)}
      </div>

      {fitKeywords.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {fitKeywords.map((keyword) => (
            <span
              key={`${program.id ?? program.title ?? "program"}-${keyword}`}
              className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}

      {recommendedReason ? (
        <p className="mb-6 line-clamp-2 text-sm text-slate-600">{recommendedReason}</p>
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
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
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

  const loadPrograms = useCallback(
    async (options?: { category?: string | null; region?: string | null }) => {
      setLoading(true);
      setError(null);

      try {
        const result = await getRecommendedPrograms({
          category: options?.category ?? undefined,
          region: options?.region ?? undefined,
        });
        setPrograms(result.programs);
      } catch (e) {
        setPrograms([]);
        setError(e instanceof Error ? e.message : "추천 프로그램을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const meResult = await getDashboardMe();
        if (!mounted) return;
        setUserName(formatUserName(meResult.user?.displayName));
      } catch {
        if (!mounted) return;
        setUserName("사용자");
      }
    };

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void loadPrograms({ category: selectedCategory, region: selectedRegion });
  }, [loadPrograms, selectedCategory, selectedRegion]);

  const isFiltered = Boolean(selectedCategory || selectedRegion);
  const emptyMessage = error
    ? error
    : selectedDate && programs.length > 0
      ? "해당 날짜에 마감되는 프로그램이 없습니다"
      : isFiltered
        ? "해당 조건에 맞는 추천 프로그램이 없습니다"
        : "추천 프로그램이 없습니다";

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

          <div className="mb-6 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">카테고리</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const isActive = selectedCategory === option.value;
                  return (
                    <button
                      key={`category-${option.label}`}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(option.value);
                        setSelectedRegion(null);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">지역</p>
              <div className="flex flex-wrap gap-2">
                {REGION_OPTIONS.map((option) => {
                  const isActive = selectedRegion === option.value;
                  return (
                    <button
                      key={`region-${option.label}`}
                      type="button"
                      onClick={() => {
                        setSelectedRegion(option.value);
                        setSelectedCategory(null);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <SkeletonCard key={`skeleton-${index}`} />
              ))}
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
              <p className="text-sm text-slate-500">{emptyMessage}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
