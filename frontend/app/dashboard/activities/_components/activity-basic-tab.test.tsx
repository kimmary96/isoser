import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Activity } from "@/lib/types";

import { ActivityBasicTab } from "./activity-basic-tab";

const activity: Activity = {
  id: "activity-1",
  user_id: "user-1",
  type: "프로젝트",
  title: "FoodRunner",
  period: null,
  role: null,
  skills: null,
  description: null,
  is_visible: true,
  created_at: "2026-04-28T00:00:00.000Z",
  updated_at: "2026-04-28T00:00:00.000Z",
};

function renderBasicTab(options?: Partial<React.ComponentProps<typeof ActivityBasicTab>>) {
  return renderToStaticMarkup(
    React.createElement(ActivityBasicTab, {
      activity,
      typeDraft: "프로젝트",
      onTypeDraftChange: () => undefined,
      organization: "FoodRunner",
      onOrganizationChange: () => undefined,
      periodStart: "2025.03",
      onPeriodStartChange: () => undefined,
      periodEnd: "2025.07",
      onPeriodEndChange: () => undefined,
      teamSize: 5,
      onTeamSizeChange: () => undefined,
      teamComposition: "백엔드 2 / 프론트 1",
      onTeamCompositionChange: () => undefined,
      myRole: "백엔드 개발자",
      onMyRoleChange: () => undefined,
      skillsDraft: ["Redis"],
      skillInput: "",
      onSkillInputChange: () => undefined,
      skillSuggestions: [],
      skillSuggestionRoleLabel: null,
      skillSuggestionLoading: false,
      skillSuggestionError: null,
      isSkillSelected: () => false,
      onSkillAdd: async () => undefined,
      onSkillRemove: () => undefined,
      onSuggestedSkillToggle: () => undefined,
      contributions: ["Redis 자동 매칭 엔진 설계"],
      onContributionChange: () => undefined,
      onContributionAdd: () => undefined,
      onContributionRemove: () => undefined,
      descriptionDraft: "",
      onDescriptionDraftChange: () => undefined,
      hasContributionContent: true,
      introGenerateLoading: false,
      introGenerateError: null,
      introCandidates: [],
      onGenerateIntroCandidates: async () => undefined,
      imageUrls: [],
      imageUploading: false,
      onImageUpload: async () => undefined,
      onImageRemove: () => undefined,
      basicSaving: false,
      onSaveBasicInfo: async () => undefined,
      ...options,
    })
  );
}

describe("ActivityBasicTab", () => {
  it("renders basic-info based intro generation for existing and new activities", () => {
    const html = renderBasicTab();

    expect(html).toContain("간단 소개글 생성");
    expect(html).toContain("기본정보와 기여내용만으로 AI가 소개글 후보");
  });

  it("disables intro generation until contribution content exists", () => {
    const html = renderBasicTab({
      contributions: [""],
      hasContributionContent: false,
    });

    expect(html).toContain("간단 소개글 생성");
    expect(html).toContain("disabled");
  });
});
