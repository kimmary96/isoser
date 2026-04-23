import { describe, expect, it } from "vitest";

import type { Program } from "@/lib/types";

import {
  buildProgramsDisplayState,
  formatProgramParticipationTime,
  getSelectionKeywordTone,
  mergeProgramsForDisplay,
  shouldPinPromotedPrograms,
} from "./page-helpers";

function createProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: overrides.id ?? "program-1",
    title: overrides.title ?? "프로그램",
    category: overrides.category ?? "AI",
    location: overrides.location ?? "서울",
    provider: overrides.provider ?? "테스트 기관",
    summary: overrides.summary ?? null,
    tags: overrides.tags ?? [],
    skills: overrides.skills ?? [],
    source: overrides.source ?? "고용24",
    ...overrides,
  };
}

describe("programs page helpers", () => {
  it("extracts total training hours for participation display when available", () => {
    expect(
      formatProgramParticipationTime({
        participation_mode_label: "풀타임",
        participation_time: "full-time",
        participation_time_text: "주중 / 16일 · 총 48시간",
      })
    ).toEqual({
      label: "풀타임",
      detail: "48시간",
    });
  });

  it("pins promoted programs only on the default all-programs view", () => {
    expect(
      shouldPinPromotedPrograms({
        q: "",
        selectedCategoryId: "all",
        selectedRegionsCount: 0,
        selectedTeachingMethodsCount: 0,
        selectedCostTypesCount: 0,
        selectedParticipationTimesCount: 0,
        selectedSourcesCount: 0,
        selectedTargetsCount: 0,
        showClosedRecent: false,
        sort: "default",
      })
    ).toBe(true);

    expect(
      shouldPinPromotedPrograms({
        q: "",
        selectedCategoryId: "data-ai",
        selectedRegionsCount: 0,
        selectedTeachingMethodsCount: 0,
        selectedCostTypesCount: 0,
        selectedParticipationTimesCount: 0,
        selectedSourcesCount: 0,
        selectedTargetsCount: 0,
        showClosedRecent: false,
        sort: "default",
      })
    ).toBe(false);
  });

  it("merges promoted programs into the main list without duplicates", () => {
    const promoted = [createProgram({ id: "ad-1", title: "스폰서 A" }), createProgram({ id: "ad-2", title: "스폰서 B" })];
    const organic = [createProgram({ id: "organic-1", title: "일반 A" }), createProgram({ id: "ad-2", title: "스폰서 B" })];

    expect(
      mergeProgramsForDisplay({
        organicPrograms: organic,
        promotedPrograms: promoted,
        pinPromoted: true,
      }).map((program) => program.id)
    ).toEqual(["ad-1", "ad-2", "organic-1"]);

    expect(
      mergeProgramsForDisplay({
        organicPrograms: organic,
        promotedPrograms: promoted,
        pinPromoted: false,
      }).map((program) => program.id)
    ).toEqual(["organic-1", "ad-2", "ad-1"]);
  });

  it("assigns different tones to different keyword families", () => {
    expect(getSelectionKeywordTone("면접")).toBe("bg-rose-50 text-rose-700");
    expect(getSelectionKeywordTone("코딩테스트")).toBe("bg-violet-50 text-violet-700");
    expect(getSelectionKeywordTone("Python")).toBe("bg-sky-50 text-sky-700");
    expect(getSelectionKeywordTone("멘토링")).toBe("bg-emerald-50 text-emerald-700");
  });

  it("keeps urgent rail on strict D-7 programs when available", () => {
    const state = buildProgramsDisplayState({
      programs: [createProgram({ id: "organic", days_left: 4 })],
      promotedPrograms: [createProgram({ id: "ad", days_left: 2 })],
      urgentPrograms: [
        createProgram({ id: "strict-1", days_left: 1 }),
        createProgram({ id: "strict-2", days_left: 6 }),
        createProgram({ id: "late", days_left: 12 }),
      ],
      q: "",
      selectedCategoryId: "all",
      selectedRegionsCount: 0,
      selectedTeachingMethodsCount: 0,
      selectedCostTypesCount: 0,
      selectedParticipationTimesCount: 0,
      selectedSourcesCount: 0,
      selectedTargetsCount: 0,
      showClosedRecent: false,
      sort: "default",
    });

    expect(state.displayUrgentPrograms.map((program) => program.id)).toEqual(["strict-1", "strict-2"]);
    expect(state.urgentProgramsUseStrictWindow).toBe(true);
    expect(state.urgentProgramsUseUpcomingFallback).toBe(false);
  });

  it("falls back to upcoming programs when no strict urgent rows exist", () => {
    const state = buildProgramsDisplayState({
      programs: [createProgram({ id: "organic", days_left: 11 })],
      promotedPrograms: [],
      urgentPrograms: [
        createProgram({ id: "upcoming-1", days_left: 9 }),
        createProgram({ id: "upcoming-2", days_left: 15 }),
      ],
      q: "",
      selectedCategoryId: "all",
      selectedRegionsCount: 0,
      selectedTeachingMethodsCount: 0,
      selectedCostTypesCount: 0,
      selectedParticipationTimesCount: 0,
      selectedSourcesCount: 0,
      selectedTargetsCount: 0,
      showClosedRecent: false,
      sort: "default",
    });

    expect(state.displayUrgentPrograms.map((program) => program.id)).toEqual(["upcoming-1", "upcoming-2"]);
    expect(state.urgentProgramsUseStrictWindow).toBe(false);
    expect(state.urgentProgramsUseUpcomingFallback).toBe(true);
  });
});
