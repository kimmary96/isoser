import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PortfolioConversionResponse } from "@/lib/types";

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

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    const { data, error } = await supabase
      .from("portfolios")
      .select("id, title, source_activity_id, selected_activity_ids, portfolio_payload, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    return apiOk({
      portfolios: (data ?? []).map((portfolio) => ({
        id: portfolio.id,
        title: portfolio.title,
        sourceActivityId: portfolio.source_activity_id,
        selectedActivityIds: portfolio.selected_activity_ids ?? [],
        portfolio: portfolio.portfolio_payload as PortfolioConversionResponse | null,
        createdAt: portfolio.created_at,
        updatedAt: portfolio.updated_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "포트폴리오 목록을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const body = (await request.json()) as {
      title?: string;
      sourceActivityId?: string | null;
      portfolio?: PortfolioConversionResponse | null;
    };

    const portfolio = body.portfolio;
    const title = body.title?.trim() || portfolio?.project_overview.title?.trim();
    const sourceActivityId = body.sourceActivityId || portfolio?.activity_id || null;

    if (!title || !portfolio || !sourceActivityId) {
      return apiError("포트폴리오 저장 요청이 올바르지 않습니다.", 400, "BAD_REQUEST");
    }

    const { data, error } = await supabase
      .from("portfolios")
      .insert({
        user_id: user.id,
        title,
        description: portfolio.project_overview.summary,
        selected_activity_ids: [sourceActivityId],
        source_activity_id: sourceActivityId,
        portfolio_payload: portfolio,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "포트폴리오 저장에 실패했습니다.");
    }

    return apiOk({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "포트폴리오 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
