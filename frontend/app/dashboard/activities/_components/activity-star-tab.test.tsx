import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActivityStarTab } from "./activity-star-tab";

function renderStarTab(options?: Partial<React.ComponentProps<typeof ActivityStarTab>>) {
  return renderToStaticMarkup(
    React.createElement(ActivityStarTab, {
      starSituation: "",
      onStarSituationChange: () => undefined,
      starTask: "",
      onStarTaskChange: () => undefined,
      starAction: "",
      onStarActionChange: () => undefined,
      starResult: "",
      onStarResultChange: () => undefined,
      starSaving: false,
      canImportBasicInfo: true,
      onImportBasicInfo: () => undefined,
      onStarSave: async () => undefined,
      ...options,
    })
  );
}

describe("ActivityStarTab", () => {
  it("renders the basic info import action before STAR fields", () => {
    const html = renderStarTab();

    expect(html).toContain("기본정보 가져오기");
    expect(html).toContain("기본정보의 활동명, 역할, 사용 기술, 기여내용");
    expect(html.indexOf("기본정보 가져오기")).toBeLessThan(html.indexOf("S - Situation"));
  });

  it("disables basic info import when there is no source content", () => {
    const html = renderStarTab({ canImportBasicInfo: false });

    expect(html).toContain("disabled");
  });

  it("does not render the old STAR summary generation action", () => {
    const html = renderStarTab({ starSituation: "문제 상황" });

    expect(html).not.toContain("AI 요약 생성");
    expect(html).not.toContain("STAR 내용을 분석해 활동 소개");
  });
});
