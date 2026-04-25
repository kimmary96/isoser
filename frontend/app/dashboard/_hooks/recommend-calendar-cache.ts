import { isProgramCardItem, toProgramCardItem } from "../../../lib/program-card-items";
import type { ProgramCardItem, ProgramCardSummary } from "../../../lib/types";

export const RECOMMEND_CALENDAR_CACHE_KEY = "isoser:recommend-calendar-programs";
export const RECOMMEND_CALENDAR_CACHE_TTL_MS = 1000 * 60 * 15;

type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type RecommendCalendarCache = {
  savedAt: number;
  items?: ProgramCardItem[];
};

type LegacyRecommendCalendarCache = {
  savedAt: number;
  programs?: unknown[];
};

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function asStringArray(value: unknown): string[] | string | null {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => cleanText(item))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items : null;
  }

  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeLegacyCachedProgram(value: unknown): ProgramCardSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawId = record.id;
  const id =
    typeof rawId === "string" && rawId.trim()
      ? rawId.trim()
      : typeof rawId === "number"
        ? rawId
        : null;

  if (id === null) {
    return null;
  }

  return {
    id,
    title: cleanText(record.title),
    category: cleanText(record.category),
    category_detail: cleanText(record.category_detail),
    location: cleanText(record.location),
    provider: cleanText(record.provider),
    source: cleanText(record.source),
    source_url: cleanText(record.source_url),
    link: cleanText(record.link),
    deadline: cleanText(record.deadline),
    start_date: cleanText(record.start_date),
    end_date: cleanText(record.end_date),
    cost:
      typeof record.cost === "number" || typeof record.cost === "string"
        ? (record.cost as number | string)
        : null,
    support_amount:
      typeof record.support_amount === "number" || typeof record.support_amount === "string"
        ? (record.support_amount as number | string)
        : typeof record.subsidy_amount === "number" || typeof record.subsidy_amount === "string"
          ? (record.subsidy_amount as number | string)
          : null,
    cost_type: cleanText(record.cost_type),
    support_type: cleanText(record.support_type),
    teaching_method: cleanText(record.teaching_method),
    is_active: asBoolean(record.is_active),
    is_ad: asBoolean(record.is_ad),
    days_left: asNumber(record.days_left),
    deadline_confidence:
      cleanText(record.deadline_confidence) as ProgramCardSummary["deadline_confidence"],
    summary: cleanText(record.summary),
    description: cleanText(record.description),
    compare_meta:
      record.compare_meta && typeof record.compare_meta === "object" && !Array.isArray(record.compare_meta)
        ? (record.compare_meta as ProgramCardSummary["compare_meta"])
        : null,
    tags: asStringArray(record.tags),
    skills: asStringArray(record.skills),
    application_url: cleanText(record.application_url),
    application_method: cleanText(record.application_method),
    participation_time: cleanText(record.participation_time),
    subsidy_amount:
      typeof record.subsidy_amount === "number" || typeof record.subsidy_amount === "string"
        ? (record.subsidy_amount as number | string)
        : null,
    display_categories: Array.isArray(record.display_categories)
      ? record.display_categories
          .map((item) => cleanText(item))
          .filter((item): item is string => Boolean(item))
      : null,
    participation_mode_label: cleanText(record.participation_mode_label),
    participation_time_text: cleanText(record.participation_time_text),
    selection_process_label: cleanText(record.selection_process_label),
    extracted_keywords: Array.isArray(record.extracted_keywords)
      ? record.extracted_keywords
          .map((item) => cleanText(item))
          .filter((item): item is string => Boolean(item))
      : null,
    rating:
      typeof record.rating === "number" || typeof record.rating === "string"
        ? (record.rating as number | string)
        : null,
    rating_raw:
      typeof record.rating_raw === "number" || typeof record.rating_raw === "string"
        ? (record.rating_raw as number | string)
        : null,
    rating_normalized: asNumber(record.rating_normalized),
    rating_scale: asNumber(record.rating_scale),
    rating_display: cleanText(record.rating_display),
    review_count: asNumber(record.review_count),
    relevance_score: asNumber(record.relevance_score),
    final_score: asNumber(record.final_score),
    urgency_score: asNumber(record.urgency_score),
    recommended_score: asNumber(record.recommended_score),
    recommendation_reasons: Array.isArray(record.recommendation_reasons)
      ? record.recommendation_reasons
          .map((item) => cleanText(item))
          .filter((item): item is string => Boolean(item))
      : null,
    detail_view_count: asNumber(record.detail_view_count),
    detail_view_count_7d: asNumber(record.detail_view_count_7d),
    click_hotness_score: asNumber(record.click_hotness_score),
    last_detail_viewed_at: cleanText(record.last_detail_viewed_at),
    promoted_rank: asNumber(record.promoted_rank),
  };
}

function isCacheExpired(savedAt: number, now: number): boolean {
  return now - savedAt > RECOMMEND_CALENDAR_CACHE_TTL_MS;
}

export function writeRecommendCalendarCache(
  storage: CacheStorage,
  items: ProgramCardItem[],
  savedAt = Date.now()
) {
  if (items.length === 0) {
    return;
  }

  const cache: RecommendCalendarCache = {
    savedAt,
    items,
  };
  storage.setItem(RECOMMEND_CALENDAR_CACHE_KEY, JSON.stringify(cache));
}

export function readRecommendCalendarCache(
  storage: CacheStorage,
  now = Date.now()
): ProgramCardItem[] {
  const raw = storage.getItem(RECOMMEND_CALENDAR_CACHE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RecommendCalendarCache & LegacyRecommendCalendarCache>;
    if (typeof parsed.savedAt !== "number" || isCacheExpired(parsed.savedAt, now)) {
      storage.removeItem(RECOMMEND_CALENDAR_CACHE_KEY);
      return [];
    }

    if (Array.isArray(parsed.items)) {
      const items = parsed.items.filter(isProgramCardItem);
      if (items.length === 0) {
        storage.removeItem(RECOMMEND_CALENDAR_CACHE_KEY);
      }
      return items;
    }

    if (Array.isArray(parsed.programs)) {
      const items = parsed.programs
        .map((program) => normalizeLegacyCachedProgram(program))
        .filter((program): program is ProgramCardSummary => Boolean(program))
        .map((program) => toProgramCardItem(program))
        .filter(isProgramCardItem);

      if (items.length === 0) {
        storage.removeItem(RECOMMEND_CALENDAR_CACHE_KEY);
        return [];
      }

      writeRecommendCalendarCache(storage, items, parsed.savedAt);
      return items;
    }

    storage.removeItem(RECOMMEND_CALENDAR_CACHE_KEY);
    return [];
  } catch {
    storage.removeItem(RECOMMEND_CALENDAR_CACHE_KEY);
    return [];
  }
}
