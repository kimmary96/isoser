import { apiError, apiOk } from "@/lib/api/route-response";
import {
  hasResumeActivityLineOverrides,
  normalizeResumeActivityLineOverrides,
  type ResumeActivityLineOverrides,
} from "@/lib/resume-line-overrides";
import {
  isMissingResumeProfileColumnError,
  normalizeResumeBuilderProfile,
  RESUME_PROFILE_BASE_COLUMNS,
  RESUME_PROFILE_COLUMNS,
} from "@/lib/resume-profile";
import { syncRecommendationProfileAfterUserMutation } from "@/lib/server/recommendation-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

    const { data: activities, error: activityError } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_visible", true)
      .order("created_at", { ascending: false });

    if (activityError) throw new Error(activityError.message);

    const profileWithBio = await supabase
      .from("profiles")
      .select(RESUME_PROFILE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();

    let profileData: unknown = profileWithBio.data;
    if (isMissingResumeProfileColumnError(profileWithBio.error)) {
      const profileWithoutBio = await supabase
        .from("profiles")
        .select(RESUME_PROFILE_BASE_COLUMNS)
        .eq("id", user.id)
        .maybeSingle();
      if (profileWithoutBio.error) throw new Error(profileWithoutBio.error.message);
      profileData = profileWithoutBio.data;
    } else if (profileWithBio.error) {
      throw new Error(profileWithBio.error.message);
    }

    return apiOk({
      activities: activities ?? [],
      profile: normalizeResumeBuilderProfile(profileData),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이력서 데이터를 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const body = (await request.json()) as {
      title?: string;
      target_job?: string | null;
      template_id?: string;
      selected_activity_ids?: string[];
      activity_line_overrides?: unknown;
    };

    const title = body.title?.trim();
    const templateId = body.template_id?.trim();
    const selectedActivityIds = Array.isArray(body.selected_activity_ids)
      ? body.selected_activity_ids.filter(Boolean)
      : [];
    const activityLineOverrides = normalizeResumeActivityLineOverrides(
      body.activity_line_overrides
    );

    if (!title || !templateId || selectedActivityIds.length === 0) {
      return apiError("이력서 생성 요청이 올바르지 않습니다.", 400, "BAD_REQUEST");
    }

    const insertPayload: {
      user_id: string;
      title: string;
      target_job: string | null;
      template_id: string;
      selected_activity_ids: string[];
      activity_line_overrides?: ResumeActivityLineOverrides;
    } = {
        user_id: user.id,
        title,
        target_job: body.target_job ?? null,
        template_id: templateId,
        selected_activity_ids: selectedActivityIds,
      };

    if (hasResumeActivityLineOverrides(activityLineOverrides)) {
      insertPayload.activity_line_overrides = activityLineOverrides;
    }

    let activityLineOverridesSaved = true;
    let insertResult = await supabase
      .from("resumes")
      .insert(insertPayload)
      .select("id")
      .single();

    if (
      insertResult.error &&
      insertPayload.activity_line_overrides &&
      isMissingActivityLineOverridesColumn(insertResult.error)
    ) {
      const fallbackPayload = { ...insertPayload };
      delete fallbackPayload.activity_line_overrides;
      activityLineOverridesSaved = false;
      insertResult = await supabase.from("resumes").insert(fallbackPayload).select("id").single();
    }

    if (insertResult.error || !insertResult.data) {
      throw new Error(insertResult.error?.message ?? "이력서 저장에 실패했습니다.");
    }

    await syncRecommendationProfileAfterUserMutation(supabase, user.id);

    return apiOk({
      id: insertResult.data.id,
      activity_line_overrides_saved: activityLineOverridesSaved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이력서 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

function isMissingActivityLineOverridesColumn(error: { code?: string; message?: string }): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("activity_line_overrides")
  );
}
