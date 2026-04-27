"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ModalShell } from "@/app/dashboard/_components/modal-shell";
import { ProgramDeadlineBadge } from "@/components/programs/program-deadline-badge";
import { getProgramDetail } from "@/lib/api/backend";
import {
  getDashboardProfile,
  getDocuments,
  listActivities,
  listCoverLetters,
  listSavedPortfolios,
} from "@/lib/api/app";
import {
  formatProgramDateRangeLabel,
  formatProgramDeadlineDate,
  formatProgramMonthDay,
  formatProgramSourceLabel,
  getProgramId,
  getProgramPrimaryLink,
  toProgramDateKey,
} from "@/lib/program-display";
import type { ProgramCardItem, ProgramCardSummary, ProgramDetail } from "@/lib/types";

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
  blue: "bg-[linear-gradient(135deg,#ebf4ff_0%,#f8fbff_100%)]",
  teal: "bg-[linear-gradient(135deg,#eef8ff_0%,#fbfdff_100%)]",
  mint: "bg-[linear-gradient(135deg,#eff8ff_0%,#fcfdff_100%)]",
  lavender: "bg-[linear-gradient(135deg,#eef4ff_0%,#fafcff_100%)]",
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
  const [detailModalItem, setDetailModalItem] = useState<ProgramCardItem | null>(null);
  const [detailModalData, setDetailModalData] = useState<ProgramDetail | null>(null);
  const [detailModalLoading, setDetailModalLoading] = useState(false);
  const [detailModalError, setDetailModalError] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, ProgramDetail>>({});

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

  useEffect(() => {
    const programId = getProgramId(detailModalItem?.program);
    if (!programId) {
      setDetailModalData(null);
      setDetailModalLoading(false);
      setDetailModalError(null);
      return;
    }

    const cachedDetail = detailCache[programId];
    if (cachedDetail) {
      setDetailModalData(cachedDetail);
      setDetailModalLoading(false);
      setDetailModalError(null);
      return;
    }

    let active = true;
    setDetailModalData(null);
    setDetailModalLoading(true);
    setDetailModalError(null);

    void getProgramDetail(programId)
      .then((detail) => {
        if (!active) return;
        setDetailCache((current) => ({ ...current, [programId]: detail }));
        setDetailModalData(detail);
      })
      .catch((error) => {
        if (!active) return;
        setDetailModalError(
          error instanceof Error ? error.message : "과정 상세를 불러오지 못했습니다."
        );
      })
      .finally(() => {
        if (!active) return;
        setDetailModalLoading(false);
      });

    return () => {
      active = false;
    };
  }, [detailCache, detailModalItem]);

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

  const openProgramPreview = (item: ProgramCardItem) => {
    setDetailModalItem(item);
  };

  const closeProgramPreview = () => {
    setDetailModalItem(null);
    setDetailModalData(null);
    setDetailModalLoading(false);
    setDetailModalError(null);
  };

  const monthCells = useMemo(
    () => buildMonthCells(year, month, MAIN_CALENDAR_ROWS),
    [year, month]
  );

  // 커리어 핏 과정/찜한 과정은 하단 5컬럼 grid에 맞춰 최대 5개만 보여준다.
  const recCardItems = programs.slice(0, 5);
  const bookmarkedCardItems = bookmarkedPrograms.slice(0, 5);

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col overflow-hidden bg-[linear-gradient(135deg,#edf5ff_0%,#f3f9ff_48%,#fbfdff_100%)] font-sans">
      {/* Body: left panel + right area */}
      <div className="mx-4 mb-0 mt-3 flex flex-1 min-h-0 min-w-0 overflow-hidden rounded-[32px] border border-white/80 bg-white/82 shadow-[0_28px_72px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        {/* LEFT PANEL */}
        <aside className="flex w-[320px] min-w-[320px] flex-shrink-0 flex-col overflow-y-auto border-r border-white/70 bg-[linear-gradient(180deg,#e7f2ff_0%,#f1f7ff_42%,#fbfdff_100%)]">
          {/* Greeting summary */}
          <div className="border-b border-white/60 px-4 pb-3 pt-6">
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
          <div className="border-b border-white/60 p-4">
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
          <div className="border-b border-white/60 p-4">
            <div className="mb-2.5 text-[15px] font-semibold text-[#aaa]">
              오늘 마감 일정
            </div>
            {todayEvents.length === 0 ? (
              <div className="py-2 text-[15px] text-[#bbb]">오늘 마감 일정이 없습니다</div>
            ) : (
              todayEvents.map((e) => (
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
            <div className="border-b border-white/60 p-4">
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
          <div className="border-b border-white/60 p-4">
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
                className="flex items-center gap-2.5 rounded-xl border-b border-white/50 py-[7px] last:border-b-0 hover:bg-white/45"
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.60)_0%,rgba(255,255,255,0.96)_100%)]">
          {/* Calendar area */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-5">
            {/* Toolbar */}
            <div className="relative flex flex-shrink-0 flex-nowrap items-center gap-1.5 rounded-[22px] border border-white/80 bg-white/76 px-4 py-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <div className="flex flex-shrink-0 items-center gap-2">
                <div className="flex overflow-hidden rounded-2xl border border-[#e6eefb] bg-white/88">
                  {(["차트", "달력", "주간"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCalView(v)}
                      className={`border-r border-[#dde0e8] px-2.5 py-1 text-[15px] font-medium transition-colors last:border-r-0 ${
                        calView === v
                          ? "bg-[#1d4ed8] text-white"
                          : "bg-transparent text-[#6b7280]"
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
                  className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#e6eefb] bg-white/94 text-[15px] text-[#555] transition-colors hover:border-[#4361ee] hover:text-[#4361ee]"
                >
                  ‹
                </button>
                <span className="min-w-[90px] whitespace-nowrap text-center text-[15px] font-extrabold text-[#16162a]">
                  {year}년 {MONTHS_KR[month]}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#e6eefb] bg-white/94 text-[15px] text-[#555] transition-colors hover:border-[#4361ee] hover:text-[#4361ee]"
                >
                  ›
                </button>
              </div>

              {/* Right buttons */}
              <div className="ml-auto flex flex-shrink-0 flex-nowrap items-center gap-1.5">
                <button
                  type="button"
                  className="whitespace-nowrap rounded-2xl border border-[#e6eefb] bg-white/92 px-3 py-[5px] text-[15px] font-medium text-[#555] transition-colors hover:bg-blue-50"
                >
                  새로고침
                </button>
                <Link
                  href="/programs"
                  className="whitespace-nowrap rounded-2xl bg-[#1d4ed8] px-3 py-[5px] text-[15px] font-medium text-white transition-colors hover:bg-[#1e40af]"
                >
                  + 새 일정
                </Link>
              </div>
            </div>

            {/* DOW header + grid */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col pb-2">
              <div className="grid flex-shrink-0 grid-cols-7 rounded-t-[24px] border border-[#e7eef9] border-b-0 bg-white/92 backdrop-blur-sm">
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
                className="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden rounded-b-[24px] border border-[#e7eef9] bg-[#e7eef9] shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
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
                          ? "bg-[#f8fbff]"
                          : isSelected && !isToday
                            ? "bg-[#eaf2ff]"
                            : "bg-white/92 hover:bg-[#f8fbff]"
                      } ${isToday ? "z-[1] outline outline-2 -outline-offset-2 outline-[#2563eb]" : ""}`}
                    >
                      <div className={dateTextClass}>{cell.day}</div>
                      {more > 0 ? (
                        <div className="absolute right-1 top-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-[#4361ee] shadow-sm">
                          +{more}
                        </div>
                      ) : null}
                      <div className="flex min-h-0 flex-1 flex-col gap-[2px]">
                        {shown.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center gap-1 rounded-[6px] px-[4px] py-[1px] text-[10px] text-[#333] transition-colors hover:bg-[#eef4ff]"
                            title={e.title}
                          >
                            <span
                              className="flex h-[13px] w-[13px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                              style={{ background: PREFIX_BG[e.eventType] }}
                            >
                              {PREFIX_LABEL[e.eventType]}
                            </span>
                            <span className="flex-1 truncate text-[10px] text-[#333]">
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
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="max-h-[35vh] flex-shrink-0 overflow-y-auto border-t border-white/70 bg-white/74 px-6 pb-4 pt-3.5 backdrop-blur-sm">
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
                      onOpenDetail={() => openProgramPreview(item)}
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
                      onOpenDetail={() => openProgramPreview(item)}
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

      <ProgramPreviewModal
        open={detailModalItem !== null}
        item={detailModalItem}
        detail={detailModalData}
        loading={detailModalLoading}
        error={detailModalError}
        onClose={closeProgramPreview}
      />
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
            className="flex h-[22px] w-[22px] items-center justify-center rounded-lg border border-white/70 bg-white/75 text-[11px] text-[#666] transition-colors hover:bg-blue-50"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-lg border border-white/70 bg-white/75 text-[11px] text-[#666] transition-colors hover:bg-blue-50"
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
                      ? "bg-[#2563eb] font-semibold text-white hover:bg-[#1d4ed8]"
                      : isSelected
                        ? "bg-[#eaf2ff] font-semibold text-[#2563eb]"
                      : "text-[#333] hover:bg-white/60"
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
  onOpenDetail,
}: {
  item: ProgramCardItem;
  index: number;
  isWhite: boolean;
  isSubscribed: boolean;
  onSubscribe: () => void;
  onOpenDetail: () => void;
}) {
  const { program } = item;
  const bg = isWhite ? "" : CARD_BG_CLASS[CARD_BG_CYCLE[index % CARD_BG_CYCLE.length]];
  const categoryLabel = program.category ?? DASHBOARD_COPY.programs.fallbackCategory;
  const canOpenDetail = Boolean(getProgramId(program));

  return (
    <div
      className={`relative flex h-[140px] min-w-0 w-full flex-col rounded-[18px] border p-[14px_15px_13px] shadow-[0_18px_35px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(15,23,42,0.12)] ${
        isWhite
          ? "border-white/75 bg-white/88 backdrop-blur-sm hover:border-[#93c5fd]"
          : `border-white/70 ${bg}`
      }`}
    >
      <ProgramDeadlineBadge
        program={program}
        className="absolute right-3 top-3 px-2 py-0.5 text-[15px]"
      />
      <div className="mb-1.5 max-w-[calc(100%-72px)] overflow-hidden text-ellipsis whitespace-nowrap text-[15px] text-[#777]">
        {categoryLabel}
      </div>
      <div className="mb-2.5 line-clamp-2 pr-20 pb-0.5 text-[15px] font-bold leading-[1.45] text-[#16162a]">
        {program.title ?? "제목 없음"}
      </div>
      <div className="mt-auto flex items-center justify-end gap-2">
        {canOpenDetail ? (
          <button
            type="button"
            onClick={onOpenDetail}
            className="flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] border-[#d8e6ff] bg-white/90 px-2.5 py-1 text-[15px] font-semibold text-[#4a5568] transition-all hover:border-[#4361ee] hover:text-[#3451d1]"
          >
            미리보기
          </button>
        ) : null}
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

function ProgramPreviewModal({
  open,
  item,
  detail,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  item: ProgramCardItem | null;
  detail: ProgramDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const program = item?.program ?? null;
  const programId = getProgramId(program);
  const detailHref = programId ? `/programs/${encodeURIComponent(programId)}` : null;
  const externalLink = getProgramPrimaryLink(detail ?? program);
  const providerLabel =
    detail?.provider ||
    program?.provider ||
    formatProgramSourceLabel(detail?.source ?? program?.source);
  const categoryLabel =
    detail?.display_categories?.filter(Boolean).join(" · ") ||
    detail?.category ||
    program?.category ||
    DASHBOARD_COPY.programs.fallbackCategory;
  const deadlineLabel = formatProgramDeadlineDate(detail?.deadline ?? program?.deadline);
  const scheduleLabel =
    formatProgramDateRangeLabel(detail?.program_start_date, detail?.program_end_date, {
      unknownLabel: null,
    }) ??
    formatProgramDateRangeLabel(detail?.application_start_date, detail?.application_end_date, {
      unknownLabel: "일정 확인 필요",
    }) ??
    "일정 확인 필요";
  const description =
    detail?.description?.trim() ||
    program?.summary?.trim() ||
    program?.description?.trim() ||
    "간단 미리보기를 아직 준비하지 못했습니다.";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="과정 미리보기"
      title={detail?.title ?? program?.title ?? "과정 정보"}
      subtitle={providerLabel}
      maxWidthClassName="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {detailHref ? (
              <Link
                href={detailHref}
                className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                상세 페이지 보기
              </Link>
            ) : null}
            {externalLink ? (
              <a
                href={externalLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full bg-[#4361ee] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3451d1]"
              >
                신청 링크 열기
              </a>
            ) : null}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">과정 상세를 불러오는 중입니다.</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {categoryLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              마감 {deadlineLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              일정 {scheduleLabel}
            </span>
            {detail?.teaching_method ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {detail.teaching_method}
              </span>
            ) : null}
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{description}</p>
          </div>

          {detail?.recommended_for?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">이런 분께 맞아요</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.recommended_for.slice(0, 6).map((value) => (
                  <span
                    key={value}
                    className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ModalShell>
  );
}
