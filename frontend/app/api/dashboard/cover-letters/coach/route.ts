import { apiError, apiOk, apiRateLimited } from "@/lib/api/route-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logRouteError } from "@/lib/server/route-logging";
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
    const rateLimit = enforceRateLimit({
      namespace: "coach-feedback",
      key: userId,
      maxRequests: 8,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return apiRateLimited(
        "AI 코칭 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        rateLimit.retryAfterSeconds
      );
    }

    const body = (await request.json()) as Omit<CoachFeedbackRequest, "user_id">;

    const response = await fetch(`${BACKEND_URL}/coach/feedback`, {
      signal: AbortSignal.timeout(30_000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return apiError(
        errorData?.detail || "AI 코칭 요청에 실패했습니다.",
        response.status >= 500 ? 502 : 400,
        response.status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST"
      );
    }

    const data = (await response.json()) as CoachFeedbackResponse;
    return apiOk(data);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      logRouteError(
        {
          route: "/api/dashboard/cover-letters/coach",
          method: "POST",
          category: "coach",
          status: 504,
          code: "UPSTREAM_ERROR",
          note: "timeout",
        },
        error
      );
      return apiError("AI 코칭 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.", 504, "UPSTREAM_ERROR");
    }
    logRouteError(
      {
        route: "/api/dashboard/cover-letters/coach",
        method: "POST",
        category: "coach",
        status: 400,
      },
      error
    );
    const message = error instanceof Error ? error.message : "AI 코칭 요청에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
