"use client";

import { useEffect, useState } from "react";

import { getRecommendedCalendar } from "@/lib/api/app";
import { getProgramCardScore } from "@/lib/program-card-items";
import type { ProgramCardItem } from "@/lib/types";

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_VISIBLE_ITEMS = 8;

export type DashboardCalendarStatus = "loading" | "ready" | "empty" | "hidden";

function resolveDeadlineTime(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function resolveItemScore(item: ProgramCardItem): number {
  return getProgramCardScore(item) ?? 0;
}

function sortCalendarItems(items: ProgramCardItem[]): ProgramCardItem[] {
  return [...items].sort((left, right) => {
    const rightScore = resolveItemScore(right);
    const leftScore = resolveItemScore(left);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return resolveDeadlineTime(left.program.deadline) - resolveDeadlineTime(right.program.deadline);
  });
}

export function useDashboardCalendar() {
  const [items, setItems] = useState<ProgramCardItem[]>([]);
  const [status, setStatus] = useState<DashboardCalendarStatus>("loading");

  useEffect(() => {
    let active = true;
    let timedOut = false;

    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      timedOut = true;
      setItems([]);
      setStatus("empty");
    }, REQUEST_TIMEOUT_MS);

    const load = async () => {
      try {
        const response = await getRecommendedCalendar();
        if (!active || timedOut) return;

        const nextItems = sortCalendarItems(response.items).slice(0, MAX_VISIBLE_ITEMS);
        setItems(nextItems);
        setStatus(nextItems.length > 0 ? "ready" : "empty");
      } catch {
        if (!active || timedOut) return;
        setItems([]);
        setStatus("hidden");
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void load();

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return {
    items,
    status,
  };
}
