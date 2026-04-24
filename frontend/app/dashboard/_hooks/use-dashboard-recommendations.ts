"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getCalendarSelections,
  getDashboardBookmarks,
  getDashboardMe,
  getRecommendCalendar,
  saveCalendarSelections,
} from "@/lib/api/app";
import { toProgramDateKey } from "@/lib/program-display";
import { isProgramCardItem, toProgramCardItem } from "@/lib/program-card-items";
import type { Program, ProgramCardItem, ProgramCardSummary } from "@/lib/types";

const APPLIED_CALENDAR_PROGRAMS_KEY = "isoser:applied-calendar-programs";
const RECOMMEND_CALENDAR_CACHE_KEY = "isoser:recommend-calendar-programs";
const RECOMMEND_CALENDAR_CACHE_TTL_MS = 1000 * 60 * 15;

type RecommendCalendarCache = {
  savedAt: number;
  items?: ProgramCardItem[];
  programs?: Program[];
};

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

function readRecommendCalendarCache(): ProgramCardItem[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(RECOMMEND_CALENDAR_CACHE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<RecommendCalendarCache>;
    if (
      typeof parsed.savedAt !== "number" ||
      (!Array.isArray(parsed.items) && !Array.isArray(parsed.programs)) ||
      Date.now() - parsed.savedAt > RECOMMEND_CALENDAR_CACHE_TTL_MS
    ) {
      window.localStorage.removeItem(RECOMMEND_CALENDAR_CACHE_KEY);
      return [];
    }

    if (Array.isArray(parsed.items)) {
      return parsed.items.filter(isProgramCardItem);
    }

    if (Array.isArray(parsed.programs)) {
      return parsed.programs
        .filter((program): program is Program => Boolean(program && program.id))
        .map((program) => toProgramCardItem(program));
    }

    return [];
  } catch {
    window.localStorage.removeItem(RECOMMEND_CALENDAR_CACHE_KEY);
    return [];
  }
}

function writeRecommendCalendarCache(items: ProgramCardItem[]) {
  if (typeof window === "undefined" || items.length === 0) return;

  const cache: RecommendCalendarCache = {
    savedAt: Date.now(),
    items,
  };
  window.localStorage.setItem(RECOMMEND_CALENDAR_CACHE_KEY, JSON.stringify(cache));
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
      const cachedPrograms = canUseCache ? readRecommendCalendarCache() : [];

      if (cachedPrograms.length > 0) {
        setPrograms(cachedPrograms);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await getRecommendCalendar({
          category: options?.category ?? undefined,
          region: options?.region ?? undefined,
        });
        setPrograms(result.items);
        if (canUseCache) {
          writeRecommendCalendarCache(result.items);
        }
      } catch (fetchError) {
        if (cachedPrograms.length === 0) {
          setPrograms([]);
          setError(fetchError instanceof Error ? fetchError.message : "추천 프로그램을 불러오지 못했습니다.");
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
      setBookmarksLoading(true);
      setBookmarksError(null);
      try {
        const result = await getDashboardBookmarks();
        if (!mounted) return;
        setBookmarkedPrograms(result.items);
      } catch (fetchError) {
        if (!mounted) return;
        setBookmarkedPrograms([]);
        setBookmarksError(fetchError instanceof Error ? fetchError.message : "찜한 훈련을 불러오지 못했습니다.");
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
      ? "해당 날짜에 마감되는 프로그램이 없습니다"
      : isFiltered
        ? "해당 조건에 맞는 추천 프로그램이 없습니다"
        : "추천 프로그램이 없습니다";

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
