import { apiError, apiOk } from "@/lib/api/route-response";
import type { AssistantMessageRequest, AssistantMessageResponse, CoachFeedbackResponse } from "@/lib/types";
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
    const body = (await request.json()) as Omit<AssistantMessageRequest, "user_id" | "preferred_intent">;

    const response = await fetch(`${BACKEND_URL}/assistant/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        user_id: userId,
        preferred_intent: "coach",
      } satisfies AssistantMessageRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return apiError(
        errorData?.detail || "AI 코칭 요청에 실패했습니다.",
        response.status >= 500 ? 502 : 400,
        response.status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST"
      );
    }

    const data = (await response.json()) as AssistantMessageResponse;
    if (!data.coach_result) {
      return apiError("Assistant did not return a coach response.", 502, "UPSTREAM_ERROR");
    }

    return apiOk<CoachFeedbackResponse>(data.coach_result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 코칭 요청에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
