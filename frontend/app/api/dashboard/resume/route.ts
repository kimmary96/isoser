import { apiError, apiOk } from "@/lib/api/route-response";
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
      .select("name, bio, email, phone, self_intro, skills")
      .eq("id", user.id)
      .maybeSingle();

    let profileData = profileWithBio.data;
    if (
      profileWithBio.error &&
      (profileWithBio.error.code === "42703" ||
        profileWithBio.error.message.toLowerCase().includes("bio"))
    ) {
      const profileWithoutBio = await supabase
        .from("profiles")
        .select("name, email, phone, self_intro, skills")
        .eq("id", user.id)
        .maybeSingle();
      profileData = profileWithoutBio.data ? { ...profileWithoutBio.data, bio: "" } : null;
    } else if (profileWithBio.error) {
      throw new Error(profileWithBio.error.message);
    }

    return apiOk({
      activities: activities ?? [],
      profile: profileData ?? null,
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
    };

    const title = body.title?.trim();
    const templateId = body.template_id?.trim();
    const selectedActivityIds = Array.isArray(body.selected_activity_ids)
      ? body.selected_activity_ids.filter(Boolean)
      : [];

    if (!title || !templateId || selectedActivityIds.length === 0) {
      return apiError("이력서 생성 요청이 올바르지 않습니다.", 400, "BAD_REQUEST");
    }

    const { data, error } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        title,
        target_job: body.target_job ?? null,
        template_id: templateId,
        selected_activity_ids: selectedActivityIds,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "이력서 저장에 실패했습니다.");
    }

    await syncRecommendationProfileAfterUserMutation(supabase, user.id);

    return apiOk({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이력서 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
