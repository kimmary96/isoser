import { apiError, apiOk } from "@/lib/api/route-response";
import { fetchBackendResponse } from "@/lib/api/backend-endpoint";
import { buildPathWithSearchParams, buildRecommendationSearchParams } from "@/lib/api/program-query";
import {
  toCalendarProgramCardItem,
  toFallbackCalendarProgramCardItem,
} from "@/lib/program-card-items";
import { hasTrustedProgramDeadline } from "@/lib/program-display";
import { extractBackendFallbackPrograms } from "@/lib/server/recommend-calendar-fallback";
import {
  loadDeadlineOrderedProgramCardSummaries,
  type ProgramCardDeadlineRouteClient,
} from "@/lib/server/program-card-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type {
  CalendarRecommendResponse,
  DashboardRecommendCalendarResponse,
  ProgramCardItem,
  ProgramCardSummary,
  ProgramListPageResponse,
} from "@/lib/types";
const BACKEND_RECOMMEND_TIMEOUT_MS = 3500;
const BACKEND_FALLBACK_TIMEOUT_MS = 2500;
const SUPABASE_FALLBACK_SCAN_LIMIT = 1000;

function toFallbackCalendarResponse(
  programs: ProgramCardSummary[],
  topK: number
): DashboardRecommendCalendarResponse {
  const reason = "추천 데이터가 비어 있어 모집 마감이 가까운 공개 프로그램을 우선 노출합니다.";
  return {
    items: programs
      .slice(0, topK)
      .map((program) => toFallbackCalendarProgramCardItem(program, reason))
      .filter((item): item is ProgramCardItem => Boolean(item)),
  };
}

async function loadSupabaseFallbackPrograms(topK: number): Promise<DashboardRecommendCalendarResponse> {
  let supabase: ProgramCardDeadlineRouteClient;
  try {
    supabase = createServiceRoleSupabaseClient() as unknown as ProgramCardDeadlineRouteClient;
  } catch {
    supabase = (await createServerSupabaseClient()) as unknown as ProgramCardDeadlineRouteClient;
  }
  const today = new Date().toISOString().slice(0, 10);
  const items = await loadDeadlineOrderedProgramCardSummaries(
    supabase,
    {
      today,
      limit: SUPABASE_FALLBACK_SCAN_LIMIT,
    }
  );

  return toFallbackCalendarResponse(items.filter(hasTrustedProgramDeadline), topK);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.trim();
    const region = searchParams.get("region")?.trim();
    const forceRefresh = searchParams.get("force_refresh") === "true";
    const topK = searchParams.get("top_k")?.trim();
    const backendSearchParams = buildRecommendationSearchParams({
      category,
      region,
      forceRefresh,
      topK,
    });

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
      buildPathWithSearchParams("/programs/recommend/calendar", backendSearchParams),
      {
        method: "GET",
        headers,
      },
      { timeoutMs: BACKEND_RECOMMEND_TIMEOUT_MS }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "캘린더 추천 프로그램을 불러오지 못했습니다.");
    }

    const data = (await response.json()) as CalendarRecommendResponse;
    if (data.items.length > 0) {
      const items = data.items
        .map(toCalendarProgramCardItem)
        .filter((item): item is ProgramCardItem => Boolean(item));
      return apiOk<DashboardRecommendCalendarResponse>({ items });
    }

    const fallbackLimit = Number(topK || "9") || 9;
    try {
      const fallbackResponse = await fetchBackendResponse(
        `/programs/list?recruiting_only=true&sort=deadline&limit=${fallbackLimit}`,
        { method: "GET" },
        { timeoutMs: BACKEND_FALLBACK_TIMEOUT_MS }
      );

      if (fallbackResponse.ok) {
        const fallbackPage = (await fallbackResponse.json().catch(() => null)) as ProgramListPageResponse | null;
        const fallbackPrograms = fallbackPage ? extractBackendFallbackPrograms(fallbackPage) : [];
        return apiOk(toFallbackCalendarResponse(fallbackPrograms, fallbackLimit));
      }
    } catch {
      // Fall through to Supabase direct fallback below.
    }

    return apiOk(await loadSupabaseFallbackPrograms(fallbackLimit));
  } catch (error) {
    const { searchParams } = new URL(request.url);
    const topK = Number(searchParams.get("top_k") || "9") || 9;
    try {
      return apiOk(await loadSupabaseFallbackPrograms(topK));
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error
          ? fallbackError.message
          : error instanceof Error
            ? error.message
            : "캘린더 추천 프로그램을 불러오지 못했습니다.";
      return apiError(message, 400, "BAD_REQUEST");
    }
  }
}
