import { describe, expect, it } from "vitest";

import {
  formatProgramCostLabel,
  getProgramOutOfPocketAmount,
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
});
