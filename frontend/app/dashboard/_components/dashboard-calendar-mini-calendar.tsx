"use client";

import { useMemo } from "react";

import type { ProgramCardItem } from "@/lib/types";

type DashboardCalendarMiniCalendarProps = {
  items: ProgramCardItem[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return toDateKey(parsed);
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function DashboardCalendarMiniCalendar({
  items,
  selectedDate,
  onSelectDate,
}: DashboardCalendarMiniCalendarProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const dateMeta = useMemo(() => {
    const meta = new Map<string, { count: number; titles: string[] }>();

    items.forEach((item) => {
      const dateKey = parseDateKey(item.program.deadline);
      if (!dateKey) return;
      if (!item.program.deadline) return;

      const parsed = new Date(item.program.deadline);
      if (parsed.getFullYear() !== currentYear || parsed.getMonth() !== currentMonth) return;

      const entry = meta.get(dateKey) ?? { count: 0, titles: [] };
      entry.count += 1;
      entry.titles.push(item.program.title ?? "제목 없음");
      meta.set(dateKey, entry);
    });

    return meta;
  }, [currentMonth, currentYear, items]);

  const firstDay = new Date(currentYear, currentMonth, 1);
  const firstVisibleDay = new Date(firstDay);
  firstVisibleDay.setDate(firstDay.getDate() - firstDay.getDay());

  const cells = Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(firstVisibleDay);
    cellDate.setDate(firstVisibleDay.getDate() + index);
    return cellDate;
  });

  return (
    <div className="rounded-3xl border border-sky-100 bg-sky-50/70 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">이번 달 마감 일정</h3>
          <p className="mt-1 text-sm text-slate-500">
            {currentYear}년 {currentMonth + 1}월
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
          {dateMeta.size}일 표시
        </span>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] font-medium text-slate-400">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const dateKey = toDateKey(cell);
          const meta = dateMeta.get(dateKey);
          const isCurrentMonth = cell.getMonth() === currentMonth;
          const isToday = isSameDay(cell, today);
          const isSelected = selectedDate === dateKey;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={`flex min-h-12 flex-col items-center justify-start rounded-2xl border px-1 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-sky-500 bg-white text-slate-900 shadow-sm"
                  : isCurrentMonth
                    ? "border-white/80 bg-white/90 text-slate-700 hover:border-sky-200"
                    : "border-transparent bg-transparent text-slate-300"
              }`}
              aria-pressed={isSelected}
              aria-label={`${currentMonth + 1}월 ${cell.getDate()}일${meta ? `, 마감 일정 ${meta.count}건` : ""}`}
              title={meta?.titles.join(", ")}
            >
              <span className={`font-medium ${isToday ? "text-sky-700" : ""}`}>{cell.getDate()}</span>
              <span className="mt-1 flex items-center gap-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    meta ? "bg-rose-500" : isToday && isCurrentMonth ? "bg-sky-300" : "bg-transparent"
                  }`}
                />
                {meta && meta.count > 1 ? (
                  <span className="rounded-full bg-slate-900 px-1 text-[10px] font-semibold text-white">
                    +{meta.count - 1}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {dateMeta.size === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-sky-100 bg-white/80 px-3 py-3 text-sm text-slate-500">
          이번 달 마감 일정 없음
        </p>
      ) : null}
    </div>
  );
}
