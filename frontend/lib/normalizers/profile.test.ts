import { describe, expect, it } from "vitest";

import {
  buildTargetJobFields,
  parseProfileAddress,
  resolveProfileTargetJob,
} from "./profile";

describe("profile normalizers", () => {
  it("builds normalized target job fields from free-form input", () => {
    expect(buildTargetJobFields("  Data   Engineer  ")).toEqual({
      target_job: "Data Engineer",
      target_job_normalized: "data engineer",
    });

    expect(buildTargetJobFields("   ")).toEqual({
      target_job: null,
      target_job_normalized: null,
    });
  });

  it("parses region and district from a known address", () => {
    expect(parseProfileAddress("서울특별시 강남구 역삼동")).toEqual({
      address: "서울특별시 강남구 역삼동",
      region: "서울",
      region_detail: "강남구",
    });
  });

  it("keeps unknown addresses without forcing a region", () => {
    expect(parseProfileAddress("온라인")).toEqual({
      address: "온라인",
      region: null,
      region_detail: null,
    });
  });

  it("prefers target_job and falls back to bio for older rows", () => {
    expect(
      resolveProfileTargetJob({
        target_job: "백엔드 개발자",
        bio: "데이터 좋아합니다",
      })
    ).toBe("백엔드 개발자");

    expect(
      resolveProfileTargetJob({
        target_job: "   ",
        bio: "브랜드와 데이터를 함께 보는 기획자",
      })
    ).toBe("브랜드와 데이터를 함께 보는 기획자");
  });
});
