import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ActivityCoachInsight } from "../_lib/activity-coach-insight";

import { ActivityCoachInsightPanel } from "./activity-coach-insight-panel";

const insight: ActivityCoachInsight = {
  hasInsight: true,
  priorityFocus: "문제 정의",
  missingElements: ["문제 정의", "정량적 성과"],
  roleKeywords: ["백엔드", "Node.js"],
  strengthPoints: [
    {
      id: "target-role-fit",
      label: "직무 기준 고정",
      description: "백엔드 개발자 관점으로 표현과 강조 순서를 맞출 수 있습니다.",
    },
  ],
  diagnosisItems: [
    {
      key: "problem_definition",
      label: "문제 정의",
      status: "missing",
      reason: "처음에 어떤 문제나 비효율이 있었는지 더 적어야 합니다.",
      priority: true,
    },
    {
      key: "tech_decision",
      label: "기술 선택 근거",
      status: "strong",
      reason: "선택한 방식의 이유가 드러납니다.",
      priority: false,
    },
  ],
  questions: [
    {
      id: "question-problem",
      missingElement: "문제 정의",
      question: "처음에 어떤 문제를 해결하려고 했나요?",
    },
  ],
  rewriteCandidates: [
    {
      id: "rewrite-1",
      text: "반복 주문 오류를 줄이기 위해 확인 플로우를 개선했습니다.",
      focus: "problem_definition",
      section: "문제 정의",
      rationale: "해결한 문제를 먼저 드러내야 합니다.",
      referencePattern: null,
      needsUserCheck: false,
      starTarget: "situation",
      starTargetLabel: "Situation",
    },
  ],
  riskFlags: [
    {
      id: "missing-quantified-result",
      label: "수치 보완 필요",
      description: "성과 후보 문장에 숫자가 들어가면 사용자 확인이 필요합니다.",
    },
  ],
};

function renderPanel(value: ActivityCoachInsight) {
  return renderToStaticMarkup(React.createElement(ActivityCoachInsightPanel, { insight: value }));
}

describe("ActivityCoachInsightPanel", () => {
  it("renders diagnosis, questions, rewrite candidates, and risk flags", () => {
    const html = renderPanel(insight);

    expect(html).toContain("코칭 진단");
    expect(html).toContain("우선 보강: 문제 정의");
    expect(html).toContain("살릴 포인트");
    expect(html).toContain("직무 기준 고정");
    expect(html).toContain("Node.js");
    expect(html).toContain("보강 질문");
    expect(html).toContain("처음에 어떤 문제를 해결하려고 했나요?");
    expect(html).toContain("문장 후보");
    expect(html).toContain("반복 주문 오류를 줄이기 위해");
    expect(html).toContain("수치 보완 필요");
  });

  it("renders description apply buttons only when an apply handler is provided", () => {
    expect(renderPanel(insight)).not.toContain("소개글에 적용");

    const html = renderToStaticMarkup(
      React.createElement(ActivityCoachInsightPanel, {
        insight,
        onApplyToDescription: () => undefined,
      })
    );

    expect(html).toContain("소개글에 적용");
  });

  it("renders STAR apply buttons only when a STAR apply handler is provided", () => {
    expect(renderPanel(insight)).not.toContain("Situation에 적용");

    const html = renderToStaticMarkup(
      React.createElement(ActivityCoachInsightPanel, {
        insight,
        onApplyToStar: () => undefined,
      })
    );

    expect(html).toContain("Situation에 적용");
  });

  it("renders contribution apply buttons only when a contribution apply handler is provided", () => {
    expect(renderPanel(insight)).not.toContain("기여내용에 추가");

    const html = renderToStaticMarkup(
      React.createElement(ActivityCoachInsightPanel, {
        insight,
        onApplyToContribution: () => undefined,
      })
    );

    expect(html).toContain("기여내용에 추가");
  });

  it("renders nothing when insight is empty", () => {
    const html = renderPanel({
      hasInsight: false,
      priorityFocus: null,
      missingElements: [],
      roleKeywords: [],
      strengthPoints: [],
      diagnosisItems: [],
      questions: [],
      rewriteCandidates: [],
      riskFlags: [],
    });

    expect(html).toBe("");
  });

  it("renders a diagnosis preview placeholder when requested", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityCoachInsightPanel, {
        insight: {
          hasInsight: false,
          priorityFocus: null,
          missingElements: [],
          roleKeywords: [],
          strengthPoints: [],
          diagnosisItems: [],
          questions: [],
          rewriteCandidates: [],
          riskFlags: [],
        },
        showPlaceholder: true,
      })
    );

    expect(html).toContain("STAR 작성후 AI 코치의 진단을 받아보세요!");
    expect(html).toContain("문제 정의");
    expect(html).toContain("예시 문장 후보");
  });
});
