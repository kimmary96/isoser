import { describe, expect, it } from "vitest";

import {
  hasResumeActivityLineOverrides,
  normalizeResumeActivityLineOverrides,
  normalizeResumeLineText,
} from "./resume-line-overrides";

describe("resume line overrides", () => {
  it("normalizes single resume bullet text", () => {
    expect(normalizeResumeLineText("  - 공고 키워드에 맞춘   성과 문장  ")).toBe(
      "공고 키워드에 맞춘 성과 문장"
    );
    expect(normalizeResumeLineText("• 정량 성과 강조")).toBe("정량 성과 강조");
  });

  it("normalizes persisted activity line override payloads", () => {
    expect(
      normalizeResumeActivityLineOverrides({
        " a1 ": [" - 첫 번째 문장 ", "첫 번째 문장", "", 42],
        a2: "문자열 하나도 배열로 정규화",
        a3: null,
      })
    ).toEqual({
      a1: ["첫 번째 문장"],
      a2: ["문자열 하나도 배열로 정규화"],
    });
  });

  it("rejects non-object override payloads", () => {
    expect(normalizeResumeActivityLineOverrides(null)).toEqual({});
    expect(normalizeResumeActivityLineOverrides(["문장"])).toEqual({});
  });

  it("detects whether any override line exists", () => {
    expect(hasResumeActivityLineOverrides({})).toBe(false);
    expect(hasResumeActivityLineOverrides({ a1: [] })).toBe(false);
    expect(hasResumeActivityLineOverrides({ a1: ["   "] })).toBe(false);
    expect(hasResumeActivityLineOverrides({ a1: ["문장"] })).toBe(true);
  });
});
