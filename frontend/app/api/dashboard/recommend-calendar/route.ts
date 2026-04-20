import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CalendarRecommendResponse } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const backendSearchParams = new URLSearchParams();

    const category = searchParams.get("category")?.trim();
    const region = searchParams.get("region")?.trim();
    const forceRefresh = searchParams.get("force_refresh") === "true";
    const topK = searchParams.get("top_k")?.trim();

    if (category) backendSearchParams.set("category", category);
    if (region) backendSearchParams.set("region", region);
    if (forceRefresh) backendSearchParams.set("force_refresh", "true");
    if (topK) backendSearchParams.set("top_k", topK);

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const accessToken = !error && session?.access_token ? session.access_token : null;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const query = backendSearchParams.toString();
    const response = await fetch(
      `${BACKEND_URL}/programs/recommend/calendar${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "캘린더 추천 프로그램을 불러오지 못했습니다.");
    }

    const data = (await response.json()) as CalendarRecommendResponse;
    return apiOk(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "캘린더 추천 프로그램을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
