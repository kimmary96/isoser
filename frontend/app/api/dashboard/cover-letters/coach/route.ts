import { NextResponse } from "next/server";

import type { CoachFeedbackRequest, CoachFeedbackResponse } from "@/lib/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function getAuthenticatedUserId() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user.id;
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    const body = (await request.json()) as Omit<CoachFeedbackRequest, "user_id">;

    const response = await fetch(`${BACKEND_URL}/coach/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "AI 코칭 요청에 실패했습니다.");
    }

    const data = (await response.json()) as CoachFeedbackResponse;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 코칭 요청에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
