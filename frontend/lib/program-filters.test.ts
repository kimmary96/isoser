import { describe, expect, it } from "vitest";

import { PROGRAM_FILTER_CHIPS, buildProgramFilterParams } from "./program-filters";

describe("program filters", () => {
  it("keeps shared landing chips available", () => {
    expect(PROGRAM_FILTER_CHIPS).toContain("AI·데이터");
    expect(PROGRAM_FILTER_CHIPS).toContain("IT·개발");
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
  });

  it("maps regions and urgency filters", () => {
    expect(buildProgramFilterParams("서울", "")).toMatchObject({
      regions: ["서울"],
      recruiting_only: true,
      sort: "deadline",
    });
    expect(buildProgramFilterParams("마감임박", "")).toMatchObject({
      recruiting_only: true,
      sort: "deadline",
    });
    expect(buildProgramFilterParams("전체", "")).toMatchObject({
      recruiting_only: true,
      sort: "default",
      limit: 6,
    });
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
