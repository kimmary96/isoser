"use client";

import { useEffect, useState } from "react";

type MiniCalendarProgram = {
  deadline?: string;
  title: string;
  isApplied?: boolean;
};

type MiniCalendarProps = {
  programs: MiniCalendarProgram[];
  selectedDate?: string | null;
  onDateClick: (date: string) => void;
  focusDate?: string | null;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function MiniCalendar({
  programs,
  selectedDate,
  onDateClick,
  focusDate,
}: MiniCalendarProps) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    if (!focusDate) return;
    const date = new Date(focusDate);
    if (Number.isNaN(date.getTime())) return;
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [focusDate]);

  const currentYear = visibleMonth.getFullYear();
  const currentMonth = visibleMonth.getMonth();

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const monthLabel = `${currentYear}년 ${currentMonth + 1}월`;

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const markedDates = new Set(
    programs
      .map((program) => {
        if (!program.deadline) return null;
        const date = new Date(program.deadline);
        if (Number.isNaN(date.getTime())) return null;
        if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) return null;
        return toDateKey(date);
      })
      .filter((value): value is string => Boolean(value))
  );
  const programsByDate = programs.reduce<Record<string, MiniCalendarProgram[]>>((acc, program) => {
    if (!program.deadline) return acc;
    const date = new Date(program.deadline);
    if (Number.isNaN(date.getTime())) return acc;
    if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) return acc;

    const key = toDateKey(date);
    acc[key] = [...(acc[key] ?? []), program];
    return acc;
  }, {});

  const cells: Array<Date | null> = [];

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    cells.push(new Date(currentYear, currentMonth, day));
  }

  return (
    <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950">이번 달 마감 일정</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            aria-label="이전 달"
          >
            ‹
          </button>
          <p className="min-w-24 text-center text-sm font-semibold text-slate-700">{monthLabel}</p>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] font-medium text-slate-400">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="h-14 rounded-lg bg-transparent" />;
          }

          const dateKey = toDateKey(cell);
          const isToday = isSameDate(cell, today);
          const hasProgram = markedDates.has(dateKey);
          const isSelected = selectedDate === dateKey;
          const dayPrograms = programsByDate[dateKey] ?? [];
          const appliedPrograms = dayPrograms.filter((program) => program.isApplied);
          const visiblePrograms = (appliedPrograms.length > 0 ? appliedPrograms : dayPrograms).slice(0, 2);
          const hasAppliedProgram = appliedPrograms.length > 0;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onDateClick(dateKey)}
              className={`flex min-h-20 flex-col items-stretch justify-start rounded-lg border px-1.5 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? "border-blue-600 bg-white text-slate-700"
                  : hasAppliedProgram
                    ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm"
                  : isToday
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-100 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-xs font-semibold leading-none">{cell.getDate()}</span>
              {visiblePrograms.length > 0 ? (
                <span className="mt-2 space-y-1">
                  {visiblePrograms.map((program, programIndex) => (
                    <span
                      key={`${dateKey}-${program.title}-${programIndex}`}
                      className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-4 ${
                        program.isApplied
                          ? "bg-emerald-600 text-white"
                          : isToday
                            ? "bg-white/20 text-white"
                            : "bg-red-50 text-red-700"
                      }`}
                      title={program.title}
                    >
                      {program.isApplied ? "적용 " : "마감 "}
                      {program.title}
                    </span>
                  ))}
                </span>
              ) : (
                <span
                  className={`mt-2 h-1.5 w-1.5 self-center rounded-full ${
                    hasProgram ? "bg-red-500" : isToday ? "bg-white/70" : "bg-transparent"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
