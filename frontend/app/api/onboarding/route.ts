import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ParsedActivity, ParsedProfile } from "@/lib/types";

function normalizeType(type: string): ParsedActivity["type"] {
  const allowed = ["회사경력", "프로젝트", "대외활동", "학생활동"] as const;
  const value = (type || "").trim();
  if (allowed.includes(value as ParsedActivity["type"])) {
    return value as ParsedActivity["type"];
  }

  const lower = value.toLowerCase();
  if (["경력", "인턴", "work", "experience"].includes(lower)) return "회사경력";
  if (["project"].includes(lower)) return "프로젝트";
  if (["활동", "동아리", "봉사", "contest", "competition"].includes(lower)) return "대외활동";
  if (["school", "학내활동", "학술활동"].includes(lower)) return "학생활동";

  return "프로젝트";
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("로그인이 필요합니다.");
    }

    const body = (await request.json()) as {
      profile?: ParsedProfile;
      activities?: ParsedActivity[];
    };

    const profile = body.profile;
    const activities = Array.isArray(body.activities) ? body.activities : [];

    if (!profile) {
      return apiError("프로필 정보가 필요합니다.", 400, "BAD_REQUEST");
    }

    const profilePayload = {
      id: user.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      bio: profile.bio ?? "",
      education: profile.education,
      career: profile.career ?? [],
      education_history: profile.education_history ?? [],
      awards: profile.awards ?? [],
      certifications: profile.certifications ?? [],
      languages: profile.languages ?? [],
      skills: profile.skills ?? [],
      self_intro: profile.self_intro ?? "",
    };

    let { error: profileError } = await supabase.from("profiles").upsert(profilePayload);
    if (profileError?.code === "42703" || profileError?.message.toLowerCase().includes("bio")) {
      const fallbackPayload = Object.fromEntries(
        Object.entries(profilePayload).filter(([key]) => key !== "bio")
      );
      const retry = await supabase.from("profiles").upsert(fallbackPayload);
      profileError = retry.error;
    }
    if (profileError) {
      throw new Error(profileError.message);
    }

    if (activities.length > 0) {
      const { error: activityError } = await supabase.from("activities").insert(
        activities.map((activity) => ({
          type: normalizeType(activity.type),
          title: activity.title,
          organization: activity.organization ?? null,
          team_size: activity.team_size ?? null,
          team_composition: activity.team_composition ?? null,
          my_role: activity.my_role ?? activity.role ?? null,
          contributions: activity.contributions ?? [],
          period: activity.period,
          role: activity.role,
          skills: activity.skills ?? [],
          description: activity.description,
          user_id: user.id,
        }))
      );
      if (activityError) {
        throw new Error(activityError.message);
      }
    }

    return apiOk({ ok: true as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : "온보딩 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
