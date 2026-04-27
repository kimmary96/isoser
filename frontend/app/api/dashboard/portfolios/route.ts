import { apiError, apiOk } from "@/lib/api/route-response";
import { normalizePortfolioDocumentPayload } from "@/lib/portfolio-document";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PortfolioConversionResponse, PortfolioDocumentPayload } from "@/lib/types";

type PortfolioRow = {
  id: string;
  title: string;
  source_activity_id?: string | null;
  selected_activity_ids?: string[] | null;
  portfolio_payload: PortfolioConversionResponse | PortfolioDocumentPayload | null;
  created_at: string;
  updated_at: string;
};

type PortfolioInsert = {
  user_id: string;
  title: string;
  description: string | null;
  template_id: string;
  selected_activity_ids?: string[];
  source_activity_id?: string | null;
  portfolio_payload: PortfolioConversionResponse | PortfolioDocumentPayload;
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

function selectedIdsFromRow(row: PortfolioRow) {
  if (Array.isArray(row.selected_activity_ids) && row.selected_activity_ids.length > 0) {
    return row.selected_activity_ids;
  }
  const document = normalizePortfolioDocumentPayload(row.portfolio_payload, {
    fallbackTitle: row.title,
  });
  return document?.selectedActivityIds ?? [];
}

async function insertPortfolioWithFallback(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  payload: PortfolioInsert
) {
  const nextPayload: PortfolioInsert = { ...payload };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await supabase.from("portfolios").insert(nextPayload).select("id").single();

    if (!result.error || result.data) return result;

    if (isMissingColumnError(result.error, "selected_activity_ids") && "selected_activity_ids" in nextPayload) {
      delete nextPayload.selected_activity_ids;
      continue;
    }

    if (isMissingColumnError(result.error, "source_activity_id") && "source_activity_id" in nextPayload) {
      delete nextPayload.source_activity_id;
      continue;
    }

    return result;
  }

  return supabase.from("portfolios").insert(nextPayload).select("id").single();
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

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    const initialResult = await supabase
      .from("portfolios")
      .select("id, title, source_activity_id, selected_activity_ids, portfolio_payload, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    let data = initialResult.data as PortfolioRow[] | null;
    let error = initialResult.error;

    if (error && isMissingColumnError(error, "selected_activity_ids")) {
      const fallback = await supabase
        .from("portfolios")
        .select("id, title, source_activity_id, portfolio_payload, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      data = fallback.data as PortfolioRow[] | null;
      error = fallback.error;
    }

    if (error && isMissingColumnError(error, "source_activity_id")) {
      const fallback = await supabase
        .from("portfolios")
        .select("id, title, portfolio_payload, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      data = fallback.data as PortfolioRow[] | null;
      error = fallback.error;
    }

    if (error) throw new Error(error.message);

    return apiOk({
      portfolios: (data ?? []).map((portfolio) => ({
        id: portfolio.id,
        title: portfolio.title,
        sourceActivityId: portfolio.source_activity_id ?? null,
        selectedActivityIds: selectedIdsFromRow(portfolio),
        portfolio: portfolio.portfolio_payload,
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
      selectedActivityIds?: string[] | null;
      portfolio?: PortfolioConversionResponse | PortfolioDocumentPayload | null;
    };

    const portfolio = body.portfolio;
    const documentPayload = normalizePortfolioDocumentPayload(portfolio, {
      fallbackTitle: body.title,
    });
    const selectedActivityIds = Array.isArray(body.selectedActivityIds)
      ? body.selectedActivityIds.filter(Boolean)
      : documentPayload?.selectedActivityIds ?? [];
    const legacyPortfolio = portfolio as PortfolioConversionResponse | null | undefined;
    const title =
      body.title?.trim() ||
      documentPayload?.title?.trim() ||
      legacyPortfolio?.project_overview?.title?.trim();
    const sourceActivityId =
      body.sourceActivityId || selectedActivityIds[0] || legacyPortfolio?.activity_id || null;

    if (!title || !portfolio || !sourceActivityId) {
      return apiError("포트폴리오 저장 요청이 올바르지 않습니다.", 400, "BAD_REQUEST");
    }

    const insertPayload: PortfolioInsert = {
      user_id: user.id,
      title,
      description:
        documentPayload?.projects[0]?.portfolio.project_overview.summary ??
        legacyPortfolio?.project_overview?.summary ??
        null,
      template_id: documentPayload?.templateId ?? "simple",
      selected_activity_ids: selectedActivityIds.length > 0 ? selectedActivityIds : [sourceActivityId],
      source_activity_id: sourceActivityId,
      portfolio_payload: portfolio,
    };

    const insertResult = await insertPortfolioWithFallback(supabase, insertPayload);

    if (insertResult.error && isMissingColumnError(insertResult.error, "portfolio_payload")) {
      throw new Error("포트폴리오 저장 컬럼이 없습니다. Supabase portfolio_payload 마이그레이션 적용이 필요합니다.");
    }

    if (insertResult.error || !insertResult.data) {
      throw new Error(insertResult.error?.message ?? "포트폴리오 저장에 실패했습니다.");
    }

    return apiOk({ id: insertResult.data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "포트폴리오 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
