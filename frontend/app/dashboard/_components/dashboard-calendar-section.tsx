"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { MouseEvent } from "react";

import { DashboardCalendarMiniCalendar } from "@/app/dashboard/_components/dashboard-calendar-mini-calendar";
import { useDashboardCalendar } from "@/app/dashboard/_hooks/use-dashboard-calendar";
import type { ProgramCalendarRecommendItem } from "@/lib/types";

function formatMonthDay(value: string | null | undefined): string {
  if (!value) return "정보 없음";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "정보 없음";

  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function formatSource(source: string | null | undefined): string {
  if (!source) return "출처 미상";
  if (source === "work24_training") return "고용24";
  return source;
}

function formatRelevance(score: number): string {
  const percent = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return `관련도 ${percent}%`;
}

function parseDateKey(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDdayTone(label: string, daysLeft: number | null | undefined): string {
  if (label === "D-Day" || daysLeft === 0 || (typeof daysLeft === "number" && daysLeft <= 3)) {
    return "bg-rose-100 text-rose-700";
  }

  if (typeof daysLeft === "number" && daysLeft <= 7) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
}

function stopCardNavigation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function CalendarCard({
  item,
  selectedDate,
}: {
  item: ProgramCalendarRecommendItem;
  selectedDate: string | null;
}) {
  const router = useRouter();
  const dateKey = parseDateKey(item.deadline);
  const isSelected = selectedDate !== null && selectedDate === dateKey;
  const programId = String(item.program.id ?? item.program_id ?? "").trim();
  const externalLink = item.program.application_url || item.program.link || item.program.source_url;
  const resumeLink = `/dashboard/resume?prefill_program_id=${encodeURIComponent(programId)}`;

  const goToProgram = () => {
    if (!programId) return;
    router.push(`/programs/${encodeURIComponent(programId)}`);
  };

  return (
    <article
      id={dateKey ? `dashboard-calendar-card-${dateKey}` : undefined}
      tabIndex={programId ? 0 : -1}
      onClick={goToProgram}
      onKeyDown={(event) => {
        if (!programId) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToProgram();
        }
      }}
      className={`flex h-full min-h-[260px] flex-col rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isSelected ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200"
      } ${programId ? "cursor-pointer" : ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          {formatSource(item.program.source)}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${getDdayTone(item.d_day_label, item.program.days_left)}`}
        >
          {item.d_day_label}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="line-clamp-2 text-lg font-semibold text-slate-950">
            {item.program.title ?? "제목 없음"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{item.reason}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            {item.program.location || "지역 정보 없음"}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            {formatRelevance(item.final_score)}
          </span>
        </div>

        <dl className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-3">
            <dt>마감일</dt>
            <dd className="font-medium text-slate-900">{formatMonthDay(item.deadline)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>관련도 점수</dt>
            <dd className="font-medium text-slate-900">{formatRelevance(item.relevance_score)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        {externalLink ? (
          <a
            href={externalLink}
            target="_blank"
            rel="noreferrer"
            onClick={stopCardNavigation}
            className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            지원하기
          </a>
        ) : null}
        {programId ? (
          <Link
            href={resumeLink}
            onClick={stopCardNavigation}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            이력서 바로 만들기
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function CalendarSkeleton() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 h-8 w-64 animate-pulse rounded bg-slate-100" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`dashboard-calendar-skeleton-${index}`}
              className="h-[280px] w-[84%] flex-none animate-pulse rounded-3xl border border-slate-200 bg-slate-50 sm:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-0.75rem)]"
            />
          ))}
        </div>
        <div className="h-[320px] animate-pulse rounded-3xl bg-slate-50" />
      </div>
    </section>
  );
}

export function DashboardCalendarSection() {
  const { items, status } = useDashboardCalendar();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    if (!selectedDate) return items;

    const filtered = items.filter((item) => parseDateKey(item.deadline) === selectedDate);
    return filtered.length > 0 ? filtered : items;
  }, [items, selectedDate]);

  if (status === "hidden") {
    return null;
  }

  if (status === "loading") {
    return <CalendarSkeleton />;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          AI 맞춤 취업 지원 캘린더
        </h2>
        <p className="text-sm text-slate-500">
          마감이 가까운 맞춤 일정을 한 번에 보고 바로 지원하거나 이력서 작성으로 이어갈 수 있습니다.
        </p>
      </div>

      {status === "empty" ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            아직 추천할 일정이 없습니다. 프로필을 완성하면 맞춤 일정이 보입니다.
          </p>
          <Link
            href="/dashboard/profile"
            className="mt-4 inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            프로필 편집
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="min-w-0">
            <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
              {visibleItems.map((item) => (
                <div
                  key={`${item.program_id}-${item.deadline ?? "open"}`}
                  className="w-[84%] min-w-0 flex-none snap-start sm:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-0.75rem)] 2xl:w-[calc(25%-0.75rem)]"
                >
                  <CalendarCard item={item} selectedDate={selectedDate} />
                </div>
              ))}
            </div>
          </div>

          <DashboardCalendarMiniCalendar
            items={items}
            selectedDate={selectedDate}
            onSelectDate={(dateKey) => {
              setSelectedDate((current) => (current === dateKey ? null : dateKey));

              const card = document.getElementById(`dashboard-calendar-card-${dateKey}`);
              if (card) {
                card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
              }
            }}
          />
        </div>
      )}
    </section>
  );
}
