import { describe, expect, it } from "vitest";

import { hasTrustedProgramDeadline } from "./program-display";
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
