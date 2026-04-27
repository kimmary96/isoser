import { describe, expect, it } from "vitest";

import {
  buildActivityCoachChatFallbackReply,
  buildActivityCoachChatPrompt,
  normalizeActivityCoachChatReply,
} from "./activity-coach-chat";

describe("activity coach chat", () => {
  it("builds a general chat prompt that avoids diagnosis and metadata echo", () => {
    const prompt = buildActivityCoachChatPrompt({
      question: "할일이 너무 많은데 뭘 기준으로 써야해?",
      targetRole: "PM",
      activityTitle: "새 성과 기록",
      activityType: "프로젝트",
      recentMessages: [],
    });

    expect(prompt).toContain("사용자의 질문에만 답한다");
    expect(prompt).toContain("STAR 진단");
    expect(prompt).toContain("메타 라벨을 답변에 출력하지 않는다");
    expect(prompt).toContain("바로 할 일");
  });

  it("removes leaked context metadata from chat replies", () => {
    const reply = normalizeActivityCoachChatReply(
      "지원 직무: PM\n활동명: 새 성과 기록\n활동 유형: 프로젝트\n\n1. 핵심 답변: 중요한 기준부터 고르세요."
    );

    expect(reply).not.toContain("지원 직무:");
    expect(reply).not.toContain("활동명:");
    expect(reply).not.toContain("활동 유형:");
    expect(reply).toContain("핵심 답변");
  });

  it("returns different local fallback replies by question intent", () => {
    const seniorReply = buildActivityCoachChatFallbackReply("시니어 백엔드 개발자 관점에서 뭐가 부족해?", "백엔드 개발자");
    const shortReply = buildActivityCoachChatFallbackReply("ㅇㅇ", "PM");

    expect(seniorReply).toContain("시니어 관점");
    expect(seniorReply).toContain("기술을 선택");
    expect(shortReply).toContain("질문이 짧아서");
    expect(shortReply).not.toBe(seniorReply);
  });
});
