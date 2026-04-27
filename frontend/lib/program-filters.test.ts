import { describe, expect, it } from "vitest";

import type { ProgramListRow } from "./types";

import {
  PROGRAM_FILTER_CHIPS,
  buildProgramFilterParams,
  isAllProgramFilterChip,
  matchesProgramKeyword,
  matchesProgramFilterChip,
} from "./program-filters";

function createProgram(overrides: Partial<ProgramListRow> = {}): ProgramListRow {
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
    cost_type: overrides.cost_type ?? "free-no-card",
    support_type: overrides.support_type ?? null,
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

describe("program filters", () => {
  it("keeps shared landing chips available", () => {
    expect(PROGRAM_FILTER_CHIPS).toContain("AI·데이터");
    expect(PROGRAM_FILTER_CHIPS).toContain("IT·개발");
    expect(PROGRAM_FILTER_CHIPS).toContain("무료");
    expect(PROGRAM_FILTER_CHIPS).not.toContain("국비100%");
  });

  it("maps display category chips to backend category values", () => {
    expect(buildProgramFilterParams("AI·데이터", "")).toMatchObject({
      category: "AI",
      recruiting_only: true,
      sort: "deadline",
      limit: 6,
    });
    expect(buildProgramFilterParams("IT·개발", "프론트")).toMatchObject({
      q: "프론트",
      category: "IT",
      recruiting_only: true,
      sort: "deadline",
      limit: 6,
    });
    expect(buildProgramFilterParams("경영", "")).toMatchObject({
      category: "경영",
      recruiting_only: true,
      sort: "deadline",
      limit: 6,
    });
    expect(buildProgramFilterParams("창업", "")).toMatchObject({
      category: "창업",
      recruiting_only: true,
      sort: "deadline",
      limit: 6,
    });
  });

  it("maps regions and free filters", () => {
    expect(buildProgramFilterParams("서울", "")).toMatchObject({
      regions: ["서울"],
      recruiting_only: true,
      sort: "deadline",
    });
    expect(buildProgramFilterParams("온라인", "")).toMatchObject({
      teaching_methods: ["온라인"],
      recruiting_only: true,
      sort: "deadline",
    });
    expect(buildProgramFilterParams("무료", "")).toMatchObject({
      cost_types: ["free-no-card", "naeil-card"],
      recruiting_only: true,
      sort: "deadline",
    });
    expect(buildProgramFilterParams("전체", "")).toMatchObject({
      recruiting_only: true,
      sort: "default",
      limit: 6,
    });
  });

  it("shares chip semantics through common helpers", () => {
    expect(isAllProgramFilterChip("전체")).toBe(true);
    expect(isAllProgramFilterChip("무료")).toBe(false);

    expect(matchesProgramFilterChip(createProgram({ category: "AI" }), "AI·데이터")).toBe(true);
    expect(matchesProgramFilterChip(createProgram({ category: "디자인" }), "AI·데이터")).toBe(false);
    expect(
      matchesProgramFilterChip(
        createProgram({ category: "기타", source: "K-Startup 창업진흥원", title: "초기 창업 패키지" }),
        "창업"
      )
    ).toBe(true);
    expect(
      matchesProgramFilterChip(
        createProgram({ teaching_method: null, location: "서울", title: "원격 실무 부트캠프" }),
        "온라인"
      )
    ).toBe(true);
    expect(matchesProgramFilterChip(createProgram({ location: "경기 성남", teaching_method: null }), "경기")).toBe(true);
    expect(matchesProgramFilterChip(createProgram({ location: "서울", cost_type: "paid", cost: 12000 }), "무료")).toBe(false);
    expect(matchesProgramFilterChip(createProgram({ cost_type: null, cost: 0 }), "무료")).toBe(true);
    expect(matchesProgramFilterChip(createProgram({ cost: 1000000, subsidy_amount: 0 }), "무료")).toBe(true);
    expect(
      matchesProgramFilterChip(
        createProgram({ cost_type: null, cost: null, support_type: "국민내일배움카드", summary: "AI 훈련" }),
        "무료"
      )
    ).toBe(true);
  });

  it("shares keyword matching between landing feed and fallback loaders", () => {
    const program = createProgram({
      title: "K-Startup 창업 부트캠프",
      provider: "창업진흥원",
      summary: "예비창업자 대상",
    });

    expect(matchesProgramKeyword(program, "창업진흥원")).toBe(true);
    expect(matchesProgramKeyword(program, "예비창업")).toBe(true);
    expect(matchesProgramKeyword(program, "디자인")).toBe(false);
  });

  it("keeps removed or unknown chips from adding hidden filters", () => {
    expect(buildProgramFilterParams("국비100%", "")).toMatchObject({
      recruiting_only: true,
      sort: "deadline",
      limit: 6,
    });
    expect(buildProgramFilterParams("국비100%", "AI")).toMatchObject({
      q: "AI",
      recruiting_only: true,
      sort: "deadline",
      limit: 6,
    });
  });
});
