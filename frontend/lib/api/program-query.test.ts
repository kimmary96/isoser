import { describe, expect, it } from "vitest";

import {
  buildCompareSearchParams,
  buildPathWithSearchParams,
  buildProgramListSearchParams,
  buildRecommendationSearchParams,
} from "./program-query";

describe("program query helpers", () => {
  it("builds shared program list query params with multi-value filters", () => {
    const searchParams = buildProgramListSearchParams({
      q: "AI",
      category: "AI",
      category_detail: "data-ai",
      scope: "all",
      region_detail: "서울 강남",
      regions: ["서울", "경기"],
      sources: ["고용24"],
      teaching_methods: ["온라인"],
      cost_types: ["free-no-card"],
      participation_times: ["part-time"],
      targets: ["청년"],
      selection_processes: ["면접"],
      employment_links: ["채용연계"],
      recruiting_only: true,
      include_closed_recent: true,
      sort: "deadline",
      limit: 20,
      offset: 40,
      cursor: "next-token",
    });

    expect(searchParams.get("q")).toBe("AI");
    expect(searchParams.getAll("regions")).toEqual(["서울", "경기"]);
    expect(searchParams.getAll("selection_processes")).toEqual(["면접"]);
    expect(searchParams.get("recruiting_only")).toBe("true");
    expect(searchParams.get("include_closed_recent")).toBe("true");
    expect(searchParams.get("sort")).toBe("deadline");
    expect(buildPathWithSearchParams("/programs/list", searchParams)).toContain("cursor=next-token");
  });

  it("builds recommendation query params for shared dashboard requests", () => {
    const searchParams = buildRecommendationSearchParams({
      category: "AI",
      region: "서울",
      forceRefresh: true,
      topK: 9,
    });

    expect(searchParams.toString()).toBe("category=AI&region=%EC%84%9C%EC%9A%B8&force_refresh=true&top_k=9");
  });

  it("builds compare search query params with recruiting flag", () => {
    const searchParams = buildCompareSearchParams({
      q: "부트캠프",
      limit: 12,
      sort: "popular",
      recruitingOnly: true,
    });

    expect(searchParams.get("q")).toBe("부트캠프");
    expect(searchParams.get("limit")).toBe("12");
    expect(searchParams.get("sort")).toBe("popular");
    expect(searchParams.get("recruiting_only")).toBe("true");
  });
});
