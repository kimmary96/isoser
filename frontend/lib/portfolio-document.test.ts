import { describe, expect, it } from "vitest";

import {
  createPortfolioDocumentPayload,
  createPortfolioProjectDraft,
  normalizePortfolioDocumentPayload,
  getOrderedPortfolioProjects,
  getPortfolioProjectDisplaySections,
  getPortfolioProjectReviewTags,
  reorderPortfolioProjects,
  updatePortfolioImagePlacement,
} from "./portfolio-document";
import type { Activity, PortfolioConversionResponse } from "./types";

const legacyPortfolio: PortfolioConversionResponse = {
  activity_id: "activity-1",
  activity_image_urls: ["https://example.com/one.png"],
  project_overview: {
    title: "실시간 매칭 플랫폼",
    activity_type: "프로젝트",
    organization: "이소서",
    period: "2025.01 ~ 2025.03",
    skills: ["FastAPI", "Redis"],
    summary: "주문과 라이더를 실시간으로 연결한 프로젝트입니다.",
    contributions: ["매칭 API 구현"],
  },
  problem_definition: {
    label: "문제 정의",
    content: "수동 배차로 대기 시간이 길었습니다.",
  },
  tech_decision: {
    label: "기술 선택 근거",
    content: "실시간 처리를 위해 Redis를 사용했습니다.",
  },
  implementation_detail: {
    label: "구현 디테일",
    summary: "FastAPI 기반 매칭 API를 구현했습니다.",
    highlights: ["Redis Sorted Set 활용"],
  },
  quantified_result: {
    label: "정량적 성과",
    summary: "매칭 시간을 75% 단축했습니다.",
    metrics: [{ value: "75%", label: "매칭 시간 단축" }],
  },
  role_clarification: {
    label: "역할 명확화",
    content: "백엔드 개발자로 참여했습니다.",
  },
  missing_elements: [],
  review_tags: [],
};

describe("portfolio document helpers", () => {
  it("normalizes a legacy portfolio conversion payload into a v2 document", () => {
    const document = normalizePortfolioDocumentPayload(legacyPortfolio);

    expect(document?.version).toBe(2);
    expect(document?.projects).toHaveLength(1);
    expect(document?.selectedActivityIds).toEqual(["activity-1"]);
    expect(document?.imagePlacements[0]).toMatchObject({
      activityId: "activity-1",
      sectionKey: "overview",
    });
  });

  it("preserves project order changes", () => {
    const first = createPortfolioProjectDraft({ portfolio: legacyPortfolio });
    const second = createPortfolioProjectDraft({
      portfolio: { ...legacyPortfolio, activity_id: "activity-2" },
    });
    const document = createPortfolioDocumentPayload({
      title: "포트폴리오",
      projects: [first, second],
    });

    const reordered = reorderPortfolioProjects(document, "activity-2", "up");

    expect(reordered.projectOrder).toEqual(["activity-2", "activity-1"]);
  });

  it("deduplicates repeated ids while resolving project order", () => {
    const first = createPortfolioProjectDraft({ portfolio: legacyPortfolio });
    const second = createPortfolioProjectDraft({
      portfolio: { ...legacyPortfolio, activity_id: "activity-2" },
    });
    const document = createPortfolioDocumentPayload({
      title: "포트폴리오",
      projects: [first, second],
      projectOrder: ["activity-1", "activity-1", "activity-2"],
    });

    expect(getOrderedPortfolioProjects(document).map((project) => project.activityId)).toEqual([
      "activity-1",
      "activity-2",
    ]);
  });

  it("hides duplicate section text and duplicate highlights in display sections", () => {
    const duplicatePortfolio: PortfolioConversionResponse = {
      ...legacyPortfolio,
      project_overview: {
        ...legacyPortfolio.project_overview,
        summary: "FastAPI 기반 매칭 API를 구현했습니다.",
      },
      implementation_detail: {
        ...legacyPortfolio.implementation_detail,
        summary: "FastAPI 기반 매칭 API를 구현했습니다.",
        highlights: ["FastAPI 기반 매칭 API를 구현했습니다.", "Redis Sorted Set 활용"],
      },
    };
    const project = createPortfolioProjectDraft({ portfolio: duplicatePortfolio });
    const sections = getPortfolioProjectDisplaySections(project);
    const implementation = sections.find((section) => section.key === "implementation");

    expect(implementation).toMatchObject({
      text: null,
      highlights: ["Redis Sorted Set 활용"],
      isDuplicateText: true,
    });
  });

  it("can hide editing placeholders from final document display sections", () => {
    const placeholderPortfolio: PortfolioConversionResponse = {
      ...legacyPortfolio,
      problem_definition: {
        label: "문제 정의",
        content: "활동이 시작된 배경이나 해결하려던 문제를 입력해주세요.",
      },
      tech_decision: {
        label: "기술 선택 근거",
        content: "비교한 대안과 선택 이유를 입력해주세요.",
      },
      quantified_result: {
        ...legacyPortfolio.quantified_result,
        summary: "결과와 수치를 입력해주세요.",
      },
    };
    const project = createPortfolioProjectDraft({ portfolio: placeholderPortfolio });
    const sections = getPortfolioProjectDisplaySections(project, { hidePlaceholders: true });

    expect(sections.find((section) => section.key === "problemDefinition")?.text).toBeNull();
    expect(sections.find((section) => section.key === "techDecision")?.text).toBeNull();
    expect(sections.find((section) => section.key === "result")?.text).toBeNull();
  });

  it("normalizes duplicate portfolio review tags for export", () => {
    const project = createPortfolioProjectDraft({
      portfolio: {
        ...legacyPortfolio,
        review_tags: ["[검토 필요]", "본인 경험으로 수정 필요"],
        missing_elements: ["정량적 성과", "역할 명확화"],
      },
    });

    expect(getPortfolioProjectReviewTags(project)).toEqual([
      "검토 필요",
      "본인 경험으로 수정 필요",
      "수치 보완 필요",
    ]);
  });

  it("updates image placement without changing project payload", () => {
    const project = createPortfolioProjectDraft({ portfolio: legacyPortfolio });
    const document = createPortfolioDocumentPayload({ title: "포트폴리오", projects: [project] });

    const updated = updatePortfolioImagePlacement(document, "activity-1-0", {
      sectionKey: "result",
      captionDraft: "성과 화면",
    });

    expect(updated.imagePlacements[0]).toMatchObject({
      sectionKey: "result",
      captionDraft: "성과 화면",
    });
    expect(updated.projects[0].portfolio.project_overview.title).toBe("실시간 매칭 플랫폼");
  });

  it("seeds editable section overrides from activity STAR evidence", () => {
    const activity: Activity = {
      id: "activity-1",
      user_id: "user-1",
      type: "프로젝트",
      title: "실시간 매칭 플랫폼",
      organization: "이소서",
      team_size: 3,
      team_composition: "백엔드 1, 프론트엔드 1, PM 1",
      my_role: "백엔드 개발",
      contributions: ["Redis 기반 매칭 큐 구현"],
      period: "2025.01 ~ 2025.03",
      role: "백엔드 개발",
      skills: ["FastAPI", "Redis"],
      description: "실시간 배차 경험을 개선한 프로젝트입니다.",
      star_situation: "수동 배차로 사용자 대기 시간이 길었습니다.",
      star_task: "대기 시간을 줄이는 자동 매칭 구조가 필요했습니다.",
      star_action: "Redis Sorted Set과 FastAPI로 매칭 API를 구현했습니다.",
      star_result: "매칭 시간을 75% 단축했습니다.",
      image_urls: [],
      is_visible: true,
      created_at: "2026-04-28T00:00:00.000Z",
      updated_at: "2026-04-28T00:00:00.000Z",
    };

    const project = createPortfolioProjectDraft({ portfolio: legacyPortfolio, activity });

    expect(project.sectionOverrides.projectTitle).toBe("실시간 매칭 플랫폼");
    expect(project.sectionOverrides.problemDefinition).toContain("수동 배차");
    expect(project.sectionOverrides.implementationSummary).toContain("Redis Sorted Set");
    expect(project.sectionOverrides.resultSummary).toContain("75%");
  });
});
