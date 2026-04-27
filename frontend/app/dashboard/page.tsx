"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ProgramDeadlineBadge } from "@/components/programs/program-deadline-badge";
import {
  getDashboardProfile,
  getDocuments,
  listActivities,
  listCoverLetters,
  listSavedPortfolios,
} from "@/lib/api/app";
import { formatProgramMonthDay, toProgramDateKey } from "@/lib/program-display";
import type { ProgramCardItem, ProgramCardSummary } from "@/lib/types";

import { useDashboardRecommendations } from "./_hooks/use-dashboard-recommendations";
import { DASHBOARD_COPY } from "./dashboard-copy";

const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS_KR = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];
const MAIN_CALENDAR_ROWS = 5;
const MINI_CALENDAR_ROWS = 6;

type ColorKey = "it" | "design" | "biz" | "urgent" | "other";
type EventType = "start" | "deadline" | "pass" | "test";

type CalendarEvent = {
  id: string;
  title: string;
  org: string;
  deadline: string;
  category: string;
  color: ColorKey;
  eventType: EventType;
  daysLeft: number | null;
  isBookmarked: boolean;
};

type BgKey = "blue" | "teal" | "mint" | "lavender";

const AGENDA_DOT_COLOR: Record<ColorKey, string> = {
  it: "#4361ee",
  design: "#d63384",
  biz: "#198754",
  urgent: "#e0621a",
  other: "#94a3b8",
};

const PREFIX_LABEL: Record<EventType, string> = {
  start: "시",
  deadline: "마",
  pass: "합",
  test: "인",
};

const PREFIX_BG: Record<EventType, string> = {
  start: "#e05c5c",
  deadline: "#4361ee",
  pass: "#1ba362",
  test: "#9b5de5",
};

const FILTER_ITEMS: Array<{ key: EventType; label: string; color: string }> = [
  { key: "start", label: "마감일정", color: "#4361ee" },
  { key: "deadline", label: "훈련 시작일정", color: "#e05c5c" },
];

const CARD_BG_CLASS: Record<BgKey, string> = {
  blue: "bg-[#dce9ff]",
  teal: "bg-[#d5f0ee]",
  mint: "bg-[#d4f0e4]",
  lavender: "bg-[#e4dcff]",
};

const CARD_BG_CYCLE: BgKey[] = ["blue", "teal", "mint", "lavender"];

const BOOKMARK_BADGE_PALETTE: Array<{ bg: string; color: string }> = [
  { bg: "#e8f0fe", color: "#4361ee" },
  { bg: "#fff3e8", color: "#e0621a" },
  { bg: "#fce8f3", color: "#d63384" },
  { bg: "#e8f8f0", color: "#198754" },
  { bg: "#e4dcff", color: "#7c3aed" },
];

function pickColor(category: string | null | undefined, daysLeft: number | null | undefined): ColorKey {
  if (typeof daysLeft === "number" && daysLeft >= 0 && daysLeft <= 3) return "urgent";
  if (!category) return "other";
  const c = category.toUpperCase();
  if (c.includes("IT") || c.includes("개발") || c.includes("데이터") || c.includes("AI")) return "it";
  if (category.includes("디자인")) return "design";
  if (
    category.includes("경영") ||
    category.includes("비즈니스") ||
    category.includes("마케팅") ||
    category.includes("사무")
  ) return "biz";
  return "other";
}

function pickEventType(color: ColorKey): EventType {
  if (color === "urgent") return "deadline";
  if (color === "it") return "start";
  if (color === "design") return "pass";
  if (color === "biz") return "deadline";
  return "start";
}

function toCalendarEvent(item: ProgramCardItem, index: number, isBookmarked = false): CalendarEvent | null {
  const { program } = item;
  const dateKey = toProgramDateKey(program.deadline);
  if (!dateKey) return null;
  const color = pickColor(program.category, program.days_left);
  return {
    id: String(program.id ?? `${program.title ?? "program"}-${index}`),
    title: program.title ?? "제목 없음",
    org: program.provider ?? "",
    deadline: dateKey,
    category: program.category ?? "",
    color,
    eventType: pickEventType(color),
    daysLeft: program.days_left ?? null,
    isBookmarked,
  };
}

function groupEventsByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const map: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!map[ev.deadline]) map[ev.deadline] = [];
    map[ev.deadline].push(ev);
  }
  return map;
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function firstDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 1).getDay();
}

function isSameLocalDate(value: string | null | undefined, targetDate: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  return (
    parsed.getFullYear() === targetDate.getFullYear() &&
    parsed.getMonth() === targetDate.getMonth() &&
    parsed.getDate() === targetDate.getDate()
  );
}

function countCreatedToday<T extends { created_at?: string | null }>(
  items: T[],
  targetDate: Date
): number {
  return items.filter((item) => isSameLocalDate(item.created_at, targetDate)).length;
}

function buildMonthCells(year: number, month: number, rowCount = MINI_CALENDAR_ROWS) {
  const firstDay = firstDayOfMonth(year, month);
  const days = daysInMonth(year, month);
  const prevDays = daysInMonth(year, month - 1);
  const targetCellCount = rowCount * 7;
  const cells: Array<{ day: number; cur: boolean; dateStr: string }> = [];

  for (let i = 0; i < firstDay; i += 1) {
    const d = prevDays - firstDay + i + 1;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, cur: false, dateStr: formatDateStr(y, m, d) });
  }
  for (let d = 1; d <= days; d += 1) {
    cells.push({ day: d, cur: true, dateStr: formatDateStr(year, month, d) });
  }
  const remaining = targetCellCount - cells.length;
  for (let d = 1; d <= remaining; d += 1) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push({ day: d, cur: false, dateStr: formatDateStr(y, m, d) });
  }
  return cells.slice(0, targetCellCount);
}

export default function DashboardPage() {
  const {
    userName,
    programs,
    bookmarkedPrograms,
    bookmarksLoading,
    bookmarksError,
    appliedCalendarPrograms,
    selectedDate,
    setSelectedDate,
    handleApplyToCalendar,
    appliedProgramIds,
  } = useDashboardRecommendations();

  const todayDate = useMemo(() => new Date(), []);
  const todayStr = useMemo(
    () => formatDateStr(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()),
    [todayDate]
  );

  const [year, setYear] = useState<number>(todayDate.getFullYear());
  const [month, setMonth] = useState<number>(todayDate.getMonth());
  const [calView, setCalView] = useState<"차트" | "달력" | "주간">("달력");
  const [filters, setFilters] = useState<Record<EventType, boolean>>({
    start: true,
    deadline: true,
    pass: true,
    test: true,
  });
  const [starred, setStarred] = useState<Record<string, boolean>>({});

  const [achievement, setAchievement] = useState<{
    profile: number;
    activities: number;
    resumes: number;
    coverLetters: number;
    portfolios: number;
  }>({ profile: 0, activities: 0, resumes: 0, coverLetters: 0, portfolios: 0 });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [profileRes, activitiesRes, documentsRes, coverLettersRes, portfoliosRes] =
        await Promise.allSettled([
          getDashboardProfile(),
          listActivities(),
          getDocuments(),
          listCoverLetters(),
          listSavedPortfolios(),
        ]);
      if (!mounted) return;
      const profileCount =
        profileRes.status === "fulfilled" &&
        isSameLocalDate(profileRes.value.profile?.created_at, todayDate)
          ? 1
          : 0;
      const activitiesCount =
        activitiesRes.status === "fulfilled"
          ? countCreatedToday(activitiesRes.value.activities, todayDate)
          : 0;
      const resumesCount =
        documentsRes.status === "fulfilled"
          ? countCreatedToday(documentsRes.value.documents, todayDate)
          : 0;
      const coverLettersCount =
        coverLettersRes.status === "fulfilled"
          ? countCreatedToday(coverLettersRes.value.coverLetters, todayDate)
          : 0;
      const portfoliosCount =
        portfoliosRes.status === "fulfilled"
          ? portfoliosRes.value.portfolios.filter((item) =>
              isSameLocalDate(item.createdAt, todayDate)
            ).length
          : 0;
      setAchievement({
        profile: profileCount,
        activities: activitiesCount,
        resumes: resumesCount,
        coverLetters: coverLettersCount,
        portfolios: portfoliosCount,
      });
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [todayDate]);

  const effectiveSelectedDate = selectedDate ?? todayStr;

  const events = useMemo<CalendarEvent[]>(() => {
    const bookmarkedIds = new Set(
      bookmarkedPrograms
        .map((item) => String(item.program.id ?? ""))
        .filter(Boolean)
    );
    const byId = new Map<string, CalendarEvent>();

    programs.forEach((item, idx) => {
      const ev = toCalendarEvent(item, idx, bookmarkedIds.has(String(item.program.id ?? "")));
      if (!ev) return;
      byId.set(ev.id, ev);
    });

    bookmarkedPrograms.forEach((item, idx) => {
      const pid = String(item.program.id ?? "");
      if (pid && byId.has(pid)) {
        const existing = byId.get(pid)!;
        byId.set(pid, { ...existing, isBookmarked: true });
        return;
      }
      const ev = toCalendarEvent(item, idx, true);
      if (!ev) return;
      byId.set(ev.id, ev);
    });

    return Array.from(byId.values());
  }, [programs, bookmarkedPrograms]);

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const eventDates = useMemo(() => new Set(Object.keys(eventsByDate)), [eventsByDate]);

  const todayEvents = eventsByDate[todayStr] ?? [];
  const selectedEvents =
    effectiveSelectedDate && effectiveSelectedDate !== todayStr
      ? eventsByDate[effectiveSelectedDate] ?? []
      : [];

  const totalDeadlines = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return Object.keys(eventsByDate)
      .filter((k) => k.startsWith(prefix))
      .reduce((acc, k) => acc + eventsByDate[k].length, 0);
  }, [year, month, eventsByDate]);

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const toggleFilter = (k: EventType) => setFilters((f) => ({ ...f, [k]: !f[k] }));
  const toggleStar = (id: string) => setStarred((s) => ({ ...s, [id]: !s[id] }));
  const handleSubscribe = (program: ProgramCardSummary) => {
    const pid = String(program.id ?? "");
    if (!pid) return;
    if (appliedProgramIds.has(pid)) return;
    handleApplyToCalendar(program);
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate((current) => (current === dateStr ? null : dateStr));
  };

  const monthCells = useMemo(
    () => buildMonthCells(year, month, MAIN_CALENDAR_ROWS),
    [year, month]
  );

  // 커리어 핏 과정/찜한 과정은 하단 5컬럼 grid에 맞춰 최대 5개만 보여준다.
  const recCardItems = programs.slice(0, 5);
  const bookmarkedCardItems = bookmarkedPrograms.slice(0, 5);

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col overflow-hidden bg-[#f4f5f7] font-sans">
      {/* Body: left panel + right area */}
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* LEFT PANEL */}
        <aside className="flex w-[320px] min-w-[320px] flex-shrink-0 flex-col overflow-y-auto border-r border-[#e8eaed] bg-white">
          {/* Greeting summary */}
          <div className="border-b border-[#f0f0f0] px-4 pb-3 pt-6">
            <div className="text-[15px] font-semibold text-[#16162a]">
              안녕하세요, {userName}님 👋
            </div>
            <div className="mt-[3px] text-[15px] text-[#888]">
              이번 달 마감{" "}
              <b className="text-[#e0621a]">{totalDeadlines}건</b> · 오늘 마감{" "}
              <b className="text-[#d63384]">{todayEvents.length}건</b>
            </div>
          </div>

          {/* Mini calendar */}
          <div className="border-b border-[#f0f0f0] p-4">
            <MiniCalendar
              year={year}
              month={month}
              today={todayStr}
              selectedDate={effectiveSelectedDate}
              eventDates={eventDates}
              onSelectDate={handleSelectDate}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
            />
          </div>

          {/* Today's deadlines */}
          <div className="border-b border-[#f0f0f0] p-4">
            <div className="mb-2.5 text-[15px] font-semibold text-[#aaa]">
              오늘 마감 일정
            </div>
            {todayEvents.length === 0 ? (
              <div className="py-2 text-[15px] text-[#bbb]">오늘 마감 일정이 없습니다</div>
            ) : (
              todayEvents.slice(0, 3).map((e) => (
                <div key={e.id} className="flex items-start gap-2 py-1.5">
                  <span
                    className="mt-1 h-[7px] w-[7px] flex-shrink-0 rounded-full"
                    style={{ background: AGENDA_DOT_COLOR[e.color] }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium leading-[1.4] text-[#222]">
                      {e.title}
                    </div>
                    <div className="mt-[1px] text-[15px] text-[#999]">
                      {e.org ? `${e.org} · ` : ""}마감 {formatProgramMonthDay(e.deadline) ?? "-"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected date events */}
          {effectiveSelectedDate !== todayStr ? (
            <div className="border-b border-[#f0f0f0] p-4">
              <div className="mb-2.5 text-[15px] font-semibold text-[#aaa]">
                선택 날짜 일정
              </div>
              {selectedEvents.length === 0 ? (
                <div className="py-2 text-[15px] text-[#bbb]">해당 날짜 일정 없음</div>
              ) : (
                selectedEvents.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-start gap-2 py-1.5">
                    <span
                      className="mt-1 h-[7px] w-[7px] flex-shrink-0 rounded-full"
                      style={{ background: AGENDA_DOT_COLOR[e.color] }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium leading-[1.4] text-[#222]">
                        {e.title}
                      </div>
                      <div className="mt-[1px] text-[15px] text-[#999]">
                        {e.org ? `${e.org} · ` : ""}마감 {formatProgramMonthDay(e.deadline) ?? "-"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {/* Today's achievements (dashboard counts) */}
          <div className="border-b border-[#f0f0f0] p-4">
            <div className="mb-2.5 text-[15px] font-semibold text-[#aaa]">
              오늘의 성과
            </div>
            {(
              [
                {
                  key: "profile",
                  label: "프로필",
                  href: "/dashboard/profile",
                  count: achievement.profile,
                  unit: "건",
                  palette: BOOKMARK_BADGE_PALETTE[0],
                  letter: "프",
                },
                {
                  key: "activities",
                  label: "성과",
                  href: "/dashboard/activities",
                  count: achievement.activities,
                  unit: "건",
                  palette: BOOKMARK_BADGE_PALETTE[1],
                  letter: "성",
                },
                {
                  key: "coverLetters",
                  label: "자기소개서",
                  href: "/dashboard/cover-letter",
                  count: achievement.coverLetters,
                  unit: "건",
                  palette: BOOKMARK_BADGE_PALETTE[2],
                  letter: "자",
                },
                {
                  key: "resumes",
                  label: "이력서",
                  href: "/dashboard/resume",
                  count: achievement.resumes,
                  unit: "건",
                  palette: BOOKMARK_BADGE_PALETTE[3],
                  letter: "이",
                },
                {
                  key: "portfolios",
                  label: "포트폴리오",
                  href: "/dashboard/portfolio",
                  count: achievement.portfolios,
                  unit: "건",
                  palette: BOOKMARK_BADGE_PALETTE[4],
                  letter: "포",
                },
              ] as const
            ).map((row) => (
              <Link
                key={row.key}
                href={row.href}
                className="flex items-center gap-2.5 border-b border-[#f5f5f5] py-[7px] last:border-b-0 hover:bg-[#fafbff]"
              >
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[12px] font-bold"
                  style={{ background: row.palette.bg, color: row.palette.color }}
                >
                  {row.letter}
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between">
                  <div className="truncate text-[12px] font-medium leading-[1.3] text-[#333]">
                    {row.label}
                  </div>
                  <div className="ml-2 flex-shrink-0 text-[12px] font-semibold text-[#4361ee]">
                    {row.count}
                    {row.unit}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>

        {/* RIGHT AREA */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Calendar area */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-6">
            {/* Toolbar */}
            <div className="relative flex flex-shrink-0 flex-nowrap items-center gap-1.5 py-2">
              <div className="flex flex-shrink-0 items-center gap-2">
                <div className="flex overflow-hidden rounded-md border border-[#dde0e8]">
                  {(["차트", "달력", "주간"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCalView(v)}
                      className={`border-r border-[#dde0e8] px-2.5 py-1 text-[15px] font-medium transition-colors last:border-r-0 ${
                        calView === v
                          ? "bg-[#16162a] text-white"
                          : "bg-white text-[#888]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {FILTER_ITEMS.map((f) => {
                    const on = filters[f.key];
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => toggleFilter(f.key)}
                        className="flex items-center gap-[3px]"
                        style={{ color: f.color }}
                      >
                        <span
                          className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[3px] border-[1.5px]`}
                          style={{
                            borderColor: f.color,
                            background: on ? f.color : "transparent",
                          }}
                        >
                          {on ? <span className="text-[15px] leading-none text-white">✓</span> : null}
                        </span>
                        <span className="whitespace-nowrap text-[15px] font-medium">
                          {f.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Centered month nav */}
              <div className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e0e0e0] bg-white text-[15px] text-[#555] transition-colors hover:border-[#4361ee] hover:text-[#4361ee]"
                >
                  ‹
                </button>
                <span className="min-w-[90px] whitespace-nowrap text-center text-[15px] font-extrabold text-[#16162a]">
                  {year}년 {MONTHS_KR[month]}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e0e0e0] bg-white text-[15px] text-[#555] transition-colors hover:border-[#4361ee] hover:text-[#4361ee]"
                >
                  ›
                </button>
              </div>

              {/* Right buttons */}
              <div className="ml-auto flex flex-shrink-0 flex-nowrap items-center gap-1.5">
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md border border-[#ddd] bg-transparent px-3 py-[5px] text-[15px] font-medium text-[#555] transition-colors hover:bg-[#f5f5f5]"
                >
                  새로고침
                </button>
                <Link
                  href="/programs"
                  className="whitespace-nowrap rounded-md bg-[#4361ee] px-3 py-[5px] text-[15px] font-medium text-white transition-colors hover:bg-[#3451d1]"
                >
                  + 새 일정
                </Link>
              </div>
            </div>

            {/* DOW header + grid */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col pb-2">
              <div className="grid flex-shrink-0 grid-cols-7 border border-[#e8eaed] border-b-0 bg-white">
                {DOW_KR.map((d, i) => (
                  <div
                    key={d}
                    className={`border-r border-[#e8eaed] px-2.5 py-2 text-left text-[12px] font-bold text-[#333] last:border-r-0 ${
                      i === 0 ? "" : i === 6 ? "" : ""
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div
                className="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden border border-[#e8eaed] bg-[#e8eaed]"
                style={{ gridTemplateRows: `repeat(${MAIN_CALENDAR_ROWS}, minmax(0, 1fr))` }}
              >
                {monthCells.map((cell, idx) => {
                  const colIdx = idx % 7;
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === effectiveSelectedDate;
                  let cellEvents = eventsByDate[cell.dateStr] ?? [];
                  cellEvents = cellEvents.filter((e) => filters[e.eventType]);
                  const shown = cellEvents.slice(0, 3);
                  const more = cellEvents.length - shown.length;
                  const dateTextClass = `text-[12px] font-medium flex-shrink-0 mb-1 ${
                    isToday
                      ? "text-[#4361ee] font-bold"
                      : !cell.cur
                        ? "text-[#bbb]"
                        : colIdx === 0
                          ? "text-[#e05c5c]"
                          : colIdx === 6
                            ? "text-[#4361ee]"
                            : "text-[#333]"
                  }`;
                  return (
                    <button
                      key={`${cell.dateStr}-${idx}`}
                      type="button"
                      onClick={() => handleSelectDate(cell.dateStr)}
                      className={`relative flex flex-col overflow-hidden px-1.5 py-1 text-left transition-colors ${
                        !cell.cur
                          ? "bg-[#fafafa]"
                          : isSelected && !isToday
                            ? "bg-[#f0f4ff]"
                            : "bg-white hover:bg-[#fafbff]"
                      } ${isToday ? "z-[1] outline outline-2 -outline-offset-2 outline-[#4361ee]" : ""}`}
                    >
                      <div className={dateTextClass}>{cell.day}</div>
                      <div className="flex min-h-0 flex-1 flex-col gap-[2px]">
                        {shown.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center gap-1 rounded-[3px] px-[2px] py-[1px] text-[10.5px] text-[#333] transition-colors hover:bg-[#f5f5f5]"
                            title={e.title}
                          >
                            <span
                              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                              style={{ background: PREFIX_BG[e.eventType] }}
                            >
                              {PREFIX_LABEL[e.eventType]}
                            </span>
                            <span className="flex-1 truncate text-[10.5px] text-[#333]">
                              {e.title}
                            </span>
                            <span
                              onClick={(ev) => {
                                ev.stopPropagation();
                                toggleStar(e.id);
                              }}
                              className={`flex-shrink-0 cursor-pointer text-[11px] transition-colors ${
                                e.isBookmarked || starred[e.id]
                                  ? "text-[#f4b942]"
                                  : "text-[#ccc] hover:text-[#f4b942]"
                              }`}
                              title={e.isBookmarked ? DASHBOARD_COPY.bookmarks.cardLabel : undefined}
                            >
                              {e.isBookmarked || starred[e.id] ? "★" : "☆"}
                            </span>
                          </div>
                        ))}
                        {more > 0 ? (
                          <div className="cursor-pointer px-[2px] py-[2px] text-[10.5px] font-medium text-[#888] hover:text-[#4361ee]">
                            + {more}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="max-h-[42vh] flex-shrink-0 overflow-y-auto border-t border-[#e8eaed] bg-white px-6 pb-4 pt-3.5">
            {/* 커리어 핏 과정 */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <div className="text-[15px] font-bold leading-[1.4] text-[#16162a]">
                  {DASHBOARD_COPY.programs.sectionTitle}
                </div>
              </div>
              <Link href="/programs" className="text-[15px] text-[#4361ee] hover:underline">
                {DASHBOARD_COPY.programs.manageLink}
              </Link>
            </div>
            <div className="mb-[18px] min-h-[154px]">
              <div className="grid grid-cols-5 gap-2.5 overflow-visible pb-2 pt-1.5">
                {recCardItems.length === 0 ? (
                  <div className="col-span-5 w-full py-6 text-center text-[15px] text-[#bbb]">
                    {DASHBOARD_COPY.programs.empty}
                  </div>
                ) : (
                  recCardItems.map((item, i) => (
                    <RecCard
                      key={`rec-${String(item.program.id ?? i)}`}
                      item={item}
                      index={i}
                      isWhite={false}
                      isSubscribed={appliedProgramIds.has(String(item.program.id ?? ""))}
                      onSubscribe={() => handleSubscribe(item.program)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 찜한 과정 */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <div className="text-[15px] font-bold leading-[1.4] text-[#16162a]">
                  {DASHBOARD_COPY.bookmarks.sectionTitle}
                </div>
              </div>
              <Link href="/compare" className="text-[15px] text-[#4361ee] hover:underline">
                {DASHBOARD_COPY.bookmarks.viewAllLink}
              </Link>
            </div>
            <div className="min-h-[154px]">
              <div className="grid grid-cols-5 gap-2.5 overflow-visible pb-2 pt-1.5">
                {bookmarksLoading && bookmarkedCardItems.length === 0 ? (
                  <div className="col-span-5 w-full py-6 text-center text-[15px] text-[#bbb]">
                    찜한 과정을 불러오는 중입니다
                  </div>
                ) : bookmarksError && bookmarkedCardItems.length === 0 ? (
                  <div className="col-span-5 w-full py-6 text-center text-[15px] text-[#bbb]">
                    {bookmarksError}
                  </div>
                ) : bookmarkedCardItems.length === 0 ? (
                  <div className="col-span-5 w-full py-6 text-center text-[15px] text-[#bbb]">
                    {DASHBOARD_COPY.bookmarks.empty}
                  </div>
                ) : (
                  bookmarkedCardItems.map((item, i) => (
                    <RecCard
                      key={`bm-card-${String(item.program.id ?? i)}`}
                      item={item}
                      index={i}
                      isWhite
                      isSubscribed
                      onSubscribe={() => handleSubscribe(item.program)}
                    />
                  ))
                )}
              </div>
            </div>

            {appliedCalendarPrograms.length > 0 ? (
              <p className="mt-3 text-[15px] text-[#999]">
                {DASHBOARD_COPY.programs.appliedNotice(appliedCalendarPrograms.length)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCalendar({
  year,
  month,
  today,
  selectedDate,
  eventDates,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number;
  today: string;
  selectedDate: string | null;
  eventDates: Set<string>;
  onSelectDate: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const firstDay = firstDayOfMonth(year, month);
  const days = daysInMonth(year, month);
  const prevDays = daysInMonth(year, month - 1);
  const cells: Array<{ day: number; cur: boolean }> = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push({ day: prevDays - firstDay + i + 1, cur: false });
  }
  for (let d = 1; d <= days; d += 1) {
    cells.push({ day: d, cur: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d += 1) {
    cells.push({ day: d, cur: false });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-[#16162a]">
          {year}년 {MONTHS_KR[month]}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            className="flex h-[22px] w-[22px] items-center justify-center rounded border-0 bg-[#f5f5f5] text-[11px] text-[#666] transition-colors hover:bg-[#e8eaed]"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="flex h-[22px] w-[22px] items-center justify-center rounded border-0 bg-[#f5f5f5] text-[11px] text-[#666] transition-colors hover:bg-[#e8eaed]"
          >
            ›
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOW_KR.map((d) => (
          <div key={d} className="py-[3px] text-center text-[9.5px] font-medium text-[#aaa]">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          const dateStr = cell.cur ? formatDateStr(year, month, cell.day) : null;
          const isToday = cell.cur && dateStr === today;
          const isSelected = cell.cur && dateStr === selectedDate;
          const hasEvent = Boolean(dateStr && eventDates.has(dateStr));
          return (
            <button
              key={i}
              type="button"
              disabled={!cell.cur}
              onClick={() => dateStr && onSelectDate(dateStr)}
              className={`relative flex aspect-square w-full items-center justify-center rounded-md p-0 text-[12px] transition-colors ${
                !cell.cur
                  ? "cursor-default text-[#ccc]"
                  : isToday
                    ? "bg-[#4361ee] font-semibold text-white hover:bg-[#3451d1]"
                    : isSelected
                      ? "bg-[#e8edff] font-semibold text-[#4361ee]"
                      : "text-[#333] hover:bg-[#f0f4ff]"
              }`}
            >
              {cell.day}
              {hasEvent ? (
                <span
                  className="absolute bottom-[2px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ background: isToday ? "rgba(255,255,255,0.7)" : "#4361ee" }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecCard({
  item,
  index,
  isWhite,
  isSubscribed,
  onSubscribe,
}: {
  item: ProgramCardItem;
  index: number;
  isWhite: boolean;
  isSubscribed: boolean;
  onSubscribe: () => void;
}) {
  const { program } = item;
  const bg = isWhite ? "" : CARD_BG_CLASS[CARD_BG_CYCLE[index % CARD_BG_CYCLE.length]];
  const categoryLabel = program.category ?? DASHBOARD_COPY.programs.fallbackCategory;

  return (
    <div
      className={`relative flex h-[132px] min-w-0 w-full flex-col rounded-[14px] border-0 p-[14px_15px_13px] transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isWhite ? "border-[1.5px] border-[#e0e0e0] bg-white hover:border-[#4361ee]" : bg
      }`}
    >
      <ProgramDeadlineBadge
        program={program}
        className="absolute right-3 top-3 px-2 py-0.5 text-[15px]"
      />
      <div className="mb-1.5 max-w-[calc(100%-72px)] overflow-hidden text-ellipsis whitespace-nowrap text-[15px] text-[#777]">
        {categoryLabel}
      </div>
      <div className="mb-2.5 line-clamp-2 pr-20 text-[15px] font-bold leading-[1.35] text-[#16162a]">
        {program.title ?? "제목 없음"}
      </div>
      <div className="mt-auto flex items-center justify-end">
        <button
          type="button"
          onClick={onSubscribe}
          className="flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-1 text-[15px] font-semibold transition-all"
          style={
            isSubscribed
              ? { borderColor: "#4361ee", color: "#4361ee", background: "#f0f4ff" }
              : { borderColor: "#ccc", color: "#333", background: "#fff" }
          }
        >
          {isSubscribed ? DASHBOARD_COPY.programs.appliedButton : DASHBOARD_COPY.programs.applyButton}
        </button>
      </div>
    </div>
  );
}
