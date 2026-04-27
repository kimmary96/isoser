import { describe, expect, it } from "vitest";

import {
  buildActivityEvidenceText,
  hasActivityEvidenceSource,
  normalizeEvidenceList,
} from "./activity-evidence";

describe("activity evidence", () => {
  it("normalizes repeated list values", () => {
    expect(normalizeEvidenceList([" Redis ", "- Redis", "FastAPI"])).toEqual(["Redis", "FastAPI"]);
  });

  it("detects useful source content", () => {
    expect(hasActivityEvidenceSource({})).toBe(false);
    expect(hasActivityEvidenceSource({ myRole: "백엔드 개발자" })).toBe(true);
  });

  it("builds a reusable activity evidence packet", () => {
    const text = buildActivityEvidenceText({
      title: "FoodRunner",
      type: "프로젝트",
      organization: "FoodRunner",
      period: "2025.03 ~ 2025.07",
      teamSize: 5,
      teamComposition: "PM 1 / 백엔드 2",
      myRole: "백엔드 개발자",
      skills: ["Redis", "FastAPI"],
      contributions: ["자동 매칭 엔진 설계", "매칭시간 75% 단축"],
      description: "실시간 배달 매칭 플랫폼",
    });

    expect(text).toContain("활동명: FoodRunner");
    expect(text).toContain("팀 규모: 5명");
    expect(text).toContain("사용 기술/도구: Redis, FastAPI");
    expect(text).toContain("- 자동 매칭 엔진 설계");
    expect(text).toContain("소개글:");
  });
});
