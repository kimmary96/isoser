import { NextResponse } from "next/server";

import { apiError, apiOk } from "@/lib/api/route-response";
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

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const body = (await request.json()) as {
      sessionId?: string;
      activityId?: string;
      messages?: unknown[];
    };

    if (!body.sessionId || !body.activityId || !Array.isArray(body.messages)) {
      return apiError("세션 저장 요청이 올바르지 않습니다.", 400, "BAD_REQUEST");
    }

    const { error } = await supabase.from("coach_sessions").upsert({
      id: body.sessionId,
      user_id: user.id,
      activity_id: body.activityId,
      messages: body.messages,
    });

    if (error) throw new Error(error.message);

    return apiOk({ ok: true as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : "코치 세션 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
