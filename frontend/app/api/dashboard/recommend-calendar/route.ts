import { apiError, apiOk } from "@/lib/api/route-response";
import { fetchBackendResponse } from "@/lib/api/backend-endpoint";
import { buildPathWithSearchParams, buildRecommendationSearchParams } from "@/lib/api/program-query";
import { DASHBOARD_COPY } from "@/app/dashboard/dashboard-copy";
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

function formatLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toFallbackCalendarResponse(
  programs: ProgramCardSummary[],
  topK: number
): DashboardRecommendCalendarResponse {
  const reason = "커리어 핏 일정이 비어 있어 모집 마감이 가까운 공개 과정을 먼저 보여줍니다.";
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
  const today = formatLocalDateKey();
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
      throw new Error(errorData?.detail || DASHBOARD_COPY.calendar.loadError);
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
              : DASHBOARD_COPY.calendar.loadError;
      return apiError(message, 400, "BAD_REQUEST");
    }
  }
}
