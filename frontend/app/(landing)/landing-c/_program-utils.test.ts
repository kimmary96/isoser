import { describe, expect, it } from "vitest";

import type { Program } from "@/lib/types";

import {
  filterOpportunityPrograms,
  getLiveBoardPrograms,
  orderOpportunityPrograms,
  resolveLandingHeroPrograms,
} from "./_program-utils";

function createProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: overrides.id ?? "program-1",
    title: overrides.title ?? "프로그램",
    category: overrides.category ?? "AI",
    location: overrides.location ?? "서울",
    provider: overrides.provider ?? "테스트 기관",
    summary: overrides.summary ?? null,
    tags: overrides.tags ?? [],
    skills: overrides.skills ?? [],
    source: overrides.source ?? "고용24",
    deadline: overrides.deadline ?? null,
    start_date: overrides.start_date ?? null,
    end_date: overrides.end_date ?? null,
    cost: overrides.cost ?? 0,
    teaching_method: overrides.teaching_method ?? null,
    days_left: overrides.days_left ?? null,
    recommended_score: overrides.recommended_score ?? null,
    rating_display: overrides.rating_display ?? null,
    rating: overrides.rating ?? null,
    review_count: overrides.review_count ?? null,
    detail_view_count: overrides.detail_view_count ?? null,
    detail_view_count_7d: overrides.detail_view_count_7d ?? null,
    ...overrides,
  };
}

describe("landing-c program utils", () => {
  it("builds live board from this week's most-clicked recruiting programs", () => {
    const programs = [
      createProgram({ id: "expired", title: "지난 공고", days_left: -1, detail_view_count_7d: 30, detail_view_count: 40 }),
      createProgram({ id: "hot-1", title: "이번 주 인기 1", days_left: 2, detail_view_count_7d: 18, detail_view_count: 25 }),
      createProgram({ id: "hot-2", title: "이번 주 인기 2", days_left: 5, detail_view_count_7d: 14, detail_view_count: 22 }),
      createProgram({ id: "hot-3", title: "이번 주 인기 3", days_left: 1, detail_view_count_7d: 11, detail_view_count: 19 }),
      createProgram({ id: "late", title: "다음 달 공고", days_left: 14, detail_view_count_7d: 50, detail_view_count: 70 }),
    ];

    expect(getLiveBoardPrograms(programs).map((program) => program.id)).toEqual(["hot-1", "hot-2", "hot-3"]);
  });

  it("falls back to proxy hotness when click counts are missing", () => {
    const programs = [
      createProgram({ id: "top", title: "만족도 상위", days_left: 2, rating_display: "4.9", review_count: 180 }),
      createProgram({ id: "mid", title: "만족도 중간", days_left: 4, rating_display: "4.7", review_count: 140 }),
      createProgram({ id: "low", title: "만족도 하위", days_left: 6, rating_display: "4.3", review_count: 90 }),
    ];

    expect(getLiveBoardPrograms(programs).map((program) => program.id)).toEqual(["top", "mid", "low"]);
  });

  it("uses opportunity programs when the live board source is empty", () => {
    const fallbackPrograms = [
      createProgram({ id: "fallback-1", title: "대체 공고 1", days_left: 2, detail_view_count_7d: 8 }),
      createProgram({ id: "fallback-2", title: "대체 공고 2", days_left: 4, detail_view_count_7d: 7 }),
      createProgram({ id: "fallback-3", title: "대체 공고 3", days_left: 6, detail_view_count_7d: 6 }),
    ];

    expect(resolveLandingHeroPrograms([], fallbackPrograms).map((program) => program.id)).toEqual([
      "fallback-1",
      "fallback-2",
      "fallback-3",
    ]);
  });

  it("keeps the live board source when it has eligible programs", () => {
    const liveBoardPrograms = [
      createProgram({ id: "live-1", title: "라이브 공고 1", days_left: 2, detail_view_count_7d: 12 }),
      createProgram({ id: "live-2", title: "라이브 공고 2", days_left: 3, detail_view_count_7d: 10 }),
      createProgram({ id: "live-3", title: "라이브 공고 3", days_left: 4, detail_view_count_7d: 9 }),
    ];
    const fallbackPrograms = [
      createProgram({ id: "fallback-1", title: "대체 공고 1", days_left: 1, detail_view_count_7d: 99 }),
    ];

    expect(resolveLandingHeroPrograms(liveBoardPrograms, fallbackPrograms).map((program) => program.id)).toEqual([
      "live-1",
      "live-2",
      "live-3",
    ]);
  });

  it("orders 전체 opportunity feed by active recruiting and satisfaction signals", () => {
    const programs = [
      createProgram({ id: "old", title: "작년 프로그램", days_left: -10, rating_display: "5.0", review_count: 999 }),
      createProgram({ id: "top", title: "만족도 상위", days_left: 12, rating_display: "4.9", review_count: 180 }),
      createProgram({ id: "mid", title: "만족도 중간", days_left: 8, rating_display: "4.7", review_count: 140 }),
      createProgram({ id: "low", title: "만족도 하위", days_left: 6, rating_display: "4.3", review_count: 90 }),
    ];

    expect(orderOpportunityPrograms(programs, { activeChip: "전체", limit: 3 }).map((program) => program.id)).toEqual([
      "top",
      "mid",
      "low",
    ]);
  });

  it("orders non-all opportunity feeds by deadline urgency first", () => {
    const programs = [
      createProgram({ id: "later", title: "여유 있음", days_left: 6, rating_display: "4.9", review_count: 150 }),
      createProgram({ id: "soon", title: "가장 임박", days_left: 1, rating_display: "4.2", review_count: 30 }),
      createProgram({ id: "next", title: "두 번째 임박", days_left: 3, rating_display: "4.8", review_count: 200 }),
    ];

    expect(orderOpportunityPrograms(programs, { activeChip: "AI·데이터", limit: 3 }).map((program) => program.id)).toEqual([
      "soon",
      "next",
      "later",
    ]);
  });

  it("filters opportunity feed by keyword and chip locally", () => {
    const programs = [
      createProgram({ id: "ai", title: "AI 과정", category: "AI", location: "서울", summary: "LLM 실습" }),
      createProgram({ id: "design", title: "디자인 과정", category: "디자인", location: "서울", summary: "Figma" }),
    ];

    expect(filterOpportunityPrograms(programs, { activeChip: "AI·데이터", keyword: "llm" }).map((program) => program.id)).toEqual([
      "ai",
    ]);
  });

  it("filters 무료 chip to both free-no-card and naeil-card programs", () => {
    const programs = [
      createProgram({ id: "free", title: "무료 특강", cost_type: "free-no-card", cost: 0 }),
      createProgram({ id: "card", title: "내배카 과정", cost_type: "naeil-card", cost: 0 }),
      createProgram({ id: "paid", title: "유료 과정", cost_type: "paid", cost: 10000 }),
    ];

    expect(filterOpportunityPrograms(programs, { activeChip: "무료" }).map((program) => program.id)).toEqual([
      "free",
      "card",
    ]);
  });
});
