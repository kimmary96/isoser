import { apiError, apiOk, apiRateLimited } from "@/lib/api/route-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import {
  MAX_AVATAR_IMAGE_SIZE_BYTES,
  validateImageFile,
} from "@/lib/server/upload-validation";
import {
  buildLegacyTargetJobFields,
  syncRecommendationProfileAfterUserMutation,
} from "@/lib/server/recommendation-profile";
import { logRouteError } from "@/lib/server/route-logging";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const EMPTY_PROFILE: Profile = {
  id: "",
  name: null,
  bio: null,
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

const REGION_ALIASES: Array<{ region: string; aliases: string[] }> = [
  { region: "서울", aliases: ["서울특별시", "서울시", "서울"] },
  { region: "경기", aliases: ["경기도", "경기"] },
  { region: "인천", aliases: ["인천광역시", "인천시", "인천"] },
  { region: "부산", aliases: ["부산광역시", "부산시", "부산"] },
  { region: "대구", aliases: ["대구광역시", "대구시", "대구"] },
  { region: "광주", aliases: ["광주광역시", "광주시", "광주"] },
  { region: "대전", aliases: ["대전광역시", "대전시", "대전"] },
  { region: "울산", aliases: ["울산광역시", "울산시", "울산"] },
  { region: "세종", aliases: ["세종특별자치시", "세종시", "세종"] },
  { region: "강원", aliases: ["강원특별자치도", "강원도", "강원"] },
  { region: "충북", aliases: ["충청북도", "충북"] },
  { region: "충남", aliases: ["충청남도", "충남"] },
  { region: "전북", aliases: ["전북특별자치도", "전라북도", "전북"] },
  { region: "전남", aliases: ["전라남도", "전남"] },
  { region: "경북", aliases: ["경상북도", "경북"] },
  { region: "경남", aliases: ["경상남도", "경남"] },
  { region: "제주", aliases: ["제주특별자치도", "제주도", "제주"] },
];

function normalizeAddressText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function extractRegionDetail(address: string, region: string | null): string | null {
  const tokens = address.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  const regionAliasSet = new Set(
    REGION_ALIASES.flatMap((entry) => (entry.region === region ? [entry.region, ...entry.aliases] : []))
  );
  const detail = tokens.find((token) => {
    const normalized = token.replace(/[(),]/g, "");
    return !regionAliasSet.has(normalized) && /(시|군|구)$/.test(normalized) && normalized.length >= 2;
  });

  return detail?.replace(/[(),]/g, "") ?? null;
}

function parseProfileAddress(value: unknown): {
  address: string | null;
  region: string | null;
  region_detail: string | null;
} {
  const address = normalizeAddressText(value);
  if (!address) {
    return { address: null, region: null, region_detail: null };
  }

  const compactAddress = address.replace(/\s+/g, "");
  const match = REGION_ALIASES.find((entry) =>
    entry.aliases.some((alias) => compactAddress.includes(alias.replace(/\s+/g, "")))
  );
  const region = match?.region ?? null;

  return {
    address,
    region,
    region_detail: extractRegionDetail(address, region),
  };
}

function normalizeProfile(profileRow: Record<string, unknown> | null): Profile {
  const getStringArray = (key: string): string[] => {
    const value = profileRow?.[key];
    return Array.isArray(value) ? (value as string[]) : [];
  };

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
    if (patch.bio !== undefined) {
      payload.bio = patch.bio;
      Object.assign(payload, buildLegacyTargetJobFields(patch.bio));
    }
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
    const targetJobFields = buildLegacyTargetJobFields(bio);
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
          upsert: true,
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
