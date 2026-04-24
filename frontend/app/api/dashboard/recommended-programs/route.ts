import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ProgramCardItem,
  ProgramCardSummary,
  ProgramRecommendItem,
  ProgramRecommendResponse,
  ProgramSurfaceContext,
  RecommendedProgram,
  RecommendedProgramsResponse,
} from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function toRecommendationSurfaceContext(item: ProgramRecommendItem): ProgramSurfaceContext {
  return {
    surface: "dashboard_recommendation",
    reason: item.reason ?? null,
    fit_keywords: item.fit_keywords ?? [],
    score: item.score ?? item.program.final_score ?? null,
    relevance_score: item.relevance_score ?? item.program.relevance_score ?? null,
    relevance_reasons: item.relevance_reasons ?? [],
    score_breakdown: item.score_breakdown ?? {},
    relevance_grade: item.relevance_grade ?? "none",
    relevance_badge: item.relevance_badge ?? null,
  };
}

function toRecommendedProgram(item: ProgramRecommendItem): RecommendedProgram | null {
  if (!item.program) {
    return null;
  }

  const cardItem: ProgramCardItem = {
    program: item.program as ProgramCardSummary,
    context: toRecommendationSurfaceContext(item),
  };
  const context = cardItem.context;

  return {
    ...cardItem.program,
    _reason: context?.reason ?? null,
    _fit_keywords: context?.fit_keywords ?? null,
    _score: context?.score ?? cardItem.program.final_score ?? null,
    _relevance_score: context?.relevance_score ?? cardItem.program.relevance_score ?? null,
    reason: context?.reason ?? item.reason,
    fitKeywords: context?.fit_keywords ?? [],
    score: context?.score ?? cardItem.program.final_score ?? null,
    relevance_score: context?.relevance_score ?? cardItem.program.relevance_score ?? null,
    relevance_reasons: context?.relevance_reasons ?? [],
    score_breakdown: context?.score_breakdown ?? {},
    relevance_grade: context?.relevance_grade ?? "none",
    relevance_badge: context?.relevance_badge ?? null,
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
    const programs = (data.items ?? [])
      .map(toRecommendedProgram)
      .filter((program): program is NonNullable<typeof program> => Boolean(program))
      .slice(0, 9);

    return apiOk<RecommendedProgramsResponse>({ programs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "추천 프로그램을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
