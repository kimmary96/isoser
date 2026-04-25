import { describe, expect, it } from "vitest";

import { countActiveProgramFilterGroups, resolvePublicProgramListScope } from "./program-list-scope";

describe("resolvePublicProgramListScope", () => {
  it("returns default for browse entry without keyword", () => {
    expect(resolvePublicProgramListScope({ keyword: "", includeClosedRecent: false })).toBe("default");
  });

  it("returns all when keyword search is present", () => {
    expect(resolvePublicProgramListScope({ keyword: "ai", includeClosedRecent: false })).toBe("all");
  });

  it("returns all when two or more filter groups are active", () => {
    expect(resolvePublicProgramListScope({ keyword: "", includeClosedRecent: false, activeFilterGroupCount: 2 })).toBe(
      "all"
    );
  });

  it("returns archive when closed recent mode is enabled", () => {
    expect(resolvePublicProgramListScope({ keyword: "ai", includeClosedRecent: true })).toBe("archive");
  });
});

describe("countActiveProgramFilterGroups", () => {
  it("counts one group per filter family", () => {
    expect(
      countActiveProgramFilterGroups({
        categoryId: "data-ai",
        regions: ["서울", "경기"],
        sources: ["고용24"],
      })
    ).toBe(3);
  });

  it("treats default category and empty groups as inactive", () => {
    expect(
      countActiveProgramFilterGroups({
        categoryId: "all",
        regions: [],
        teachingMethods: [],
      })
    ).toBe(0);
  });
});
