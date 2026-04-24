import type {
  CalendarRecommendItem,
  ProgramCardItem,
  ProgramCardRenderable,
  ProgramCardSummary,
  ProgramRecommendItem,
  ProgramSurfaceContext,
} from "@/lib/types";

function trimNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function toProgramCardSummary(
  program: ProgramCardRenderable,
  overrides: Partial<ProgramCardSummary> = {}
): ProgramCardSummary {
  return {
    ...(program as ProgramCardSummary),
    ...overrides,
  };
}

export function toProgramCardItem(
  program: ProgramCardRenderable,
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
  return (
    item.context?.relevance_score ??
    item.context?.score ??
    item.program.relevance_score ??
    item.program.final_score ??
    item.program.recommended_score ??
    null
  );
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
  program: ProgramCardRenderable,
  reason: string
): ProgramSurfaceContext {
  const urgencyScore = Number(program.urgency_score ?? 0);
  return {
    surface: "dashboard_recommend_calendar_fallback",
    reason,
    fit_keywords: [],
    score: urgencyScore,
    relevance_score: 0,
    urgency_score: urgencyScore,
    relevance_reasons: [],
    score_breakdown: {},
    relevance_grade: "none",
    relevance_badge: null,
  };
}

export function toFallbackCalendarProgramCardItem(
  program: ProgramCardRenderable,
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
  program: ProgramCardRenderable,
  bookmarkedAt: string | null
): ProgramCardItem {
  return toProgramCardItem(program, {
    surface: "dashboard_bookmark",
    bookmarked_at: bookmarkedAt,
  });
}

export function toSelectionProgramCardItem(
  program: ProgramCardRenderable,
  selectedAt: string | null
): ProgramCardItem {
  return toProgramCardItem(program, {
    surface: "dashboard_calendar_selection",
    selected_at: selectedAt,
  });
}
