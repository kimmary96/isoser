import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActivityCoachPanel } from "./activity-coach-panel";

function renderPanel(options?: Partial<React.ComponentProps<typeof ActivityCoachPanel>>) {
  return renderToStaticMarkup(
    React.createElement(ActivityCoachPanel, {
      jobTitle: "AI 서비스 기획자",
      onJobTitleChange: () => undefined,
      messages: options?.messages ?? [],
      sending: false,
      diagnosisLoading: false,
      canRunDiagnosis: false,
      input: "",
      onInputChange: () => undefined,
      onSendMessage: async () => undefined,
      onRunDiagnosis: async () => undefined,
      ...options,
    })
  );
}

describe("ActivityCoachPanel", () => {
  it("keeps diagnosis out of the chat panel", () => {
    const html = renderPanel();

    expect(html).toContain("AI 코치");
    expect(html).toContain("코칭 진단");
    expect(html).not.toContain("우선 보강");
    expect(html).not.toContain("문장 후보");
  });

  it("enables diagnosis button only when STAR draft is complete", () => {
    expect(renderPanel()).toContain("STAR 4개 항목을 모두 채우면 진단할 수 있습니다.");
    expect(renderPanel({ canRunDiagnosis: true })).not.toContain(
      "STAR 4개 항목을 모두 채우면 진단할 수 있습니다."
    );
  });

  it("wraps long assistant messages instead of expanding horizontally", () => {
    const html = renderPanel({
      messages: [
        {
          role: "assistant",
          content: "https://ai.google.dev/gemini-api/docs/rate-limits/very-long-provider-url",
        },
      ],
    });

    expect(html).toContain("[overflow-wrap:anywhere]");
    expect(html).toContain("overflow-x-hidden");
  });

  it("stretches to the grid row height instead of using a separate fixed height", () => {
    const html = renderPanel();

    expect(html).toContain("h-full");
    expect(html).toContain("min-h-[640px]");
    expect(html).not.toContain("xl:h-[720px]");
  });
});
