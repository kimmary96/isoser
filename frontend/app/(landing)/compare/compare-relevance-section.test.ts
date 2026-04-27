import { describe, expect, it } from "vitest";

import { getFitStage } from "./compare-relevance-section";

describe("getFitStage", () => {
  it("maps career fit scores to the adjusted five-stage thresholds", () => {
    expect(getFitStage(undefined)).toBe(1);
    expect(getFitStage(0.19)).toBe(1);
    expect(getFitStage(0.2)).toBe(2);
    expect(getFitStage(0.4)).toBe(3);
    expect(getFitStage(0.55)).toBe(4);
    expect(getFitStage(0.7)).toBe(5);
  });
});
