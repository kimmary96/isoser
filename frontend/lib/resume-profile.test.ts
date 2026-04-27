import { describe, expect, it } from "vitest";

import {
  getResumeProfileHighlightSections,
  isMissingResumeProfileColumnError,
  normalizeResumeBuilderProfile,
} from "./resume-profile";

describe("resume profile helpers", () => {
  it("normalizes profile arrays used by the resume builder", () => {
    expect(
      normalizeResumeBuilderProfile({
        name: "홍길동",
        bio: "백엔드 개발자",
        avatar_url: null,
        email: "user@example.com",
        phone: "010-0000-0000",
        self_intro: "문제 해결 중심 개발자",
        skills: ["Python", "Python", " FastAPI "],
        awards: ["해커톤 대상"],
        certifications: "정보처리기사, SQLD",
        languages: "TOEIC 900\nOPIc IH",
      })
    ).toMatchObject({
      name: "홍길동",
      skills: ["Python", "FastAPI"],
      awards: ["해커톤 대상"],
      certifications: ["정보처리기사", "SQLD"],
      languages: ["TOEIC 900", "OPIc IH"],
    });
  });

  it("builds compact highlight sections in resume priority order", () => {
    const sections = getResumeProfileHighlightSections({
      awards: ["해커톤 대상"],
      certifications: ["정보처리기사"],
      languages: ["TOEIC 900"],
    });

    expect(sections.map((section) => section.key)).toEqual([
      "awards",
      "certifications",
      "languages",
    ]);
  });

  it("recognizes optional profile column drift for fallback queries", () => {
    expect(isMissingResumeProfileColumnError({ code: "42703", message: "missing" })).toBe(true);
    expect(
      isMissingResumeProfileColumnError({
        code: "PGRST204",
        message: "Could not find the 'awards' column",
      })
    ).toBe(true);
    expect(isMissingResumeProfileColumnError({ code: "42501", message: "permission" })).toBe(
      false
    );
  });
});
