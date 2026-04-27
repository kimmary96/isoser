import { apiError, apiOk } from "@/lib/api/route-response";
import { analyzePortfolioFit } from "@/lib/portfolio-fit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Activity, PortfolioFitResponse } from "@/lib/types";

async function getAuthenticatedClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  return { supabase, user };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const body = (await request.json()) as {
      targetJob?: string | null;
      jobPostingText?: string | null;
      activityIds?: string[] | null;
      recommendLimit?: number | null;
    };

    const activityIds = Array.isArray(body.activityIds)
      ? body.activityIds.map((id) => id.trim()).filter(Boolean)
      : [];

    let query = supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_visible", true)
      .order("created_at", { ascending: false });

    if (activityIds.length > 0) {
      query = query.in("id", activityIds);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const analysis = analyzePortfolioFit({
      activities: (data ?? []) as Activity[],
      targetJob: body.targetJob ?? null,
      jobPostingText: body.jobPostingText ?? null,
      recommendLimit: body.recommendLimit ?? 3,
    });

    return apiOk<PortfolioFitResponse>({
      recommendedActivityIds: analysis.recommendedActivityIds,
      analysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "포트폴리오 적합도 분석에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

