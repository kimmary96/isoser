import { describe, expect, it } from "vitest";

import {
  DASHBOARD_RECOMMEND_CALENDAR,
  DEFAULT_PUBLIC_LANDING,
  getGoogleAuthHref,
  getLoginHref,
  resolveInternalPath,
} from "./routes";

describe("routes", () => {
  it("uses landing C as the default public landing", () => {
    expect(DEFAULT_PUBLIC_LANDING).toBe("/landing-c");
    expect(resolveInternalPath(undefined)).toBe("/landing-c");
    expect(resolveInternalPath("")).toBe("/landing-c");
  });

  it("accepts only internal paths", () => {
    expect(resolveInternalPath("/dashboard")).toBe("/dashboard");
    expect(resolveInternalPath("/dashboard#recommend-calendar")).toBe(DASHBOARD_RECOMMEND_CALENDAR);
    expect(resolveInternalPath("https://example.com/dashboard")).toBe(DEFAULT_PUBLIC_LANDING);
    expect(resolveInternalPath("//example.com/dashboard")).toBe(DEFAULT_PUBLIC_LANDING);
  });

  it("builds login and oauth hrefs while preserving hash targets", () => {
    expect(getLoginHref(DASHBOARD_RECOMMEND_CALENDAR)).toBe(
      "/login?redirectedFrom=%2Fdashboard%23recommend-calendar"
    );
    expect(getGoogleAuthHref(DASHBOARD_RECOMMEND_CALENDAR)).toBe(
      "/api/auth/google?next=%2Fdashboard%23recommend-calendar"
    );
  });
});

