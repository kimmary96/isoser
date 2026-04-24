import { describe, expect, it, vi } from "vitest";

import {
  buildLegacyTargetJobFields,
  syncRecommendationProfileAfterUserMutation,
} from "./recommendation-profile";

describe("recommendation profile helper", () => {
  it("mirrors the current legacy bio input into target job fields", () => {
    expect(buildLegacyTargetJobFields("  Data   Engineer  ")).toEqual({
      target_job: "Data Engineer",
      target_job_normalized: "data engineer",
    });
    expect(buildLegacyTargetJobFields("   ")).toEqual({
      target_job: null,
      target_job_normalized: null,
    });
  });

  it("refreshes the derived recommendation profile and clears cached rows", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const deleteFn = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ delete: deleteFn }));

    await syncRecommendationProfileAfterUserMutation(
      { rpc, from },
      "user-123",
    );

    expect(rpc).toHaveBeenCalledWith(
      "refresh_user_recommendation_profile",
      { p_user_id: "user-123" },
    );
    expect(from).toHaveBeenCalledWith("recommendations");
    expect(eq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("soft-fails when the additive DB artifacts are not applied yet", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: {
        code: "42883",
        message:
          'function public.refresh_user_recommendation_profile(uuid) does not exist',
      },
    });
    const eq = vi.fn().mockResolvedValue({
      error: {
        code: "42P01",
        message: 'relation "public.recommendations" does not exist',
      },
    });
    const deleteFn = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ delete: deleteFn }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      syncRecommendationProfileAfterUserMutation({ rpc, from }, "user-123"),
    ).resolves.toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
