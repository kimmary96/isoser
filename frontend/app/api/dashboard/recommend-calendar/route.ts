import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProgramCalendarRecommendResponse } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("force_refresh") === "true";

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const accessToken = !error && session?.access_token ? session.access_token : null;

    const headers: HeadersInit = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const backendQuery = new URLSearchParams();
    if (forceRefresh) {
      backendQuery.set("force_refresh", "true");
    }

    const response = await fetch(
      `${BACKEND_URL}/recommend/calendar${backendQuery.size ? `?${backendQuery.toString()}` : ""}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "캘린더 추천 일정을 불러오지 못했습니다.");
    }

    const data = (await response.json()) as ProgramCalendarRecommendResponse;
    return apiOk(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "캘린더 추천 일정을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
