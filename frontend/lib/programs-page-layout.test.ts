import { describe, expect, it } from "vitest";

import { buildUrgentProgramChips, buildUrgentProgramsParams } from "./programs-page-layout";

describe("programs page layout helpers", () => {
  it("keeps urgent programs independent from the active search filters", () => {
    expect(buildUrgentProgramsParams()).toEqual({
      recruiting_only: true,
      sort: "deadline",
      limit: 12,
      offset: 0,
    });
  });

  it("removes duplicate urgent card chips before rendering keys", () => {
    expect(
      buildUrgentProgramChips({
        category: "창업",
        category_detail: "PM/기획",
        display_categories: ["창업", "PM/기획"],
        extracted_keywords: ["창업", "AI", "멘토링"],
        skills: ["AI", "마케팅"],
      })
    ).toEqual(["창업", "PM/기획", "AI", "멘토링"]);
  });
});
