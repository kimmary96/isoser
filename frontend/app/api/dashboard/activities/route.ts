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

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ activities: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const body = (await request.json()) as Record<string, unknown>;

    const { data, error } = await supabase
      .from("activities")
      .insert({
        user_id: user.id,
        type: body.type,
        title: body.title,
        period: body.period ?? null,
        role: body.role ?? null,
        skills: body.skills ?? [],
        description: body.description ?? null,
        organization: body.organization ?? null,
        team_size: body.team_size ?? null,
        team_composition: body.team_composition ?? null,
        my_role: body.my_role ?? null,
        contributions: body.contributions ?? [],
        image_urls: body.image_urls ?? [],
        is_visible: body.is_visible ?? true,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "활동 저장에 실패했습니다.");
    }

    return NextResponse.json({ activity: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
