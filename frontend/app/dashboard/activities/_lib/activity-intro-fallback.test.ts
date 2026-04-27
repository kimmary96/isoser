import { describe, expect, it } from "vitest";

import { buildActivityIntroFallbackCandidates } from "./activity-intro-fallback";

describe("activity intro fallback", () => {
  it("builds local intro candidates from basic info and contributions", () => {
    const candidates = buildActivityIntroFallbackCandidates({
      title: "FoodRunner",
      type: "프로젝트",
      organization: "FoodRunner",
      period: "2025.03 ~ 2025.07",
      myRole: "백엔드 개발자",
      skills: ["Redis", "WebSocket"],
      contributions: ["Redis 자동 매칭 엔진 설계", "매칭시간 75% 단축"],
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]).toContain("FoodRunner");
    expect(candidates[0]).toContain("백엔드 개발자");
    expect(candidates[0]).toContain("Redis 자동 매칭 엔진 설계");
    expect(candidates[0]).toContain("Redis, WebSocket");
  });

  it("falls back to description when contribution content is missing", () => {
    const candidates = buildActivityIntroFallbackCandidates({
      title: "운영 자동화",
      description: "반복 운영 업무를 자동화한 활동입니다.",
    });

    expect(candidates[0]).toContain("반복 운영 업무를 자동화한 활동입니다.");
  });
});
