import { isProgramCardItem, toProgramCardItem } from "../../../lib/program-card-items";
import type { ProgramCardItem, ProgramCardRenderable } from "../../../lib/types";

export const RECOMMEND_CALENDAR_CACHE_KEY = "isoser:recommend-calendar-programs";
export const RECOMMEND_CALENDAR_CACHE_TTL_MS = 1000 * 60 * 15;

type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type RecommendCalendarCache = {
  savedAt: number;
  items?: ProgramCardItem[];
};

type LegacyRecommendCalendarCache = {
  savedAt: number;
  programs?: ProgramCardRenderable[];
};

function hasProgramIdentity(value: unknown): value is ProgramCardRenderable {
  return Boolean(value && typeof value === "object" && "id" in value);
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
        .filter(hasProgramIdentity)
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
