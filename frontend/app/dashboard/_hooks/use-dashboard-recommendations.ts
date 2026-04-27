"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getCalendarSelections,
  getDashboardBookmarks,
  getDashboardMe,
  getRecommendedPrograms,
  saveCalendarSelections,
} from "@/lib/api/app";
import { isProgramCardOpen } from "@/lib/program-card-items";
import { toProgramDateKey } from "@/lib/program-display";
import type { ProgramCardItem, ProgramCardSummary } from "@/lib/types";
import {
  readRecommendCalendarCache,
  writeRecommendCalendarCache,
} from "./recommend-calendar-cache";
import { DASHBOARD_COPY } from "../dashboard-copy";

const APPLIED_CALENDAR_PROGRAMS_KEY = "isoser:applied-calendar-programs";
const BOOKMARKED_PROGRAMS_CACHE_KEY = "isoser:dashboard-bookmarked-programs:v1";
const BOOKMARKED_PROGRAMS_CACHE_TTL_MS = 1000 * 60 * 10;

export const DASHBOARD_CATEGORY_OPTIONS = [
  { label: "전체", value: null },
  { label: "IT·컴퓨터", value: "IT" },
  { label: "디자인", value: "디자인" },
  { label: "경영·마케팅", value: "경영" },
  { label: "어학", value: "어학" },
] as const;

export const DASHBOARD_REGION_OPTIONS = [
  { label: "전체", value: null },
  { label: "서울", value: "서울" },
  { label: "경기", value: "경기" },
  { label: "온라인", value: "온라인" },
] as const;

function formatUserName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || "사용자";
}

function isUsableCareerFitCache(items: ProgramCardItem[]): boolean {
  return items.some(isProgramCardOpen);
}

function readBookmarkedProgramsCache(now = Date.now()): ProgramCardItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(BOOKMARKED_PROGRAMS_CACHE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown; items?: unknown };
    if (
      typeof parsed.savedAt !== "number" ||
      now - parsed.savedAt > BOOKMARKED_PROGRAMS_CACHE_TTL_MS ||
      !Array.isArray(parsed.items)
    ) {
      window.localStorage.removeItem(BOOKMARKED_PROGRAMS_CACHE_KEY);
      return [];
    }

    return parsed.items.filter(
      (item): item is ProgramCardItem =>
        Boolean(item && typeof item === "object" && (item as ProgramCardItem).program?.id)
    );
  } catch {
    window.localStorage.removeItem(BOOKMARKED_PROGRAMS_CACHE_KEY);
    return [];
  }
}

function writeBookmarkedProgramsCache(items: ProgramCardItem[]) {
  if (typeof window === "undefined" || items.length === 0) {
    return;
  }

  window.localStorage.setItem(
    BOOKMARKED_PROGRAMS_CACHE_KEY,
    JSON.stringify({ savedAt: Date.now(), items })
  );
}

export function useDashboardRecommendations() {
  const [userName, setUserName] = useState("사용자");
  const [programs, setPrograms] = useState<ProgramCardItem[]>([]);
  const [bookmarkedPrograms, setBookmarkedPrograms] = useState<ProgramCardItem[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(true);
  const [bookmarksError, setBookmarksError] = useState<string | null>(null);
  const [appliedCalendarPrograms, setAppliedCalendarPrograms] = useState<ProgramCardSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarSaveStatus, setCalendarSaveStatus] = useState<string | null>(null);

  const filteredPrograms = useMemo(() => {
    if (!selectedDate) {
      return programs;
    }

    return programs.filter((item) => {
      const dateKey = toProgramDateKey(item.program.deadline);
      return dateKey === selectedDate;
    });
  }, [programs, selectedDate]);

  const calendarPrograms =
    appliedCalendarPrograms.length > 0 ? appliedCalendarPrograms : programs.map((item) => item.program);
  const appliedProgramIds = useMemo(
    () => new Set(appliedCalendarPrograms.map((program) => String(program.id ?? ""))),
    [appliedCalendarPrograms]
  );

  const handleApplyToCalendar = (program: ProgramCardSummary) => {
    const programId = String(program.id ?? "");
    if (!programId) return;

    setAppliedCalendarPrograms((current) => {
      const next = [
        program,
        ...current.filter((item) => String(item.id ?? "") !== programId),
      ].slice(0, 3);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(APPLIED_CALENDAR_PROGRAMS_KEY, JSON.stringify(next));
      }

      void saveCalendarSelections(next.map((item) => String(item.id ?? "")).filter(Boolean))
        .then(() => setCalendarSaveStatus("서버에 저장되었습니다."))
        .catch(() => setCalendarSaveStatus("서버 저장에 실패해 이 브라우저에만 유지됩니다."));

      return next;
    });
  };

  const clearAppliedCalendarPrograms = () => {
    setAppliedCalendarPrograms([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(APPLIED_CALENDAR_PROGRAMS_KEY);
    }
    void saveCalendarSelections([])
      .then(() => setCalendarSaveStatus("적용 일정이 초기화되었습니다."))
      .catch(() => setCalendarSaveStatus("서버 초기화에 실패했습니다."));
  };

  const loadPrograms = useCallback(
    async (options?: { category?: string | null; region?: string | null }) => {
      const canUseCache = !options?.category && !options?.region;
      const cachedPrograms =
        canUseCache && typeof window !== "undefined"
          ? readRecommendCalendarCache(window.localStorage)
          : [];
      const openCachedPrograms = cachedPrograms.filter(isProgramCardOpen);
      const usableCachedPrograms =
        openCachedPrograms.length > 0 && isUsableCareerFitCache(openCachedPrograms)
          ? openCachedPrograms
          : [];

      if (usableCachedPrograms.length > 0) {
        setPrograms(usableCachedPrograms);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await getRecommendedPrograms({
          category: options?.category ?? undefined,
          region: options?.region ?? undefined,
        });
        const sortedItems = result.items.filter(isProgramCardOpen);
        if (sortedItems.length > 0) {
          setPrograms(sortedItems);
        } else if (usableCachedPrograms.length === 0) {
          setPrograms([]);
        }
        if (sortedItems.length > 0 && canUseCache && typeof window !== "undefined") {
          writeRecommendCalendarCache(window.localStorage, sortedItems);
        }
      } catch {
        if (usableCachedPrograms.length === 0) {
          setPrograms([]);
          setError(DASHBOARD_COPY.programs.loadError);
        } else {
          setError(null);
        }
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
    let mounted = true;

    const loadBookmarks = async () => {
      const cachedBookmarks = readBookmarkedProgramsCache();
      if (cachedBookmarks.length > 0) {
        setBookmarkedPrograms(cachedBookmarks);
        setBookmarksLoading(false);
      } else {
        setBookmarksLoading(true);
      }
      setBookmarksError(null);
      try {
        const result = await getDashboardBookmarks();
        if (!mounted) return;
        setBookmarkedPrograms(result.items);
        writeBookmarkedProgramsCache(result.items);
      } catch {
        if (!mounted) return;
        if (cachedBookmarks.length === 0) {
          setBookmarkedPrograms([]);
        }
        setBookmarksError(DASHBOARD_COPY.bookmarks.loadError);
      } finally {
        if (mounted) {
          setBookmarksLoading(false);
        }
      }
    };

    void loadBookmarks();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(APPLIED_CALENDAR_PROGRAMS_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as ProgramCardSummary[];
      if (Array.isArray(parsed)) {
        setAppliedCalendarPrograms(parsed.filter((program) => program && program.id).slice(0, 3));
      }
    } catch {
      window.localStorage.removeItem(APPLIED_CALENDAR_PROGRAMS_KEY);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSelections = async () => {
      try {
        const result = await getCalendarSelections();
        if (!mounted || result.items.length === 0) return;
        const nextPrograms = result.items
          .slice(0, 3)
          .map((item) => item.program)
          .filter((program): program is ProgramCardSummary => Boolean(program && program.id));
        setAppliedCalendarPrograms(nextPrograms);
        window.localStorage.setItem(
          APPLIED_CALENDAR_PROGRAMS_KEY,
          JSON.stringify(nextPrograms)
        );
      } catch {
        if (mounted) {
          setCalendarSaveStatus("서버 저장 일정을 불러오지 못해 이 브라우저의 선택 상태를 사용합니다.");
        }
      }
    };

    void loadSelections();

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
      ? DASHBOARD_COPY.programs.dateEmpty
      : isFiltered
        ? DASHBOARD_COPY.programs.filteredEmpty
        : DASHBOARD_COPY.programs.empty;

  return {
    userName,
    programs,
    bookmarkedPrograms,
    bookmarksLoading,
    bookmarksError,
    appliedCalendarPrograms,
    selectedDate,
    setSelectedDate,
    selectedCategory,
    setSelectedCategory,
    selectedRegion,
    setSelectedRegion,
    loading,
    error,
    calendarSaveStatus,
    filteredPrograms,
    calendarPrograms,
    appliedProgramIds,
    handleApplyToCalendar,
    clearAppliedCalendarPrograms,
    emptyMessage,
  };
}
