import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROGRAM_SORT,
  normalizeProgramSort,
  PROGRAM_SORT_LABELS,
  PROGRAM_SORT_OPTIONS,
} from "./program-sort";

describe("program sort contract", () => {
  it("keeps labels and filter options in sync, including popular", () => {
    const sortValues = PROGRAM_SORT_OPTIONS.map((option) => option.value);

    expect(sortValues).toContain("popular");
    expect(PROGRAM_SORT_LABELS.popular).toBe("인기순");
    expect(sortValues).toEqual(Object.keys(PROGRAM_SORT_LABELS));
  });

  it("normalizes unknown sort query values to the default sort", () => {
    expect(normalizeProgramSort("popular")).toBe("popular");
    expect(normalizeProgramSort(["deadline", "cost_low"])).toBe("deadline");
    expect(normalizeProgramSort("not-a-sort")).toBe(DEFAULT_PROGRAM_SORT);
    expect(normalizeProgramSort(undefined)).toBe(DEFAULT_PROGRAM_SORT);
  });
});
