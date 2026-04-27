import { describe, expect, it } from "vitest";

import type { CoachFeedbackResponse } from "@/lib/types";

import { buildActivityCoachInsight } from "./activity-coach-insight";

const baseResponse: CoachFeedbackResponse = {
  session_id: "session-1",
  feedback: "문제 정의와 정량 성과를 보강해보세요.",
  structure_diagnosis: {
    has_problem_definition: false,
    has_tech_decision: true,
    has_quantified_result: false,
    has_role_clarification: true,
    has_implementation_detail: true,
    missing_elements: ["문제 정의", "정량적 성과"],
    priority_focus: "문제 정의",
  },
  rewrite_suggestions: [
    {
      text: "기존 주문 확인 과정의 오류를 줄이기 위해 확인 플로우를 개선하고 반복 실수를 낮췄습니다.",
      focus: "problem_definition",
      section: "문제 정의",
      rationale: "해결한 문제를 먼저 드러내야 합니다.",
      reference_pattern: "Problem - Cause - Action - Result",
    },
    {
      text: "주문 오류율을 수치로 보완하면 성과 크기가 더 명확해집니다.",
      focus: "quantification",
      section: "정량적 성과",
      rationale: "성과를 숫자로 확인할 수 있어야 합니다.",
      reference_pattern: null,
    },
  ],
  missing_elements: ["문제 정의", "정량적 성과"],
  iteration_count: 1,
  updated_history: [],
};

const completeResponse: CoachFeedbackResponse = {
  ...baseResponse,
  structure_diagnosis: {
    has_problem_definition: true,
    has_tech_decision: true,
    has_quantified_result: true,
    has_role_clarification: true,
    has_implementation_detail: true,
    missing_elements: [],
    priority_focus: "",
  },
  missing_elements: [],
};

describe("buildActivityCoachInsight", () => {
  it("returns an empty insight when response is missing", () => {
    const insight = buildActivityCoachInsight(null);

    expect(insight.hasInsight).toBe(false);
    expect(insight.diagnosisItems).toEqual([]);
    expect(insight.strengthPoints).toEqual([]);
    expect(insight.roleKeywords).toEqual([]);
    expect(insight.rewriteCandidates).toEqual([]);
  });

  it("maps structure diagnosis into ordered diagnosis cards", () => {
    const insight = buildActivityCoachInsight(baseResponse);

    expect(insight.hasInsight).toBe(true);
    expect(insight.priorityFocus).toBe("문제 정의");
    expect(insight.missingElements).toEqual(["문제 정의", "정량적 성과"]);

    expect(insight.diagnosisItems.map((item) => item.label)).toEqual([
      "프로젝트 개요",
      "문제 정의",
      "기술 선택 근거",
      "구현 디테일",
      "정량적 성과",
      "역할 명확화",
    ]);

    expect(insight.diagnosisItems.find((item) => item.key === "problem_definition")).toMatchObject({
      status: "missing",
      priority: true,
    });
    expect(insight.diagnosisItems.find((item) => item.key === "tech_decision")).toMatchObject({
      status: "strong",
      priority: false,
    });
  });

  it("creates coaching questions and risk flags from missing elements", () => {
    const insight = buildActivityCoachInsight(baseResponse);

    expect(insight.questions.map((item) => item.missingElement)).toEqual(["문제 정의", "정량적 성과"]);
    expect(insight.questions[0]?.question).toContain("어떤 문제");
    expect(insight.riskFlags).toContainEqual(
      expect.objectContaining({
        id: "missing-quantified-result",
        label: "수치 보완 필요",
      })
    );
  });

  it("normalizes rewrite suggestions for candidate UI", () => {
    const insight = buildActivityCoachInsight(baseResponse);

    expect(insight.rewriteCandidates).toHaveLength(2);
    expect(insight.rewriteCandidates[0]).toMatchObject({
      id: "question-answer-1-problem_definition",
      focus: "problem_definition",
      section: "문제 정의",
      referencePattern: null,
      needsUserCheck: false,
      starTarget: "situation",
      starTargetLabel: "Situation",
    });
    expect(insight.rewriteCandidates[0]?.rationale).toContain("보강 질문");
    expect(insight.rewriteCandidates[1]).toMatchObject({
      id: "question-answer-2-quantification",
      section: "정량적 성과",
      needsUserCheck: true,
      starTarget: "result",
      starTargetLabel: "Result",
    });
  });

  it("uses the suggestion section before focus when selecting the STAR target", () => {
    const insight = buildActivityCoachInsight({
      ...completeResponse,
      rewrite_suggestions: [
        {
          text: "3개월 내 오류율을 낮추는 것을 목표로 삼았습니다.",
          focus: "job_fit",
          section: "과제",
          rationale: "목표를 보강합니다.",
          reference_pattern: null,
        },
      ],
    });

    expect(insight.rewriteCandidates[0]).toMatchObject({
      starTarget: "task",
      starTargetLabel: "Task",
    });
  });

  it("hides STAR structure rewrite candidates because they duplicate the STAR form", () => {
    const insight = buildActivityCoachInsight({
      ...completeResponse,
      rewrite_suggestions: [
        {
          text: "프로젝트 배경과 맡은 역할을 먼저 제시한 뒤 결과를 한 문장으로 연결했습니다.",
          focus: "star_gap",
          section: "STAR 구조",
          rationale: "상황, 역할, 액션, 결과를 한 흐름으로 연결해야 합니다.",
          reference_pattern: null,
        },
      ],
    });

    expect(insight.rewriteCandidates).toEqual([]);
  });

  it("removes leaked activity context from rewrite candidate text", () => {
    const insight = buildActivityCoachInsight({
      ...completeResponse,
      rewrite_suggestions: [
        {
          text: [
            "기존 방식의 한계로 활동명: FoodRunner - 실시간 배달 매칭 플랫폼",
            "",
            "활동 유형: 프로젝트",
            "",
            "조직: FoodRunner",
            "",
            "STAR Result:",
            "성과: 일 15,000건 처리 / 매칭시간 75% 단축(12s->3s) / 완료율 94% / 장애 0건이 필요했고, 대안을 비교한 뒤 현재 방식을 선택해 운영 효율과 확장성을 높였습니다.",
          ].join("\n"),
          focus: "tech_decision",
          section: "기술적 의사결정",
          rationale: "대안 비교와 선택 이유가 있어야 합니다.",
          reference_pattern: null,
        },
      ],
    });

    expect(insight.rewriteCandidates).toHaveLength(1);
    expect(insight.rewriteCandidates[0]?.text).not.toContain("활동명:");
    expect(insight.rewriteCandidates[0]?.text).not.toContain("활동 유형:");
    expect(insight.rewriteCandidates[0]?.text).not.toContain("STAR Result:");
    expect(insight.rewriteCandidates[0]?.text).toContain("대안을 비교한 뒤");
  });

  it("answers the strengthening question before showing same-focus backend rewrite text", () => {
    const insight = buildActivityCoachInsight(
      {
        ...baseResponse,
        structure_diagnosis: {
          ...baseResponse.structure_diagnosis,
          has_tech_decision: false,
          missing_elements: ["기술 선택 근거"],
          priority_focus: "기술 선택 근거",
        },
        missing_elements: ["기술 선택 근거"],
        rewrite_suggestions: [
          {
            text: "성과: 일 15,000건 처리 / 매칭시간 75% 단축이 필요했고, 대안을 비교한 뒤 현재 방식을 선택했습니다.",
            focus: "tech_decision",
            section: "기술적 의사결정",
            rationale: "대안 비교와 선택 이유가 있어야 합니다.",
            reference_pattern: null,
          },
        ],
      },
      {
        activityTitle: "FoodRunner",
        targetRole: "백엔드 개발자",
        myRole: "백엔드 개발자",
        skills: ["Redis", "WebSocket", "FastAPI"],
        contributions: ["자동 매칭 엔진 설계"],
      }
    );

    expect(insight.questions[0]?.question).toContain("왜 그 기술");
    expect(insight.rewriteCandidates).toHaveLength(1);
    expect(insight.rewriteCandidates[0]).toMatchObject({
      id: "question-answer-1-tech_decision",
      focus: "tech_decision",
      section: "기술 선택 근거",
      starTarget: "action",
    });
    expect(insight.rewriteCandidates[0]?.text).toContain("Redis");
    expect(insight.rewriteCandidates[0]?.text).toContain("자동 매칭 엔진 설계");
    expect(insight.rewriteCandidates[0]?.text).toContain("선택했습니다");
    expect(insight.rewriteCandidates[0]?.text).not.toContain("성과:");
  });

  it("derives role keywords and strength points from activity context", () => {
    const insight = buildActivityCoachInsight(baseResponse, {
      targetRole: "백엔드 개발자",
      myRole: "API 설계",
      skills: ["Node.js", "PostgreSQL"],
      contributions: ["주문 상태 API 재설계", "반복 문의 감소"],
    });

    expect(insight.roleKeywords).toEqual(["백엔드", "개발자", "Node.js", "PostgreSQL", "API 설계"]);
    expect(insight.strengthPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "target-role-fit", label: "직무 기준 고정" }),
        expect.objectContaining({ id: "role-evidence", label: "내 역할 근거" }),
        expect.objectContaining({ id: "skill-evidence", label: "기술/실행 근거" }),
        expect.objectContaining({ id: "contribution-evidence", label: "기여 내용 근거" }),
      ])
    );
  });
});
