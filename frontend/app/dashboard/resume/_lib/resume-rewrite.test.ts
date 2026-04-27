import { describe, expect, it } from "vitest";

import {
  addResumeRewriteLine,
  appendJobPostingText,
  applyResumeRewriteLine,
  canRequestResumeRewrite,
  clearResumeRewriteLine,
  isResumeRewriteSuggestionApplied,
  mapResumeRewriteActivityTitles,
  normalizeResumeRewriteText,
  removeResumeRewriteLine,
  resolveResumeRewriteSectionType,
  updateResumeRewriteLine,
} from "./resume-rewrite";

describe("resume rewrite helpers", () => {
  it("appends extracted posting text without losing pasted text", () => {
    expect(appendJobPostingText("기존 공고", "추출 공고")).toBe("기존 공고\n\n---\n\n추출 공고");
    expect(appendJobPostingText("", "추출 공고")).toBe("추출 공고");
    expect(appendJobPostingText("기존 공고", "   ")).toBe("기존 공고");
  });

  it("uses a concrete section type only when selected activities share one type", () => {
    expect(resolveResumeRewriteSectionType([{ type: "회사경력" }, { type: "회사경력" }])).toBe(
      "회사경력"
    );
    expect(resolveResumeRewriteSectionType([{ type: "회사경력" }, { type: "프로젝트" }])).toBe(
      "요약"
    );
  });

  it("maps selected activity ids to titles for rewrite result rendering", () => {
    expect(
      mapResumeRewriteActivityTitles([
        { id: "a1", title: "API 개선" },
        { id: "a2", title: "캐시 도입" },
      ])
    ).toEqual({
      a1: "API 개선",
      a2: "캐시 도입",
    });
  });

  it("requires selected activities, target role, posting text, and idle state", () => {
    expect(
      canRequestResumeRewrite({
        selectedCount: 1,
        targetJob: "백엔드 개발자",
        jobPostingText:
          "백엔드 개발자를 채용합니다. Python과 FastAPI 기반 API 설계, 성능 최적화, 장애 대응 경험을 중요하게 봅니다.",
        loading: false,
      })
    ).toBe(true);
    expect(
      canRequestResumeRewrite({
        selectedCount: 0,
        targetJob: "백엔드 개발자",
        jobPostingText:
          "백엔드 개발자를 채용합니다. Python과 FastAPI 기반 API 설계, 성능 최적화, 장애 대응 경험을 중요하게 봅니다.",
        loading: false,
      })
    ).toBe(false);
  });

  it("normalizes rewrite text for preview application", () => {
    expect(normalizeResumeRewriteText("  - 공고 키워드에 맞춘   성과 문장  ")).toBe(
      "공고 키워드에 맞춘 성과 문장"
    );
    expect(normalizeResumeRewriteText("• 정량 성과를 강조한 문장")).toBe(
      "정량 성과를 강조한 문장"
    );
  });

  it("applies and clears a selected rewrite line by activity", () => {
    const initial = { a1: ["기존 적용 문장"] };
    const applied = applyResumeRewriteLine(initial, "a2", "  - 신규 후보 문장  ");

    expect(applied).toEqual({
      a1: ["기존 적용 문장"],
      a2: ["신규 후보 문장"],
    });
    expect(initial).toEqual({ a1: ["기존 적용 문장"] });
    expect(isResumeRewriteSuggestionApplied(applied, "a2", "신규 후보 문장")).toBe(true);
    expect(clearResumeRewriteLine(applied, "a2")).toEqual({ a1: ["기존 적용 문장"] });
  });

  it("edits applied rewrite lines without dropping the whole draft", () => {
    const initial = { a1: ["첫 문장"] };
    const added = addResumeRewriteLine(initial, "a1");
    const updated = updateResumeRewriteLine(added, "a1", 1, "  - 추가 문장  ");

    expect(updated).toEqual({ a1: ["첫 문장", "추가 문장  "] });
    expect(removeResumeRewriteLine(updated, "a1", 0)).toEqual({ a1: ["추가 문장  "] });
    expect(removeResumeRewriteLine({ a1: ["마지막 문장"] }, "a1", 0)).toEqual({});
  });
});
