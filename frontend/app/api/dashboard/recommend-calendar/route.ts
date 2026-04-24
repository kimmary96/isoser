import { apiError, apiOk } from "@/lib/api/route-response";
import {
  toCalendarProgramCardItem,
  toFallbackCalendarProgramCardItem,
} from "@/lib/program-card-items";
import { getProgramCompareMeta } from "@/lib/program-display";
import { extractBackendFallbackPrograms } from "@/lib/server/recommend-calendar-fallback";
import {
  loadDeadlineOrderedProgramCardRenderables,
  type ProgramCardDeadlineRouteClient,
} from "@/lib/server/program-card-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  CalendarRecommendItem,
  CalendarRecommendResponse,
  DashboardRecommendCalendarResponse,
  ProgramCardItem,
  ProgramCardRenderable,
  ProgramListPageResponse,
} from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const BACKEND_RECOMMEND_TIMEOUT_MS = 3500;
const BACKEND_FALLBACK_TIMEOUT_MS = 2500;
const SUPABASE_FALLBACK_SCAN_LIMIT = 1000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function toFallbackCalendarResponse(programs: ProgramCardRenderable[], topK: number): DashboardRecommendCalendarResponse {
  const reason = "추천 데이터가 비어 있어 모집 마감이 가까운 공개 프로그램을 우선 노출합니다.";
  return {
    items: programs
      .slice(0, topK)
      .map((program) => toFallbackCalendarProgramCardItem(program, reason))
      .filter((item): item is ProgramCardItem => Boolean(item)),
  };
}

function isWork24Program(program: ProgramCardRenderable): boolean {
  const source = String(program.source ?? "").toLowerCase();
  return source.includes("고용24") || source.includes("work24");
}

function hasTrustedDeadline(program: ProgramCardRenderable): boolean {
  if (!program.deadline) return false;

  if ("deadline_confidence" in program && program.deadline_confidence === "low") {
    return false;
  }

  const deadline = String(program.deadline).slice(0, 10);
  const endDate = String(program.end_date ?? "").slice(0, 10);
  const compareMeta = getProgramCompareMeta(program) ?? {};
  const metaDeadline =
    compareMeta.application_deadline ||
    compareMeta.application_end_date ||
    compareMeta.recruitment_deadline ||
    compareMeta.recruitment_end_date;
  const deadlineSource = String(
    compareMeta.deadline_source ||
      compareMeta.application_deadline_source ||
      compareMeta.recruitment_deadline_source ||
      "",
  )
    .replace(/[_-]/g, "")
    .toLowerCase();
  const usesTrainingStartDeadline =
    deadlineSource === "trastartdate" ||
    deadlineSource === "trainingstartdate" ||
    deadlineSource === "trainingstart";

  if (isWork24Program(program) && endDate && deadline === endDate && !metaDeadline && !usesTrainingStartDeadline) {
    return false;
  }

  return true;
}

async function loadSupabaseFallbackPrograms(topK: number): Promise<DashboardRecommendCalendarResponse> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const items = await loadDeadlineOrderedProgramCardRenderables(
    supabase as unknown as ProgramCardDeadlineRouteClient,
    {
      today,
      limit: SUPABASE_FALLBACK_SCAN_LIMIT,
    }
  );

  return toFallbackCalendarResponse(items.filter(hasTrustedDeadline), topK);
}

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
    const response = await fetchWithTimeout(
      `${BACKEND_URL}/programs/recommend/calendar${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers,
      },
      BACKEND_RECOMMEND_TIMEOUT_MS
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
      const fallbackResponse = await fetchWithTimeout(
        `${BACKEND_URL}/programs/list?recruiting_only=true&sort=deadline&limit=${fallbackLimit}`,
        { method: "GET" },
        BACKEND_FALLBACK_TIMEOUT_MS
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
