import { describe, expect, it } from "vitest";

import { type ProgramCardSummary, type ProgramCardItem } from "@/lib/types";

import {
  readRecommendCalendarCache,
  RECOMMEND_CALENDAR_CACHE_KEY,
  RECOMMEND_CALENDAR_CACHE_TTL_MS,
  writeRecommendCalendarCache,
} from "./recommend-calendar-cache";

type MemoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function createMemoryStorage(initialValue?: string): MemoryStorage {
  const store = new Map<string, string>();
  if (initialValue) {
    store.set(RECOMMEND_CALENDAR_CACHE_KEY, initialValue);
  }

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function createProgram(overrides: Partial<ProgramCardSummary> = {}): ProgramCardSummary {
  return {
    id: overrides.id ?? "program-1",
    title: overrides.title ?? "테스트 프로그램",
    category: overrides.category ?? "개발",
    location: overrides.location ?? "서울",
    provider: overrides.provider ?? "테스트 기관",
    summary: overrides.summary ?? "요약",
    tags: overrides.tags ?? [],
    skills: overrides.skills ?? [],
    ...overrides,
  };
}

function createItem(overrides: Partial<ProgramCardItem> = {}): ProgramCardItem {
  return {
    program: createProgram(),
    context: { surface: "dashboard_recommend_calendar" },
    ...overrides,
  };
}

describe("recommend calendar cache helper", () => {
  it("현재 items 캐시를 그대로 읽는다", () => {
    const storage = createMemoryStorage();
    const items = [createItem()];

    writeRecommendCalendarCache(storage, items, 1_000);

    expect(readRecommendCalendarCache(storage, 1_100)).toEqual(items);
  });

  it("예전 programs 캐시를 읽으면 items 캐시로 자동 승격한다", () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        savedAt: 2_000,
        programs: [createProgram({ id: "legacy-1" })],
      })
    );

    const result = readRecommendCalendarCache(storage, 2_100);

    expect(result).toHaveLength(1);
    expect(result[0]?.program.id).toBe("legacy-1");

    const migratedRaw = storage.getItem(RECOMMEND_CALENDAR_CACHE_KEY);
    expect(migratedRaw).not.toBeNull();
    expect(JSON.parse(migratedRaw as string)).toMatchObject({
      savedAt: 2_000,
      items: [
        {
          program: {
            id: "legacy-1",
          },
        },
      ],
    });
  });

  it("만료된 캐시는 비우고 제거한다", () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        savedAt: 3_000,
        items: [createItem()],
      })
    );

    expect(
      readRecommendCalendarCache(storage, 3_000 + RECOMMEND_CALENDAR_CACHE_TTL_MS + 1)
    ).toEqual([]);
    expect(storage.getItem(RECOMMEND_CALENDAR_CACHE_KEY)).toBeNull();
  });
});
