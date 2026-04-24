import { apiError, apiOk, apiRateLimited } from "@/lib/api/route-response";
import {
  buildTargetJobFields,
  normalizeTargetJobText,
  parseProfileAddress,
} from "@/lib/normalizers/profile";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import {
  MAX_AVATAR_IMAGE_SIZE_BYTES,
  validateImageFile,
} from "@/lib/server/upload-validation";
import {
  syncRecommendationProfileAfterUserMutation,
} from "@/lib/server/recommendation-profile";
import { logRouteError } from "@/lib/server/route-logging";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const EMPTY_PROFILE: Profile = {
  id: "",
  name: null,
  bio: null,
  target_job: null,
  target_job_normalized: null,
  portfolio_url: null,
  email: null,
  phone: null,
  address: null,
  region: null,
  region_detail: null,
  education: null,
  career: [],
  education_history: [],
  awards: [],
  certifications: [],
  languages: [],
  skills: [],
  self_intro: "",
  created_at: "",
  updated_at: "",
};

function normalizeProfile(profileRow: Record<string, unknown> | null): Profile {
  const getStringArray = (key: string): string[] => {
    const value = profileRow?.[key];
    return Array.isArray(value) ? (value as string[]) : [];
  };
  const targetJob =
    (profileRow?.["target_job"] as string | null) ??
    (profileRow?.["bio"] as string | null) ??
    "";

  return {
    ...EMPTY_PROFILE,
    ...(profileRow ?? {}),
    career: getStringArray("career"),
    education_history: getStringArray("education_history"),
    awards: getStringArray("awards"),
    certifications: getStringArray("certifications"),
    languages: getStringArray("languages"),
    skills: getStringArray("skills"),
    self_intro: (profileRow?.["self_intro"] as string | null) ?? "",
    bio: (profileRow?.["bio"] as string | null) ?? "",
    target_job: targetJob,
    target_job_normalized:
      (profileRow?.["target_job_normalized"] as string | null) ??
      normalizeTargetJobText(targetJob),
    portfolio_url: (profileRow?.["portfolio_url"] as string | null) ?? "",
    address: (profileRow?.["address"] as string | null) ?? "",
    region: (profileRow?.["region"] as string | null) ?? "",
    region_detail: (profileRow?.["region_detail"] as string | null) ?? "",
  };
}

function enforceProfileWriteRateLimit(userId: string) {
  return enforceRateLimit({
    namespace: "profile-update",
    key: userId,
    maxRequests: 20,
    windowMs: 60_000,
  });
}

function isMissingProfileOptionalColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" ||
    message.includes("bio") ||
    message.includes("target_job") ||
    message.includes("portfolio_url") ||
    message.includes("address") ||
    message.includes("region")
  );
}

function withoutOptionalProfileColumns(payload: Record<string, unknown>): Record<string, unknown> {
  const fallbackPayload = { ...payload };
  delete fallbackPayload.bio;
  delete fallbackPayload.target_job;
  delete fallbackPayload.target_job_normalized;
  delete fallbackPayload.portfolio_url;
  delete fallbackPayload.address;
  delete fallbackPayload.region;
  delete fallbackPayload.region_detail;
  return fallbackPayload;
}

async function getAuthenticatedClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    const [
      { data: profileRow, error: profileError },
      { data: activityRows, error: activityError },
      { data: matchRows, error: matchError },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_visible", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("match_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (profileError) throw new Error(profileError.message);
    if (activityError) throw new Error(activityError.message);
    if (matchError) throw new Error(matchError.message);

    return apiOk({
      profile: normalizeProfile((profileRow as Record<string, unknown> | null) ?? null),
      activities: activityRows ?? [],
      matchAnalyses: matchRows ?? [],
    });
  } catch (error) {
    logRouteError(
      {
        route: "/api/dashboard/profile",
        method: "GET",
        category: "profile",
        status: 400,
      },
      error
    );
    const message =
      error instanceof Error ? error.message : "프로필 데이터를 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const rateLimit = await enforceProfileWriteRateLimit(user.id);
    if (!rateLimit.allowed) {
      return apiRateLimited(
        "프로필 저장 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        rateLimit.retryAfterSeconds
      );
    }

    const patch = (await request.json()) as Partial<Profile>;

    const payload: Record<string, unknown> = {};
    if (patch.career !== undefined) payload.career = patch.career;
    if (patch.education_history !== undefined) payload.education_history = patch.education_history;
    if (patch.awards !== undefined) payload.awards = patch.awards;
    if (patch.certifications !== undefined) payload.certifications = patch.certifications;
    if (patch.languages !== undefined) payload.languages = patch.languages;
    if (patch.skills !== undefined) payload.skills = patch.skills;
    if (patch.self_intro !== undefined) payload.self_intro = patch.self_intro;
    if (patch.bio !== undefined) payload.bio = patch.bio;
    if (patch.target_job !== undefined) Object.assign(payload, buildTargetJobFields(patch.target_job));
    if (patch.email !== undefined) payload.email = patch.email;
    if (patch.phone !== undefined) payload.phone = patch.phone;
    if (patch.portfolio_url !== undefined) payload.portfolio_url = patch.portfolio_url;
    if (patch.address !== undefined) Object.assign(payload, parseProfileAddress(patch.address));

    let { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (isMissingProfileOptionalColumnError(updateError)) {
      const retry = await supabase
        .from("profiles")
        .update(withoutOptionalProfileColumns(payload))
        .eq("id", user.id);
      updateError = retry.error;
    }

    if (updateError) throw new Error(updateError.message);

    await syncRecommendationProfileAfterUserMutation(supabase, user.id);

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    return apiOk({ profile: normalizeProfile((profileRow as Record<string, unknown> | null) ?? null) });
  } catch (error) {
    logRouteError(
      {
        route: "/api/dashboard/profile",
        method: "PATCH",
        category: "profile",
        status: 400,
      },
      error
    );
    const message = error instanceof Error ? error.message : "프로필 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const rateLimit = await enforceProfileWriteRateLimit(user.id);
    if (!rateLimit.allowed) {
      return apiRateLimited(
        "프로필 저장 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        rateLimit.retryAfterSeconds
      );
    }

    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return apiError("이름은 필수입니다.", 400, "BAD_REQUEST");
    }

    const bio = String(formData.get("bio") ?? "").trim() || null;
    const targetJob = String(formData.get("target_job") ?? "").trim() || null;
    const targetJobFields = buildTargetJobFields(targetJob);
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const portfolioUrl = String(formData.get("portfolio_url") ?? "").trim() || null;
    const addressFields = parseProfileAddress(formData.get("address"));
    const avatarFile = formData.get("avatar");

    let nextAvatarUrl = String(formData.get("current_avatar_url") ?? "").trim() || null;

    if (avatarFile instanceof File && avatarFile.size > 0) {
      const validationError = await validateImageFile(avatarFile, {
        maxSizeBytes: MAX_AVATAR_IMAGE_SIZE_BYTES,
        label: "프로필 이미지",
      });
      if (validationError) {
        return apiError(validationError, 400, "BAD_REQUEST");
      }

      const extension = avatarFile.name.split(".").pop()?.trim().toLowerCase() ?? "png";
      const path = `${user.id}/profile/${Date.now()}.${extension}`;
      const fileBuffer = Buffer.from(await avatarFile.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from("activity-images")
        .upload(path, fileBuffer, {
          contentType: avatarFile.type || "application/octet-stream",
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from("activity-images").getPublicUrl(path);
      nextAvatarUrl = urlData.publicUrl;
    }

    let { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        name,
        bio,
        ...targetJobFields,
        email,
        phone,
        portfolio_url: portfolioUrl,
        ...addressFields,
        avatar_url: nextAvatarUrl,
      },
      { onConflict: "id" }
    );

    if (isMissingProfileOptionalColumnError(upsertError)) {
      const retry = await supabase.from("profiles").upsert(
        withoutOptionalProfileColumns({
          id: user.id,
          name,
          bio,
          ...targetJobFields,
          email,
          phone,
          portfolio_url: portfolioUrl,
          ...addressFields,
          avatar_url: nextAvatarUrl,
        }),
        { onConflict: "id" }
      );
      upsertError = retry.error;
    }

    if (upsertError) throw new Error(upsertError.message);

    await syncRecommendationProfileAfterUserMutation(supabase, user.id);

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    return apiOk({
      profile: normalizeProfile((profileRow as Record<string, unknown> | null) ?? null),
    });
  } catch (error) {
    logRouteError(
      {
        route: "/api/dashboard/profile",
        method: "PUT",
        category: "profile",
        status: 400,
      },
      error
    );
    const message = error instanceof Error ? error.message : "프로필 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
