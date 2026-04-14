import { NextResponse } from "next/server";

import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) throw new Error(error.message);

    return apiOk({ ok: true as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : "로그아웃에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
