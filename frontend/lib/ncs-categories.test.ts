import { describe, expect, it } from "vitest";

import { deriveNcsMajorCategoryLabels } from "./ncs-categories";

describe("NCS major category labels", () => {
  it("keeps stored NCS major labels", () => {
    expect(
      deriveNcsMajorCategoryLabels({
        category: "기타",
        category_detail: null,
        display_categories: ["정보통신"],
        title: "AI 과정",
        summary: null,
        description: null,
        skills: [],
        tags: [],
      })
    ).toEqual(["정보통신"]);
  });

  it("retags stale 기타 display categories from title and skills", () => {
    expect(
      deriveNcsMajorCategoryLabels({
        category: "기타",
        category_detail: null,
        display_categories: ["기타"],
        title: "[스케치업]SketchUp 입문",
        summary: null,
        description: null,
        skills: [],
        tags: [],
      })
    ).toEqual(["문화·예술·디자인·방송"]);
  });

  it("maps legacy broad categories to NCS first-level labels", () => {
    expect(
      deriveNcsMajorCategoryLabels({
        category: "IT",
        category_detail: null,
        display_categories: ["IT"],
        title: "Business Analyst Course",
        summary: null,
        description: null,
        skills: ["데이터"],
        tags: [],
      })
    ).toEqual(["정보통신"]);
  });

  it("retags common 기타 rows from title before provider-like description words", () => {
    expect(
      deriveNcsMajorCategoryLabels({
        category: "기타",
        category_detail: null,
        display_categories: ["기타"],
        title: "요양보호사 자격 취득과정",
        summary: null,
        description: "요양보호사교육원",
        skills: [],
        tags: [],
      })
    ).toEqual(["사회복지·종교"]);

    expect(
      deriveNcsMajorCategoryLabels({
        category: "기타",
        category_detail: null,
        display_categories: ["기타"],
        title: "타일시공 및 기능사 취득과정_야간",
        summary: null,
        description: null,
        skills: [],
        tags: [],
      })
    ).toEqual(["건설"]);

    expect(
      deriveNcsMajorCategoryLabels({
        category: "기타",
        category_detail: null,
        display_categories: ["기타"],
        title: "지게차자격증실기(야간40A)",
        summary: null,
        description: null,
        skills: [],
        tags: [],
      })
    ).toEqual(["운전·운송"]);
  });
});
