import { describe, expect, it } from "vitest";

import type { ProgramCardItem, ProgramCardSummary, ProgramSurfaceContext } from "./types";

import {
  getProgramCardFitKeywords,
  getProgramCardReason,
  getProgramCardRelevanceBadge,
  getProgramCardRelevanceReasons,
  getProgramCardScore,
  isProgramCardOpen,
  toFallbackCalendarProgramCardItem,
} from "./program-card-items";

function createProgram(
  overrides: Partial<ProgramCardSummary> & Record<string, unknown> = {}
): ProgramCardSummary {
  return {
    id: "program-1",
    title: "테스트 프로그램",
    category: "개발",
    location: "서울",
    provider: "테스트 기관",
    summary: "요약",
    tags: [],
    skills: [],
    ...overrides,
  };
}

function createItem({
  program,
  context,
}: {
  program?: ProgramCardSummary;
  context?: ProgramSurfaceContext | null;
} = {}): ProgramCardItem {
  return {
    program: (program ?? createProgram()) as ProgramCardSummary,
    context: context ?? null,
  };
}

describe("program card item helpers", () => {
  it("prefers structured context over summary scores when both exist", () => {
    const item = createItem({
      program: createProgram({
        relevance_score: 61,
        final_score: 58,
        recommended_score: 55,
        recommendation_reasons: ["정본 추천 사유"],
      }),
      context: {
        surface: "dashboard_recommendation",
        reason: "현재 사유",
        fit_keywords: ["현재 키워드"],
        relevance_score: 77,
        relevance_reasons: ["현재 relevance 사유"],
        relevance_badge: "현재 배지",
      },
    });

    expect(getProgramCardScore(item)).toBe(77);
    expect(getProgramCardReason(item)).toBe("현재 사유");
    expect(getProgramCardFitKeywords(item)).toEqual(["현재 키워드"]);
    expect(getProgramCardRelevanceReasons(item)).toEqual(["현재 relevance 사유"]);
    expect(getProgramCardRelevanceBadge(item)).toBe("현재 배지");
  });

  it("does not let a zero relevance score hide a usable final score", () => {
    const item = createItem({
      program: createProgram({
        relevance_score: 0,
        final_score: 0.42,
        recommended_score: 0.3,
      }),
      context: {
        surface: "dashboard_recommendation",
        relevance_score: 0,
        score: 0.58,
      },
    });

    expect(getProgramCardScore(item)).toBe(0.58);
  });

  it("derives a non-zero score for deadline fallback cards", () => {
    const item = toFallbackCalendarProgramCardItem(
      createProgram({
        days_left: 5,
        relevance_score: null,
        final_score: null,
        recommended_score: null,
        urgency_score: null,
      }),
      "fallback"
    );

    expect(item).not.toBeNull();
    expect(getProgramCardScore(item as ProgramCardItem)).toBe(65);
  });

  it("uses canonical recommendation reasons when structured context is absent", () => {
    const item = createItem({
      program: createProgram({
        recommendation_reasons: ["정본 사유 A", "정본 사유 B"],
      }),
    });

    expect(getProgramCardRelevanceReasons(item)).toEqual(["정본 사유 A", "정본 사유 B"]);
    expect(getProgramCardReason(item)).toBeNull();
  });

  it("returns empty recommendation helpers for bookmark surfaces without recommendation context", () => {
    const item = createItem({
      program: createProgram({
        recommendation_reasons: [],
      }),
      context: { surface: "dashboard_bookmark" },
    });

    expect(getProgramCardScore(item)).toBeNull();
    expect(getProgramCardReason(item)).toBeNull();
    expect(getProgramCardFitKeywords(item)).toEqual([]);
    expect(getProgramCardRelevanceReasons(item)).toEqual([]);
    expect(getProgramCardRelevanceBadge(item)).toBeNull();
  });

  it("treats negative days_left recommendation cards as closed", () => {
    const item = createItem({
      program: createProgram({
        days_left: -1,
        deadline: "2099-05-10",
        is_open: true,
      }),
    });

    expect(isProgramCardOpen(item)).toBe(false);
  });

  it("keeps recommendation cards without explicit closed signals", () => {
    const item = createItem({
      program: createProgram({
        deadline: null,
        is_active: true,
      }),
    });

    expect(isProgramCardOpen(item)).toBe(true);
  });

  it("keeps cards with future date signals even when stale closed flags remain", () => {
    const item = createItem({
      program: createProgram({
        deadline: "2099-05-10",
        days_left: 10,
        is_open: false,
      }),
    });

    expect(isProgramCardOpen(item)).toBe(true);
  });

  it("treats explicit closed flags as closed when no date signal exists", () => {
    const item = createItem({
      program: createProgram({
        deadline: null,
        days_left: null,
        is_open: false,
      }),
    });

    expect(isProgramCardOpen(item)).toBe(false);
  });
});
