import { describe, expect, it } from "vitest";

import {
  buildActivityStarImportDraft,
  hasActivityStarImportSource,
} from "./activity-star-import";

describe("activity star import", () => {
  it("detects whether basic activity info can be imported", () => {
    expect(hasActivityStarImportSource({})).toBe(false);
    expect(hasActivityStarImportSource({ contributions: ["Redis 매칭 엔진 설계"] })).toBe(true);
  });

  it("maps parsed basic info and contributions into STAR draft fields", () => {
    const draft = buildActivityStarImportDraft({
      title: "FoodRunner",
      type: "프로젝트",
      organization: "FoodRunner",
      period: "2025.03 ~ 2025.07",
      teamSize: 5,
      teamComposition: "PM 1 / 백엔드 2 / 프론트 1 / 디자이너 1",
      myRole: "백엔드 개발자",
      skills: ["Redis", "WebSocket", "FastAPI"],
      description: "실시간 배달 매칭 플랫폼을 구축했습니다.",
      contributions: [
        "기존 수동 매칭 방식의 지연 문제 해결",
        "Redis Sorted Set 기반 자동 매칭 엔진 설계",
        "WebSocket 실시간 라이더 위치 추적 및 주문 상태 동기화",
        "성과: 일 15,000건 처리 / 매칭시간 75% 단축(12s->3s) / 완료율 94%",
      ],
    });

    expect(draft.situation).toContain("FoodRunner (프로젝트)");
    expect(draft.situation).toContain("2025.03 ~ 2025.07");
    expect(draft.situation).toContain("실시간 배달 매칭 플랫폼");
    expect(draft.task).toContain("백엔드 개발자 역할");
    expect(draft.task).toContain("지연 문제 해결");
    expect(draft.action).toContain("Redis Sorted Set 기반 자동 매칭 엔진 설계");
    expect(draft.action).toContain("WebSocket 실시간 라이더 위치 추적");
    expect(draft.action).toContain("Redis, WebSocket, FastAPI");
    expect(draft.result).toContain("매칭시간 75% 단축");
  });
});
