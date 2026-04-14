import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("로그인이 필요합니다.");
    }

    const { data, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "문서 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
