import { apiError, apiOk } from "@/lib/api/route-response";
import { toRecommendationProgramCardItem } from "@/lib/program-card-items";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  DashboardRecommendedProgramsResponse,
  ProgramCardItem,
  ProgramRecommendItem,
  ProgramRecommendResponse,
} from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.trim() || undefined;
    const region = searchParams.get("region")?.trim() || undefined;
    const forceRefresh = searchParams.get("force_refresh") === "true";

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

    const response = await fetch(`${BACKEND_URL}/programs/recommend`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        top_k: 9,
        category,
        region,
        force_refresh: forceRefresh,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const message = errorData?.error || errorData?.detail || "추천 프로그램을 불러오지 못했습니다.";
      const status = response.status >= 500 ? 502 : response.status;
      const code = response.status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST";
      return apiError(message, status, code);
    }

    const data = (await response.json()) as ProgramRecommendResponse;
    const items = (data.items ?? [])
      .map(toRecommendationProgramCardItem)
      .filter((item): item is ProgramCardItem => Boolean(item))
      .slice(0, 9);

    return apiOk<DashboardRecommendedProgramsResponse>({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "추천 프로그램을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
