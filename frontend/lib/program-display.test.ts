import { describe, expect, it } from "vitest";

import {
  formatProgramDateRangeLabel,
  formatProgramCostLabel,
  formatProgramScheduleLabel,
  getProgramOutOfPocketAmount,
  getProgramDeadlineBadgeData,
  getProgramRatingDisplay,
  getProgramTrainingModeLabel,
  hasTomorrowLearningCardRequirement,
  hasTrustedProgramDeadline,
} from "./program-display";
import type { CompareMeta } from "./types";

function createProgram(
  overrides: {
    deadline?: string | null;
    end_date?: string | null;
    source?: string | null;
    deadline_confidence?: "high" | "medium" | "low" | null;
    compare_meta?: CompareMeta | null;
  } = {}
) {
  return {
    deadline: "2026-05-10",
    end_date: "2026-06-10",
    source: "고용24",
    deadline_confidence: "high" as const,
    compare_meta: null,
    ...overrides,
  };
}

describe("program deadline trust helper", () => {
  it("rejects rows without deadline or with low confidence", () => {
    expect(hasTrustedProgramDeadline(createProgram({ deadline: null }))).toBe(false);
    expect(
      hasTrustedProgramDeadline(createProgram({ deadline_confidence: "low" }))
    ).toBe(false);
  });

  it("rejects work24 rows when deadline only mirrors training end date", () => {
    expect(
      hasTrustedProgramDeadline(
        createProgram({
          deadline: "2026-06-10",
          end_date: "2026-06-10",
          compare_meta: null,
        })
      )
    ).toBe(false);
  });

  it("keeps work24 rows when compare_meta has explicit deadline evidence", () => {
    expect(
      hasTrustedProgramDeadline(
        createProgram({
          deadline: "2026-06-10",
          end_date: "2026-06-10",
          compare_meta: {
            deadline_source: "traStartDate",
          },
        })
      )
    ).toBe(true);

    expect(
      hasTrustedProgramDeadline(
        createProgram({
          deadline: "2026-06-10",
          end_date: "2026-06-10",
          compare_meta: {
            application_deadline: "2026-06-10",
          },
        })
      )
    ).toBe(true);
  });

  it("keeps non-work24 rows with a normal deadline", () => {
    expect(
      hasTrustedProgramDeadline(
        createProgram({
          source: "K-Startup",
          deadline: "2026-05-01",
          end_date: "2026-06-10",
        })
      )
    ).toBe(true);
  });
});

describe("program display legacy compare_meta bridge", () => {
  it("keeps compare_meta-based display fallbacks through the shared helper", () => {
    const program = {
      cost: null,
      support_type: null,
      subsidy_amount: null,
      teaching_method: null,
      application_method: null,
      location: null,
      title: "청년 디지털 부트캠프",
      summary: "내일배움 기반 실무 과정",
      description: "기초부터 실무 프로젝트까지",
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: {
        subsidy_rate: "전액 지원",
        teaching_method: "온라인",
        satisfaction_score: "91.4",
        naeilbaeumcard_required: true,
      } satisfies CompareMeta,
    };

    expect(formatProgramCostLabel(program)).toBe("전액 지원");
    expect(getProgramTrainingModeLabel(program)).toBe("온라인");
    expect(getProgramRatingDisplay(program)).toBe("4.6");
    expect(hasTomorrowLearningCardRequirement(program)).toBe(true);
  });

  it("prefers out-of-pocket amounts over total training cost when available", () => {
    const program = {
      cost: 1000000,
      subsidy_amount: 22730,
      support_type: "훈련비 지원",
      teaching_method: "온라인",
      application_method: null,
      location: "온라인",
      title: "AI 과정",
      summary: null,
      description: null,
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: null,
    };

    expect(getProgramOutOfPocketAmount(program)).toBe(22730);
    expect(formatProgramCostLabel(program)).toBe("22,730원");
  });

  it("prefers compare_meta self-payment over subsidy_amount when both are present", () => {
    const program = {
      cost: 265980,
      subsidy_amount: 265980,
      support_type: "훈련비 지원",
      teaching_method: "오프라인",
      application_method: null,
      location: "부산",
      title: "스케치업 과정",
      summary: null,
      description: null,
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: {
        self_payment: "93,100",
      } satisfies CompareMeta,
    };

    expect(getProgramOutOfPocketAmount(program)).toBe(93100);
    expect(formatProgramCostLabel(program)).toBe("93,100원");
  });

  it("accepts support_amount and camelCase compare_meta cost keys as out-of-pocket evidence", () => {
    const directProgram = {
      cost: 265980,
      support_amount: 93100,
      subsidy_amount: 265980,
      support_type: "훈련비 지원",
      teaching_method: "오프라인",
      application_method: null,
      location: "부산",
      source: "고용24",
      title: "스케치업 과정",
      summary: null,
      description: null,
      deadline: null,
      start_date: null,
      end_date: null,
      days_left: null,
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: null,
    };

    const metaProgram = {
      ...directProgram,
      support_amount: null,
      compare_meta: {
        outOfPocketAmount: "93,100",
      } satisfies CompareMeta,
    };

    expect(getProgramOutOfPocketAmount(directProgram)).toBe(93100);
    expect(formatProgramCostLabel(directProgram)).toBe("93,100원");
    expect(getProgramOutOfPocketAmount(metaProgram)).toBe(93100);
    expect(formatProgramCostLabel(metaProgram)).toBe("93,100원");
  });

  it("prefers verified_self_pay_amount when read-model rows expose it explicitly", () => {
    const program = {
      cost: 265980,
      verified_self_pay_amount: 93100,
      support_amount: 265980,
      subsidy_amount: 265980,
      support_type: "훈련비 지원",
      teaching_method: "오프라인",
      application_method: null,
      location: "부산",
      source: "고용24",
      title: "스케치업 과정",
      summary: null,
      description: null,
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: null,
    };

    expect(getProgramOutOfPocketAmount(program)).toBe(93100);
    expect(formatProgramCostLabel(program)).toBe("93,100원");
  });

  it("does not show total training cost as out-of-pocket when work24 self-payment evidence is missing", () => {
    const program = {
      cost: 265980,
      subsidy_amount: 265980,
      support_type: "훈련비 지원",
      teaching_method: "오프라인",
      application_method: null,
      location: "부산",
      source: "고용24",
      title: "스케치업 과정",
      summary: null,
      description: null,
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: null,
    };

    expect(getProgramOutOfPocketAmount(program)).toBeNull();
    expect(formatProgramCostLabel(program)).toBe("자부담 정보 확인 필요");
  });

});

describe("program schedule display helpers", () => {
  it("keeps work24 training periods as schedule labels", () => {
    const program = {
      source: "고용24",
      title: "바리스타 과정",
      summary: null,
      description: null,
      deadline: "2026-04-29",
      start_date: "2026-04-29",
      end_date: "2026-06-10",
      cost: null,
      support_amount: null,
      support_type: null,
      subsidy_amount: null,
      teaching_method: null,
      application_method: null,
      location: null,
      days_left: 3,
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: null,
    };

    expect(formatProgramScheduleLabel(program)).toBe("2026-04-29 ~ 2026-06-10");
  });

  it("prefers explicit non-work24 program schedule metadata over application period-like row dates", () => {
    const program = {
      source: "도봉구청년창업센터",
      title: "모두의 창업 설명회",
      summary: null,
      description: null,
      deadline: "2026-04-26",
      start_date: "2026-04-13",
      end_date: "2026-04-26",
      cost: null,
      support_amount: null,
      support_type: null,
      subsidy_amount: null,
      teaching_method: null,
      application_method: null,
      location: null,
      days_left: 0,
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: {
        application_start_date: "2026-04-13",
        application_end_date: "2026-04-26",
        program_start_date: "2026-04-29",
        program_end_date: "2026-04-29",
      } satisfies CompareMeta,
    };

    expect(formatProgramScheduleLabel(program)).toBe("2026-04-29");
  });

  it("avoids showing non-work24 application periods as schedule labels when no real schedule is present", () => {
    const program = {
      source: "지역 창업센터",
      title: "창업 프로그램",
      summary: null,
      description: null,
      deadline: "2026-04-26",
      start_date: "2026-04-13",
      end_date: "2026-04-26",
      cost: null,
      support_amount: null,
      support_type: null,
      subsidy_amount: null,
      teaching_method: null,
      application_method: null,
      location: null,
      days_left: 0,
      rating: null,
      rating_display: null,
      review_count: 0,
      compare_meta: null,
    };

    expect(formatProgramScheduleLabel(program)).toBe("일정 확인 필요");
  });

  it("formats same-day ranges as a single date label", () => {
    expect(
      formatProgramDateRangeLabel("2026-04-29", "2026-04-29", {
        sameDaySingleLabel: true,
      })
    ).toBe("2026-04-29");
  });
});

describe("program deadline badge helpers", () => {
  it("returns consistent D-day labels for cards", () => {
    expect(getProgramDeadlineBadgeData({ days_left: 10, deadline: null })).toEqual({
      label: "D-10",
      tone: "normal",
    });
    expect(getProgramDeadlineBadgeData({ days_left: 4, deadline: null })).toEqual({
      label: "D-4",
      tone: "warning",
    });
    expect(getProgramDeadlineBadgeData({ days_left: 0, deadline: null })).toEqual({
      label: "D-Day",
      tone: "critical",
    });
  });
});
