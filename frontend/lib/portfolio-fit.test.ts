import { describe, expect, it } from "vitest";

import { analyzePortfolioFit } from "./portfolio-fit";
import type { Activity } from "./types";

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: overrides.id ?? "activity-id",
    user_id: "user-id",
    type: overrides.type ?? "프로젝트",
    title: overrides.title ?? "프로젝트",
    organization: overrides.organization,
    team_size: overrides.team_size,
    team_composition: overrides.team_composition,
    my_role: overrides.my_role,
    contributions: overrides.contributions ?? [],
    image_urls: overrides.image_urls ?? [],
    period: overrides.period ?? "2025.01 ~ 2025.03",
    role: overrides.role ?? null,
    skills: overrides.skills ?? [],
    description: overrides.description ?? "",
    star_situation: overrides.star_situation,
    star_task: overrides.star_task,
    star_action: overrides.star_action,
    star_result: overrides.star_result,
    is_visible: overrides.is_visible ?? true,
    created_at: overrides.created_at ?? "2025-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2025-01-01T00:00:00.000Z",
  };
}

describe("analyzePortfolioFit", () => {
  it("recommends the top three activities for a job posting", () => {
    const result = analyzePortfolioFit({
      targetJob: "백엔드 개발자",
      jobPostingText: "FastAPI, Redis, PostgreSQL 기반 실시간 매칭 API 경험을 우대합니다.",
      activities: [
        activity({
          id: "backend-match",
          title: "실시간 매칭 API",
          skills: ["FastAPI", "Redis", "PostgreSQL"],
          contributions: ["Redis 기반 매칭 엔진 설계", "WebSocket 주문 상태 동기화"],
          star_situation: "피크타임 주문 대기 시간이 길었습니다.",
          star_task: "실시간 매칭 구조가 필요했습니다.",
          star_action: "FastAPI와 Redis로 매칭 API를 구현했습니다.",
          star_result: "매칭 시간을 12초에서 3초로 줄였습니다.",
          image_urls: ["https://example.com/match.png"],
        }),
        activity({
          id: "frontend-admin",
          title: "관리자 대시보드",
          skills: ["React", "TypeScript"],
          contributions: ["운영 지표 대시보드 구현"],
          star_result: "운영 확인 시간을 30% 줄였습니다.",
        }),
        activity({
          id: "data-pipeline",
          title: "PostgreSQL 통계 파이프라인",
          skills: ["PostgreSQL", "Python"],
          contributions: ["배달 이력 통계 테이블 설계"],
          star_action: "Python 배치로 통계 데이터를 생성했습니다.",
          star_result: "일 15,000건 데이터를 처리했습니다.",
        }),
        activity({
          id: "marketing",
          type: "대외활동",
          title: "마케팅 캠페인",
          skills: ["콘텐츠"],
          contributions: ["카피라이팅"],
        }),
      ],
    });

    expect(result.recommendedActivityIds).toHaveLength(3);
    expect(result.recommendedActivityIds[0]).toBe("backend-match");
    expect(result.recommendedActivityIds).toContain("data-pipeline");
    expect(result.activities.find((item) => item.activityId === "backend-match")?.matchedEvidenceKeywords).toContain("fastapi");
  });

  it("falls back to evidence completeness when no job context exists", () => {
    const result = analyzePortfolioFit({
      activities: [
        activity({ id: "thin", title: "짧은 활동" }),
        activity({
          id: "rich",
          title: "정리된 프로젝트",
          contributions: ["API 설계", "배포 자동화", "성능 개선"],
          star_situation: "문제가 있었습니다.",
          star_task: "개선 목표를 세웠습니다.",
          star_action: "자동화를 구현했습니다.",
          star_result: "처리 시간을 40% 줄였습니다.",
        }),
      ],
    });

    expect(result.recommendedActivityIds[0]).toBe("rich");
    expect(result.activities.find((item) => item.activityId === "thin")?.riskFlags).toContain("수치 보완 필요");
  });
});

