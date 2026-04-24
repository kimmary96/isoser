import { apiError, apiOk } from "@/lib/api/route-response";
import { fetchBackendResponse } from "@/lib/api/backend-endpoint";
import {
  toFallbackCalendarProgramCardItem,
  toRecommendationProgramCardItem,
} from "@/lib/program-card-items";
import {
  loadDeadlineOrderedProgramCardSummaries,
  type ProgramCardDeadlineRouteClient,
} from "@/lib/server/program-card-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type {
  DashboardRecommendedProgramsResponse,
  ProgramCardItem,
  ProgramRecommendResponse,
} from "@/lib/types";

const BACKEND_RECOMMEND_TIMEOUT_MS = 3500;

async function loadFallbackRecommendedPrograms(limit: number): Promise<DashboardRecommendedProgramsResponse> {
  let supabase: ProgramCardDeadlineRouteClient;
  try {
    supabase = createServiceRoleSupabaseClient() as unknown as ProgramCardDeadlineRouteClient;
  } catch {
    supabase = (await createServerSupabaseClient()) as unknown as ProgramCardDeadlineRouteClient;
  }

  const today = new Date().toISOString().slice(0, 10);
  const programs = await loadDeadlineOrderedProgramCardSummaries(supabase, {
    today,
    limit: Math.max(limit, 9),
  });

  const reason = "추천 엔진 연결이 불안정해 공개 프로그램 우선 목록을 대신 표시합니다.";
  return {
    items: programs
      .slice(0, limit)
      .map((program) => toFallbackCalendarProgramCardItem(program, reason))
      .filter((item): item is ProgramCardItem => Boolean(item)),
  };
}

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

    const response = await fetchBackendResponse(
      "/programs/recommend",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          top_k: 9,
          category,
          region,
          force_refresh: forceRefresh,
        }),
      },
      { timeoutMs: BACKEND_RECOMMEND_TIMEOUT_MS },
    );

    if (!response.ok) {
      if (response.status >= 500) {
        return apiOk(await loadFallbackRecommendedPrograms(9));
      }

      const errorData = await response.json().catch(() => null);
      const message = errorData?.error || errorData?.detail || "추천 프로그램을 불러오지 못했습니다.";
      return apiError(message, response.status, "BAD_REQUEST");
    }

    const data = (await response.json()) as ProgramRecommendResponse;
    const items = (data.items ?? [])
      .map(toRecommendationProgramCardItem)
      .filter((item): item is ProgramCardItem => Boolean(item))
      .slice(0, 9);

    return apiOk<DashboardRecommendedProgramsResponse>({ items });
  } catch (error) {
    try {
      return apiOk(await loadFallbackRecommendedPrograms(9));
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error
          ? fallbackError.message
          : error instanceof Error
            ? error.message
            : "추천 프로그램을 불러오지 못했습니다.";
      return apiError(message, 400, "BAD_REQUEST");
    }
  }
}
