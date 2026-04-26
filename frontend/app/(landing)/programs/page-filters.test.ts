import { describe, expect, it } from "vitest";

import {
  canonicalizeSourceFilterOption,
  dynamicOrFallbackOptions,
  normalizeNamedOptions,
  SOURCE_OPTIONS,
} from "./page-filters";

describe("programs page filters", () => {
  it("canonicalizes dynamic K-Startup source values to the shared query value", () => {
    const sourceOptions = dynamicOrFallbackOptions(
      [{ value: "K-Startup 창업진흥원", label: "K-Startup 창업진흥원" }],
      SOURCE_OPTIONS,
      canonicalizeSourceFilterOption
    );

    expect(sourceOptions).toEqual([
      { value: "kstartup", label: "K-Startup" },
      { value: "고용24", label: "고용24" },
      { value: "sesac", label: "SeSAC" },
      { value: "other", label: "기타 기관" },
    ]);
    expect(normalizeNamedOptions("kstartup", sourceOptions)).toEqual(["kstartup"]);
  });

  it("canonicalizes dynamic 고용24 source values without changing the label contract", () => {
    const sourceOptions = dynamicOrFallbackOptions(
      [{ value: "고용24", label: "고용24" }],
      SOURCE_OPTIONS,
      canonicalizeSourceFilterOption
    );

    expect(sourceOptions).toEqual([
      { value: "고용24", label: "고용24" },
      { value: "kstartup", label: "K-Startup" },
      { value: "sesac", label: "SeSAC" },
      { value: "other", label: "기타 기관" },
    ]);
    expect(normalizeNamedOptions("고용24", sourceOptions)).toEqual(["고용24"]);
  });

  it("keeps canonical source options even when the current facet snapshot omits them", () => {
    const sourceOptions = dynamicOrFallbackOptions(
      [
        { value: "고용24", label: "고용24" },
        { value: "K-Startup 창업진흥원", label: "K-Startup 창업진흥원" },
      ],
      SOURCE_OPTIONS,
      canonicalizeSourceFilterOption
    );

    expect(sourceOptions.map((option) => option.value)).toEqual(["고용24", "kstartup", "sesac", "other"]);
  });

  it("keeps 기타 기관 as the catch-all source filter value", () => {
    const sourceOptions = dynamicOrFallbackOptions(
      [{ value: "other", label: "기타 기관" }],
      SOURCE_OPTIONS,
      canonicalizeSourceFilterOption
    );

    expect(sourceOptions).toContainEqual({ value: "other", label: "기타 기관" });
    expect(normalizeNamedOptions("other", sourceOptions)).toEqual(["other"]);
  });
});
