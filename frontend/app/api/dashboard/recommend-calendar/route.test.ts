import { describe, expect, it } from "vitest";

import type { ProgramListPageResponse } from "../../../../lib/types";

import { extractBackendFallbackPrograms } from "../../../../lib/server/recommend-calendar-fallback";

describe("recommend calendar fallback page extractor", () => {
  it("uses only organic list items and preserves their order", () => {
    const page: ProgramListPageResponse = {
      promoted_items: [
        {
          program: {
            id: "promoted-1",
            title: "프로모션 프로그램",
            category: "IT",
            location: "서울",
            provider: "기관 P",
            summary: "프로모션 요약",
            tags: [],
            skills: [],
          },
          context: { surface: "program_list_promoted", promoted_rank: 1 },
        },
      ],
      items: [
        {
          program: {
            id: "program-2",
            title: "두 번째 공개 프로그램",
            category: "IT",
            location: "서울",
            provider: "기관 B",
            summary: "요약 B",
            tags: [],
            skills: [],
          },
          context: { surface: "program_list" },
        },
        {
          program: {
            id: "program-1",
            title: "첫 번째 공개 프로그램",
            category: "AI",
            location: "부산",
            provider: "기관 A",
            summary: "요약 A",
            tags: [],
            skills: [],
          },
          context: { surface: "program_list" },
        },
      ],
      next_cursor: null,
      count: 2,
      mode: "browse",
      source: "read_model",
      cache_hit: false,
    };

    expect(extractBackendFallbackPrograms(page)).toEqual([
      page.items[0].program,
      page.items[1].program,
    ]);
  });
});
