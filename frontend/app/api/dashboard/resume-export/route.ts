import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get("resumeId");

    let resumeQuery = supabase.from("resumes").select("*").eq("user_id", user.id);
    if (resumeId) {
      resumeQuery = resumeQuery.eq("id", resumeId);
    } else {
      resumeQuery = resumeQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: resumeRow, error: resumeError } = resumeId
      ? await resumeQuery.maybeSingle()
      : await resumeQuery.maybeSingle();

    if (resumeError) throw new Error(resumeError.message);

    if (!resumeRow) {
      return NextResponse.json({ resume: null, activities: [] });
    }

    const rawIds = Array.isArray(resumeRow.selected_activity_ids)
      ? (resumeRow.selected_activity_ids as unknown[])
      : [];

    const ids: string[] = rawIds.length > 0
      ? rawIds
          .map((id) => String(id))
          .filter(Boolean)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ resume: resumeRow, activities: [] });
    }

    const { data: activityRows, error: activityError } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .in("id", ids);

    if (activityError) throw new Error(activityError.message);

    const activityMap = new Map((activityRows ?? []).map((activity) => [activity.id, activity]));
    const orderedActivities = ids
      .map((id) => activityMap.get(id))
      .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity));

    return NextResponse.json({
      resume: resumeRow,
      activities: orderedActivities,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF 데이터 로딩에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
