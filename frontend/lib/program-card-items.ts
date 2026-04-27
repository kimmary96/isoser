import type {
  CalendarRecommendItem,
  ProgramCardItem,
  ProgramCardSummary,
  ProgramRecommendItem,
  ProgramSurfaceContext,
} from "@/lib/types";

function trimNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function toProgramCardSummary(
  program: ProgramCardSummary,
  overrides: Partial<ProgramCardSummary> = {}
): ProgramCardSummary {
  return {
    ...program,
    ...overrides,
  };
}

export function toProgramCardItem(
  program: ProgramCardSummary,
  context: ProgramSurfaceContext | null = null,
  overrides: Partial<ProgramCardSummary> = {}
): ProgramCardItem {
  return {
    program: toProgramCardSummary(program, overrides),
    context,
  };
}

export function isProgramCardItem(value: unknown): value is ProgramCardItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { program?: { id?: unknown } | null };
  return Boolean(candidate.program && candidate.program.id);
}

export function getProgramCardScore(item: ProgramCardItem): number | null {
  const candidates = [
    item.context?.relevance_score,
    item.context?.score,
    item.program.relevance_score,
    item.program.final_score,
    item.program.recommended_score,
  ].filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  return candidates.find((score) => score > 0) ?? candidates[0] ?? null;
}

export function isProgramCardOpen(item: ProgramCardItem): boolean {
  const { program } = item;

  if (typeof program.days_left === "number" && Number.isFinite(program.days_left)) {
    return program.days_left >= 0;
  }

  const deadlineText = program.deadline?.trim();
  if (deadlineText) {
    const parsed = new Date(deadlineText);
    if (!Number.isNaN(parsed.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      parsed.setHours(0, 0, 0, 0);
      return parsed.getTime() >= today.getTime();
    }
  }

  return program.is_open !== false && program.is_active !== false;
}

export function getProgramCardReason(item: ProgramCardItem): string | null {
  return trimNullableText(item.context?.reason);
}

export function getProgramCardRelevanceReasons(item: ProgramCardItem): string[] {
  const reasons =
    Array.isArray(item.context?.relevance_reasons) && item.context.relevance_reasons.length > 0
      ? item.context.relevance_reasons
      : Array.isArray(item.program.recommendation_reasons) && item.program.recommendation_reasons.length > 0
        ? item.program.recommendation_reasons
        : [];
  const fallback = getProgramCardReason(item);
  return (reasons.length > 0 ? reasons : fallback ? [fallback] : []).slice(0, 3);
}

export function getProgramCardFitKeywords(item: ProgramCardItem): string[] {
  const value = item.context?.fit_keywords;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((keyword) => keyword.trim()).filter(Boolean).slice(0, 3);
}

export function getProgramCardRelevanceBadge(item: ProgramCardItem): string | null {
  return trimNullableText(item.context?.relevance_badge);
}

export function toRecommendationSurfaceContext(item: ProgramRecommendItem): ProgramSurfaceContext {
  return {
    surface: "dashboard_recommendation",
    reason: item.reason ?? null,
    fit_keywords: item.fit_keywords ?? [],
    score: item.score ?? item.program.final_score ?? null,
    relevance_score: item.relevance_score ?? item.program.relevance_score ?? null,
    relevance_reasons: item.relevance_reasons ?? [],
    score_breakdown: item.score_breakdown ?? {},
    relevance_grade: item.relevance_grade ?? "none",
    relevance_badge: item.relevance_badge ?? null,
  };
}

export function toRecommendationProgramCardItem(item: ProgramRecommendItem): ProgramCardItem | null {
  if (!item.program) {
    return null;
  }

  return toProgramCardItem(item.program, toRecommendationSurfaceContext(item), {
    relevance_score: item.relevance_score ?? item.program.relevance_score ?? null,
    final_score: item.score ?? item.program.final_score ?? null,
    recommended_score: item.score ?? item.program.recommended_score ?? null,
  });
}

export function toCalendarSurfaceContext(item: CalendarRecommendItem): ProgramSurfaceContext {
  return {
    surface: "dashboard_recommend_calendar",
    reason: item.reason ?? null,
    fit_keywords: item.fit_keywords ?? [],
    score: item.final_score ?? item.program.final_score ?? null,
    relevance_score: item.relevance_score ?? item.program.relevance_score ?? null,
    urgency_score: item.urgency_score ?? item.program.urgency_score ?? null,
    relevance_reasons: item.relevance_reasons ?? [],
    score_breakdown: item.score_breakdown ?? {},
    relevance_grade: item.relevance_grade ?? "none",
    relevance_badge: item.relevance_badge ?? null,
  };
}

export function toCalendarProgramCardItem(item: CalendarRecommendItem): ProgramCardItem | null {
  if (!item.program?.id) {
    return null;
  }

  return toProgramCardItem(item.program, toCalendarSurfaceContext(item), {
    deadline: item.deadline ?? item.program.deadline ?? null,
    relevance_score: item.relevance_score ?? item.program.relevance_score ?? null,
    final_score: item.final_score ?? item.program.final_score ?? null,
    urgency_score: item.urgency_score ?? item.program.urgency_score ?? null,
  });
}

export function toFallbackCalendarSurfaceContext(
  program: ProgramCardSummary,
  reason: string
): ProgramSurfaceContext {
  const positiveScore = [
    program.relevance_score,
    program.final_score,
    program.recommended_score,
    program.urgency_score,
  ].find((score) => typeof score === "number" && Number.isFinite(score) && score > 0);
  const daysLeft =
    typeof program.days_left === "number" && Number.isFinite(program.days_left)
      ? program.days_left
      : null;
  const fallbackScore =
    positiveScore ??
    (daysLeft !== null ? Math.max(25, Math.min(70, 70 - daysLeft)) : 35);
  return {
    surface: "dashboard_recommend_calendar_fallback",
    reason,
    fit_keywords: [],
    score: fallbackScore,
    relevance_score: null,
    urgency_score: program.urgency_score ?? fallbackScore,
    relevance_reasons: [],
    score_breakdown: {},
    relevance_grade: "none",
    relevance_badge: null,
  };
}

export function toFallbackCalendarProgramCardItem(
  program: ProgramCardSummary,
  reason: string
): ProgramCardItem | null {
  if (!program.id) {
    return null;
  }

  const context = toFallbackCalendarSurfaceContext(program, reason);
  return toProgramCardItem(program, context, {
    relevance_score: context.relevance_score ?? program.relevance_score ?? null,
    final_score: context.score ?? program.final_score ?? null,
    urgency_score: context.urgency_score ?? program.urgency_score ?? null,
  });
}

export function toBookmarkProgramCardItem(
  program: ProgramCardSummary,
  bookmarkedAt: string | null
): ProgramCardItem {
  return toProgramCardItem(program, {
    surface: "dashboard_bookmark",
    bookmarked_at: bookmarkedAt,
  });
}

export function toSelectionProgramCardItem(
  program: ProgramCardSummary,
  selectedAt: string | null
): ProgramCardItem {
  return toProgramCardItem(program, {
    surface: "dashboard_calendar_selection",
    selected_at: selectedAt,
  });
}
