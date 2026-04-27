import { apiError, apiOk } from "@/lib/api/route-response";
import {
  attachActivityImagesToPortfolio,
  buildDefaultPortfolioImagePlacements,
  normalizePortfolioDocumentPayload,
} from "@/lib/portfolio-document";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Activity,
  PortfolioConversionResponse,
  PortfolioDocumentPayload,
  PortfolioExportResponse,
} from "@/lib/types";

type PortfolioExportRow = {
  id: string;
  title: string;
  source_activity_id?: string | null;
  selected_activity_ids?: string[] | null;
  portfolio_payload: PortfolioConversionResponse | PortfolioDocumentPayload | null;
  created_at: string;
  updated_at: string;
};

function isMissingColumnError(error: { message?: string; details?: string | null }, column: string) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return text.includes(column.toLowerCase()) && (
    text.includes("column") ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("could not find")
  );
}

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

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get("portfolioId");

    let portfolioQuery = supabase
      .from("portfolios")
      .select("id, title, source_activity_id, selected_activity_ids, portfolio_payload, created_at, updated_at")
      .eq("user_id", user.id);

    portfolioQuery = portfolioId
      ? portfolioQuery.eq("id", portfolioId)
      : portfolioQuery.order("created_at", { ascending: false }).limit(1);

    const initialPortfolioResult = await portfolioQuery.maybeSingle();
    let portfolioRow = initialPortfolioResult.data as PortfolioExportRow | null;
    let portfolioError = initialPortfolioResult.error;
    if (portfolioError && isMissingColumnError(portfolioError, "selected_activity_ids")) {
      let fallbackQuery = supabase
        .from("portfolios")
        .select("id, title, source_activity_id, portfolio_payload, created_at, updated_at")
        .eq("user_id", user.id);
      fallbackQuery = portfolioId
        ? fallbackQuery.eq("id", portfolioId)
        : fallbackQuery.order("created_at", { ascending: false }).limit(1);
      const fallback = await fallbackQuery.maybeSingle();
      portfolioRow = fallback.data as PortfolioExportRow | null;
      portfolioError = fallback.error;
    }
    if (portfolioError && isMissingColumnError(portfolioError, "source_activity_id")) {
      let fallbackQuery = supabase
        .from("portfolios")
        .select("id, title, portfolio_payload, created_at, updated_at")
        .eq("user_id", user.id);
      fallbackQuery = portfolioId
        ? fallbackQuery.eq("id", portfolioId)
        : fallbackQuery.order("created_at", { ascending: false }).limit(1);
      const fallback = await fallbackQuery.maybeSingle();
      portfolioRow = fallback.data as PortfolioExportRow | null;
      portfolioError = fallback.error;
    }
    if (portfolioError) throw new Error(portfolioError.message);

    if (!portfolioRow) {
      return apiOk<PortfolioExportResponse>({
        portfolio: null,
        document: null,
        activities: [],
        profile: null,
      });
    }

    const document = normalizePortfolioDocumentPayload(portfolioRow.portfolio_payload, {
      fallbackTitle: portfolioRow.title,
    });
    const selectedActivityIds =
      document?.selectedActivityIds?.length
        ? document.selectedActivityIds
        : Array.isArray(portfolioRow.selected_activity_ids)
          ? (portfolioRow.selected_activity_ids as unknown[]).map(String).filter(Boolean)
          : [];

    let activities: Activity[] = [];
    if (selectedActivityIds.length > 0) {
      const { data: activityRows, error: activityError } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .in("id", selectedActivityIds);

      if (activityError) throw new Error(activityError.message);

      const activityMap = new Map((activityRows ?? []).map((activity) => [activity.id, activity as Activity]));
      activities = selectedActivityIds
        .map((activityId) => activityMap.get(activityId))
        .filter((activity): activity is Activity => Boolean(activity));
    }

    const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
    const hydratedDocument = document
      ? {
          ...document,
          projects: document.projects.map((project) => {
            const activity = activityMap.get(project.activityId);
            return {
              ...project,
              sourceActivity:
                project.sourceActivity ??
                (activity
                  ? {
                      id: activity.id,
                      title: activity.title,
                      type: activity.type,
                      period: activity.period,
                      role: activity.my_role ?? activity.role,
                      skills: activity.skills ?? [],
                    }
                  : null),
              portfolio: attachActivityImagesToPortfolio(project.portfolio, activity),
            };
          }),
        }
      : null;

    const resolvedDocument =
      hydratedDocument && hydratedDocument.imagePlacements.length === 0
        ? {
            ...hydratedDocument,
            imagePlacements: buildDefaultPortfolioImagePlacements(hydratedDocument.projects),
          }
        : hydratedDocument;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("name, avatar_url, email, phone, self_intro, skills")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    return apiOk<PortfolioExportResponse>({
      portfolio: {
        id: portfolioRow.id,
        title: portfolioRow.title,
        sourceActivityId: portfolioRow.source_activity_id ?? null,
        selectedActivityIds,
        portfolio: portfolioRow.portfolio_payload,
        createdAt: portfolioRow.created_at,
        updatedAt: portfolioRow.updated_at,
      },
      document: resolvedDocument,
      activities,
      profile: profileData ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "포트폴리오 PDF 데이터 로딩에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
