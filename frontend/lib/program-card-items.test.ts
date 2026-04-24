import { describe, expect, it } from "vitest";

import type { ProgramCardItem, ProgramCardSummary, ProgramSurfaceContext } from "./types";

import {
  getProgramCardFitKeywords,
  getProgramCardReason,
  getProgramCardRelevanceBadge,
  getProgramCardRelevanceReasons,
  getProgramCardScore,
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
  it("prefers structured context and canonical summary fields over legacy private fields", () => {
    const item = createItem({
      program: createProgram({
        relevance_score: 61,
        final_score: 58,
        recommended_score: 55,
        recommendation_reasons: ["정본 추천 사유"],
        _reason: "예전 사유",
        _fit_keywords: ["예전 키워드"],
        _score: 22,
        _relevance_score: 21,
        relevance_reasons: ["예전 relevance 사유"],
        relevance_badge: "예전 배지",
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

  it("uses canonical recommendation reasons before legacy private reasons", () => {
    const item = createItem({
      program: createProgram({
        recommendation_reasons: ["정본 사유 A", "정본 사유 B"],
        _reason: "예전 사유",
        relevance_reasons: ["예전 relevance 사유"],
      }),
    });

    expect(getProgramCardRelevanceReasons(item)).toEqual(["정본 사유 A", "정본 사유 B"]);
    expect(getProgramCardReason(item)).toBe("예전 사유");
  });

  it("keeps legacy private fields only for stale payloads without structured recommendation context", () => {
    const item = createItem({
      program: createProgram({
        _reason: "예전 사유",
        _fit_keywords: ["예전 키워드"],
        _score: 44,
        _relevance_score: 43,
        relevance_reasons: ["예전 relevance 사유"],
        relevance_badge: "예전 배지",
      }),
      context: { surface: "dashboard_bookmark" },
    });

    expect(getProgramCardScore(item)).toBe(43);
    expect(getProgramCardReason(item)).toBe("예전 사유");
    expect(getProgramCardFitKeywords(item)).toEqual(["예전 키워드"]);
    expect(getProgramCardRelevanceReasons(item)).toEqual(["예전 relevance 사유"]);
    expect(getProgramCardRelevanceBadge(item)).toBe("예전 배지");
  });
});
