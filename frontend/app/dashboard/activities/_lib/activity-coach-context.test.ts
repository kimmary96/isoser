import { describe, expect, it } from "vitest";

import { buildActivityCoachContext } from "./activity-coach-context";

describe("buildActivityCoachContext", () => {
  it("builds a structured evidence packet from activity fields", () => {
    const context = buildActivityCoachContext({
      targetRole: "백엔드 개발자",
      title: "주문 관리 개선",
      type: "프로젝트",
      organization: "커머스 팀",
      period: "2025.03 ~ 2025.05",
      teamSize: 4,
      teamComposition: "프론트엔드 1명, 백엔드 2명, 기획 1명",
      myRole: "백엔드 API 설계",
      skills: ["Node.js", "PostgreSQL", ""],
      contributions: ["주문 상태 API 재설계", "반복 문의 감소"],
      description: "주문 확인 과정을 개선했습니다.",
      starSituation: "주문 상태 확인 문의가 반복됐습니다.",
      starTask: "문의 없이 상태를 확인할 수 있어야 했습니다.",
      starAction: "상태값과 알림 흐름을 정리했습니다.",
      starResult: "문의가 줄었습니다.",
    });

    expect(context).toContain("지원 직무: 백엔드 개발자");
    expect(context).toContain("활동명: 주문 관리 개선");
    expect(context).toContain("팀 규모: 4명");
    expect(context).toContain("사용 기술/도구: Node.js, PostgreSQL");
    expect(context).toContain("- 주문 상태 API 재설계");
    expect(context).toContain("STAR Situation:");
    expect(context).toContain("STAR Result:");
  });

  it("falls back to the user message when no activity fields are available", () => {
    expect(buildActivityCoachContext({ fallbackText: "이 활동을 봐줘" })).toBe("이 활동을 봐줘");
  });
});
